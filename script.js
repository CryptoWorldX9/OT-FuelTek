/* Fueltek v8.1 - script.js
   Mejora: Lógica de correlativo actualizada para usar transacciones de Firebase,
   evitando que el número salte si solo se pulsa "Nuevo OT" sin guardar.
   El correlativo solo se incrementa al GUARDAR exitosamente.
   
   CORRECCIÓN: Se modifica getFormData() para leer el N° OT directamente del input field
   al imprimir, resolviendo el error "El número de OT no es válido" al cargar OT antiguas.
*/

// --- VARIABLES GLOBALES ---
const form = document.getElementById('otForm');
const otNumberInput = document.getElementById('otNumber');
const viewBtn = document.getElementById('viewBtn');
const saveBtn = document.getElementById('saveBtn');
const newOtBtn = document.getElementById('newOtBtn');
const resetFormBtn = document.getElementById('resetFormBtn');
const printBtn = document.getElementById('printBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const exportDbBtn = document.getElementById('exportDbBtn');
const importFile = document.getElementById('importFile');
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('closeModal');
const ordersList = document.getElementById('ordersList');
const searchOt = document.getElementById('searchOt');
const estadoPagoSelect = document.getElementById('estadoPago');
const labelAbono = document.getElementById('labelAbono');
const syncCorrelativeBtn = document.getElementById('syncCorrelativeBtn'); // Nuevo botón

let currentCorrelative = 10725; // Número inicial por si falla la carga de Firebase

// IDs de correlativo para Firebase
const CORRELATIVE_DOC_ID = 'lastOtNumber'; 
const CORRELATIVE_COLLECTION = 'metadata';


// --- FUNCIONES DE MANEJO DE ESTADO ---

function resetForm() {
    form.reset();
    otNumberInput.value = '';
    currentCorrelative = null; 
    document.querySelector('.ot-box').classList.remove('editing-existing');
    document.getElementById('saveBtn').textContent = 'Guardar';
}

function loadOrderToForm(order) {
    resetForm();
    currentCorrelative = order.ot; // Se establece la variable global (Número)
    otNumberInput.value = order.ot; // Se establece el valor visible en el input (String)

    // Cargar campos básicos
    Object.keys(order).forEach(key => {
        const input = form.elements[key];
        if (!input) return;

        if (input.type === 'checkbox' || input.type === 'radio') {
            if (Array.isArray(input)) {
                input.forEach(i => i.checked = order[key].includes(i.value));
            } else {
                input.checked = order[key];
            }
        } else if (input.tagName === 'SELECT' || input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
            input.value = order[key] || '';
        }
    });

    // Manejar el campo de Abono
    estadoPagoSelect.value = order.estadoPago || 'Pendiente';
    toggleAbonoField();
    
    // Indica visualmente que estamos editando una OT existente
    document.querySelector('.ot-box').classList.add('editing-existing');
    document.getElementById('saveBtn').textContent = 'Actualizar';
}

function getFormData() {
    const data = {};
    const elements = form.elements;
    
    // CORRECCIÓN: Leer el N° OT directamente del input field para máxima fiabilidad
    const otValue = otNumberInput.value.trim();
    const parsedOt = parseInt(otValue);
    // Incluye el número de OT actual (requerido), asegurando que sea un número válido
    data.ot = !isNaN(parsedOt) ? parsedOt : null; 
    
    // Asegura que la variable global de estado se actualice con el valor actual del formulario
    currentCorrelative = data.ot; 
    
    for (let i = 0; i < elements.length; i++) {
        const item = elements[i];
        if (!item.name) continue;

        if (item.type === 'checkbox') {
            if (!data[item.name]) {
                data[item.name] = [];
            }
            if (item.checked) {
                data[item.name].push(item.value);
            }
        } else if (item.tagName === 'SELECT' || item.tagName === 'INPUT' || item.tagName === 'TEXTAREA') {
            let value = item.value.trim();
            // Convertir valores monetarios/numéricos
            if (item.id === 'valorTrabajoInput' || item.id === 'montoAbonadoInput') {
                value = parseInt(value.replace(/\./g, '')) || 0; // Limpia puntos de miles
            }
            data[item.name] = value;
        }
    }
    
    // Asegurar que las fechas estén en formato YYYY-MM-DD para impresión
    data.fechaRecibida = form.elements.fechaRecibida.value || new Date().toISOString().split('T')[0];
    data.fechaEntrega = form.elements.fechaEntrega.value || '';
    
    return data;
}

function validateData(data) {
    if (!data.ot || data.ot < 1000) {
        // Este error era el que se disparaba si data.ot era null.
        alert("Error: El número de OT no es válido.");
        return false;
    }
    if (!data.clienteNombre || data.clienteNombre.length < 3) {
        alert("El Nombre del Cliente es obligatorio.");
        return false;
    }
    if (!data.marca || data.marca.length < 2) {
        alert("La Marca de la Herramienta es obligatoria.");
        return false;
    }
    if (data.estadoPago === 'Abonado' && data.montoAbonado <= 0) {
        alert("Debe ingresar un Monto Abonado válido.");
        return false;
    }
    return true;
}

function formatCurrency(input) {
    let value = input.value.replace(/\./g, '').replace(/[^0-9]/g, '');
    if (value) {
        input.value = parseInt(value).toLocaleString('es-CL');
    }
}

function toggleAbonoField() {
    if (estadoPagoSelect.value === 'Abonado') {
        labelAbono.classList.remove('hidden');
    } else {
        labelAbono.classList.add('hidden');
        document.getElementById('montoAbonadoInput').value = '';
    }
}


// --- LÓGICA DE FIREBASE ---

/**
 * Obtiene el último correlativo guardado en Firebase (sin incrementarlo).
 * Se usa al cargar la página o al hacer clic en "Nuevo OT".
 */
async function firebaseGetCurrentCorrelative() {
  if (typeof firestore === 'undefined') return Promise.reject("Firestore no inicializado");
  try {
    const docRef = firestore.collection(CORRELATIVE_COLLECTION).doc(CORRELATIVE_DOC_ID);
    const doc = await docRef.get();
    
    // Si el documento existe, devuelve el número. Si no, devuelve el valor inicial (10725).
    const lastOt = doc.exists ? doc.data().otNumber : 10725;
    console.log("Firebase: Último Correlativo disponible:", lastOt);
    return lastOt;
  } catch (error) {
    console.error("Firebase ERROR al obtener correlativo:", error);
    return 10725;
  }
}

/**
 * Sincroniza el correlativo: lo ajusta al máximo OT de la colección 'orders' + 1.
 */
async function firebaseSyncCorrelative() {
    if (typeof firestore === 'undefined') {
        alert("Firestore no inicializado.");
        return;
    }

    try {
        // 1. Encontrar el número máximo de OT guardado en la colección 'orders'
        let maxOtInOrders = 0;
        const snapshot = await firestore.collection("orders").orderBy("ot", "desc").limit(1).get();
        if (!snapshot.empty) {
            maxOtInOrders = snapshot.docs[0].data().ot;
        }

        // 2. Establecer el nuevo correlativo como el máximo encontrado + 1
        const newCorrelativeValue = maxOtInOrders + 1;

        // 3. Escribir el nuevo correlativo en la colección 'metadata' (Usando una transacción)
        const docRef = firestore.collection(CORRELATIVE_COLLECTION).doc(CORRELATIVE_DOC_ID);
        
        await firestore.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            
            // Solo actualiza si el valor en la DB es menor que el valor calculado.
            if (!doc.exists || doc.data().otNumber < newCorrelativeValue) {
                 transaction.set(docRef, { otNumber: newCorrelativeValue });
                 alert(`¡Correlativo resincronizado con éxito! Nuevo valor: ${newCorrelativeValue}`);
            } else {
                 alert(`Sincronización innecesaria. Valor actual en DB: ${doc.data().otNumber}`);
            }
        });
        
        // Actualizar la vista después de la sincronización
        otNumberInput.value = newCorrelativeValue;
        currentCorrelative = newCorrelativeValue;
    } catch (e) {
        console.error("Error en la sincronización:", e);
        alert("Error al sincronizar el correlativo. Revise la consola.");
    }
}

/**
 * Guarda o actualiza la orden. Usa una transacción si es una OT NUEVA.
 * Solo incrementa el correlativo si el guardado de la OT es exitoso.
 */
async function saveOrder(order) {
    const isNew = order.ot === currentCorrelative; 

    if (isNew) {
        return await firestore.runTransaction(async (transaction) => {
            const otDocRef = firestore.collection("orders").doc(String(order.ot));
            const correlativeRef = firestore.collection(CORRELATIVE_COLLECTION).doc(CORRELATIVE_DOC_ID);

            // 1. Verificar si el número de OT ya existe
            const otDoc = await transaction.get(otDocRef);
            if (otDoc.exists) {
                // Esto puede pasar si dos personas intentan guardar la misma OT al mismo tiempo.
                throw new Error("La OT con este número ya existe. Recargue y obtenga un nuevo número.");
            }

            // 2. Guardar la nueva OT
            transaction.set(otDocRef, order);

            // 3. Obtener el valor actual del correlativo para actualizarlo
            const correlativeDoc = await transaction.get(correlativeRef);
            let nextOt = order.ot + 1;
            
            // Si el documento correlativo existe y ya está más adelante, no lo rebajamos.
            if (correlativeDoc.exists && correlativeDoc.data().otNumber > order.ot) {
                 nextOt = correlativeDoc.data().otNumber + 1;
            }

            // 4. Incrementar y actualizar el correlativo SOLO si el guardado es exitoso
            transaction.set(correlativeRef, { otNumber: nextOt });
            
            return true; // Transacción exitosa
        });
    } else {
        // Lógica para actualizar una OT existente (no toca el correlativo)
        try {
            const copy = Object.assign({}, order);
            await firestore.collection("orders").doc(String(order.ot)).set(copy);
            return true;
        } catch (error) {
             console.error("Firebase ERROR al actualizar OT existente:", error);
             throw error;
        }
    }
}

async function firebaseGetAllOrders() {
  if (typeof firestore === 'undefined') return Promise.reject("Firestore no inicializado");
  try {
    const snap = await firestore.collection("orders").orderBy("ot", "desc").get();
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


// --- LÓGICA DE INTERFAZ (UI) ---

function displayOrders(orders, searchTerm = '') {
    ordersList.innerHTML = '';
    const filteredOrders = orders.filter(o => 
        String(o.ot).includes(searchTerm) || 
        (o.clienteNombre && o.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filteredOrders.length === 0) {
        ordersList.innerHTML = '<p style="text-align:center; color:#777;">No se encontraron órdenes.</p>';
        return;
    }

    filteredOrders.forEach(order => {
        const row = document.createElement('div');
        row.className = 'order-row';
        row.innerHTML = `
            <div><b>OT #${order.ot}</b> - ${order.clienteNombre} (${order.marca})</div>
            <div class="order-actions">
                <button data-action="load" data-ot="${order.ot}">Cargar</button>
                <button data-action="delete" class="small" data-ot="${order.ot}">Borrar</button>
            </div>
        `;
        ordersList.appendChild(row);
    });
}

function handleOrderAction(event) {
    const btn = event.target.closest('button');
    if (!btn) return;
    
    const ot = btn.dataset.ot;
    const action = btn.dataset.action;

    if (action === 'load') {
        firebaseGetOrder(ot).then(order => {
            if (order) {
                loadOrderToForm(order);
                modal.classList.add('hidden');
            } else {
                alert("Error: OT no encontrada.");
            }
        }).catch(err => alert("Error al cargar la orden: " + err.message));
    } else if (action === 'delete') {
        if (confirm(`¿Está seguro de borrar la OT #${ot}? Esta acción es irreversible.`)) {
            firebaseDeleteOrder(ot).then(() => {
                alert(`OT #${ot} eliminada con éxito.`);
                refreshOrdersList();
            }).catch(err => alert("Error al eliminar la orden: " + err.message));
        }
    }
}


// --- FUNCIONES DE EXPORTACIÓN / IMPRESIÓN ---

function createPrintableHTML(data) {
    const getFormattedValue = (value) => {
        if (typeof value === 'number' && (data.valorTrabajo === value || data.montoAbonado === value)) {
            return '$' + value.toLocaleString('es-CL');
        }
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        return value || 'N/A';
    };

    const isExisting = document.querySelector('.ot-box').classList.contains('editing-existing') ? ' (ACTUALIZADA)' : '';

    let html = `
        <style>
            .print-container { font-family: 'Inter', sans-serif; font-size: 9.5pt; max-width: 100%; margin: 0 auto; padding: 0; position: relative; }
            .print-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
            .print-header h2 { margin: 0; font-size: 14pt; color: #f26522; }
            .print-header h1 { margin: 0; font-size: 20pt; color: #0066cc; }
            .print-header small { display: block; font-size: 8pt; margin-top: 2px; }
            .ot-box-print { background: #f26522; color: white; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 16pt; }
            .section { border: 1px solid #ccc; border-radius: 5px; margin-bottom: 10px; padding: 8px 12px; }
            .section h3 { margin: 0 0 8px 0; font-size: 11pt; color: #2c3e50; border-bottom: 1px dashed #ccc; padding-bottom: 4px; }
            .grid-print { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px 10px; }
            .field-label { font-weight: bold; color: #555; font-size: 9pt; display: block; }
            .field-value { margin-top: 1px; font-size: 10pt; word-break: break-word; }
            .full-width { grid-column: 1 / -1; }
            .notes-section { border: 1px solid #0066cc; background: #e8f0f8; padding: 8px 12px; border-radius: 5px; margin-top: 10px; }
            .notes-section h4 { margin: 0 0 5px 0; color: #0066cc; font-size: 10pt; }
            .notes-section ul { padding-left: 15px; margin: 0; font-size: 8.5pt; }
            .firmas-print { display: flex; justify-content: space-around; margin-top: 30px; }
            .firma-box-print { width: 45%; text-align: center; border-top: 1px solid #000; padding-top: 5px; font-size: 9pt; }
            .firma-text { font-weight: bold; text-transform: uppercase; }
            .sello-print { position: absolute; bottom: 100px; right: 50px; opacity: 0.2; width: 150px; height: 150px; }
        </style>
        <div class="print-container">
            <div class="print-header">
                <div>
                    <h2>OT N°:</h2>
                    <div class="ot-box-print">${getFormattedValue(data.ot)} ${isExisting}</div>
                </div>
                <div style="text-align: right;">
                    <h1>FUELTEK</h1>
                    <small>Servicio Técnico Multimarca</small>
                    <small>Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</small>
                </div>
            </div>

            <div class="section">
                <h3>Datos del Cliente</h3>
                <div class="grid-print">
                    <div class="field"><span class="field-label">Nombre:</span><div class="field-value">${getFormattedValue(data.clienteNombre)}</div></div>
                    <div class="field"><span class="field-label">Teléfono:</span><div class="field-value">${getFormattedValue(data.clienteTelefono)}</div></div>
                    <div class="field"><span class="field-label">Email:</span><div class="field-value">${getFormattedValue(data.clienteEmail)}</div></div>
                    <div class="field"><span class="field-label">Fecha Recibida:</span><div class="field-value">${getFormattedValue(data.fechaRecibida)}</div></div>
                    <div class="field"><span class="field-label">Fecha Entrega:</span><div class="field-value">${getFormattedValue(data.fechaEntrega)}</div></div>
                </div>
            </div>

            <div class="section">
                <h3>Datos de la Herramienta</h3>
                <div class="grid-print">
                    <div class="field"><span class="field-label">Marca:</span><div class="field-value">${getFormattedValue(data.marca)}</div></div>
                    <div class="field"><span class="field-label">Modelo:</span><div class="field-value">${getFormattedValue(data.modelo)}</div></div>
                    <div class="field"><span class="field-label">N° Serie:</span><div class="field-value">${getFormattedValue(data.serie)}</div></div>
                    <div class="field"><span class="field-label">Año Fab:</span><div class="field-value">${getFormattedValue(data.anio)}</div></div>
                </div>
            </div>

            <div class="section">
                <h3>Accesorios Recibidos / Revisión</h3>
                <div class="field full-width"><span class="field-label">Items:</span><div class="field-value">${getFormattedValue(data.accesorios)}</div></div>
            </div>

            <div class="section">
                <h3>Diagnóstico Inicial</h3>
                <div class="field full-width"><div class="field-value" style="white-space: pre-wrap;">${getFormattedValue(data.diagnostico)}</div></div>
            </div>

            <div class="section">
                <h3>Trabajo Realizado / Notas del Técnico</h3>
                <div class="field full-width"><div class="field-value" style="white-space: pre-wrap;">${getFormattedValue(data.trabajo)}</div></div>
            </div>
            
            <div class="section">
                <h3>Pago y Estado</h3>
                <div class="grid-print">
                    <div class="field"><span class="field-label">Valor del Trabajo:</span><div class="field-value">${getFormattedValue(data.valorTrabajo)}</div></div>
                    <div class="field"><span class="field-label">Estado de Pago:</span><div class="field-value">${getFormattedValue(data.estadoPago)}</div></div>
                    ${data.estadoPago === 'Abonado' ? `<div class="field"><span class="field-label">Monto Abonado:</span><div class="field-value">${getFormattedValue(data.montoAbonado)}</div></div>` : '<div></div>'}
                </div>
            </div>

            <img src="sello.png" alt="Sello de Taller" class="sello-print" />

            <div class="firmas-print">
                <div class="firma-box-print"><div class="firma-text">${getFormattedValue(data.firmaTaller)}</div>Firma Taller</div>
                <div class="firma-box-print"><div class="firma-text">${getFormattedValue(data.firmaCliente)}</div>Firma Cliente</div>
            </div>

            <div class="notes-section">
                <h4>Notas importantes</h4>
                <ul>
                    <li>Toda herramienta no retirada en 30 días podrá generar cobro por almacenamiento.</li>
                    <li>FuelTek no se responsabiliza por accesorios no declarados al momento de la recepción.</li>
                    <li>El cliente declara estar informado sobre los términos del servicio y autoriza la revisión del equipo.</li>
                </ul>
            </div>

        </div>
    `;
    return html;
}


function exportToExcel(data) {
    if (data.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OrdenesDeTrabajo");
    XLSX.writeFile(wb, "OT_Fueltek_Export.xlsx");
}


// --- INICIALIZACIÓN Y EVENT LISTENERS ---

function refreshOrdersList() {
    firebaseGetAllOrders().then(orders => {
        // Guardar las órdenes completas en una variable local para la búsqueda
        window.allOrders = orders; 
        displayOrders(orders, searchOt.value);
    }).catch(err => {
        console.error("Error al cargar la lista de órdenes:", err);
        alert("Error al cargar la lista de órdenes.");
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización del correlativo
    firebaseGetCurrentCorrelative().then(ot => {
        otNumberInput.value = ot;
        currentCorrelative = ot; 
    }).catch(console.error);
    
    // 2. Evento de Guardar/Actualizar
    saveBtn.addEventListener('click', async () => {
        const data = getFormData();
        if (!validateData(data)) return;

        try {
            await saveOrder(data);
            alert(`OT #${data.ot} guardada con éxito.`);
            
            // Si fue una OT nueva, cargar el siguiente correlativo inmediatamente
            if (data.ot === currentCorrelative) {
                firebaseGetCurrentCorrelative().then(ot => {
                    resetForm();
                    otNumberInput.value = ot;
                    currentCorrelative = ot;
                });
            }
        } catch (error) {
            console.error(error);
            alert(`Error al guardar/actualizar la OT: ${error.message}`);
        }
    });

    // 3. Evento para Nuevo OT (Solo carga el correlativo, no lo incrementa)
    newOtBtn.addEventListener('click', () => {
        if (confirm("¿Desea empezar una nueva Orden de Trabajo? Los datos no guardados se perderán.")) {
            resetForm();
            firebaseGetCurrentCorrelative().then(ot => {
                otNumberInput.value = ot;
                currentCorrelative = ot;
            }).catch(console.error);
        }
    });
    
    // 4. Evento para Limpiar Formulario
    resetFormBtn.addEventListener('click', () => {
        if (confirm("¿Desea limpiar todos los campos del formulario?")) {
            resetForm();
            firebaseGetCurrentCorrelative().then(ot => {
                otNumberInput.value = ot;
                currentCorrelative = ot;
            }).catch(console.error);
        }
    });
    
    // 5. Evento para Ver Lista
    viewBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        searchOt.value = '';
        refreshOrdersList();
    });
    
    // 6. Evento de Cerrar Modal
    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    // 7. Evento de Buscar en Modal (con pequeño debounce)
    let searchTimeout;
    searchOt.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (window.allOrders) {
                displayOrders(window.allOrders, searchOt.value);
            }
        }, 300);
    });

    // 8. Evento de Acciones en Filas (Cargar/Borrar)
    ordersList.addEventListener('click', handleOrderAction);

    // 9. Evento de Borrar Base de Datos
    clearBtn.addEventListener('click', () => {
        if (confirm("ADVERTENCIA: ¿Está seguro de que desea BORRAR TODA LA BASE DE DATOS de Órdenes de Trabajo? Esta acción es irreversible.")) {
            alert("Acción cancelada. Para confirmar, debe implementar la lógica de borrado masivo en `script.js`.");
            // Lógica de borrado de colección: No implementada aquí por seguridad.
        }
    });
    
    // 10. Evento de Imprimir / PDF
    printBtn.addEventListener('click', () => {
        const data = getFormData();
        if (!validateData(data)) {
            alert("Debe completar los campos obligatorios para generar el PDF/Imprimir.");
            return;
        }

        const printArea = document.getElementById('printArea');
        printArea.innerHTML = createPrintableHTML(data);
        printArea.style.display = 'block';
        
        setTimeout(() => {
            window.print();
            printArea.style.display = 'none';
        }, 300);
    });

    // 11. Evento de Exportar Excel
    exportBtn.addEventListener('click', () => {
        firebaseGetAllOrders().then(exportToExcel).catch(err => alert("Error al exportar: " + err.message));
    });

    // 12. Evento de Exportar DB (JSON)
    exportDbBtn.addEventListener('click', () => {
        firebaseGetAllOrders().then(orders => {
            const dataStr = JSON.stringify(orders, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ot_fueltek_export.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }).catch(err => alert("Error al exportar DB: " + err.message));
    });
    
    // 13. Evento de Importar DB (JSON)
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);
                if (!Array.isArray(importedData) || importedData.length === 0) {
                    throw new Error("El archivo JSON no contiene un array de órdenes válido.");
                }
                if (confirm(`Se encontraron ${importedData.length} órdenes. ¿Está seguro de importarlas? Esto SOBRESCRIBIRÁ las OT existentes con el mismo número.`)) {
                    // Lógica para subir datos a Firebase
                    alert("Importación iniciada. Revise la consola para el progreso.");
                    // Implementación de la subida masiva (ej. con batch writes) iría aquí.
                    // Para el alcance actual, se omite el código masivo.
                    alert("Importación completada (simulada). Se requieren más funciones de Firebase para la subida masiva real.");
                }
            } catch (error) {
                alert("Error al procesar el archivo: " + error.message);
            }
            importFile.value = ''; // Resetear el input
        };
        reader.readAsText(file);
    });
    
    // 14. Evento para campos monetarios
    const currencyInputs = document.querySelectorAll('#valorTrabajoInput, #montoAbonadoInput');
    currencyInputs.forEach(input => {
        input.addEventListener('blur', () => formatCurrency(input));
    });

    // 15. Evento para Estado de Pago
    estadoPagoSelect.addEventListener('change', toggleAbonoField);

    // 16. Evento para Sincronización
    syncCorrelativeBtn.addEventListener('click', () => {
        if (confirm("¿Está seguro de querer resincronizar el correlativo? Esto es una acción de diagnóstico/mantenimiento. Buscará la OT máxima guardada y establecerá el correlativo siguiente.")) {
            firebaseSyncCorrelative();
        }
    });

    // 17. Menú móvil (ocultar/mostrar)
    const mobileMenuDropdown = document.getElementById('mobileMenuDropdown');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    if (mobileMenuBtn && mobileMenuDropdown) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuDropdown.classList.toggle('active');
        });
        // Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!mobileMenuDropdown.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                mobileMenuDropdown.classList.remove('active');
            }
        });
        // Cerrar al hacer clic en un botón dentro del menú
        mobileMenuDropdown.querySelectorAll('button, .import-label').forEach(el => {
            el.addEventListener('click', () => {
                // Pequeño retraso para que la acción se ejecute antes de cerrar
                setTimeout(() => mobileMenuDropdown.classList.remove('active'), 100); 
            });
        });
    }

});
