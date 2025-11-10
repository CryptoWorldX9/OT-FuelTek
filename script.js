/* ==========================================
   FUELTEK - Orden de Trabajo
   Versión optimizada con PDF profesional
   ========================================== */

const DB_NAME = "fueltek_db_v6";
const DB_VERSION = 1;
const STORE = "orders";
const OT_LOCAL = "fueltek_last_ot_v6";
let currentLoadedOt = null;

/* ---------------- IndexedDB ---------------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "ot" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(order) {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(order);
        tx.oncomplete = () => {
          db.close();
          res(true);
        };
        tx.onerror = () => {
          db.close();
          rej(tx.error);
        };
      })
  );
}

function dbGetAll() {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
          db.close();
          res(req.result);
        };
        req.onerror = () => {
          db.close();
          rej(req.error);
        };
      })
  );
}

function dbGet(key) {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => {
          db.close();
          res(req.result);
        };
        req.onerror = () => {
          db.close();
          rej(req.error);
        };
      })
  );
}

function dbDeleteAll() {
  return new Promise((res, rej) => {
    const del = indexedDB.deleteDatabase(DB_NAME);
    del.onsuccess = () => res(true);
    del.onerror = () => rej(del.error);
  });
}

/* ---------------- Utilidades ---------------- */
function getLastOt() {
  return parseInt(localStorage.getItem(OT_LOCAL) || "726", 10);
}
function setLastOt(n) {
  localStorage.setItem(OT_LOCAL, String(n));
}
function nextOtAndSave() {
  const n = getLastOt() + 1;
  setLastOt(n);
  return n;
}

function formatCLPNumber(value) {
  return new Intl.NumberFormat("es-CL").format(Number(value) || 0);
}
function unformatCLPString(str) {
  return Number(String(str).replace(/\./g, "").replace(/,/g, "")) || 0;
}

/* ---------------- Document Ready ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const otInput = document.getElementById("otNumber");
  const form = document.getElementById("otForm");
  const estadoPago = document.getElementById("estadoPago");
  const labelAbono = document.getElementById("labelAbono");
  const valorTrabajoInput = document.getElementById("valorTrabajo");
  const montoAbonadoInput = document.getElementById("montoAbonado");
  const printArea = document.getElementById("printArea");

  // Mostrar OT actual
  const updateOtDisplay = () => (otInput.value = String(getLastOt() + 1));
  updateOtDisplay();

  /* ======== Formato CLP ======== */
  function attachCLPFormatter(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("input", () => {
      const raw = inputEl.value.replace(/[^\d]/g, "");
      if (!raw) return (inputEl.value = "");
      inputEl.value = formatCLPNumber(raw);
    });
  }
  attachCLPFormatter(valorTrabajoInput);
  attachCLPFormatter(montoAbonadoInput);

  /* ======== Mostrar / ocultar campo Abonado ======== */
  estadoPago.addEventListener("change", () => {
    if (estadoPago.value === "Abonado") labelAbono.classList.remove("hidden");
    else {
      labelAbono.classList.add("hidden");
      montoAbonadoInput.value = "";
    }
  });

  /* ======== Botones ======== */
  document.getElementById("newOtBtn").addEventListener("click", () => {
    const reserved = nextOtAndSave();
    updateOtDisplay();
    alert("Reservado N° OT: " + reserved);
  });

  document.getElementById("saveBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const order = {};
    for (const [k, v] of fd.entries()) if (k !== "accesorios") order[k] = v;
    order.accesorios = Array.from(
      form.querySelectorAll("input[name='accesorios']:checked")
    ).map((c) => c.value);
    order.valorTrabajo = unformatCLPString(order.valorTrabajo);
    order.montoAbonado = unformatCLPString(order.montoAbonado);
    order.fechaGuardado = new Date().toISOString();
    order.estadoPago = order.estadoPago || "Pendiente";

    if (currentLoadedOt) order.ot = currentLoadedOt;
    else order.ot = String(getLastOt() + 1);

    await dbPut(order);
    if (!currentLoadedOt) setLastOt(Number(order.ot));
    alert("Orden guardada correctamente ✅ (OT #" + order.ot + ")");
    form.reset();
    labelAbono.classList.add("hidden");
    updateOtDisplay();
    currentLoadedOt = null;
  });

  document.getElementById("clearBtn").addEventListener("click", async () => {
    if (!confirm("¿Borrar toda la base de datos y reiniciar contador a 727?"))
      return;
    await dbDeleteAll();
    setLastOt(726);
    updateOtDisplay();
    alert("Base de datos eliminada y contador reiniciado.");
  });

  document.getElementById("printBtn").addEventListener("click", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    data.accesorios = Array.from(
      form.querySelectorAll("input[name='accesorios']:checked")
    ).map((c) => c.value);
    data.valorTrabajo = unformatCLPString(data.valorTrabajo);
    data.montoAbonado = unformatCLPString(data.montoAbonado);
    data.ot = otInput.value;
    buildPrintAndPrint(data);
  });

  /* ========== FUNCIÓN DE IMPRESIÓN MEJORADA ========== */
  function buildPrintAndPrint(data) {
    const html = `
      <div style="font-family:'Open Sans',sans-serif;color:#222;max-width:780px;margin:0 auto;border:1px solid #ccc;box-shadow:0 0 10px rgba(0,0,0,0.15);padding:18px;">
        <div style="display:flex;align-items:center;background:#00aaff;color:white;padding:12px 16px;border-radius:6px 6px 0 0;">
          <img src="logo-fueltek.png" alt="logo" style="height:60px;width:60px;background:white;border-radius:6px;padding:4px;margin-right:14px;">
          <h2 style="margin:0;font-size:20px;">FUELTEK – Servicio Técnico Multimarca</h2>
        </div>
        <div style="height:4px;background:#f26522;margin-bottom:12px;"></div>

        <table style="width:100%;font-size:13px;margin-bottom:10px;">
          <tr><td><b>OT N°:</b> ${data.ot || ""}</td>
          <td style="text-align:right;"><b>Fecha:</b> ${new Date().toLocaleDateString()}</td></tr>
        </table>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;">Datos del Cliente</h3>
        <table style="width:100%;font-size:13px;">
          <tr><td><b>Nombre:</b> ${data.clienteNombre || ""}</td><td><b>Teléfono:</b> ${data.clienteTelefono || ""}</td></tr>
          <tr><td><b>Email:</b> ${data.clienteEmail || ""}</td><td><b>Recibida:</b> ${data.fechaRecibida || ""}</td></tr>
          <tr><td><b>Entrega:</b> ${data.fechaEntrega || ""}</td><td></td></tr>
        </table>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Datos de la Herramienta</h3>
        <table style="width:100%;font-size:13px;">
          <tr><td><b>Marca:</b> ${data.marca || ""}</td><td><b>Modelo:</b> ${data.modelo || ""}</td></tr>
          <tr><td><b>Serie:</b> ${data.serie || ""}</td><td><b>Año:</b> ${data.anio || ""}</td></tr>
        </table>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Pago</h3>
        <table style="width:100%;font-size:13px;">
          <tr><td><b>Valor del trabajo:</b></td><td style="text-align:right;">${formatCLPNumber(data.valorTrabajo)} CLP</td></tr>
          <tr><td><b>Estado del pago:</b></td><td style="text-align:right;">${data.estadoPago || ""}</td></tr>
          ${
            data.estadoPago === "Abonado"
              ? `<tr><td><b>Monto abonado:</b></td><td style="text-align:right;">${formatCLPNumber(
                  data.montoAbonado
                )} CLP</td></tr>`
              : ""
          }
        </table>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Accesorios</h3>
        <div style="font-size:13px;display:flex;flex-wrap:wrap;gap:6px;">
          ${data.accesorios
            .map(
              (a) =>
                `<span style="border:1px solid #ccc;padding:3px 8px;border-radius:6px;">${a}</span>`
            )
            .join("")}
        </div>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Diagnóstico Inicial</h3>
        <div style="border:1px solid #ccc;border-radius:6px;padding:8px;min-height:40px;">${
          data.diagnostico || ""
        }</div>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Trabajo Realizado / Notas</h3>
        <div style="border:1px solid #ccc;border-radius:6px;padding:8px;min-height:40px;">${
          data.trabajo || ""
        }</div>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Notas Importantes</h3>
        <ul style="font-size:12px;color:#555;">
          <li>Toda herramienta no retirada en 30 días podrá generar cobro por almacenamiento.</li>
          <li>FuelTek no se responsabiliza por accesorios no declarados al momento de la recepción.</li>
          <li>El cliente declara estar informado sobre los términos del servicio y autoriza la revisión del equipo.</li>
        </ul>

        <div style="display:flex;justify-content:space-around;margin-top:30px;">
          <div style="text-align:center;"><div style="height:40px;border-bottom:1px solid #999;width:200px;margin:auto;"></div><div>Firma Taller</div></div>
          <div style="text-align:center;"><div style="height:40px;border-bottom:1px solid #999;width:200px;margin:auto;"></div><div>Firma Cliente</div></div>
        </div>

        <footer style="margin-top:15px;text-align:center;font-size:11px;color:#666;border-top:2px solid #00aaff;padding-top:6px;">
          © 2025 FUELTEK — La Trilla 1062, San Bernardo — Tel: +56 9 4043 5805
        </footer>
      </div>
    `;

    printArea.innerHTML = html;
    printArea.style.display = "block";
    window.print();
    setTimeout(() => (printArea.style.display = "none"), 800);
  }
});
