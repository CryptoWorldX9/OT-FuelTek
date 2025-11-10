/* Fueltek v5.3 - script.js
   - Formato CLP (separador de miles)
   - Impresión estilo ficha profesional
   - Exportar Excel (SheetJS)
   - Exportar / Importar DB JSON
   - Corrección y activación de todos los botones
*/

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

// formato CLP (separador de miles con punto en es-CL)
function formatCLP(value) {
  return new Intl.NumberFormat("es-CL").format(Number(value) || 0);
}

// descarga helper
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

  // Limpiar campos manualmente (botón nuevo) - añadido como botón dentro del form
  let clearFieldsBtn = document.getElementById("resetFormBtn");
  if (!clearFieldsBtn) {
    clearFieldsBtn = document.createElement("button");
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
  }
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
    // ensure numeric types for formatting:
    data.valorTrabajo = data.valorTrabajo ? Number(data.valorTrabajo) : 0;
    data.montoAbonado = data.montoAbonado ? Number(data.montoAbonado) : 0;
    buildPrintAndPrint(data);
  });

  function buildPrintAndPrint(data) {
    // Professional card layout, logo centered, blue border, orange titles
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:780px;margin:0 auto">
        <div style="border:3px solid #00aaff;border-radius:8px;padding:14px">
          <div style="text-align:center">
            <img src="logo-fueltek.png" alt="logo" style="width:120px;height:120px;object-fit:contain;background:white;padding:6px;border-radius:8px"/>
            <h2 style="margin:8px 0 0;color:#222">FUELTEK</h2>
            <div style="color:#555;font-weight:600">Servicio Técnico Multimarca</div>
            <div style="margin-top:6px;color:#666;font-size:12px">Tel: +56 9 4043 5805 — La Trilla 1062, San Bernardo</div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
            <div>
              <div style="font-size:12px;color:#777">N° OT</div>
              <div style="font-weight:700;font-size:20px">${data.ot}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;color:#777">Fecha impresión</div>
              <div style="font-size:12px;color:#333">${new Date().toLocaleString()}</div>
            </div>
          </div>

          <hr style="border:none;border-top:1px solid #e6e6e6;margin:12px 0"/>

          <section style="display:flex;gap:20px;margin-top:6px">
            <div style="flex:1">
              <div style="color: #f26522;font-weight:700;margin-bottom:6px">Datos del Cliente</div>
              <div style="font-size:13px;color:#222">
                <div><strong>Nombre:</strong> ${data.clienteNombre || ""}</div>
                <div><strong>Teléfono:</strong> ${data.clienteTelefono || ""}</div>
                <div><strong>Email:</strong> ${data.clienteEmail || ""}</div>
                <div><strong>Fecha Recibida:</strong> ${data.fechaRecibida || ""}</div>
                <div><strong>Fecha Entrega:</strong> ${data.fechaEntrega || ""}</div>
              </div>
            </div>

            <div style="flex:1">
              <div style="color: #f26522;font-weight:700;margin-bottom:6px">Datos de la Herramienta</div>
              <div style="font-size:13px;color:#222">
                <div><strong>Marca:</strong> ${data.marca || ""}</div>
                <div><strong>Modelo:</strong> ${data.modelo || ""}</div>
                <div><strong>N° Serie:</strong> ${data.serie || ""}</div>
                <div><strong>Año Fabricación:</strong> ${data.anio || ""}</div>
                <div style="margin-top:8px"><strong style="color:#333">Pago</strong></div>
                <div>Valor: <strong>${formatCLP(data.valorTrabajo)} CLP</strong></div>
                <div>Estado: ${data.estadoPago || ""}</div>
                <div>Abonado: <strong>${formatCLP(data.montoAbonado)} CLP</strong></div>
              </div>
            </div>
          </section>

          <section style="margin-top:12px">
            <div style="color: #f26522;font-weight:700;margin-bottom:6px">Accesorios / Revisión</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${(data.accesorios || []).map(a => `<span style="border:1px solid #e1e1e1;padding:6px 8px;border-radius:6px;font-size:12px;color:#333">${a}</span>`).join("")}
            </div>
          </section>

          <section style="margin-top:12px;display:flex;gap:18px">
            <div style="flex:1">
              <div style="color: #f26522;font-weight:700;margin-bottom:6px">Diagnóstico Inicial</div>
              <div style="border:1px solid #eaeaea;padding:10px;border-radius:6px;min-height:70px;font-size:13px;color:#222">${(data.diagnostico || "").replace(/\n/g, "<br/>")}</div>
            </div>
            <div style="flex:1">
              <div style="color: #f26522;font-weight:700;margin-bottom:6px">Trabajo Realizado / Notas</div>
              <div style="border:1px solid #eaeaea;padding:10px;border-radius:6px;min-height:70px;font-size:13px;color:#222">${(data.trabajo || "").replace(/\n/g, "<br/>")}</div>
            </div>
          </section>

          <div style="display:flex;gap:30px;margin-top:20px;align-items:flex-end">
            <div style="flex:1;text-align:center">
              <div style="height:70px;border-bottom:1px solid #bbb"></div>
              <div style="margin-top:6px;font-size:13px">Firma Taller</div>
            </div>
            <div style="flex:1;text-align:center">
              <div style="height:70px;border-bottom:1px solid #bbb"></div>
              <div style="margin-top:6px;font-size:13px">Firma Cliente</div>
            </div>
          </div>

          <div style="margin-top:18px;border-top:2px solid #00aaff;padding-top:10px;text-align:center;color:#666;font-size:12px">
            © 2025 FUELTEK — Tel: +56 9 4043 5805 — La Trilla 1062, San Bernardo
          </div>
        </div>
      </div>
    `;
    printArea.innerHTML = html;
    printArea.style.display = "block";
    // Esperar un microtick para asegurar que el DOM está actualizado antes de imprimir
    setTimeout(() => {
      window.print();
      setTimeout(() => (printArea.style.display = "none"), 800);
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
    // Normalizar rows
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
    // Convertir a hoja
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OTs");
    XLSX.writeFile(wb, `fueltek_ots_${new Date().toISOString().slice(0,10)}.xlsx`);
  });

  // ===== Export DB JSON =====
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
      // Insertar/actualizar cada orden
      for (const o of data) {
        // proteger la estructura mínima
        const order = Object.assign({}, o);
        if (!order.ot) {
          // si no tiene OT, asignar correlativo nuevo
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
