const DB_NAME = "fueltek_db_v6";
const DB_VERSION = 1;
const STORE = "orders";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "ot" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(order) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(order);
    tx.oncomplete = () => { db.close(); res(true); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  }));
}

let currentLoadedOt = null;
function getLastOt() { return parseInt(localStorage.getItem("fueltek_last_ot") || "726", 10); }
function setLastOt(n) { localStorage.setItem("fueltek_last_ot", String(n)); }

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("otForm");
  const estadoPago = document.getElementById("estadoPago");
  const labelAbono = document.getElementById("labelAbono");
  const inputAbono = document.getElementById("montoAbonado");
  const otInput = document.getElementById("otNumber");
  const updateOtDisplay = () => (otInput.value = String(getLastOt() + 1));
  updateOtDisplay();

  estadoPago.addEventListener("change", () => {
    if (estadoPago.value === "Abonado") {
      labelAbono.classList.remove("hidden");
      inputAbono.classList.remove("hidden");
    } else {
      labelAbono.classList.add("hidden");
      inputAbono.classList.add("hidden");
      inputAbono.value = "";
    }
  });

  document.getElementById("saveBtn").addEventListener("click", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const order = {};
    for (const [k, v] of fd.entries()) {
      if (k !== "accesorios") order[k] = v;
    }
    order.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(c => c.value);
    order.ot = String(getLastOt() + 1);
    await dbPut(order);
    setLastOt(parseInt(order.ot));
    alert("Orden guardada correctamente ✅");
    form.reset();
    labelAbono.classList.add("hidden");
    updateOtDisplay();
  });

  document.getElementById("newOtBtn").addEventListener("click", () => {
    form.reset();
    labelAbono.classList.add("hidden");
    alert("Listo para nueva OT");
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm("¿Borrar toda la base de datos?")) {
      indexedDB.deleteDatabase("fueltek_db_v6");
      localStorage.removeItem("fueltek_last_ot");
      form.reset();
      alert("Base de datos eliminada y contador reiniciado.");
      updateOtDisplay();
    }
  });
});
