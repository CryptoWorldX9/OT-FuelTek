/* Fueltek v8.0 - script.js
   - MIGRACIÓN COMPLETA a Firebase Firestore.
   - Se elimina toda la lógica de IndexedDB y localStorage.
   - Se utiliza onSnapshot para obtener datos en tiempo real.
   - Se usa el ID del documento de Firestore como el "N° OT".
   - El número de OT se genera encontrando el máximo OT actual.
*/

// Variables importadas del módulo de Firebase en index.html
let db;
let auth;
let appId;
let userId;

// Funciones de Firebase
let setDoc, doc, collection, deleteDoc, query, onSnapshot, getDocs, getDoc, where;

// Datos globales de la aplicación
let workOrders = []; // Array que contendrá los datos sincronizados de Firestore
let currentOtId = null; // ID de Firestore (N° OT) de la orden actualmente cargada

// Inicialización de Firebase/Auth y carga de la lógica principal
function initializeAppLogic() {
  if (!window.firebase || !window.firebase.db || !window.firebase.userId) {
    console.error("Firebase no está inicializado o la autenticación no ha finalizado.");
    setTimeout(initializeAppLogic, 100); // Reintentar
    return;
  }

  // Asignar variables y funciones de Firebase
  ({ db, auth, appId, setDoc, doc, collection, deleteDoc, query, onSnapshot, getDocs, getDoc, where } = window.firebase);
  userId = auth.currentUser?.uid || window.firebase.userId;
  
  // Iniciar la sincronización con Firestore
  setupFirestoreListener();

  // Inicializar UI y Event Listeners
  updateOtDisplay(getNewOtNumber());
  setupEventListeners();

  // Ocultar el indicador de carga si lo hubiera
  console.log("Aplicación inicializada y escuchando a Firestore. User ID:", userId);
}


// ====================================================================\
// UTILITIES (CLP FORMAT & UI MESSAGES)
// ====================================================================\

function formatCLP(num) {
  if (num === null || num === undefined) return "0";
  const n = String(num).replace(/[^\d]/g, '');
  if (n === "") return "";
  return new Intl.NumberFormat('es-CL').format(Number(n));
}

function unformatCLP(str) {
  if (str === null || str === undefined) return 0;
  const cleaned = String(str).replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function handleFormatOnInput(e) {
  const input = e.target;
  const value = input.value;
  const numericValue = unformatCLP(value);
  const formattedValue = formatCLP(numericValue);
  
  // Guardar el valor sin formato en un atributo data para fácil recuperación
  input.value = formattedValue;
  input.dataset.numericValue = numericValue;
}

function showMessage(message, type = 'success', duration = 4000) {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
    messageBox.classList.remove('hidden');

    // Ocultar después de la duración
    if (duration > 0) {
        setTimeout(() => {
            messageBox.classList.add('hidden');
        }, duration);
    }
}

// ====================================================================\
// FIREBASE FIRESTORE LOGIC
// ====================================================================\

// Obtiene la referencia a la colección privada de Órdenes de Trabajo del usuario
function getOrdersCollectionRef() {
    // Ruta: /artifacts/{appId}/users/{userId}/work_orders
    const path = `artifacts/${appId}/users/${userId}/work_orders`;
    return collection(db, path);
}

// Escucha en tiempo real los cambios en la colección
function setupFirestoreListener() {
    if (!db || !userId) {
        console.error("No se puede iniciar el listener, DB o UserID no están disponibles.");
        return;
    }

    const ordersCollectionRef = getOrdersCollectionRef();
    // Consulta: obtiene todas las órdenes. No se usa orderBy() para evitar errores de índices, se ordena en memoria.
    const q = query(ordersCollectionRef);

    // onSnapshot para la sincronización en tiempo real
    onSnapshot(q, (snapshot) => {
        workOrders = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // El OT ID (número) es el ID del documento. Lo guardamos como 'ot'
            workOrders.push({
                ...data,
                ot: doc.id
            });
        });

        // Ordenar en memoria por el número de OT de forma descendente
        workOrders.sort((a, b) => unformatCLP(b.ot) - unformatCLP(a.ot));
        
        // Si no hay ninguna OT cargada, asegurar que se muestre una nueva OT
        if (!currentOtId) {
            updateOtDisplay(getNewOtNumber());
        } else {
            // Si la OT actual fue eliminada o modificada, recargar
            if (!workOrders.find(o => o.ot === currentOtId)) {
                updateOtDisplay(getNewOtNumber());
            }
        }
        
        // Volver a renderizar la lista del modal
        renderOrdersList(workOrders);
        console.log(`Firestore: ${workOrders.length} órdenes sincronizadas.`);
    }, (error) => {
        console.error("Error al escuchar Firestore:", error);
        showMessage("Error de conexión con la base de datos.", 'danger', 0);
    });
}

// Guarda o actualiza una orden en Firestore
async function saveOrder(formData) {
    if (!db || !userId) {
        showMessage("Error: Sesión no lista para guardar.", 'danger');
        return;
    }

    const otToSave = formData.ot; // El OT actual es el ID del documento

    try {
        // Obtenemos la referencia al documento
        const docRef = doc(getOrdersCollectionRef(), otToSave);
        
        // Guardar los datos en el documento con el ID 'otToSave'
        await setDoc(docRef, formData);

        showMessage(`Orden de Trabajo N° ${otToSave} guardada exitosamente!`, 'success');
        
        // Forzar la actualización del display para el siguiente número de OT si es una OT nueva
        if (currentOtId !== otToSave) {
            currentOtId = otToSave;
            // Asegurarse de que el input de OT refleje el ID guardado
            document.getElementById('otNumber').value = otToSave;
        }

    } catch (error) {
        console.error("Error al guardar en Firestore:", error);
        showMessage("Error al guardar la orden: " + error.message, 'danger', 8000);
    }
}

// Carga una orden de la caché local sincronizada
function loadOrder(otId) {
    const order = workOrders.find(o => o.ot === otId);
    if (!order) {
        showMessage(`Error: Orden N° ${otId} no encontrada en la caché local.`, 'danger');
        return false;
    }
    
    // Limpiar formulario y cargar datos
    resetForm();
    currentOtId = otId;
    document.getElementById('otNumber').value = otId;
    
    // Cargar campos principales
    const form = document.getElementById('otForm');
    Object.keys(order).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && key !== 'items') {
            input.value = order[key];
        }
    });

    // Cargar items (requiere reconstruir el HTML)
    document.getElementById('itemsContainer').innerHTML = '';
    if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => addItemRow(item));
    }
    
    calculateTotals();
    showMessage(`Orden N° ${otId} cargada.`, 'primary');
    document.getElementById('modal').classList.add('hidden');
    return true;
}

// Elimina una orden de Firestore
async function deleteOrder(otId) {
    const isConfirmed = window.confirm(`¿Estás seguro de que quieres eliminar la Orden N° ${otId}? Esta acción es permanente.`);

    if (!isConfirmed) return;

    try {
        const docRef = doc(getOrdersCollectionRef(), otId);
        await deleteDoc(docRef);

        showMessage(`Orden N° ${otId} eliminada correctamente.`, 'danger');
        
        // Si la orden eliminada era la cargada, iniciar una nueva
        if (currentOtId === otId) {
            newOt();
        }

    } catch (error) {
        console.error("Error al eliminar en Firestore:", error);
        showMessage("Error al eliminar la orden: " + error.message, 'danger', 8000);
    }
}

// ====================================================================\
// OT MANAGEMENT & UI
// ====================================================================\

// Calcula el siguiente número de OT
function getNewOtNumber() {
    const maxOt = workOrders.reduce((max, order) => {
        const otNum = unformatCLP(order.ot);
        return otNum > max ? otNum : max;
    }, 0);
    // Retorna el máximo + 1 como string, forzando 4 dígitos si es necesario
    return String(maxOt + 1).padStart(4, '0');
}

// Actualiza el display del N° OT
function updateOtDisplay(otId) {
    document.getElementById('otNumber').value = otId;
    currentOtId = otId;
}

// Inicia una nueva OT
function newOt() {
    resetForm();
    updateOtDisplay(getNewOtNumber());
    showMessage("Formulario limpiado. Nueva OT lista.", 'primary');
}

// Resetea el formulario
function resetForm() {
    document.getElementById('otForm').reset();
    document.getElementById('itemsContainer').innerHTML = '';
    addItemRow(); // Añadir un item por defecto
    calculateTotals();
}

// ====================================================================\
// ITEM MANAGEMENT (Repuestos/Servicios)
// ====================================================================\

// Crea y añade una fila de item al formulario
function addItemRow(data = {}) {
    const container = document.getElementById('itemsContainer');
    const index = container.children.length;

    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <input name="item_desc_${index}" placeholder="Descripción (Repuesto/Servicio)" value="${data.desc || ''}" class="desc-input" required>
        <input name="item_qty_${index}" placeholder="Qty" type="number" inputmode="numeric" value="${data.qty || '1'}" min="1" required class="qty-input">
        <input name="item_price_${index}" placeholder="Precio Unitario" type="text" inputmode="numeric" value="${formatCLP(data.price || 0)}" required class="price-input">
        <span class="total-item">Total: $${formatCLP(data.total || (data.qty || 1) * unformatCLP(data.price || 0))}</span>
        <button type="button" class="delete-item-btn"><i data-lucide="x"></i></button>
    `;
    
    // Inicializar iconos de lucide
    lucide.createIcons();

    // Event listeners para la fila
    const priceInput = row.querySelector(`.price-input`);
    const qtyInput = row.querySelector(`.qty-input`);
    const deleteBtn = row.querySelector('.delete-item-btn');

    priceInput.addEventListener('input', (e) => {
        handleFormatOnInput(e);
        calculateTotals();
    });
    qtyInput.addEventListener('input', calculateTotals);
    deleteBtn.addEventListener('click', () => {
        if (container.children.length > 1) {
            row.remove();
            calculateTotals();
        } else {
            showMessage("Debe haber al menos un item.", 'primary');
        }
    });

    container.appendChild(row);
    calculateTotals(); // Recalcular al añadir
}

// Calcula Subtotal, IVA y Total
function calculateTotals() {
    const container = document.getElementById('itemsContainer');
    let subtotal = 0;
    const itemRows = Array.from(container.querySelectorAll('.item-row'));

    itemRows.forEach(row => {
        const qty = parseInt(row.querySelector('.qty-input').value) || 0;
        const price = unformatCLP(row.querySelector('.price-input').value);
        const itemTotal = qty * price;
        
        row.querySelector('.total-item').textContent = `Total: $${formatCLP(itemTotal)}`;
        subtotal += itemTotal;
    });

    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;

    document.getElementById('subtotalInput').value = formatCLP(subtotal);
    document.getElementById('ivaInput').value = formatCLP(iva);
    document.getElementById('totalInput').value = formatCLP(total);
}

// ====================================================================\
// FORM SUBMISSION & DATA EXTRACTION
// ====================================================================\

function extractFormData() {
    const form = document.getElementById('otForm');
    const formData = {};

    // 1. Campos del formulario
    Array.from(form.elements).forEach(element => {
        if (element.name && element.name.startsWith('item_') === false) {
            if (element.id && element.id.endsWith('Input')) {
                // Para campos con formato CLP (Total, Abono, etc.), guardamos el valor numérico
                formData[element.name] = unformatCLP(element.value);
            } else {
                formData[element.name] = element.value.trim();
            }
        }
    });

    // 2. Número de OT
    formData.ot = document.getElementById('otNumber').value;

    // 3. Items
    formData.items = [];
    const itemRows = Array.from(document.getElementById('itemsContainer').querySelectorAll('.item-row'));
    
    itemRows.forEach((row, index) => {
        const descInput = row.querySelector(`.desc-input`);
        const qtyInput = row.querySelector(`.qty-input`);
        const priceInput = row.querySelector(`.price-input`);
        
        const price = unformatCLP(priceInput.value);
        const qty = parseInt(qtyInput.value) || 0;
        
        if (descInput.value.trim()) {
            formData.items.push({
                desc: descInput.value.trim(),
                qty: qty,
                price: price, // Valor numérico
                total: qty * price // Valor numérico
            });
        }
    });
    
    // 4. Metadata
    formData.date = new Date().toISOString().split('T')[0];
    formData.timestamp = Date.now();
    formData.userId = userId;

    return formData;
}

// Handler principal de guardado
function handleSave(e) {
    e.preventDefault();
    const form = document.getElementById('otForm');
    
    // Validación de campos mínimos (nombre cliente y problema)
    if (!form.nombreCliente.value.trim() || !form.problemaReportado.value.trim()) {
        showMessage("Por favor, complete el Nombre del Cliente y el Problema Reportado.", 'danger');
        return;
    }
    
    const formData = extractFormData();
    saveOrder(formData);
}

// ====================================================================\
// MODAL & LIST RENDERING
// ====================================================================\

function renderOrdersList(orders) {
    const list = document.getElementById('ordersList');
    const searchValue = document.getElementById('searchOt').value.toLowerCase();
    list.innerHTML = '';

    const filteredOrders = orders.filter(order => 
        order.ot.includes(searchValue) || 
        (order.nombreCliente && order.nombreCliente.toLowerCase().includes(searchValue))
    );

    if (filteredOrders.length === 0) {
        list.innerHTML = `<p class="text-center p-4">${searchValue ? 'No se encontraron resultados.' : 'No hay órdenes de trabajo guardadas.'}</p>`;
        return;
    }

    filteredOrders.forEach(order => {
        const row = document.createElement('div');
        row.className = 'order-row';
        
        // El OT es el ID del documento, siempre es un string
        const otId = String(order.ot); 

        row.innerHTML = `
            <div class="order-info">
                <b>OT N° ${otId}</b> - ${order.nombreCliente || 'Cliente sin nombre'}
                <small>${order.date || ''}</small>
            </div>
            <div class="order-actions">
                <button data-action="load" data-ot-id="${otId}">Cargar</button>
                <button data-action="print" data-ot-id="${otId}">Imprimir</button>
                <button data-action="delete" data-ot-id="${otId}" class="small danger">Eliminar</button>
            </div>
        `;
        
        row.querySelector('[data-action="load"]').addEventListener('click', () => loadOrder(otId));
        row.querySelector('[data-action="print"]').addEventListener('click', () => printOrder(order));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteOrder(otId));

        list.appendChild(row);
    });
}

function openModal() {
    document.getElementById('modal').classList.remove('hidden');
    // Renderizar la lista al abrir, ya que workOrders está sincronizado
    renderOrdersList(workOrders); 
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// ====================================================================\
// EXCEL EXPORT
// ====================================================================\

function exportToExcel() {
    if (workOrders.length === 0) {
        showMessage("No hay órdenes para exportar.", 'primary');
        return;
    }

    // 1. Aplanar los datos para que cada item de cada OT sea una fila separada (formato típico de Excel)
    const flatData = [];
    
    workOrders.forEach(order => {
        const base = {
            'N° OT': order.ot,
            'Fecha': order.date,
            'Nombre Cliente': order.nombreCliente,
            'Rut/ID': order.rutId,
            'Teléfono': order.telefono,
            'Email': order.email,
            'Tipo Equipo': order.tipoEquipo,
            'Marca/Modelo': order.marcaModelo,
            'N° Serie': order.nroSerie,
            'Problema Reportado': order.problemaReportado,
            'Subtotal': order.subtotal,
            'IVA': order.iva,
            'TOTAL': order.total,
            'Monto Abonado': order.montoAbonado,
        };

        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                flatData.push({
                    ...base,
                    'Item Descripción': item.desc,
                    'Item Cantidad': item.qty,
                    'Item Precio Unitario': item.price,
                    'Item Total': item.total,
                });
            });
        } else {
             // Incluir órdenes sin items
            flatData.push({
                ...base,
                'Item Descripción': 'N/A',
                'Item Cantidad': 0,
                'Item Precio Unitario': 0,
                'Item Total': 0,
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OrdenesDeTrabajo");

    XLSX.writeFile(workbook, "Fueltek_OT_Export.xlsx");
    showMessage("Datos exportados a Excel.", 'success');
}

// ====================================================================\
// PRINTING
// ====================================================================\

function printOrder(order) {
    const printArea = document.getElementById('printArea');
    
    const formattedOrder = { ...order };
    ['subtotal', 'iva', 'total', 'montoAbonado'].forEach(key => {
        formattedOrder[key] = formatCLP(order[key]);
    });
    
    if (formattedOrder.items) {
        formattedOrder.items = formattedOrder.items.map(item => ({
            ...item,
            price: formatCLP(item.price),
            total: formatCLP(item.total)
        }));
    }

    // Construir el HTML de impresión (similar al formulario pero con la data de la orden)
    printArea.innerHTML = `
        <!-- Contenido de impresión basado en la orden cargada/seleccionada -->
        <header>
            <img src="logo-fueltek.png" alt="Fueltek Logo" class="logo" />
            <div class="header-info">
                <h1>FUELTEK</h1>
                <p>Servicio Técnico Multimarca</p>
                <small>Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</small>
            </div>
        </header>

        <main>
            <div class="ot-bar">
                <div class="left">
                    <label class="ot-label">N° OT:</label>
                    <span id="printOtNumber">${formattedOrder.ot}</span>
                </div>
                <div class="right">
                    <small>Fecha: ${formattedOrder.date || new Date().toISOString().split('T')[0]}</small>
                </div>
            </div>

            <fieldset class="grid-2-col">
                <legend>Datos del Cliente</legend>
                <label>Nombre Cliente: <span>${formattedOrder.nombreCliente || '-'}</span></label>
                <label>Rut/ID: <span>${formattedOrder.rutId || '-'}</span></label>
                <label>Teléfono: <span>${formattedOrder.telefono || '-'}</span></label>
                <label>Email: <span>${formattedOrder.email || '-'}</span></label>
            </fieldset>

            <fieldset class="grid-2-col">
                <legend>Datos del Equipo</legend>
                <label>Tipo Equipo: <span>${formattedOrder.tipoEquipo || '-'}</span></label>
                <label>Marca/Modelo: <span>${formattedOrder.marcaModelo || '-'}</span></label>
                <label>Año: <span>${formattedOrder.año || '-'}</span></label>
                <label>N° Serie/VIN: <span>${formattedOrder.nroSerie || '-'}</span></label>
            </fieldset>

            <fieldset>
                <legend>Problema Reportado / Trabajos a Realizar</legend>
                <label>Descripción: <p>${formattedOrder.problemaReportado || '-'}</p></label>
            </fieldset>

            <fieldset class="print-items-table">
                <legend>Detalle de Repuestos, Servicios y Valores</legend>
                <table>
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th>Qty</th>
                            <th class="right">P. Unitario</th>
                            <th class="right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${formattedOrder.items && formattedOrder.items.length > 0 ? formattedOrder.items.map(item => `
                            <tr>
                                <td>${item.desc}</td>
                                <td>${item.qty}</td>
                                <td class="right">$${item.price}</td>
                                <td class="right">$${item.total}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4">Sin detalles.</td></tr>'}
                    </tbody>
                </table>

                <div class="total-bar">
                    <label>Subtotal: <span>$${formattedOrder.subtotal}</span></label>
                    <label>IVA (19%): <span>$${formattedOrder.iva}</span></label>
                    <label>TOTAL: <span>$${formattedOrder.total}</span></label>
                </div>

                <div class="abono-bar">
                    <label>Monto Abonado: <span>$${formattedOrder.montoAbonado}</span></label>
                </div>
            </fieldset>

            <div class="firmas">
                <div class="firma-box"><label>Firma Taller</label><span class="signature-line"></span></div>
                <div class="firma-box"><label>Firma Cliente</label><span class="signature-line"></span></div>
            </div>

            <section class="notas">
                <h4>Notas importantes</h4>
                <ul>
                    <li>Toda herramienta no retirada en 30 días podrá generar cobro por almacenamiento.</li>
                    <li>FuelTek no se responsabiliza por accesorios no declarados al momento de la recepción.</li>
                    <li>El cliente declara estar informado sobre los términos del servicio y autoriza la revisión del equipo.</li>
                </ul>
            </section>
        </main>
        <footer>
            <p>© 2025 FUELTEK</p>
        </footer>
    `;

    window.print();
}

// ====================================================================\
// EVENT LISTENERS
// ====================================================================\

function setupEventListeners() {
    // Buttons
    document.getElementById('saveOtBtn').addEventListener('click', handleSave);
    document.getElementById('newOtBtn').addEventListener('click', newOt);
    document.getElementById('addItemBtn').addEventListener('click', () => addItemRow());
    document.getElementById('openModalBtn').addEventListener('click', openModal);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('searchOt').addEventListener('input', () => renderOrdersList(workOrders));
    
    // Print Button (Imprime la OT actualmente cargada)
    document.getElementById('printOtBtn').addEventListener('click', () => {
        if (!currentOtId) {
            showMessage("Cargue o guarde una OT primero para poder imprimir.", 'primary');
            return;
        }
        const currentOrder = workOrders.find(o => o.ot === currentOtId);
        if (currentOrder) {
            printOrder(currentOrder);
        } else {
            showMessage("No se encontró la OT cargada para imprimir.", 'danger');
        }
    });

    // Mobile Menu
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        const menu = document.querySelector('.ot-bar .right');
        menu.classList.toggle('mobile-visible');
        document.getElementById('mobileMenuBtn').querySelector('i').setAttribute('data-lucide', menu.classList.contains('mobile-visible') ? 'x' : 'menu');
        lucide.createIcons();
    });

    // Calculate totals on price/qty input (for initial rows and updates)
    document.getElementById('otForm').addEventListener('input', (e) => {
        if (e.target.classList.contains('price-input')) {
            handleFormatOnInput(e);
            calculateTotals();
        } else if (e.target.classList.contains('qty-input')) {
            calculateTotals();
        }
    });
    
    // Formato de moneda para monto abonado
    document.getElementById('montoAbonadoInput').addEventListener('input', handleFormatOnInput);

    // Configuración inicial del formulario
    resetForm();
}


// Iniciar la lógica de la aplicación una vez que Firebase esté listo
document.addEventListener('DOMContentLoaded', initializeAppLogic);
