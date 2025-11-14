/* Fueltek v7.1 - script.js
   - Migración de IndexedDB a Firestore (Firebase)
   - Implementación de autenticación anónima y uso de __initial_auth_token
   - Uso de onSnapshot para escucha de datos en tiempo real
*/

// Variables globales de Firebase (inicializadas en index.html)
let firebaseApp, db, auth, appId, setDoc, doc, collection, query, onSnapshot, getDocs, deleteDoc, updateDoc, signInWithCustomToken, signInAnonymously;
let userId = null;
let currentLoadedOt = null; // OT cargada actualmente
let allOrders = []; // Array local para guardar las órdenes de la última instantánea de Firestore
let lastOtCorrelative = 0; // El último OT correlativo usado para la creación de nuevos OT

const OT_COLLECTION = "orders";
const OT_CORRELATIVE_DOC = "lastOt";
const DB_MESSAGE = document.getElementById('dbMessage');
const USER_DISPLAY = document.getElementById('userIdDisplay');
const MODAL_SPINNER = document.getElementById('modalSpinner');

// ====================================================================
// CONFIGURACIÓN DE FIREBASE Y AUTH
// ====================================================================

// Esta función se ejecuta después de que el script principal ha cargado los imports de Firebase
async function setupFirebase() {
  if (typeof window.firebase === 'undefined') {
    console.error("Firebase no está disponible. Asegúrate de que los imports en index.html se cargaron correctamente.");
    DB_MESSAGE.textContent = "Error: Firebase no inicializado.";
    return;
  }

  // Desestructuración de las variables y funciones de window.firebase
  ({
    app: firebaseApp, db, auth, appId, setDoc, doc, collection, query, onSnapshot, getDocs, deleteDoc, updateDoc, signInWithCustomToken, signInAnonymously
  } = window.firebase);

  DB_MESSAGE.textContent = "Autenticando...";
  
  try {
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    
    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
    } else {
      await signInAnonymously(auth);
    }

  } catch (error) {
    console.error("Error en autenticación:", error);
    DB_MESSAGE.textContent = "Error de autenticación. Funcionalidad de DB deshabilitada.";
    return;
  }
}

// Escucha el estado de autenticación para obtener el ID de usuario
function startAuthListener() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userId = user.uid;
      USER_DISPLAY.innerHTML = `**App ID:** ${appId}<br>**User ID:** ${userId}`;
      DB_MESSAGE.textContent = "Conectado. Esperando datos...";
      // Una vez autenticado, inicia la escucha de Firestore
      startFirestoreListeners(userId);
    } else {
      userId = null;
      USER_DISPLAY.innerHTML = `**App ID:** ${appId}<br>**User ID:** (Anónimo/Desconectado)`;
      DB_MESSAGE.textContent = "Sesión cerrada. No se puede acceder a la base de datos.";
    }
  });
}

// ====================================================================
// FIREBASE FIRESTORE OPERATIONS
// ====================================================================

// Obtiene la referencia a la colección de órdenes privadas del usuario
function getOrdersCollectionRef(uid) {
  // Path: /artifacts/{appId}/users/{userId}/orders
  return collection(db, 'artifacts', appId, 'users', uid, OT_COLLECTION);
}

// Obtiene la referencia al documento correlativo
function getCorrelativeDocRef(uid) {
  // Path: /artifacts/{appId}/users/{userId}/correlatives/lastOt
  return doc(db, 'artifacts', appId, 'users', uid, 'correlatives', OT_CORRELATIVE_DOC);
}

// 1. ESCUCHA EN TIEMPO REAL (onSnapshot)
function startFirestoreListeners(uid) {
  const ordersRef = getOrdersCollectionRef(uid);
  const correlativeRef = getCorrelativeDocRef(uid);

  // Escuchar cambios en el Correlativo
  onSnapshot(correlativeRef, (docSnap) => {
    if (docSnap.exists()) {
      lastOtCorrelative = docSnap.data().value || 0;
    } else {
      lastOtCorrelative = 0; // Inicializar si no existe
    }
    console.log("Correlativo actualizado:", lastOtCorrelative);
    updateOtDisplay(); // Actualizar N° OT en la UI
  }, (error) => {
    console.error("Error al escuchar correlativo:", error);
    DB_MESSAGE.textContent = "Error al obtener correlativo.";
  });

  // Escuchar cambios en la Colección de Órdenes
  // Nota: Firestore no tiene un 'orderBy' simple para el campo 'ot' que es un String,
  // por lo que se omite el `orderBy` en la query para evitar errores de índice.
  // La data se ordenará localmente si es necesario.
  const q = query(ordersRef); 
  
  onSnapshot(q, (snapshot) => {
    allOrders = [];
    snapshot.forEach((doc) => {
      // Agregar el ID del documento (que es el número OT) y los datos
      const order = { id: doc.id, ...doc.data() };
      allOrders.push(order);
    });

    // Ordenar localmente por N° OT (descendente)
    allOrders.sort((a, b) => Number(b.id) - Number(a.id));

    console.log("Órdenes actualizadas:", allOrders.length);
    DB_MESSAGE.textContent = `Conectado y sincronizado. ${allOrders.length} órdenes.`;
    
    // Si el modal está abierto, actualizar la lista
    if (!document.getElementById('modal').classList.contains('hidden')) {
      renderOrdersList(allOrders);
    }
  }, (error) => {
    console.error("Error al escuchar órdenes:", error);
    DB_MESSAGE.textContent = "Error al sincronizar órdenes.";
  });
}

// 2. OBTENER NUEVO N° OT (Correlativo)
async function getNewOtNumber() {
  // Se obtiene de la variable 'lastOtCorrelative' que se mantiene sincronizada con onSnapshot
  return lastOtCorrelative + 1;
}

// 3. GUARDAR/ACTUALIZAR ORDEN (SetDoc)
async function saveOrder(orderData, otNumber) {
  if (!userId) {
    console.error("Usuario no autenticado para guardar.");
    showCustomAlert("Error de autenticación. No se pudo guardar la OT.");
    return;
  }

  const otId = String(otNumber);
  const ordersRef = getOrdersCollectionRef(userId);
  const orderDocRef = doc(ordersRef, otId);
  const correlativeRef = getCorrelativeDocRef(userId);

  try {
    // 1. Guardar o Actualizar el documento de la Orden
    await setDoc(orderDocRef, {
      ...orderData,
      // Usar timestamp para ordenar si es necesario y para saber cuándo se guardó por última vez
      lastUpdated: new Date().toISOString(),
      otNumber: otId // Guardar el número OT como campo dentro del documento también
    });

    // 2. Actualizar el Correlativo solo si estamos guardando una OT nueva o una superior
    if (Number(otId) > lastOtCorrelative) {
      await setDoc(correlativeRef, { value: Number(otId) }, { merge: true });
      lastOtCorrelative = Number(otId); // Actualizar inmediatamente el estado local
    }

    showCustomAlert(`OT N° ${otId} guardada y sincronizada correctamente.`);
    currentLoadedOt = otId; // Mantener la OT cargada
    return true;

  } catch (e) {
    console.error("Error al guardar la orden: ", e);
    showCustomAlert("Error al guardar la OT en Firebase.");
    return false;
  }
}

// 4. ELIMINAR ORDEN (DeleteDoc)
async function deleteOrder(otId) {
  if (!userId) {
    showCustomAlert("Error de autenticación. No se pudo eliminar la OT.");
    return false;
  }

  const orderDocRef = doc(getOrdersCollectionRef(userId), String(otId));

  try {
    await deleteDoc(orderDocRef);
    showCustomAlert(`OT N° ${otId} eliminada correctamente.`);
    return true;
  } catch (e) {
    console.error("Error al eliminar la orden: ", e);
    showCustomAlert("Error al eliminar la OT en Firebase.");
    return false;
  }
}


// ====================================================================
// UTILIDADES DE FORMATO CLP
// ====================================================================

// Formatea un número (ej. 15000) a string con separador de miles (ej. 15.000)
function formatCLP(num) {
  if (num === null || num === undefined) return "0";
  const n = String(num).replace(/[^\\d]/g, ''); // Limpia no dígitos
  if (n === "") return "";
  return new Intl.NumberFormat('es-CL').format(Number(n));
}

// Desformatea un string (ej. 15.000) a un número entero (ej. 15000)
function unformatCLP(str) {
  if (str === null || str === undefined) return 0;
  const cleaned = String(str).replace(/[^\\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

// Handler para aplicar formato al teclear (input event)
function handleFormatOnInput(e) {
  const input = e.target;
  const rawValue = unformatCLP(input.value);
  input.value = formatCLP(rawValue);
  calculateTotal();
}

// ====================================================================
// LÓGICA DE CÁLCULO
// ====================================================================

function calculateTotal() {
  const manoObra = unformatCLP(document.getElementById('montoManoObraInput').value);
  const repuestos = unformatCLP(document.getElementById('montoRepuestosInput').value);
  const otros = unformatCLP(document.getElementById('montoOtrosInput').value);
  const abonado = unformatCLP(document.getElementById('montoAbonadoInput').value);

  const totalNeto = manoObra + repuestos + otros;
  const iva = Math.round(totalNeto * 0.19);
  const totalServicio = totalNeto + iva;
  const saldoPendiente = totalServicio - abonado;

  document.getElementById('totalNetoDisplay').value = formatCLP(totalNeto);
  document.getElementById('ivaDisplay').value = formatCLP(iva);
  document.getElementById('totalServicioDisplay').value = formatCLP(totalServicio);

  // También se podría mostrar el saldo pendiente si se desea
  // document.getElementById('saldoPendienteDisplay').value = formatCLP(saldoPendiente);
}


// ====================================================================
// MANEJO DEL FORMULARIO Y DATOS
// ====================================================================

// Convierte los datos del formulario a un objeto plano
function getFormData() {
  const form = document.getElementById('otForm');
  const formData = new FormData(form);
  const data = {};

  for (let [key, value] of formData.entries()) {
    // Para los montos, desformatear a número antes de guardar
    if (key.startsWith('monto')) {
      data[key] = unformatCLP(value);
    } else {
      data[key] = value.trim();
    }
  }

  // Agregar los totales calculados al objeto de datos
  data.totalNeto = unformatCLP(document.getElementById('totalNetoDisplay').value);
  data.iva = unformatCLP(document.getElementById('ivaDisplay').value);
  data.totalServicio = unformatCLP(document.getElementById('totalServicioDisplay').value);

  return data;
}

// Carga datos en el formulario
function loadFormData(data) {
  const form = document.getElementById('otForm');
  for (const key in data) {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      if (key.startsWith('monto')) {
        // Formatear CLP antes de cargar en el input
        input.value = formatCLP(data[key]);
      } else {
        input.value = data[key];
      }
    }
  }

  // Cargar el N° OT y actualizar el estado
  const otNumber = data.otNumber || data.id;
  document.getElementById('otNumber').value = otNumber;
  currentLoadedOt = otNumber;
  calculateTotal();
}

// Limpia el formulario y prepara para una nueva OT
async function clearForm() {
  document.getElementById('otForm').reset();
  const newOtNumber = await getNewOtNumber();
  document.getElementById('otNumber').value = String(newOtNumber);
  currentLoadedOt = null;
  calculateTotal(); // Inicializa los montos a 0 formateados
  document.getElementById('fechaRecepcionInput').valueAsDate = new Date(); // Establecer fecha actual
}

// ------------------------------------
// MANEJO DE CORRELATIVO
// ------------------------------------

// Actualiza la visualización del N° OT
function updateOtDisplay() {
  const otInput = document.getElementById('otNumber');
  // Si no hay una OT cargada, muestra el correlativo siguiente
  if (!currentLoadedOt) {
    otInput.value = lastOtCorrelative ? String(lastOtCorrelative + 1) : "1";
  } else {
    // Si hay una OT cargada, mantiene su valor
    otInput.value = currentLoadedOt;
  }
}

// ====================================================================
// MANEJO DEL MODAL Y LISTA DE ÓRDENES
// ====================================================================

function renderOrdersList(orders) {
  const ordersList = document.getElementById('ordersList');
  ordersList.innerHTML = '';
  MODAL_SPINNER.style.display = 'none';

  if (orders.length === 0) {
    ordersList.innerHTML = '<p class="text-center">No hay órdenes guardadas en la base de datos.</p>';
    return;
  }

  // Se asume que 'orders' ya viene ordenado descendentemente por OT
  orders.forEach(order => {
    const otId = order.id;
    const orderRow = document.createElement('div');
    orderRow.className = 'order-row';
    orderRow.innerHTML = `
      <div>
        <strong>OT N° ${otId}</strong> - ${order.clienteNombre}
        <br>
        <small>Equipo: ${order.equipoMarca} ${order.equipoModelo || ''} | Estado: ${order.estadoServicio}</small>
      </div>
      <div class="order-actions">
        <button data-ot="${otId}" data-action="load" class="small">Cargar</button>
        <button data-ot="${otId}" data-action="delete" class="small danger-btn">Eliminar</button>
      </div>
    `;
    ordersList.appendChild(orderRow);
  });
}

function handleOrderAction(e) {
  const button = e.target.closest('button');
  if (!button) return;

  const otId = button.getAttribute('data-ot');
  const action = button.getAttribute('data-action');

  if (action === 'load') {
    // Buscar la orden en el array local
    const orderToLoad = allOrders.find(o => o.id === otId);
    if (orderToLoad) {
      loadFormData(orderToLoad);
      closeModal();
    }
  } else if (action === 'delete') {
    // Usar la alerta personalizada en lugar de window.confirm
    showCustomConfirm(`¿Está seguro que desea eliminar la OT N° ${otId}?`, async () => {
      MODAL_SPINNER.style.display = 'block'; // Mostrar spinner mientras se elimina
      await deleteOrder(otId);
      // onSnapshot se encargará de actualizar la lista automáticamente
      MODAL_SPINNER.style.display = 'none';
    });
  }
}

function openModal() {
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modal').setAttribute('aria-hidden', 'false');
  MODAL_SPINNER.style.display = 'block'; // Mostrar spinner al abrir
  // Llama a renderOrdersList con la data actual. onSnapshot actualizará si hay cambios.
  renderOrdersList(allOrders);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modal').setAttribute('aria-hidden', 'true');
}

// ------------------------------------
// BUSCADOR EN EL MODAL
// ------------------------------------
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  const filteredOrders = allOrders.filter(order =>
    order.id.includes(query) ||
    order.clienteNombre.toLowerCase().includes(query) ||
    order.equipoMarca.toLowerCase().includes(query)
  );
  renderOrdersList(filteredOrders);
}


// ====================================================================
// UTILIDADES DE ALERTA/CONFIRMACIÓN (Reemplazo de alert/confirm)
// ====================================================================

function showCustomAlert(message) {
  // Simple implementación temporal: usar console.log o un div de feedback temporal en la UI
  console.log(`[ALERTA]: ${message}`);
  DB_MESSAGE.textContent = message;
  setTimeout(() => DB_MESSAGE.textContent = `Conectado y sincronizado. ${allOrders.length} órdenes.`, 3000);
}

function showCustomConfirm(message, callback) {
  // Reemplazar window.confirm por un modal o una lógica de UI
  if (window.confirm(message)) {
      callback();
  }
}

// ====================================================================
// EXPORTACIÓN A JSON (Simplificado)
// ====================================================================

function exportOrdersToJson() {
  if (allOrders.length === 0) {
    showCustomAlert("No hay órdenes para exportar.");
    return;
  }
  
  const json = JSON.stringify(allOrders.map(order => ({ ...order, id: undefined })), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fueltek_ordenes_exportadas_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showCustomAlert(`Exportadas ${allOrders.length} órdenes a JSON.`);
}

// ====================================================================
// INICIALIZACIÓN Y EVENT LISTENERS
// ====================================================================

function setupEventListeners() {
  const otForm = document.getElementById('otForm');
  const clpInputs = document.querySelectorAll('.clp-input');

  // Listeners para formato CLP
  clpInputs.forEach(input => {
    input.addEventListener('input', handleFormatOnInput);
    input.addEventListener('focus', (e) => e.target.select());
    // Inicializar el formato al cargar (si tienen valor por defecto, como '0')
    if (input.value) input.value = formatCLP(unformatCLP(input.value));
  });

  // Listener principal de Guardar OT
  document.getElementById('saveBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (otForm.checkValidity()) {
      const otNumber = document.getElementById('otNumber').value;
      const orderData = getFormData();
      await saveOrder(orderData, otNumber);
    } else {
      otForm.reportValidity(); // Mostrar errores de validación nativos
    }
  });

  // Otros botones
  document.getElementById('newOtBtn').addEventListener('click', clearForm);
  document.getElementById('clearBtn').addEventListener('click', clearForm);
  document.getElementById('viewOrdersBtn').addEventListener('click', openModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('ordersList').addEventListener('click', handleOrderAction);
  document.getElementById('searchOt').addEventListener('input', handleSearch);
  document.getElementById('exportBtn').addEventListener('click', exportOrdersToJson);
  
  // Imprimir (La función printOrder se deja simplificada)
  document.getElementById('printBtn').addEventListener('click', printOrder);

  // Inicializar el formulario con la fecha actual y el primer OT
  document.getElementById('fechaRecepcionInput').valueAsDate = new Date();
  
  // Configurar el comportamiento de 'Enter' en el formulario (evita submit)
  otForm.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  });
}

// ------------------------------------
// LÓGICA DE IMPRESIÓN (Simplificada/Reusada)
// ------------------------------------
function printOrder() {
  const otNumber = document.getElementById('otNumber').value;
  const form = document.getElementById('otForm');
  const printArea = document.getElementById('printArea');
  const formClone = form.cloneNode(true);

  // Transferir valores de inputs a elementos de texto estáticos para impresión
  const inputs = formClone.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    const value = input.value;
    const displayElement = document.createElement('span');
    displayElement.textContent = value;
    displayElement.className = 'print-value';
    input.parentNode.replaceChild(displayElement, input);
  });

  // Clonar y preparar la estructura de impresión
  const printContent = `
    <header class="print-header">
      <img src="logo-fueltek.png" alt="Fueltek Logo" class="logo" />
      <div class="header-info">
        <h1>FUELTEK</h1>
        <p>Servicio Técnico Multimarca</p>
        <small>Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</small>
      </div>
    </header>
    <div class="ot-bar print-ot-bar">
      <label>N° OT:</label>
      <span class="ot-number-print">${otNumber}</span>
    </div>
    ${formClone.innerHTML}
  `;

  printArea.innerHTML = printContent;
  
  // Estilos de impresión (CSS) se aplican automáticamente con el @media print
  window.print();
}

// Función de inicio
window.onload = async function() {
  await setupFirebase(); // Inicializa Firebase y autentica
  startAuthListener();    // Espera a que la autenticación finalice e inicia Firestore Listeners
  setupEventListeners();  // Configura todos los event listeners
  lucide.createIcons();   // Inicializa los íconos de Lucide
};
