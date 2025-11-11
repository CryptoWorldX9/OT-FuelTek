/* Fueltek v5.1 - script.js
   - Corrige actualización de OTs ya creadas
   - Mantiene correlativo
   - Agrega botón Limpiar Campos
   - ¡NUEVO! Agrega imagen de timbre/sello en Firma Taller para impresión PDF
*/

const DB_NAME = "fueltek_db_v5";
const DB_VERSION = 1;
const STORE = "orders";
const OT_LOCAL = "fueltek_last_ot_v5";

let currentLoadedOt = null; // guarda el OT cargado para editar

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

document.addEventListener("DOMContentLoaded", () => {
  const otInput = document.getElementById("otNumber");
  const form = document.getElementById("otForm");
  const estadoPago = document.getElementById("estadoPago");
  const labelAbono = document.getElementById("labelAbono");
  const printArea = document.getElementById("printArea");
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("closeModal");
  const ordersList = document.getElementById("ordersList");
  const searchOt = document.getElementById("searchOt");

  const updateOtDisplay = () => (otInput.value = String(getLastOt() + 1));
  updateOtDisplay();

  // Mostrar / ocultar campo Abonado
  estadoPago.addEventListener("change", () => {
    if (estadoPago.value === "Abonado") labelAbono.classList.remove("hidden");
    else { labelAbono.classList.add("hidden"); document.getElementById("montoAbonado").value = ""; }
  });

  // Reservar nuevo OT (no guarda aún)
  document.getElementById("newOtBtn").addEventListener("click", () => {
    const reserved = nextOtAndSave();
    updateOtDisplay();
    alert("Reservado N° OT: " + reserved + ". En pantalla verás el siguiente disponible.");
  });

  // Guardar o actualizar
  document.getElementById("saveBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const order = {};
    for (const [k, v] of fd.entries()) {
      if (k === "accesorios") continue;
      order[k] = v;
    }
    order.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(c => c.value);
    order.fechaGuardado = new Date().toISOString();
    order.valorTrabajo = order.valorTrabajo ? Number(order.valorTrabajo) : 0;
    order.estadoPago = order.estadoPago || "Pendiente";
    order.montoAbonado = order.montoAbonado ? Number(order.montoAbonado) : 0;

    // Si se cargó una OT existente, mantener el mismo número
    if (currentLoadedOt) {
      order.ot = currentLoadedOt;
      try {
        await dbPut(order);
        alert("Orden actualizada correctamente ✅ (OT #" + currentLoadedOt + ")");
      } catch (err) {
        alert("Error al actualizar: " + err);
      }
      currentLoadedOt = null; // limpia el estado de edición
    } else {
      // Guardar una nueva OT
      const newOt = getLastOt() + 1;
      order.ot = String(newOt);
      try {
        await dbPut(order);
        setLastOt(newOt);
        alert("Orden guardada correctamente ✅ (OT #" + newOt + ")");
      } catch (err) {
        alert("Error al guardar: " + err);
      }
    }

    // Limpiar form y mostrar siguiente correlativo
    form.reset();
    labelAbono.classList.add("hidden");
    updateOtDisplay();
  });

  // Limpiar campos manualmente (botón nuevo)
  const clearFieldsBtn = document.createElement("button");
  clearFieldsBtn.id = "resetFormBtn";
  clearFieldsBtn.innerHTML = "🧹 Limpiar Campos";
  clearFieldsBtn.type = "button";
  clearFieldsBtn.style.cssText = `
    background:#777;
    color:white;
    border:none;
    border-radius:8px;
    padding:8px 12px;
    margin:8px 0;
    cursor:pointer;
    font-size:0.9rem;
  `;
  form.insertBefore(clearFieldsBtn, form.firstChild);

  clearFieldsBtn.addEventListener("click", () => {
    if (confirm("¿Seguro que deseas limpiar todos los campos?")) {
      form.reset();
      labelAbono.classList.add("hidden");
      currentLoadedOt = null;
      alert("Campos limpiados.");
    }
  });

  // Modal - Ver OT
  document.getElementById("viewBtn").addEventListener("click", async () => {
    await renderOrdersList();
    modal.classList.remove("hidden");
  });
  closeModal.addEventListener("click", () => modal.classList.add("hidden"));
  searchOt.addEventListener("input", () => renderOrdersList(searchOt.value.trim()));

  async function renderOrdersList(filter = "") {
    ordersList.innerHTML = "<div style='padding:10px;color:#666'>Cargando...</div>";
    const all = await dbGetAll();
    const rows = all
      .filter(o => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return (o.ot && o.ot.toLowerCase().includes(f)) ||
               (o.clienteNombre && o.clienteNombre.toLowerCase().includes(f));
      })
      .sort((a, b) => Number(b.ot) - Number(a.ot));

    if (rows.length === 0) { ordersList.innerHTML = "<div style='padding:10px'>No hay órdenes</div>"; return; }

    ordersList.innerHTML = "";
    for (const o of rows) {
      const div = document.createElement("div");
      div.className = "order-row";
      div.innerHTML = `
        <div><b>OT #${o.ot}</b> — ${o.clienteNombre || ""}<br><small>${o.marca || ""} ${o.modelo || ""}</small></div>
        <div class="order-actions">
          <button class="small" data-ot="${o.ot}" data-action="print">Imprimir</button>
          <button class="small" data-ot="${o.ot}" data-action="load">Cargar</button>
          <button class="small" data-ot="${o.ot}" data-action="delete" style="background:#b51b1b">Borrar</button>
        </div>`;
      ordersList.appendChild(div);
    }

    ordersList.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", async ev => {
        const ot = ev.target.dataset.ot;
        const action = ev.target.dataset.action;
        if (action === "print") {
          const dat = await dbGet(ot); buildPrintAndPrint(dat);
        } else if (action === "load") {
          const dat = await dbGet(ot); loadOrderToForm(dat); modal.classList.add("hidden");
        } else if (action === "delete") {
          if (confirm("¿Borrar OT #" + ot + "?")) {
            const db = await openDB();
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).delete(ot);
            tx.oncomplete = () => { alert("OT eliminada"); renderOrdersList(); };
          }
        }
      });
    });
  }

  function loadOrderToForm(o) {
    if (!o) return alert("Orden no encontrada.");
    form.reset();
    currentLoadedOt = o.ot; // se marcará como cargada para actualizar
    const fields = ["clienteNombre","clienteTelefono","clienteEmail","fechaRecibida","fechaEntrega",
      "marca","modelo","serie","anio","diagnostico","trabajo","valorTrabajo","estadoPago","montoAbonado","firmaTaller","firmaCliente"];
    fields.forEach(k => { const el = form.querySelector(`[name="${k}"]`); if (el) el.value = o[k] || ""; });
    form.querySelectorAll("input[name='accesorios']").forEach(ch => ch.checked = false);
    if (Array.isArray(o.accesorios)) o.accesorios.forEach(val => {
      const el = Array.from(form.querySelectorAll("input[name='accesorios']")).find(c => c.value === val);
      if (el) el.checked = true;
    });
    otInput.value = o.ot;
    if (o.estadoPago === "Abonado") labelAbono.classList.remove("hidden"); else labelAbono.classList.add("hidden");
    alert("Orden OT #" + o.ot + " cargada. Si modificas algo y guardas, se actualizará esa misma OT.");
  }

  // Imprimir actual o vista previa
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
    // Definimos el HTML para el timbre/sello
    const stampHtml = `
      <div style="position:absolute; top:-70px; left:50%; transform:translateX(-50%);">
        <img src="image.png" style="width:100px; height:100px; object-fit:contain; opacity:0.7;" alt="Sello Taller" />
      </div>
    `;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="logo-fueltek.png" style="width:90px;height:90px;object-fit:contain" alt="logo" />
          <div>
            <h2 style="margin:0">FUELTEK</h2>
            <div style="color:#f26522;font-weight:700">Servicio Técnico Multimarca</div>
            <div style="font-size:12px;margin-top:6px">Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</div>
          </div>
          <div style="margin-left:auto;text-align:right">
            <div style="font-weight:700;font-size:18px">N° OT: ${data.ot}</div>
            <div style="font-size:12px;margin-top:6px">Fecha impresión: ${new Date().toLocaleString()}</div>
          </div>
        </div>
        <hr style="border:none;border-top:1px solid #ddd;margin:10px 0 14px" />
        <div style="display:flex;gap:18px">
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
            N° Serie: ${data.serie || ""}<br/>
            Año Fabricación: ${data.anio || ""}<br/>
            <strong style="margin-top:8px;display:block">Pago</strong>
            Valor: ${data.valorTrabajo || "0"} CLP<br/>
            Estado: ${data.estadoPago || ""}<br/>
            Abonado: ${data.montoAbonado || "0"} CLP
          </div>
        </div>
        <div style="margin-top:12px"><strong>Revisión y Accesorios</strong><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px">${(data.accesorios||[]).map(s=>`<span style='border:1px solid #ddd;padding:6px 8px;border-radius:6px;font-size:12px'>${s}</span>`).join('')}</div></div>
        <div style="margin-top:12px"><strong>Diagnóstico Inicial</strong><div style="border:1px solid #eee;padding:8px;border-radius:6px;min-height:60px">${data.diagnostico || ""}</div></div>
        <div style="margin-top:12px"><strong>Trabajo Realizado / Notas del Técnico</strong><div style="border:1px solid #eee;padding:8px;border-radius:6px;min-height:60px">${data.trabajo || ""}</div></div>
        <div style="display:flex;gap:40px;margin-top:22px">
          <div style="flex:1;text-align:center; position:relative;">
            ${stampHtml} 
            <div style="height:60px;border-bottom:1px solid #aaa"></div>
            <div style="margin-top:6px">Firma Taller</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="height:60px;border-bottom:1px solid #aaa"></div>
            <div style="margin-top:6px">Firma Cliente</div>
          </div>
        </div>
      </div>`;
    printArea.innerHTML = html;
    printArea.style.display = "block";
    window.print();
    setTimeout(() => printArea.style.display = "none", 800);
  }

  // Borrar base de datos completa
  document.getElementById("clearBtn").addEventListener("click", async () => {
    if (!confirm("¿Borrar toda la base de datos y reiniciar contador a 727?")) return;
    await dbDeleteAll();
    setLastOt(726);
    updateOtDisplay();
    alert("Base de datos eliminada. Contador reiniciado a 727.");
  });
});
