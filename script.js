/* Fueltek v5.2 - script mejorado con formato CLP y PDF profesional */

const DB_NAME = "fueltek_db_v5";
const DB_VERSION = 1;
const STORE = "orders";
const OT_LOCAL = "fueltek_last_ot_v5";

let currentLoadedOt = null;

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
    const r = store.get(key);
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

// 🔹 función formato CLP con separador de miles
function formatCLP(value) {
  return new Intl.NumberFormat("es-CL").format(Number(value) || 0);
}

document.addEventListener("DOMContentLoaded", () => {
  const otInput = document.getElementById("otNumber");
  const form = document.getElementById("otForm");
  const estadoPago = document.getElementById("estadoPago");
  const labelAbono = document.getElementById("labelAbono");
  const printArea = document.getElementById("printArea");

  const updateOtDisplay = () => (otInput.value = String(getLastOt() + 1));
  updateOtDisplay();

  estadoPago.addEventListener("change", () => {
    if (estadoPago.value === "Abonado") labelAbono.classList.remove("hidden");
    else {
      labelAbono.classList.add("hidden");
      document.getElementById("montoAbonado").value = "";
    }
  });

  // Imprimir
  document.getElementById("printBtn").addEventListener("click", e => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) if (k !== "accesorios") data[k] = v;
    data.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(c => c.value);
    data.ot = otInput.value || String(getLastOt() + 1);
    buildPrintAndPrint(data);
  });

  function buildPrintAndPrint(data) {
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111">
        <header style="display:flex;align-items:center;gap:12px;background:#00aaff;color:white;padding:10px 16px;border-radius:8px">
          <img src="logo-fueltek.png" style="width:80px;height:80px;object-fit:contain;background:white;border-radius:6px;padding:4px" alt="logo"/>
          <div>
            <h2 style="margin:0;color:white">FUELTEK</h2>
            <div style="font-weight:600">Servicio Técnico Multimarca</div>
            <small>Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</small>
          </div>
          <div style="margin-left:auto;text-align:right">
            <div style="font-weight:700;font-size:18px">N° OT: ${data.ot}</div>
            <div style="font-size:12px">Fecha impresión: ${new Date().toLocaleString()}</div>
          </div>
        </header>
        <hr style="border:none;border-top:1px solid #ccc;margin:12px 0"/>

        <main style="font-size:14px;line-height:1.4">
          <section style="display:flex;gap:18px">
            <div style="flex:1">
              <strong>Datos del Cliente</strong><br/>
              Nombre: ${data.clienteNombre || ""}<br/>
              Teléfono: ${data.clienteTelefono || ""}<br/>
              Email: ${data.clienteEmail || ""}<br/>
              Fecha Recibida: ${data.fechaRecibida || ""}<br/>
              Fecha Entrega: ${data.fechaEntrega || ""}
            </div>
            <div style="flex:1">
              <strong>Datos de la Herramienta</strong><br/>
              Marca: ${data.marca || ""}<br/>
              Modelo: ${data.modelo || ""}<br/>
              Serie: ${data.serie || ""}<br/>
              Año: ${data.anio || ""}<br/>
              <strong>Pago</strong><br/>
              Valor: ${formatCLP(data.valorTrabajo)} CLP<br/>
              Estado: ${data.estadoPago || ""}<br/>
              Abonado: ${formatCLP(data.montoAbonado)} CLP
            </div>
          </section>

          <section style="margin-top:14px">
            <strong>Accesorios / Revisión</strong><br/>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">
              ${(data.accesorios || [])
                .map(a => `<span style="border:1px solid #ddd;padding:4px 6px;border-radius:6px;font-size:12px">${a}</span>`)
                .join("")}
            </div>
          </section>

          <section style="margin-top:14px">
            <strong>Diagnóstico Inicial</strong>
            <div style="border:1px solid #ccc;padding:8px;border-radius:6px;min-height:60px">${data.diagnostico || ""}</div>
          </section>

          <section style="margin-top:14px">
            <strong>Trabajo Realizado / Notas del Técnico</strong>
            <div style="border:1px solid #ccc;padding:8px;border-radius:6px;min-height:60px">${data.trabajo || ""}</div>
          </section>

          <div style="display:flex;gap:40px;margin-top:26px">
            <div style="flex:1;text-align:center">
              <div style="height:60px;border-bottom:1px solid #999"></div>
              <div>Firma Taller</div>
            </div>
            <div style="flex:1;text-align:center">
              <div style="height:60px;border-bottom:1px solid #999"></div>
              <div>Firma Cliente</div>
            </div>
          </div>
        </main>

        <footer style="margin-top:20px;text-align:center;font-size:12px;color:#555;border-top:2px solid #00aaff;padding-top:6px">
          © 2025 FUELTEK — Tel: +56 9 4043 5805 — La Trilla 1062, San Bernardo
        </footer>
      </div>`;
    printArea.innerHTML = html;
    printArea.style.display = "block";
    window.print();
    setTimeout(() => (printArea.style.display = "none"), 800);
  }
});
