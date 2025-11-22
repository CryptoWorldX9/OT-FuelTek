/* Fueltek v7.5 - script.js
   
   CORRECCIÓN FINAL Y DEFINITIVA (2025-11-22):
   1. Se soluciona el problema de los botones y el correlativo OT invisible garantizando 
      que la asignación de TODAS las variables del DOM se ejecute solo dentro de la 
      función initialize(), que espera la carga completa del documento.
   2. Se mantiene la corrección del timbre PDF (`stamp-motosierra.png`).
*/

// =========================================================================================
// VARIABLES GLOBALES Y CÓDIGO DE INICIALIZACIÓN
// =========================================================================================

// Configuración inicial
const INITIAL_OT_NUMBER = 10724;
const LOCAL_STORAGE_KEY = 'lastOtNumber';

let currentOtNumber = INITIAL_OT_NUMBER;

// Obtener la referencia a la base de datos de Firestore
let firestore;
if (typeof firebase !== 'undefined') {
  try {
    if (typeof firebaseConfig !== 'undefined') {
      firebase.initializeApp(firebaseConfig);
      firestore = firebase.firestore();
    } else {
      console.warn("Firebase: La configuración 'firebaseConfig' no está definida.");
    }
  } catch (error) {
    console.warn("Firebase no se inicializó. Verifique firebaseConfig en index.html.", error);
  }
}

// Variables para elementos del DOM (Declaradas globalmente con 'let', asignadas en initialize())
let otNumberInput;
let form;
let saveBtn;
let printBtn;
let loadBtn;
let clearBtn;
let mobileMenuBtn;
let mobileMenu;
let printArea;
let modal;
let closeModalBtn;
let ordersListContainer;
let searchOtInput;
let exportBtn;

// =========================================================================================
// FUNCIONES PRINCIPALES
// =========================================================================================

function generateNewOtNumber() {
  const lastOt = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY));
  if (isNaN(lastOt) || lastOt < INITIAL_OT_NUMBER) {
    currentOtNumber = INITIAL_OT_NUMBER;
  } else {
    currentOtNumber = lastOt + 1;
  }
  // El correlativo se asigna solo si el elemento ya fue encontrado
  if (otNumberInput) {
    otNumberInput.value = currentOtNumber;
  }
}

function updateOtNumber(newOt) {
  if (newOt >= currentOtNumber) {
    localStorage.setItem(LOCAL_STORAGE_KEY, newOt);
    currentOtNumber = newOt;
  }
  if (otNumberInput) {
    otNumberInput.value = newOt;
  }
}

function clearForm() {
  if (form) {
    form.reset();
  }
  generateNewOtNumber();
  if (form) {
    form.dataset.editing = 'false';
    form.dataset.ot = currentOtNumber;
  }
}

function getFormData() {
  const otValue = otNumberInput ? parseInt(otNumberInput.value, 10) : currentOtNumber;

  const data = {
    ot: otValue,
    fecha: document.getElementById('fecha').value,
    cliente: document.getElementById('cliente').value.toUpperCase(),
    rut: document.getElementById('rut').value.toUpperCase(),
    telefono: document.getElementById('telefono').value,
    correo: document.getElementById('correo').value.toUpperCase(),
    marca: document.getElementById('marca').value.toUpperCase(),
    modelo: document.getElementById('modelo').value.toUpperCase(),
    patente: document.getElementById('patente').value.toUpperCase(),
    chasis: document.getElementById('chasis').value.toUpperCase(),
    motor: document.getElementById('motor').value.toUpperCase(),
    ano: document.getElementById('ano').value,
    horas: document.getElementById('horas').value,
    observacion: document.getElementById('observacion').value,
    diagnostico: document.getElementById('diagnostico').value,
    repuestos: document.getElementById('repuestos').value,
    trabajo: document.getElementById('trabajo').value,
    tecnico: document.getElementById('tecnico').value.toUpperCase(),
    fechaTermino: document.getElementById('fechaTermino').value,
    condiciones: [],
    entrega: document.getElementById('entrega').value.toUpperCase(),
    estado: 'ABIERTA',
    createdAt: new Date().toISOString(),
  };

  const checkboxes = document.querySelectorAll('input[name="condicion"]:checked');
  checkboxes.forEach(checkbox => {
    data.condiciones.push(checkbox.value);
  });

  return data;
}

function loadFormData(data) {
  if (form) {
    form.dataset.editing = 'true';
    form.dataset.ot = data.ot;
  }

  // Cargar datos en los campos
  if (otNumberInput) otNumberInput.value = data.ot;
  document.getElementById('fecha').value = data.fecha;
  document.getElementById('cliente').value = data.cliente;
  document.getElementById('rut').value = data.rut;
  document.getElementById('telefono').value = data.telefono;
  document.getElementById('correo').value = data.correo;
  document.getElementById('marca').value = data.marca;
  document.getElementById('modelo').value = data.modelo;
  document.getElementById('patente').value = data.patente;
  document.getElementById('chasis').value = data.chasis;
  document.getElementById('motor').value = data.motor;
  document.getElementById('ano').value = data.ano;
  document.getElementById('horas').value = data.horas;
  document.getElementById('observacion').value = data.observacion;
  document.getElementById('diagnostico').value = data.diagnostico;
  document.getElementById('repuestos').value = data.repuestos;
  document.getElementById('trabajo').value = data.trabajo;
  document.getElementById('tecnico').value = data.tecnico;
  document.getElementById('fechaTermino').value = data.fechaTermino;
  document.getElementById('entrega').value = data.entrega;

  // Limpiar y cargar checkboxes
  document.querySelectorAll('input[name="condicion"]').forEach(checkbox => {
    checkbox.checked = false;
  });

  if (data.condiciones && Array.isArray(data.condiciones)) {
    data.condiciones.forEach(condicion => {
      const checkbox = document.querySelector(`input[value="${condicion}"]`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }

  // Cerrar modal
  if (modal) {
    modal.classList.add('hidden');
  }

  // Mover al inicio de la página
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildPrintAndPrint(data) {
  if (!printArea) return;

  const condicionesHTML = (data.condiciones && data.condiciones.length > 0)
    ? data.condiciones.map(c => `<li>${c}</li>`).join('')
    : '<li>No se registraron condiciones al momento de la recepción.</li>';

  // === INICIO CORRECCIÓN TIMBRE (Ruta sin / inicial) ===
  const htmlContent = `
    <div class="ot-document">
      <header class="print-header">
        <img src="logo-fueltek.png" alt="Fueltek Logo" class="print-logo" />
        <div class="print-header-info">
          <h1>ORDEN DE TRABAJO N° ${data.ot}</h1>
          <p>Servicio Técnico Multimarca</p>
          <small>Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</small>
        </div>
      </header>
      <section class="section-box print-client-info">
        <div class="column-group">
          <p><strong>Fecha Ingreso:</strong> ${data.fecha}</p>
          <p><strong>Cliente:</strong> ${data.cliente}</p>
          <p><strong>RUT:</strong> ${data.rut}</p>
          <p><strong>Teléfono:</strong> ${data.telefono}</p>
          <p><strong>Correo:</strong> ${data.correo}</p>
        </div>
        <div class="column-group">
          <p><strong>Marca:</strong> ${data.marca}</p>
          <p><strong>Modelo:</strong> ${data.modelo}</p>
          <p><strong>Patente:</strong> ${data.patente}</p>
          <p><strong>Horas/KM:</strong> ${data.horas}</p>
          <p><strong>Año:</strong> ${data.ano}</p>
        </div>
      </section>

      <section class="section-box">
        <h2>Observación del Cliente / Síntoma</h2>
        <p>${data.observacion || 'Sin información.'}</p>
      </section>

      <section class="section-box">
        <h2>Condiciones de Recepción del Equipo</h2>
        <ul class="print-conditions">
          ${condicionesHTML}
        </ul>
      </section>

      <section class="section-box">
        <h2>Diagnóstico Técnico</h2>
        <p class="print-multiline">${data.diagnostico || 'Pendiente de diagnóstico.'}</p>
      </section>

      <section class="section-box">
        <h2>Trabajo Realizado / Servicios</h2>
        <p class="print-multiline">${data.trabajo || 'Pendiente de trabajo realizado.'}</p>
      </section>

      <section class="section-box">
        <h2>Repuestos Utilizados</h2>
        <p class="print-multiline">${data.repuestos || 'Pendiente de repuestos.'}</p>
      </section>

      <div class="signature-section">
        <div class="signature-column">
          <div class="signature-line"></div>
          <p><strong>FIRMA CLIENTE</strong><br>Recibo conforme.</p>
        </div>

        <div class="signature-column workshop-signature">
          <div class="signature-line"></div>
          <p><strong>FIRMA TALLER / TÉCNICO: ${data.tecnico}</strong><br>Entrega de equipo.</p>
          <div class="workshop-stamp">
            <img src="stamp-motosierra.png" alt="Sello de Taller" style="width:150px;height:auto;position:absolute;top:-70px;left:50%;transform:translateX(-50%);opacity:0.9;">
          </div>
        </div>
      </div>

      <div class="print-notes">
        <p><strong>Fecha Estimada de Término:</strong> ${data.fechaTermino || 'No especificada.'}</p>
        <p><strong>Persona que Retira:</strong> ${data.entrega || 'Cliente titular.'}</p>
        <p class="note-disclaimer">NOTA: Este documento no es un presupuesto. La recepción de su equipo solo confirma su ingreso a taller. Todo repuesto y/o trabajo es validado por el cliente antes de ser ejecutado. El equipo debe ser retirado en un plazo máximo de 60 días una vez notificada la entrega, de lo contrario se cobrará almacenaje diario. El taller no se hace responsable por daños o pérdidas una vez el equipo esté fuera de sus instalaciones.</p>
      </div>

    </div>
  `;
  // === FIN CORRECCIÓN TIMBRE ===

  printArea.innerHTML = htmlContent;
  window.print();
  printArea.innerHTML = ''; // Limpiar el área después de imprimir
}

function displayOrders(orders) {
  if (!ordersListContainer) return;

  ordersListContainer.innerHTML = '';
  if (orders.length === 0) {
    ordersListContainer.innerHTML = '<p style="text-align:center; padding: 20px;">No hay órdenes guardadas.</p>';
    return;
  }

  orders.sort((a, b) => b.ot - a.ot);

  orders.forEach(order => {
    const row = document.createElement('div');
    row.className = 'order-row';
    row.innerHTML = `
      <div>
        <b>OT N° ${order.ot}</b>
        <p>${order.cliente}</p>
        <small>Ingreso: ${order.fecha}</small>
      </div>
      <div class="order-actions">
        <button data-action="load" data-ot="${order.ot}">Cargar</button>
        <button data-action="print" data-ot="${order.ot}">Imprimir</button>
        <button data-action="delete" data-ot="${order.ot}">Eliminar</button>
      </div>
    `;
    ordersListContainer.appendChild(row);
  });
}

async function loadAndDisplayOrders() {
  try {
    const orders = await firebaseGetAllOrders();
    displayOrders(orders);
    return orders;
  } catch (e) {
    console.error("No se pudo cargar las órdenes de Firebase. Usando datos locales si aplica.", e);
    displayOrders([]);
    return [];
  }
}

// =========================================================================================
// GESTIÓN DE EVENTOS
// =========================================================================================

// Usamos DOMContentLoaded para garantizar que initialize() se ejecute después de cargar el HTML
if (document.readyState !== 'loading') {
  initialize();
} else {
  document.addEventListener('DOMContentLoaded', initialize);
}

function initialize() {
  // === PASO CRÍTICO: INICIALIZAR TODAS LAS VARIABLES DE DOM AQUÍ PARA GARANTIZAR QUE EXISTEN ===
  otNumberInput = document.getElementById('otNumber');
  form = document.getElementById('otForm');
  saveBtn = document.getElementById('saveOrder');
  printBtn = document.getElementById('printOrder');
  loadBtn = document.getElementById('loadOrders');
  clearBtn = document.getElementById('clearForm');
  mobileMenuBtn = document.getElementById('mobileMenuBtn');
  mobileMenu = document.getElementById('mobileMenu');
  printArea = document.getElementById('printArea');
  modal = document.getElementById('modal');
  closeModalBtn = document.getElementById('closeModal');
  ordersListContainer = document.getElementById('ordersList');
  searchOtInput = document.getElementById('searchOt');
  exportBtn = document.getElementById('exportOrders');
  // === FIN DE INICIALIZACIÓN DE VARIABLES DE DOM ===
  
  // Llama a lucide SOLO si está definida (previene fallos en la inicialización)
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
  }
  
  // Generar el número de OT (esto ahora funciona porque otNumberInput ya fue asignado)
  generateNewOtNumber();

  // ---------------------------------------------------------------------------------
  // Evento: Guardar Orden (SAVE)
  // ---------------------------------------------------------------------------------
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const data = getFormData();

        // 1. Guardar en Firebase
        await firebaseSaveOrder(data);

        // 2. Mostrar mensaje de éxito y limpiar formulario
        alert(`La Orden de Trabajo N° ${data.ot} ha sido guardada con éxito.`);
        updateOtNumber(data.ot + 1);
        clearForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } catch (error) {
        console.error("Error al guardar la OT:", error);
        alert("Hubo un error al guardar la Orden de Trabajo. Verifique la consola.");
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // Evento: Imprimir Orden (PRINT)
  // ---------------------------------------------------------------------------------
  if (printBtn) {
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const data = getFormData();
      buildPrintAndPrint(data);
    });
  }

  // ---------------------------------------------------------------------------------
  // Evento: Cargar Órdenes (LOAD MODAL)
  // ---------------------------------------------------------------------------------
  let allOrdersCache = [];

  if (loadBtn && modal) {
    loadBtn.addEventListener('click', async () => {
      try {
        allOrdersCache = await loadAndDisplayOrders();
        modal.classList.remove('hidden');
      } catch (e) {
        alert("Error al cargar las órdenes. Intente de nuevo.");
      }
    });
  }

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      if (searchOtInput) {
        searchOtInput.value = ''; // Limpiar búsqueda al cerrar
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // Evento: Búsqueda en el Modal
  // ---------------------------------------------------------------------------------
  if (searchOtInput) {
    searchOtInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filteredOrders = allOrdersCache.filter(order =>
        String(order.ot).includes(query) ||
        order.cliente.toLowerCase().includes(query)
      );
      displayOrders(filteredOrders);
    });
  }

  // ---------------------------------------------------------------------------------
  // Evento: Acciones de Fila (Cargar, Imprimir, Eliminar)
  // ---------------------------------------------------------------------------------
  if (ordersListContainer) {
    ordersListContainer.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const action = btn.dataset.action;
      const ot = parseInt(btn.dataset.ot, 10);

      const orderData = allOrdersCache.find(o => o.ot === ot);
      if (!orderData) {
        alert("No se encontró la orden solicitada.");
        return;
      }

      switch (action) {
        case 'load':
          loadFormData(orderData);
          break;
        case 'print':
          buildPrintAndPrint(orderData);
          break;
        case 'delete':
          if (confirm(`¿Está seguro de eliminar la OT N° ${ot}? Esta acción es irreversible.`)) {
            try {
              await firebaseDeleteOrder(ot);
              alert(`OT N° ${ot} eliminada con éxito.`);
              // Actualizar la lista en el modal y el cache
              allOrdersCache = await loadAndDisplayOrders();
              // Si la OT eliminada era la que estaba en el formulario, limpiar el formulario
              if (form && parseInt(form.dataset.ot, 10) === ot) {
                  clearForm();
              }
            } catch (error) {
              alert("Error al eliminar la OT. Verifique la consola.");
            }
          }
          break;
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // Evento: Limpiar Formulario (CLEAR)
  // ---------------------------------------------------------------------------------
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm("¿Está seguro de limpiar el formulario? Se perderán los datos no guardados.")) {
        clearForm();
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // Evento: Menú Móvil
  // ---------------------------------------------------------------------------------
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });

    // Cerrar menú si se hace click en una acción
    mobileMenu.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  }


  // ---------------------------------------------------------------------------------
  // Evento: Exportar a Excel (EXPORT)
  // ---------------------------------------------------------------------------------
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        try {
            const orders = await firebaseGetAllOrders();

            if (orders.length === 0) {
                alert("No hay órdenes para exportar.");
                return;
            }

            // Mapear los datos para el archivo Excel
            const dataToExport = orders.map(order => ({
                'OT N°': order.ot,
                'Fecha Ingreso': order.fecha,
                'Cliente': order.cliente,
                'RUT': order.rut,
                'Teléfono': order.telefono,
                'Correo': order.correo,
                'Marca': order.marca,
                'Modelo': order.modelo,
                'Patente': order.patente,
                'Chasis': order.chasis,
                'Motor': order.motor,
                'Año': order.ano,
                'Horas/KM': order.horas,
                'Observación Cliente': order.observacion,
                'Condiciones Recepción': order.condiciones.join(', '),
                'Diagnóstico Técnico': order.diagnostico,
                'Trabajo Realizado': order.trabajo,
                'Repuestos Utilizados': order.repuestos,
                'Técnico': order.tecnico,
                'Fecha Término Estimada': order.fechaTermino,
                'Persona que Retira': order.entrega,
                'Estado': order.estado,
                'Fecha Creación (Timestamp)': order.createdAt,
            }));

            // Generar el archivo Excel
            if (typeof XLSX === 'undefined') {
                throw new Error("La librería XLSX no está cargada. Revise index.html.");
            }
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Ordenes de Trabajo");

            const date = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(workbook, `OT_Fueltek_Export_${date}.xlsx`);
            alert(`Se han exportado ${orders.length} órdenes a Excel.`);

        } catch (e) {
            console.error("Error al exportar a Excel:", e);
            alert("Error al exportar los datos. Verifique la consola.");
        }
    });
  }


  // ---------------------------------------------------------------------------------
  // Inicialización de la fecha
  // ---------------------------------------------------------------------------------
  const fechaInput = document.getElementById('fecha');
  if (fechaInput) {
    if (!fechaInput.value) {
      fechaInput.value = new Date().toISOString().slice(0, 10);
    }
  }

}

// =========================================================================================
// FUNCIONES DE FIREBASE
// =========================================================================================

async function firebaseSaveOrder(order) {
  if (typeof firestore === 'undefined') return Promise.reject("Firestore no inicializado");
  try {
    const copy = Object.assign({}, order);
    await firestore.collection("orders").doc(String(order.ot)).set(copy);
    console.log("Firebase: OT guardada", order.ot);
    return true;
  } catch (error) {
    console.error("Firebase ERROR al guardar:", error);
    throw error;
  }
}

async function firebaseGetAllOrders() {
  if (typeof firestore === 'undefined') return Promise.reject("Firestore no inicializado");
  try {
    const snap = await firestore.collection("orders").get();
    return snap.docs.map(d => d.data());
  } catch (error) {
    console.error("Firebase ERROR al cargar:", error);
    throw error;
  }
}

async function firebaseGetOrder(ot) {
  if (typeof firestore === 'undefined') throw new Error("Firestore no inicializado");
  try {
    const doc = await firestore.collection("orders").doc(String(ot)).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error("Firebase ERROR al obtener OT:", error);
    throw error;
  }
}

async function firebaseDeleteOrder(ot) {
  if (typeof firestore === 'undefined') throw new Error("Firestore no inicializado");
  try {
    await firestore.collection("orders").doc(String(ot)).delete();
    console.log("Firebase: OT eliminada", ot);
    return true;
  } catch (error) {
    console.error("Firebase ERROR al eliminar:", error);
    throw error;
  }
}
