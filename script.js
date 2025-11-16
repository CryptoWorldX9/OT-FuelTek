/* Fueltek v7.5 - script.js
   Versión Corregida FINAL:
   1. Blindaje contra errores de elementos nulos que bloquean la ejecución del script.
   2. Corrección de la lógica de correlativo OT para SINCRONIZAR con Firebase/IndexedDB.
   3. El correlativo de OT ahora inicia en 10725.
   4. Corrección de visualización de iconos de acción en el listado de OT.
*/

/* -------------------------
   CONFIG / CONSTANTES
   ------------------------- */
const DB_NAME = "fueltek_db_v7";
const DB_VERSION = 1;
const STORE = "orders";
// La base mínima para el contador. El primer OT será OT_START + 1 (10725)
const OT_START = 10724; 
const OT_LOCAL = "fueltek_last_ot_v7"; // LocalStorage para caché del último OT conocido

let currentLoadedOt = null;

// Función de verificación de Lucide (centralizada para limpieza)
const tryCreateIcons = (options) => {
    // Si lucide existe y tiene el método createIcons, ejecutarlo de forma segura
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons(options);
    }
}

/* ====================================================================
   UTILIDADES DE FORMATO CLP
   ==================================================================== */
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
  input.value = formattedValue;
}

/* ====================================================================
   INDEXEDDB (mismo funcionamiento que tenías)
   ==================================================================== */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "ot" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(order) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const r = store.put(order);
    r.onsuccess = () => { res(true); db.close(); };
    r.onerror = () => { rej(r.error); db.close(); };
  }));
}

function dbGetAll() {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const r = store.getAll();
    r.onsuccess = () => { res(r.result || []); db.close(); };
    r.onerror = () => { rej(r.error); db.close(); };
  }));
}

function dbGet(key) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const r = store.get(String(key)); 
    r.onsuccess = () => { res(r.result); db.close(); };
    r.onerror = () => { rej(r.error); db.close(); };
  }));
}

function dbDelete(key) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const r = store.delete(String(key));
    r.onsuccess = () => { res(true); db.close(); };
    r.onerror = () => { rej(r.error); db.close(); };
  }));
}

function dbDeleteAll() {
  return new Promise((res, rej) => {
    const del = indexedDB.deleteDatabase(DB_NAME);
    del.onsuccess = () => res(true);
    del.onerror = () => rej(del.error);
  });
}

/* ====================================================================
   CORRELATIVO / LOCALSTORAGE (Solo caché y valor por defecto)
   ==================================================================== */
function getLastOt() {
  // Ahora, si no existe, usa la nueva constante OT_START (10724)
  return parseInt(localStorage.getItem(OT_LOCAL) || String(OT_START), 10); 
}
function setLastOt(n) { localStorage.setItem(OT_LOCAL, String(n)); }


// ✅ FIX: Función para encontrar el OT máximo en la DB (Firebase -> IndexedDB)
async function findMaxOtInDB() {
    let allOrders = [];
    
    // 1. Intentar leer desde Firebase (Fuente de verdad)
    const isFirebaseReady = typeof firestore !== 'undefined';
    
    if (isFirebaseReady) {
        try {
            allOrders = await firebaseGetAllOrders(); 
        } catch (e) {
            console.warn("Firebase read failed, falling back to IndexedDB:", e);
            // 2. Fallback: IndexedDB
            allOrders = await dbGetAll();
        }
    } else {
        // 3. Solo IndexedDB disponible
        allOrders = await dbGetAll();
    }
    
    // Convertir OT keys a números y encontrar el máximo, valor mínimo OT_START (10724)
    const maxDbOt = allOrders.reduce((max, order) => {
        const otNum = Number(order.ot);
        return (otNum > max) ? otNum : max;
    }, OT_START); // <-- Usa la nueva constante de inicio

    return maxDbOt;
}

// ✅ FIX: Modificación para SINCRONIZAR el correlativo
const updateOtDisplay = async () => { 
    const otInput = document.getElementById("otNumber");
    if (!otInput) return; // ✅ Blindaje
    
    // Obtener el máximo real de la DB (sincronizado)
    const maxDbOt = await findMaxOtInDB(); 
    
    // Asegurarse de que el localStorage se actualice con el valor sincronizado
    setLastOt(maxDbOt);

    // Mostrar el siguiente OT disponible (maxDbOt + 1)
    otInput.value = String(maxDbOt + 1);
    resetSaveButton();
}


/* ====================================================================
   BOTÓN GUARDAR - RESET
   ==================================================================== */
const resetSaveButton = () => {
    const saveBtn = document.getElementById("saveBtn");
    if (!saveBtn) return; // ✅ Blindaje
    
    saveBtn.title = "Guardar OT";
    // Usamos el HTML directo para que Lucide lo recoja 
    saveBtn.innerHTML = '<i data-lucide="save"></i><span>Guardar</span>'; 
    tryCreateIcons({ parent: saveBtn }); // Usar tryCreateIcons y acotar el padre
}

/* ====================================================================
   SALDO Y ESTADO DE PAGO
   ==================================================================== */
function updateSaldo() {
    const valorTrabajoInput = document.getElementById("valorTrabajoInput");
    const montoAbonadoInput = document.getElementById("montoAbonadoInput");
    const estadoPago = document.getElementById("estadoPago");
    const labelAbono = document.getElementById("labelAbono");
    
    // ✅ Blindaje: Si falta algún elemento, salimos
    if (!valorTrabajoInput || !montoAbonadoInput || !estadoPago || !labelAbono) return;

    const valor = unformatCLP(valorTrabajoInput.value);
    const estado = estadoPago.value;

    if (estado === "Abonado") {
        labelAbono.classList.remove("hidden");
    } else if (estado === "Pagado") {
        labelAbono.classList.add("hidden");
        // Cuando es pagado, el monto abonado debe ser igual al valor del trabajo
        montoAbonadoInput.value = formatCLP(valor); 
    } else { // Pendiente
        labelAbono.classList.add("hidden");
        montoAbonadoInput.value = ""; // Limpia el valor en caso de Pendiente
    }
}

/* ====================================================================
   FIREBASE - funciones auxiliares (sin cambios, ya eran seguras)
   ==================================================================== */
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

/* ====================================================================
   DOMContentLoaded - eventos principales (MÁXIMA PROTECCIÓN)
   ==================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  // Obtener todos los elementos necesarios al inicio
  const otInput = document.getElementById("otNumber");
  const form = document.getElementById("otForm");
  const estadoPago = document.getElementById("estadoPago");
  const labelAbono = document.getElementById("labelAbono");
  const valorTrabajoInput = document.getElementById("valorTrabajoInput");
  const montoAbonadoInput = document.getElementById("montoAbonadoInput");
  const printArea = document.getElementById("printArea");
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("closeModal");
  const ordersList = document.getElementById("ordersList");
  const searchOt = document.getElementById("searchOt");
  
  // Elementos de botones
  const newOtBtn = document.getElementById("newOtBtn");
  const clearBtn = document.getElementById("clearBtn");
  const resetFormBtn = document.getElementById("resetFormBtn");
  const saveBtn = document.getElementById("saveBtn");
  const viewBtn = document.getElementById("viewBtn"); // Botón Ver Lista
  const printBtn = document.getElementById("printBtn");
  const exportBtn = document.getElementById("exportBtn");
  const exportDbBtn = document.getElementById("exportDbBtn");
  const importFile = document.getElementById("importFile");

  // Elementos del menú móvil
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileMenuDropdown = document.getElementById("mobileMenuDropdown");
    
  // Función de inicialización OT (se llama con await para sincronizar con la DB)
  await updateOtDisplay(); 
  
  // --- LISTENERS DE INPUTS Y ESTADO DE PAGO (Seguros) ---
  
  // Agregar listeners para formato de miles Y ACTUALIZACIÓN DE SALDO EN TIEMPO REAL
  const inputsToFormat = [valorTrabajoInput, montoAbonadoInput].filter(el => el);
  inputsToFormat.forEach(input => {
    input.addEventListener("input", e => {
        handleFormatOnInput(e);
        setTimeout(updateSaldo, 0); 
    });
    input.addEventListener("blur", updateSaldo); 
  });

  // Mostrar / ocultar campo Abonado y recalcular Saldo
  if (estadoPago) { // ✅ Blindaje
      estadoPago.addEventListener("change", updateSaldo);
  }
  
  // Inicializar estado de pago
  updateSaldo();


  // --- LÓGICA DEL MENÚ MÓVIL (Seguro) ---
  if (mobileMenuBtn && mobileMenuDropdown) { // ✅ Blindaje de elementos
    // 1. Toggle mobile menu
    mobileMenuBtn.addEventListener("click", () => {
        mobileMenuDropdown.classList.toggle("active");
        
        const iconContainer = mobileMenuBtn.querySelector('i'); // Asumimos que el icono está dentro de <i>
        const newIconName = mobileMenuDropdown.classList.contains('active') ? 'x' : 'menu';
        
        if (iconContainer) {
            // Reemplazamos el innerHTML para que Lucide actúe
            iconContainer.innerHTML = `<i data-lucide="${newIconName}"></i>`; 
            tryCreateIcons({ parent: iconContainer }); 
        }
    });

    // 2. Cerrar el menú después de hacer click en cualquier botón de acción
    mobileMenuDropdown.querySelectorAll("button, .import-label").forEach(btn => {
      btn.addEventListener("click", () => {
          setTimeout(() => {
              mobileMenuDropdown.classList.remove("active");
              if (mobileMenuBtn) {
                  const iconContainer = mobileMenuBtn.querySelector('i');
                  if (iconContainer) {
                      iconContainer.innerHTML = `<i data-lucide="menu"></i>`;
                      tryCreateIcons({ parent: iconContainer }); 
                  }
              }
          }, 100);
      });
    });
  }
  // -------------------------------------


  // --- LISTENERS DE BOTONES DE ACCIÓN (MÁXIMA PROTECCIÓN) ---
  
  // Reservar nuevo OT
  if (newOtBtn && form) { // ✅ Blindaje
    newOtBtn.addEventListener("click", async () => {
      // ✅ FIX: El número de OT actual es el que está en pantalla (siguiente disponible)
      const nextAvailableOt = otInput.value; 
      await updateOtDisplay(); // Refresca y sincroniza el contador
      form.reset();
      if (labelAbono) labelAbono.classList.add("hidden");
      currentLoadedOt = null;
      updateSaldo(); 
      alert("Listo para la OT N° " + nextAvailableOt + " (siguiente sincronizada).");
    });
  }
  
  // Borrar base de datos completa
  if (clearBtn) { // ✅ Blindaje
    clearBtn.addEventListener("click", async () => {
      if (!confirm(`⚠️ ADVERTENCIA: Esta acción BORRARÁ toda la base de datos de Órdenes de Trabajo (IndexedDB) y reiniciará el contador a ${OT_START + 1}. ¿Desea continuar?`)) return;
      
      try {
          await dbDeleteAll();
      } catch (e) {
          console.error("Error al borrar IndexedDB:", e);
          alert("Error al borrar IndexedDB. Consulta la consola.");
          return;
      }
      
      if (typeof firestore !== 'undefined' && confirm("¿También desea intentar BORRAR todas las órdenes de Firebase Firestore?")) {
           console.warn("Borrar todas las órdenes de Firestore debe hacerse manualmente en la consola de Firebase, pero el código de eliminación local ha sido ejecutado.");
      }
      
      setLastOt(OT_START); // Reinicia el contador local
      await updateOtDisplay();
      if (form) form.reset();
      if (labelAbono) labelAbono.classList.add("hidden");
      currentLoadedOt = null;
      updateSaldo(); 
      alert(`Base de datos local eliminada. Contador reiniciado a ${OT_START + 1}.`);
    });
  }
  
  // Limpiar campos manualmente
  if (resetFormBtn && form) { // ✅ Blindaje
    resetFormBtn.addEventListener("click", () => {
      if (confirm("¿Seguro que deseas limpiar todos los campos del formulario?")) {
        form.reset();
        if (labelAbono) labelAbono.classList.add("hidden");
        currentLoadedOt = null;
        updateOtDisplay(); 
        updateSaldo(); 
        alert("Campos limpiados. Listo para una nueva OT.");
      }
    });
  }


  // Guardar o actualizar
  if (saveBtn && form) { // ✅ Blindaje
    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      
      const fd = new FormData(form);
      const order = {};
      for (const [k, v] of fd.entries()) {
        if (k === "accesorios") continue; 
        order[k] = v;
      }
      order.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(c => c.value);
      order.fechaGuardado = new Date().toISOString();
      
      order.valorTrabajo = unformatCLP(order.valorTrabajo); 
      order.estadoPago = order.estadoPago || "Pendiente";
      order.montoAbonado = unformatCLP(order.montoAbonado);
      
      if (order.montoAbonado > order.valorTrabajo && order.estadoPago !== "Pagado") {
          return alert("Error: El monto abonado no puede ser mayor que el valor del trabajo.");
      }
      if (order.estadoPago === "Pagado") {
          order.montoAbonado = order.valorTrabajo;
      }

      let saveMessage = "guardada";
      let otToSave;

      if (currentLoadedOt) {
        // ACTUALIZAR OT existente
        order.ot = String(currentLoadedOt);
        otToSave = currentLoadedOt;
        saveMessage = "actualizada";
      } else {
        // ✅ FIX: GUARDAR NUEVA OT - Obtener el número sincronizado de la DB
        const maxOt = await findMaxOtInDB(); 
        otToSave = String(maxOt + 1);
        order.ot = otToSave;
      }

      try {
        await dbPut(order);
        
        if (typeof firestore !== 'undefined') {
          firebaseSaveOrder(order).catch(err => console.error("Firebase save error (non-blocking):", err));
        }

        if (!currentLoadedOt) {
            // ✅ FIX: Si se guardó una OT NUEVA, actualizar el contador local con el número recién usado
            setLastOt(Number(otToSave)); 
        }
        alert(`Orden ${saveMessage} correctamente ✅ (OT #${otToSave})`);
      } catch (err) {
        alert(`Error al ${saveMessage === "guardada" ? "guardar" : "actualizar"}: ${err}`);
        console.error(err);
      }

      form.reset();
      if (labelAbono) labelAbono.classList.add("hidden");
      currentLoadedOt = null;
      await updateOtDisplay(); // Sincroniza y muestra el siguiente correlativo
      updateSaldo(); 
    });
  }

  // Modal - Ver OT
  if (viewBtn && modal) { // ✅ Blindaje
    viewBtn.addEventListener("click", async () => {
      await renderOrdersList();
      modal.classList.remove("hidden");
      // Reseteamos el campo de búsqueda
      if (searchOt) searchOt.value = ""; 
    });
  }
  
  if (closeModal && modal) { // ✅ Blindaje
    closeModal.addEventListener("click", () => {
        modal.classList.add("hidden");
        if (searchOt) searchOt.value = ""; 
    });
  }
  
  if (searchOt) { // ✅ Blindaje
    searchOt.addEventListener("input", () => renderOrdersList(searchOt.value.trim()));
  }

  // Imprimir actual o vista previa
  if (printBtn && form) { // ✅ Blindaje
    printBtn.addEventListener("click", e => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {};
      for (const [k, v] of fd.entries()) if (k !== "accesorios") data[k] = v;
      data.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(c => c.value);
      
      // Usa el OT que está cargado o el que está en pantalla (siguiente)
      data.ot = currentLoadedOt || otInput.value || String(getLastOt() + 1); 
      
      data.valorTrabajoNum = unformatCLP(data.valorTrabajo);
      data.montoAbonadoNum = unformatCLP(data.montoAbonado);
      data.estadoPago = data.estadoPago || "Pendiente"; 
      
      buildPrintAndPrint(data);
    });
  }
  
  // Implementación de Exportar/Importar DB JSON y Exportar a Excel
  if (exportBtn) { // ✅ Blindaje
    exportBtn.addEventListener("click", async () => {
      let orders = [];
      if (typeof firestore !== 'undefined') {
        try {
          orders = await firebaseGetAllOrders();
        } catch (e) {
          orders = await dbGetAll();
        }
      } else {
        orders = await dbGetAll();
      }
      
      if (orders.length === 0) return alert("No hay órdenes para exportar.");
      
      const data = orders.map(o => ({
        'N° OT': o.ot,
        'Cliente': o.clienteNombre,
        'Teléfono': o.clienteTelefono,
        'Email': o.clienteEmail,
        'Fecha Recibida': o.fechaRecibida,
        'Fecha Entrega': o.fechaEntrega,
        'Marca': o.marca,
        'Modelo': o.modelo,
        'Serie': o.serie,
        'Año': o.anio,
        'Accesorios': (o.accesorios || []).join(', '),
        'Diagnóstico': o.diagnostico,
        'Trabajo Realizado': o.trabajo,
        'Valor Trabajo (CLP)': o.valorTrabajo, 
        'Estado Pago': o.estadoPago,
        'Monto Abonado (CLP)': o.montoAbonado, 
        'Fecha Guardado': new Date(o.fechaGuardado).toLocaleString('es-CL'),
      }));

      try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Órdenes de Trabajo");
        XLSX.writeFile(wb, `Ordenes_Trabajo_Fueltek_${new Date().toISOString().slice(0, 10)}.xlsx`);
        alert("Exportación a Excel completada.");
      } catch (e) {
          alert("Error: La librería XLSX no está disponible. No se puede exportar a Excel.");
          console.error(e);
      }
    });
  }

  if (exportDbBtn) { // ✅ Blindaje
    exportDbBtn.addEventListener("click", async () => {
      const orders = await dbGetAll(); 
      const dataStr = JSON.stringify(orders, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fueltek_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("Copia de seguridad de la base de datos (JSON) exportada.");
    });
  }

  if (importFile) { // ✅ Blindaje
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const orders = JSON.parse(event.target.result);
          if (!Array.isArray(orders) || orders.some(o => typeof o.ot === 'undefined')) {
            e.target.value = null;
            return alert("Error: El archivo JSON no tiene el formato de Órdenes de Trabajo correcto.");
          }

          if (!confirm(`Se encontraron ${orders.length} órdenes. ¿Desea importarlas? Las órdenes existentes con el mismo N° OT se **SOBRESCRIBIRÁN**.`)) {
            e.target.value = null; 
            return;
          }

          const db = await openDB();
          const tx = db.transaction(STORE, "readwrite");
          const store = tx.objectStore(STORE);
          let importedCount = 0;
          
          orders.forEach(order => {
              order.ot = String(order.ot);
              const request = store.put(order);
              request.onsuccess = () => {
                  importedCount++;
                  if (typeof firestore !== 'undefined') {
                      firebaseSaveOrder(order).catch(err => console.error("Error firebase import (non-blocking):", err));
                  }
              };
              request.onerror = (e) => {
                  console.error("Error al importar OT:", order.ot, e.target.error);
              };
          });

          tx.oncomplete = async () => {
            alert(`Importación finalizada. ${importedCount} órdenes procesadas.`);
            // Al importar, sincronizar el correlativo con el valor más alto
            await updateOtDisplay(); 
            e.target.value = null; 
          };
          tx.onerror = (e) => alert("Error en la transacción de importación: " + e.target.error);
          
        } catch (error) {
          alert("Error al leer, parsear o procesar el archivo JSON: " + error.message);
          e.target.value = null;
          console.error(error);
        }
      };
      reader.readAsText(file);
    });
  }


  // --- FUNCIONES INTERNAS ---
  async function renderOrdersList(filter = "") {
    if (!ordersList) return; // ✅ Blindaje

    ordersList.innerHTML = "<div style='padding:10px;color:#666'>Cargando...</div>";

    let all = [];
    if (typeof firestore !== 'undefined') {
      try {
        // Fuente de verdad para la lista: Firebase
        all = await firebaseGetAllOrders();
      } catch (e) {
        console.warn("Firebase read failed, falling back to IndexedDB:", e);
        all = await dbGetAll();
      }
    } else {
      all = await dbGetAll();
    }

    const rows = all
      .filter(o => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return (String(o.ot).toLowerCase().includes(f)) ||
               (o.clienteNombre && o.clienteNombre.toLowerCase().includes(f));
      })
      .sort((a, b) => Number(b.ot) - Number(a.ot));

    if (rows.length === 0) { ordersList.innerHTML = "<div style='padding:10px'>No hay órdenes guardadas.</div>"; return; }

    ordersList.innerHTML = "";
    for (const o of rows) {
      const div = document.createElement("div");
      div.className = "order-row";
      // ✅ FIX: Se elimina el estilo de tamaño de los <i> para usar attrs en createIcons
      div.innerHTML = `
        <div><b>OT #${o.ot}</b> — ${o.clienteNombre || "Sin Nombre"}<br><small>${o.marca || ""} ${o.modelo || ""}</small></div>
        <div class="order-actions">
          <button class="small" data-ot="${o.ot}" data-action="print" title="Imprimir"><i data-lucide="printer"></i></button>
          <button class="small" data-ot="${o.ot}" data-action="load" title="Cargar para Editar"><i data-lucide="edit"></i></button>
          <button class="small" data-ot="${o.ot}" data-action="delete" style="background:#b51b1b" title="Borrar"><i data-lucide="trash-2"></i></button>
        </div>`;
      ordersList.appendChild(div);
      // ✅ FIX: Se establece el tamaño 14x14px para los iconos de la lista
      tryCreateIcons({ parent: div, attrs: { width: 14, height: 14 } }); 
    }

    ordersList.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", async ev => {
        const targetBtn = ev.target.closest('button');
        if (!targetBtn) return; // ✅ Blindaje adicional
        
        const ot = String(targetBtn.dataset.ot);
        const action = targetBtn.dataset.action;
        
        if (action === "print") {
          let dat = null;
          if (typeof firestore !== 'undefined') {
            try { dat = await firebaseGetOrder(ot); } catch (e) { console.warn("firebase get order failed:", e); }
          }
          if (!dat) dat = await dbGet(ot);
          if (dat) buildPrintAndPrint(dat);
          else alert("Orden no encontrada para imprimir.");
        } else if (action === "load") {
          let dat = null;
          if (typeof firestore !== 'undefined') {
            try { dat = await firebaseGetOrder(ot); } catch (e) { console.warn("firebase get order failed:", e); }
          }
          if (!dat) dat = await dbGet(ot);
          if (dat) { 
              loadOrderToForm(dat); 
              if (modal) modal.classList.add("hidden"); 
          }
          else alert("Orden no encontrada para cargar.");
        } else if (action === "delete") {
          if (confirm("¿Borrar definitivamente OT #" + ot + "?")) {
            try {
              await dbDelete(ot);
            } catch (e) {
              console.error("Error al borrar en IndexedDB:", e);
            }
            if (typeof firestore !== 'undefined') {
              try {
                await firebaseDeleteOrder(ot);
              } catch (e) {
                console.error("Error al borrar en Firebase:", e);
              }
            }

            alert("OT eliminada");
            renderOrdersList();
            if (currentLoadedOt === ot) {
                currentLoadedOt = null;
                if (form) form.reset();
                updateOtDisplay();
                updateSaldo();
            }
          }
        }
      });
    });
  }

  function loadOrderToForm(o) {
    if (!o) return alert("Orden no encontrada.");
    if (form) form.reset(); // ✅ Blindaje
    currentLoadedOt = String(o.ot); 
    const fields = ["clienteNombre","clienteTelefono","clienteEmail","fechaRecibida","fechaEntrega",
      "marca","modelo","serie","anio","diagnostico","trabajo","firmaTaller","firmaCliente"];
    fields.forEach(k => { 
        const el = form.querySelector(`[name="${k}"]`); 
        if (el) el.value = o[k] || ""; // ✅ Blindaje
    });
    
    if (valorTrabajoInput) valorTrabajoInput.value = formatCLP(o.valorTrabajo);
    if (montoAbonadoInput) montoAbonadoInput.value = formatCLP(o.montoAbonado);
    if (estadoPago) estadoPago.value = o.estadoPago || "Pendiente";
    
    updateSaldo(); 
    
    form.querySelectorAll("input[name='accesorios']").forEach(ch => ch.checked = false);
    if (Array.isArray(o.accesorios)) o.accesorios.forEach(val => {
      const el = Array.from(form.querySelectorAll("input[name='accesorios']")).find(c => c.value === val);
      if (el) el.checked = true;
    });
    
    if (otInput) otInput.value = o.ot;
    
    // Actualiza el contenido de texto para el botón de escritorio
    if (saveBtn) { // ✅ Blindaje
        saveBtn.title = "Actualizar OT #" + o.ot;
        saveBtn.innerHTML = '<i data-lucide="refresh-cw"></i><span>Actualizar</span>';
        tryCreateIcons({ parent: saveBtn });
    }
    
    alert("Orden OT #" + o.ot + " cargada. Si modificas algo y guardas, se actualizará esa misma OT.");
  }

  function buildPrintAndPrint(data) {
    if (!printArea) { // ✅ Blindaje
        console.error("No se encontró el área de impresión (printArea).");
        return;
    }
    
    const valorNum = (typeof data.valorTrabajoNum !== 'undefined') ? data.valorTrabajoNum : unformatCLP(data.valorTrabajo || 0);
    const abonoNum = (typeof data.montoAbonadoNum !== 'undefined') ? data.montoAbonadoNum : unformatCLP(data.montoAbonado || 0);

    const valorTrabajoF = formatCLP(valorNum);
    const montoAbonadoF = formatCLP(abonoNum);
    let saldo = valorNum - abonoNum;
    if (data.estadoPago === 'Pagado') saldo = 0;
    const saldoF = formatCLP(saldo > 0 ? saldo : 0);
    const estadoColor = data.estadoPago === 'Pagado' ? '#27ae60' : (data.estadoPago === 'Abonado' ? '#f39c12' : '#c0392b');
    const estadoPagoText = data.estadoPago || "Pendiente";

    const html = `
      <div style="font-family:'Inter', sans-serif;color:#111;padding-bottom:10px;border-bottom:1px solid #ddd;">
        <div style="display:flex;align-items:center;gap:15px">
          <img src="logo-fueltek.png" style="width:80px;height:80px;object-fit:contain;border:1px solid #eee;padding:5px;border-radius:8px;" alt="logo" />
          <div style="flex-grow:1">
            <h2 style="margin:0;color:#004d99;font-size:20px;">ORDEN DE TRABAJO - FUELTEK</h2>
            <div style="color:#f26522;font-weight:600;font-size:14px;">Servicio Técnico Multimarca</div>
            <div style="font-size:10px;margin-top:3px;opacity:0.8;">Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</div>
          </div>
          <div style="text-align:right;background:#004d99;color:white;padding:8px 12px;border-radius:6px;">
            <div style="font-weight:800;font-size:20px;">N° OT: ${data.ot}</div>
            <div style="font-size:9px;margin-top:5px;">Emitida: ${new Date().toLocaleDateString('es-CL')}</div>
          </div>
        </div>
        <hr style="border:none;border-top:2px solid #004d99;margin:10px 0 12px" />
        
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.5pt;table-layout: fixed;">
          <tr>
            <td style="width:50%;padding:6px 0;vertical-align:top;border-right:1px solid #eee;">
              <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:10pt;">DATOS DEL CLIENTE</strong>
              <span style="display:block;">Nombre: <b>${data.clienteNombre || "-"}</b></span>
              <span style="display:block;">Teléfono: ${data.clienteTelefono || "-"}</span>
              <span style="display:block;">Email: ${data.clienteEmail || "-"}</span>
              <span style="display:block;">Fecha Recibida: <b>${data.fechaRecibida || "-"}</b></span>
              <span style="display:block;">Fecha Entrega: <b>${data.fechaEntrega || "-"}</b></span>
            </td>
            <td style="width:50%;padding:6px 0 6px 15px;vertical-align:top;">
              <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:10pt;">DATOS DE LA HERRAMIENTA</strong>
              <span style="display:block;">Marca: <b>${data.marca || "-"}</b></span>
              <span style="display:block;">Modelo: <b>${data.modelo || "-"}</b></span>
              <span style="display:block;">N° Serie: ${data.serie || "-"}</span>
              <span style="display:block;">Año Fabricación: ${data.anio || "-"}</span>
              <div style="height:15px;"></div>
            </td>
          </tr>
        </table>

        <div style="display:flex;gap:15px;margin-bottom:10px;border-top:1px solid #ddd;padding-top:10px;">
            <div style="width:40%;min-width:300px;">
                <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:10pt;">RESUMEN DE PAGO</strong>
                <table style="width:100%;border-collapse:collapse;font-size:9pt;background:#f8f8f8;border-radius:6px;overflow:hidden;">
                    <tr><td style="padding:4px;border:1px solid #eee;">Valor del Trabajo:</td><td style="padding:4px;text-align:right;font-weight:700;">$${valorTrabajoF} CLP</td></tr>
                    ${estadoPagoText === 'Abonado' || estadoPagoText === 'Pagado' ? `<tr><td style="padding:4px;border:1px solid #eee;">Monto Abonado:</td><td style="padding:4px;text-align:right;">$${montoAbonadoF} CLP</td></tr>` : ''}
                    <tr><td style="padding:4px;border:1px solid #eee;">Estado de Pago:</td><td style="padding:4px;text-align:right;font-weight:700;color:${estadoColor};">${estadoPagoText}</td></tr>
                    ${estadoPagoText !== 'Pagado' && saldo > 0 ? `<tr><td style="padding:4px;border:1px solid #eee;">SALDO PENDIENTE:</td><td style="padding:4px;text-align:right;font-weight:800;color:#c0392b;">$${saldoF} CLP</td></tr>` : ''}
                </table>
            </div>
            <div style="flex:1;">
                <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:10pt;">REVISIÓN Y ACCESORIOS RECIBIDOS</strong>
                <div style="display:flex;flex-wrap:wrap;gap:5px;border:1px solid #ddd;padding:6px;border-radius:6px;min-height:50px;">
                    ${(data.accesorios||[]).map(s=>`<span style='border:1px solid #ddd;background:#fff;padding:3px 6px;border-radius:4px;font-size:9px'>${s}</span>`).join('') || '<span style="color:#999;font-style:italic;font-size:9px;">Ningún accesorio o revisión marcada.</span>'}
                </div>
            </div>
        </div>

        <div style="margin-top:10px;">
            <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:10pt;">DIAGNÓSTICO INICIAL</strong>
            <div style="border:1px solid #ddd;padding:8px;border-radius:6px;min-height:70px;background:#fcfcfc;font-size:9.5pt;">${data.diagnostico || "Sin diagnóstico."}</div>
        </div>
        <div style="margin-top:10px;">
            <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:10pt;">TRABAJO REALIZADO / NOTAS DEL TÉCNICO</strong>
            <div style="border:1px solid #ddd;padding:8px;border-radius:6px;min-height:70px;background:#fcfcfc;font-size:9.5pt;">${data.trabajo || "Trabajo Pendiente de Realizar / Sin notas."}</div>
        </div>
        
        <div style="display:flex;gap:40px;margin-top:25px;padding-top:10px;border-top:1px solid #eee;">
          <div style="flex:1;text-align:center">
            <div style="height:1px;border-bottom:1px solid #2c3e50;margin:0 auto;width:80%;font-size:9.5pt;">${data.firmaTaller || ""}</div>
            <div style="margin-top:6px;font-weight:600;color:#2c3e50;font-size:9.5pt;">Firma Taller</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="height:1px;border-bottom:1px solid #2c3e50;margin:0 auto;width:80%;font-size:9.5pt;">${data.firmaCliente || ""}</div>
            <div style="margin-top:6px;font-weight:600;color:#2c3e50;font-size:9.5pt;">Firma Cliente</div>
          </div>
        </div>
        
        <div style="margin-top:20px;padding:8px;background:#f0f7ff;border:1px solid #d0e0f0;border-radius:6px;font-size:9pt;color:#444;">
            <strong style="color:#004d99;">Notas importantes:</strong>
            <ul style="margin:5px 0 0 15px;padding:0;">
                <li>Toda herramienta no retirada en 30 días podrá generar cobro por almacenamiento.</li>
                <li>FuelTek no se responsabiliza por accesorios no declarados al momento de la recepción.</li>
                <li>El cliente declara estar informado sobre los términos del servicio y autoriza la revisión del equipo.</li>
            </ul>
        </div>
      </div>`;
    printArea.innerHTML = html;
    printArea.style.display = "block";
    window.print();
    setTimeout(() => printArea.style.display = "none", 800);
  }
});
