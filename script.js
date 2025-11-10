/* Fueltek v6.0 - mantiene funcionalidades originales + impresión minimalista + formato CLP en vivo */

const DB_NAME = "fueltek_db_v6";
const DB_VERSION = 1;
const STORE = "orders";
const OT_LOCAL = "fueltek_last_ot_v6";

let currentLoadedOt = null; // guarda el OT cargado para editar

/* ---------- IndexedDB helpers ---------- */
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

/* ---------- correlativo OT ---------- */
function getLastOt() {
  return parseInt(localStorage.getItem(OT_LOCAL) || "726", 10);
}
function setLastOt(n) { localStorage.setItem(OT_LOCAL, String(n)); }
function nextOtAndSave() {
  const n = getLastOt() + 1;
  setLastOt(n);
  return n;
}

/* ---------- formateo CLP ---------- */
function formatCLPNumber(value) {
  return new Intl.NumberFormat("es-CL").format(Number(value) || 0);
}
function unformatCLPString(str) {
  if (str == null) return 0;
  return Number(String(str).replace(/\./g, "").replace(/,/g, "")) || 0;
}

/* ---------- DOM ready ---------- */
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
  const valorTrabajoInput = document.getElementById("valorTrabajo");
  const montoAbonadoInput = document.getElementById("montoAbonado");

  const updateOtDisplay = () => (otInput.value = String(getLastOt() + 1));
  updateOtDisplay();

  /* ---------- formato en vivo para inputs numéricos (miles con punto) ---------- */
  function attachCLPFormatter(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("input", (e) => {
      // preservar cursor sencillo: reconstruir valor limpio
      const raw = inputEl.value.replace(/[^\d]/g, "");
      if (!raw) { inputEl.value = ""; return; }
      inputEl.value = formatCLPNumber(raw);
    });
    // allow paste numeric
    inputEl.addEventListener("paste", (ev) => {
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData('text');
      const digits = text.replace(/[^\d]/g, "");
      if (digits) inputEl.value = formatCLPNumber(digits);
    });
  }
  attachCLPFormatter(valorTrabajoInput);
  attachCLPFormatter(montoAbonadoInput);

  // Mostrar / ocultar campo Abonado
  estadoPago.addEventListener("change", () => {
    if (estadoPago.value === "Abonado") labelAbono.classList.remove("hidden");
    else { labelAbono.classList.add("hidden"); montoAbonadoInput.value = ""; }
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
    // convertir valores formateados a número
    order.valorTrabajo = unformatCLPString(order.valorTrabajo);
    order.estadoPago = order.estadoPago || "Pendiente";
    order.montoAbonado = unformatCLPString(order.montoAbonado);

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

  // Limpiar campos manualmente (botón nuevo adicional en el form)
  let clearFieldsBtn = document.getElementById("resetFormBtn");
  if (!clearFieldsBtn) {
    clearFieldsBtn = document.createElement("button");
    clearFieldsBtn.id = "resetFormBtn";
    clearFieldsBtn.innerHTML = "🧹 Limpiar Campos";
    clearFieldsBtn.type = "button";
    clearFieldsBtn.style.cssText = `
      background:#777;color:white;border:none;border-radius:8px;padding:8px 12px;margin:8px 0;cursor:pointer;font-size:0.9rem;
    `;
    form.insertBefore(clearFieldsBtn, form.firstChild);
  }
  clearFieldsBtn.addEventListener("click", () => {
    if (confirm("¿Seguro que deseas limpiar todos los campos?")) {
      form.reset();
      labelAbono.classList.add("hidden");
      currentLoadedOt = null;
      // reset formatted fields
      if (valorTrabajoInput) valorTrabajoInput.value = "";
      if (montoAbonadoInput) montoAbonadoInput.value = "";
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
        return (o.ot && String(o.ot).toLowerCase().includes(f)) ||
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
      "marca","modelo","serie","anio","diagnostico","trabajo","estadoPago","firmaTaller","firmaCliente"];
    fields.forEach(k => { const el = form.querySelector(`[name="${k}"]`); if (el) el.value = o[k] || ""; });
    // valores numéricos formateados para mostrar
    if (valorTrabajoInput) valorTrabajoInput.value = formatCLPNumber(o.valorTrabajo || 0);
    if (montoAbonadoInput) montoAbonadoInput.value = formatCLPNumber(o.montoAbonado || 0);
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
    // ensure numeric types for formatting:
    data.valorTrabajo = unformatCLPString(data.valorTrabajo);
    data.montoAbonado = unformatCLPString(data.montoAbonado);
    buildPrintAndPrint(data);
  });

  function buildPrintAndPrint(data) {
    // Professional minimal layout, logo centered, subtle card
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:780px;margin:0 auto">
        <div style="padding:16px;border-radius:6px;">
          <div style="text-align:center;">
            <div style="background:#00aaff;padding:18px 12px;border-top-left-radius:8px;border-top-right-radius:8px;">
              <img src="logo-fueltek.png" style="height:84px;background:white;padding:6px;border-radius:8px;display:inline-block" alt="logo"/>
              <h2 style="margin:10px 0 0 0;color:white;font-weight:700">FUELTEK</h2>
              <div style="color:white;font-weight:500">Servicio Técnico Multimarca</div>
            </div>
            <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#444">
              <div style="text-align:left">
                <div><strong style="color:#333">Cliente:</strong> ${data.clienteNombre || ""}</div>
                <div style="color:#666;font-size:12px">${data.clienteTelefono ? 'Tel: '+data.clienteTelefono : ''} ${data.clienteEmail ? ' | '+data.clienteEmail : ''}</div>
              </div>
              <div style="text-align:right">
                <div><strong style="color:#333">OT N°</strong> ${data.ot || ""}</div>
                <div style="color:#666;font-size:12px">Impreso: ${new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>

          <hr style="border:none;border-top:1px solid #eee;margin:14px 0"/>

          <div style="display:flex;gap:20px">
            <div style="flex:1">
              <div style="color:${getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#f26522'};font-weight:700;margin-bottom:6px">Datos de la Herramienta</div>
              <div style="font-size:13px;color:#222">
                <div><strong>Marca:</strong> ${data.marca || ""}</div>
                <div><strong>Modelo:</strong> ${data.modelo || ""}</div>
                <div><strong>Serie:</strong> ${data.serie || ""}</div>
                <div><strong>Año:</strong> ${data.anio || ""}</div>
              </div>
            </div>

            <div style="width:260px">
              <div style="color:${getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#f26522'};font-weight:700;margin-bottom:6px">Pago</div>
              <table style="width:100%;font-size:13px;color:#222">
                <tr><td>Valor del trabajo</td><td style="text-align:right"><strong>${formatCLPNumber(data.valorTrabajo)}</strong> CLP</td></tr>
                <tr><td>Estado</td><td style="text-align:right">${data.estadoPago || ""}</td></tr>
                <tr><td>Abonado</td><td style="text-align:right"><strong>${formatCLPNumber(data.montoAbonado)}</strong> CLP</td></tr>
              </table>
            </div>
          </div>

          <div style="margin-top:12px">
            <div style="color:${getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#f26522'};font-weight:700;margin-bottom:6px">Accesorios / Revisión</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${(data.accesorios || []).map(a => `<span style="border:1px solid #e6e6e6;padding:6px 8px;border-radius:6px;font-size:12px;color:#333">${a}</span>`).join("")}
            </div>
          </div>

          <div style="margin-top:12px;display:flex;gap:18px">
            <div style="flex:1">
              <div style="color:${getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#f26522'};font-weight:700;margin-bottom:6px">Diagnóstico Inicial</div>
              <div style="border:1px solid #eee;padding:10px;border-radius:6px;min-height:70px;font-size:13px;color:#222">${(data.diagnostico || "").replace(/\n/g, "<br/>")}</div>
            </div>
            <div style="flex:1">
              <div style="color:${getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#f26522'};font-weight:700;margin-bottom:6px">Trabajo Realizado / Notas</div>
              <div style="border:1px solid #eee;padding:10px;border-radius:6px;min-height:70px;font-size:13px;color:#222">${(data.trabajo || "").replace(/\n/g, "<br/>")}</div>
            </div>
          </div>

          <div style="display:flex;gap:30px;margin-top:28px;justify-content:space-between">
            <div style="text-align:center">
              <div style="height:70px;border-bottom:1px solid #bbb;width:240px;margin:auto"></div>
              <div style="margin-top:6px;color:#444">Firma Taller</div>
            </div>
            <div style="text-align:center">
              <div style="height:70px;border-bottom:1px solid #bbb;width:240px;margin:auto"></div>
              <div style="margin-top:6px;color:#444">Firma Cliente</div>
            </div>
          </div>

          <div style="margin-top:18px;border-top:1px solid #00aaff;padding-top:10px;text-align:center;color:#777;font-size:12px">
            © 2025 FUELTEK — Tel: +56 9 4043 5805 — La Trilla 1062, San Bernardo
          </div>
        </div>
      </div>
    `;
    printArea.innerHTML = html;
    printArea.style.display = "block";
    // slight delay to allow rendering
    setTimeout(() => {
      window.print();
      setTimeout(() => printArea.style.display = "none", 800);
    }, 50);
  }

  // Borrar base de datos completa
  document.getElementById("clearBtn").addEventListener("click", async () => {
    if (!confirm("¿Borrar toda la base de datos y reiniciar contador a 727?")) return;
    await dbDeleteAll();
    setLastOt(726);
    updateOtDisplay();
    alert("Base de datos eliminada. Contador reiniciado a 727.");
  });

  // ===== Exportar a Excel (SheetJS) =====
  document.getElementById("exportBtn").addEventListener("click", async () => {
    const all = await dbGetAll();
    if (!all || all.length === 0) return alert("No hay órdenes para exportar.");
    const rows = all.map(o => ({
      ot: o.ot,
      clienteNombre: o.clienteNombre || "",
      clienteTelefono: o.clienteTelefono || "",
      clienteEmail: o.clienteEmail || "",
      fechaRecibida: o.fechaRecibida || "",
      fechaEntrega: o.fechaEntrega || "",
      marca: o.marca || "",
      modelo: o.modelo || "",
      serie: o.serie || "",
      anio: o.anio || "",
      accesorios: (o.accesorios || []).join(", "),
      diagnostico: o.diagnostico || "",
      trabajo: o.trabajo || "",
      valorTrabajo: o.valorTrabajo || 0,
      estadoPago: o.estadoPago || "",
      montoAbonado: o.montoAbonado || 0,
      fechaGuardado: o.fechaGuardado || ""
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OTs");
    XLSX.writeFile(wb, `fueltek_ots_${new Date().toISOString().slice(0,10)}.xlsx`);
  });

  // ===== Export DB JSON =====
  function downloadBlob(filename, content, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  document.getElementById("exportDbBtn").addEventListener("click", async () => {
    const all = await dbGetAll();
    const json = JSON.stringify(all || [], null, 2);
    downloadBlob(`fueltek_db_${new Date().toISOString().slice(0,10)}.json`, json, "application/json");
  });

  // ===== Import DB JSON =====
  document.getElementById("importFile").addEventListener("change", async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (!confirm("¿Importar este archivo JSON y añadir/actualizar órdenes en la base de datos?")) { ev.target.value = ""; return; }
    const txt = await f.text();
    try {
      const data = JSON.parse(txt);
      if (!Array.isArray(data)) throw new Error("JSON no contiene un array");
      for (const o of data) {
        const order = Object.assign({}, o);
        // ensure numeric fields are numbers
        order.valorTrabajo = unformatCLPString(order.valorTrabajo);
        order.montoAbonado = unformatCLPString(order.montoAbonado);
        if (!order.ot) {
          order.ot = String(getLastOt() + 1);
          setLastOt(Number(order.ot));
        }
        await dbPut(order);
      }
      alert("Importación completada.");
    } catch (err) {
      alert("Error al importar JSON: " + err.message);
    } finally {
      ev.target.value = "";
    }
  });

});
