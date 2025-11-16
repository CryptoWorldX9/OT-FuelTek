/* Fueltek v7.5 - script.js
   - FIX: Se asegura que las claves de IndexedDB sean siempre String.
   - Se integra Firebase sin modificar diseño ni lógica existente.
*/

const DB_NAME = "fueltek_db_v7";
const DB_VERSION = 1;
const STORE = "orders";
const OT_LOCAL = "fueltek_last_ot_v7";

let currentLoadedOt = null;

// ====================================================================
// UTILIDADES DE FORMATO CLP
// ====================================================================

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
  const numericValue = unformatCLP(input.value);
  input.value = formatCLP(numericValue);
}

// ====================================================================
// BASE DE DATOS INDEXEDDB
// ====================================================================

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
    const st = tx.objectStore(STORE);
    const r = st.put(order);
    r.onsuccess = () => { res(true); db.close(); };
    r.onerror = () => { rej(r.error); db.close(); };
  }));
}

function dbGetAll() {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const r = st.getAll();
    r.onsuccess = () => { res(r.result || []); db.close(); };
    r.onerror = () => { rej(r.error); db.close(); };
  }));
}

function dbGet(key) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const r = st.get(String(key));
    r.onsuccess = () => { res(r.result); db.close(); };
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

function getLastOt() {
  return parseInt(localStorage.getItem(OT_LOCAL) || "726", 10);
}
function setLastOt(n) { localStorage.setItem(OT_LOCAL, String(n)); }
function nextOtAndSave() {
  const n = getLastOt() + 1;
  setLastOt(n);
  return n;
}

// ====================================================================
// SALDO Y PAGO
// ====================================================================

const resetSaveButton = () => {
  document.getElementById("saveBtn").title = "Guardar OT";
  document.getElementById("saveBtn").innerHTML = '<i data-lucide="save"></i><span>Guardar</span>';
  lucide.createIcons();
}

function updateSaldo() {
  const valorTrabajoInput = document.getElementById("valorTrabajoInput");
  const abonoInput = document.getElementById("montoAbonadoInput");
  const estadoPago = document.getElementById("estadoPago");
  const labelAbono = document.getElementById("labelAbono");

  const valor = unformatCLP(valorTrabajoInput.value);
  const estado = estadoPago.value;

  if (estado === "Abonado") {
    labelAbono.classList.remove("hidden");
  } else if (estado === "Pagado") {
    labelAbono.classList.add("hidden");
    abonoInput.value = formatCLP(valor);
  } else {
    labelAbono.classList.add("hidden");
    abonoInput.value = "";
  }
}

// ====================================================================
// DOM
// ====================================================================

document.addEventListener("DOMContentLoaded", () => {
  const otInput = document.getElementById("otNumber");
  const form = document.getElementById("otForm");
  const estadoPago = document.getElementById("estadoPago");
  const valorTrabajoInput = document.getElementById("valorTrabajoInput");
  const abonoInput = document.getElementById("montoAbonadoInput");
  const labelAbono = document.getElementById("labelAbono");
  const printArea = document.getElementById("printArea");

  const updateOtDisplay = () => {
    otInput.value = String(getLastOt() + 1);
    resetSaveButton();
  };
  updateOtDisplay();

  [valorTrabajoInput, abonoInput].forEach(input => {
    input.addEventListener("input", e => {
      handleFormatOnInput(e);
      updateSaldo();
    });
  });

  estadoPago.addEventListener("change", updateSaldo);
  updateSaldo();

  // --------------------------------------------------------------------------------
  // NUEVO OT
  document.getElementById("newOtBtn").addEventListener("click", () => {
    const reserved = nextOtAndSave();
    updateOtDisplay();
    alert("Reservado N° OT: " + reserved);
  });

  // LIMPIAR FORM
  document.getElementById("resetFormBtn").addEventListener("click", () => {
    if (confirm("¿Seguro que deseas limpiar todos los campos?")) {
      form.reset();
      labelAbono.classList.add("hidden");
      currentLoadedOt = null;
      updateOtDisplay();
      updateSaldo();
    }
  });

  // BORRAR DB
  document.getElementById("clearBtn").addEventListener("click", async () => {
    if (!confirm("Esto borrará toda la DB. ¿Continuar?")) return;
    await dbDeleteAll();
    setLastOt(726);
    updateOtDisplay();
  });

  // --------------------------------------------------------------------------------
  // GUARDAR OT
  document.getElementById("saveBtn").addEventListener("click", async e => {
    e.preventDefault();

    const fd = new FormData(form);
    const order = {};
    for (const [k, v] of fd.entries()) {
      if (k !== "accesorios") order[k] = v;
    }

    order.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked"))
      .map(c => c.value);

    order.fechaGuardado = new Date().toISOString();
    order.valorTrabajo = unformatCLP(order.valorTrabajo);
    order.montoAbonado = unformatCLP(order.montoAbonado);
    order.estadoPago = order.estadoPago || "Pendiente";

    if (currentLoadedOt) {
      order.ot = String(currentLoadedOt);
    } else {
      order.ot = String(getLastOt() + 1);
    }

    await dbPut(order);
    firebaseSaveOrder(order);   // 🔥 GUARDAR TAMBIÉN EN FIREBASE

    if (!currentLoadedOt) setLastOt(Number(order.ot));

    alert(`OT #${order.ot} guardada correctamente.`);
    form.reset();
    currentLoadedOt = null;
    updateOtDisplay();
    updateSaldo();
  });

  // --------------------------------------------------------------------------------
  // VER LISTA (MODAL)
  document.getElementById("viewBtn").addEventListener("click", async () => {
    await renderOrdersList();
    document.getElementById("modal").classList.remove("hidden");
  });

  document.getElementById("closeModal").addEventListener("click", () =>
    document.getElementById("modal").classList.add("hidden")
  );

  document.getElementById("searchOt").addEventListener("input", e =>
    renderOrdersList(e.target.value.trim())
  );

  async function renderOrdersList(filter = "") {
    const list = document.getElementById("ordersList");
    list.innerHTML = "Cargando...";

    const all = await firebaseGetAllOrders();  // 🔥 AHORA SE LEE DESDE FIREBASE

    const rows = all
      .filter(o => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return String(o.ot).toLowerCase().includes(f) ||
               (o.clienteNombre || "").toLowerCase().includes(f);
      })
      .sort((a, b) => Number(b.ot) - Number(a.ot));

    if (rows.length === 0) {
      list.innerHTML = "<div>No hay órdenes guardadas.</div>";
      return;
    }

    list.innerHTML = "";
    for (const o of rows) {
      const div = document.createElement("div");
      div.className = "order-row";
      div.innerHTML = `
        <div><b>OT #${o.ot}</b> — ${o.clienteNombre || "Sin Nombre"}</div>
      `;
      list.appendChild(div);
    }
  }

});

// ===============================================================
// 🔥 FIREBASE (AGREGADO COMPLETO)
// ===============================================================

// Guardar OT en Firebase
async function firebaseSaveOrder(order) {
  try {
    await firestore.collection("orders").doc(order.ot).set(order);
    console.log("Firebase: guardada OT", order.ot);
  } catch (e) {
    console.error("Error Firebase guardar:", e);
  }
}

// Obtener todas las OT
async function firebaseGetAllOrders() {
  try {
    const snap = await firestore.collection("orders").get();
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error("Error Firebase obtener:", e);
    return [];
  }
}
