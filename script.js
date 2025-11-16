/* Fueltek v7.5 - script.js
   Versión corregida: mantiene toda la lógica original,
   restaura exportar/imprimir/acciones de fila y corrige menú móvil.
   Además integra Firebase (guardar, leer, eliminar) sin tocar diseño.
*/

/* -------------------------
   CONFIG / CONSTANTES
   ------------------------- */
const DB_NAME = "fueltek_db_v7";
const DB_VERSION = 1;
const STORE = "orders";
const OT_LOCAL = "fueltek_last_ot_v7";

let currentLoadedOt = null;

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
    // order.ot DEBE ser string (ya manejado en el guardado)
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
    // Asegurar que la clave buscada sea siempre string para IndexedDB
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
   CORRELATIVO / LOCALSTORAGE
   ==================================================================== */
function getLastOt() {
  return parseInt(localStorage.getItem(OT_LOCAL) || "726", 10);
}
function setLastOt(n) { localStorage.setItem(OT_LOCAL, String(n)); }
function nextOtAndSave() {
  const n = getLastOt() + 1;
  setLastOt(n);
  return n;
}

/* ====================================================================
   BOTÓN GUARDAR - RESET
   ==================================================================== */
const resetSaveButton = () => {
    document.getElementById("saveBtn").title = "Guardar OT";
    document.getElementById("saveBtn").innerHTML = '<i data-lucide="save"></i><span>Guardar</span>'; 
    lucide.createIcons();
}

/* ====================================================================
   SALDO Y ESTADO DE PAGO
   ==================================================================== */
function updateSaldo() {
    const valorTrabajoInput = document.getElementById("valorTrabajoInput");
    const montoAbonadoInput = document.getElementById("montoAbonadoInput");
    const estadoPago = document.getElementById("estadoPago");
    const labelAbono = document.getElementById("labelAbono");
    
    const valor = unformatCLP(valorTrabajoInput.value);
    const estado = estadoPago.value;

    if (estado === "Abonado") {
        labelAbono.classList.remove("hidden");
    } else if (estado === "Pagado") {
        labelAbono.classList.add("hidden");
        montoAbonadoInput.value = formatCLP(valor); 
    } else { // Pendiente
        labelAbono.classList.add("hidden");
        montoAbonadoInput.value = "";
    }
}

/* ====================================================================
   DOMContentLoaded - eventos principales
   ==================================================================== */
document.addEventListener("DOMContentLoaded", () => {
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
  
  // Elementos del menú móvil
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileMenuDropdown = document.getElementById("mobileMenuDropdown");
    
  const updateOtDisplay = () => {
    otInput.value = String(getLastOt() + 1);
    resetSaveButton();
  }
  updateOtDisplay();
  
  // Agregar listeners para formato de miles Y ACTUALIZACIÓN DE SALDO EN TIEMPO REAL
  [valorTrabajoInput, montoAbonadoInput].forEach(input => {
    input.addEventListener("input", e => {
        handleFormatOnInput(e);
        updateSaldo();
    });
    // Aplicar formato y actualizar saldo al perder foco si se copia/pega
    input.addEventListener("blur", updateSaldo); 
  });

  // Mostrar / ocultar campo Abonado y recalcular Saldo
  estadoPago.addEventListener("change", updateSaldo);
  
  // Inicializar estado de pago
  updateSaldo();

  // --- LÓGICA DEL MENÚ MÓVIL ---
  
  // 1. Toggle mobile menu
  if(mobileMenuBtn) mobileMenuBtn.addEventListener("click", () => {
    mobileMenuDropdown.classList.toggle("active");
    // Cambiar icono: menú o X
    const iconContainer = mobileMenuBtn.querySelector('i');
    const newIconName = mobileMenuDropdown.classList.contains('active') ? 'x' : 'menu';
    if (iconContainer) iconContainer.innerHTML = `<i data-lucide="${newIconName}"></i>`;
    lucide.createIcons({ parent: mobileMenuBtn });
  });

  // 2. Cerrar el menú después de hacer click en cualquier botón de acción
  if(mobileMenuDropdown) mobileMenuDropdown.querySelectorAll("button, .import-label").forEach(btn => {
    btn.addEventListener("click", () => {
        // Usar setTimeout para que la acción del botón (ej. guardar) se ejecute primero
        setTimeout(() => {
            mobileMenuDropdown.classList.remove("active");
            if(mobileMenuBtn) {
                const iconContainer = mobileMenuBtn.querySelector('i');
                if (iconContainer) iconContainer.innerHTML = `<i data-lucide="menu"></i>`;
                lucide.createIcons({ parent: mobileMenuBtn });
            }
        }, 100);
    });
  });
  // -------------------------------------


  // Reservar nuevo OT
  document.getElementById("newOtBtn").addEventListener("click", () => {
    const reserved = nextOtAndSave();
    updateOtDisplay();
    alert("Reservado N° OT: " + reserved + ". En pantalla verás el siguiente disponible.");
  });
  
  // Borrar base de datos completa
  document.getElementById("clearBtn").addEventListener("click", async () => {
    if (!confirm("⚠️ ADVERTENCIA: Esta acción BORRARÁ toda la base de datos de Órdenes de Trabajo y reiniciará el contador a 727. ¿Desea continuar?")) return;
    await dbDeleteAll();
    setLastOt(726);
    updateOtDisplay();
    alert("Base de datos eliminada. Contador reiniciado a 727.");
  });
  
  // Limpiar campos manualmente
  document.getElementById("resetFormBtn").addEventListener("click", () => {
    if (confirm("¿Seguro que deseas limpiar todos los campos del formulario?")) {
      form.reset();
      labelAbono.classList.add("hidden");
      currentLoadedOt = null;
      updateOtDisplay(); // Restablece el número OT al siguiente correlativo y el botón
      updateSaldo(); // Limpia el saldo
      alert("Campos limpiados. Listo para una nueva OT.");
    }
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
    
    // Convertir a número entero limpio antes de guardar
    order.valorTrabajo = unformatCLP(order.valorTrabajo); 
    order.estadoPago = order.estadoPago || "Pendiente";
    order.montoAbonado = unformatCLP(order.montoAbonado);
    
    // Validación de lógica de negocio, no de campo obligatorio
    if (order.montoAbonado > order.valorTrabajo && order.estadoPago !== "Pagado") {
        return alert("Error: El monto abonado no puede ser mayor que el valor del trabajo.");
    }

    let saveMessage = "guardada";
    let otToSave;

    // Si se cargó una OT existente, mantener el mismo número
    if (currentLoadedOt) {
      // Asegurar que el OT sea string para IndexedDB
      order.ot = String(currentLoadedOt);
      otToSave = currentLoadedOt;
      saveMessage = "actualizada";
    } else {
      // Guardar una nueva OT y avanzar correlativo
      otToSave = String(getLastOt() + 1);
      order.ot = otToSave;
    }

    try {
      await dbPut(order);
      // Guardar también en Firebase (si está disponible)
      if (typeof firestore !== 'undefined') {
        firebaseSaveOrder(order).catch(err => console.error("Firebase save error:", err));
      }
      if (!currentLoadedOt) setLastOt(Number(otToSave)); // Solo avanza si es OT nueva
      alert(`Orden ${saveMessage} correctamente ✅ (OT #${otToSave})`);
    } catch (err) {
      alert(`Error al ${saveMessage === "guardada" ? "guardar" : "actualizar"}: ${err}`);
    }

    // Limpiar form y mostrar siguiente correlativo
    form.reset();
    labelAbono.classList.add("hidden");
    currentLoadedOt = null;
    updateOtDisplay(); // Restablece el número OT y el botón
    updateSaldo(); // Limpia el saldo
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

    // Intentamos leer desde Firebase si está disponible, si no fallback a IndexedDB
    let all = [];
    if (typeof firestore !== 'undefined') {
      try {
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
      div.innerHTML = `
        <div><b>OT #${o.ot}</b> — ${o.clienteNombre || "Sin Nombre"}<br><small>${o.marca || ""} ${o.modelo || ""}</small></div>
        <div class="order-actions">
          <button class="small" data-ot="${o.ot}" data-action="print" title="Imprimir"><i data-lucide="printer" style="width:14px;height:14px;"></i></button>
          <button class="small" data-ot="${o.ot}" data-action="load" title="Cargar para Editar"><i data-lucide="edit" style="width:14px;height:14px;"></i></button>
          <button class="small" data-ot="${o.ot}" data-action="delete" style="background:#b51b1b" title="Borrar"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
        </div>`;
      ordersList.appendChild(div);
      // Solo renderiza los íconos de la fila
      lucide.createIcons({ parent: div }); 
    }

    ordersList.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", async ev => {
        const targetBtn = ev.target.closest('button');
        // Aseguramos que el OT extraído del data-attribute sea string para la consulta
        const ot = String(targetBtn.dataset.ot);
        const action = targetBtn.dataset.action;
        if (action === "print") {
          // Preferir Firebase, fallback a IndexedDB
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
          if (dat) { loadOrderToForm(dat); modal.classList.add("hidden"); }
          else alert("Orden no encontrada para cargar.");
        } else if (action === "delete") {
          if (confirm("¿Borrar definitivamente OT #" + ot + "?")) {
            // Borrar en IndexedDB
            try {
              await dbDelete(ot);
            } catch (e) {
              console.error("Error al borrar en IndexedDB:", e);
            }
            // Borrar en Firebase si existe
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
                form.reset();
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
    form.reset();
    currentLoadedOt = String(o.ot); // Aseguramos que el OT cargado sea string
    const fields = ["clienteNombre","clienteTelefono","clienteEmail","fechaRecibida","fechaEntrega",
      "marca","modelo","serie","anio","diagnostico","trabajo","firmaTaller","firmaCliente"];
    fields.forEach(k => { const el = form.querySelector(`[name="${k}"]`); if (el) el.value = o[k] || ""; });
    
    // Cargar campos numéricos formateados
    valorTrabajoInput.value = formatCLP(o.valorTrabajo);
    montoAbonadoInput.value = formatCLP(o.montoAbonado);
    
    // Estado de pago
    estadoPago.value = o.estadoPago || "Pendiente";
    updateSaldo(); // Llama a la función para mostrar/ocultar abono
    
    // Checkboxes
    form.querySelectorAll("input[name='accesorios']").forEach(ch => ch.checked = false);
    if (Array.isArray(o.accesorios)) o.accesorios.forEach(val => {
      const el = Array.from(form.querySelectorAll("input[name='accesorios']")).find(c => c.value === val);
      if (el) el.checked = true;
    });
    
    otInput.value = o.ot;
    // Actualiza el contenido de texto para el botón de escritorio
    document.getElementById("saveBtn").title = "Actualizar OT #" + o.ot;
    document.getElementById("saveBtn").innerHTML = '<i data-lucide="refresh-cw"></i><span>Actualizar</span>';
    lucide.createIcons();
    
    alert("Orden OT #" + o.ot + " cargada. Si modificas algo y guardas, se actualizará esa misma OT.");
  }

  // Imprimir actual o vista previa
  document.getElementById("printBtn").addEventListener("click", e => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) if (k !== "accesorios") data[k] = v;
    data.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked')).map(c => c.value);
    data.ot = otInput.value || String(getLastOt() + 1);
    
    // Para impresión, usa el valor DESFORMATEADO para el cálculo
    data.valorTrabajoNum = unformatCLP(data.valorTrabajo);
    data.montoAbonadoNum = unformatCLP(data.montoAbonado);
    data.estadoPago = data.estadoPago || "Pendiente"; // Asegurar que tenga estado
    
    buildPrintAndPrint(data);
  });

  function buildPrintAndPrint(data) {
    // Asegurarse de tener números
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
  
  // Implementación de Exportar/Importar DB JSON y Exportar a Excel
  document.getElementById("exportBtn").addEventListener("click", async () => {
    const orders = await dbGetAll();
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

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Órdenes de Trabajo");
    XLSX.writeFile(wb, `Ordenes_Trabajo_Fueltek_${new Date().toISOString().slice(0, 10)}.xlsx`);
    alert("Exportación a Excel completada.");
  });

  document.getElementById("exportDbBtn").addEventListener("click", async () => {
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

  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const orders = JSON.parse(event.target.result);
        if (!Array.isArray(orders) || orders.some(o => typeof o.ot === 'undefined')) {
          return alert("Error: El archivo JSON no tiene el formato de Órdenes de Trabajo correcto.");
        }

        if (!confirm(`Se encontraron ${orders.length} órdenes. ¿Desea importarlas? Las órdenes existentes con el mismo N° OT se SOBRESCRIBIRÁN.`)) {
          e.target.value = null; // Limpiar el input file
          return;
        }

        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        let importedCount = 0;
        
        orders.forEach(order => {
            // Asegurar que el OT sea string para el keyPath
            order.ot = String(order.ot);
            const request = store.put(order);
            request.onsuccess = () => importedCount++;
            request.onerror = (e) => console.error("Error al importar OT:", order.ot, e.target.error);

            // También intentar guardar en Firebase si está disponible
            if (typeof firestore !== 'undefined') {
              firebaseSaveOrder(order).catch(err => console.error("Error firebase import:", err));
            }
        });

        tx.oncomplete = () => {
            alert(`Importación finalizada. ${importedCount} órdenes procesadas.`);
            const maxOt = Math.max(...orders.map(o => Number(o.ot)), getLastOt());
            setLastOt(maxOt);
            updateOtDisplay();
            e.target.value = null;
        };
        tx.onerror = (e) => alert("Error en la transacción de importación: " + e.target.error);
      } catch (error) {
        alert("Error al leer o parsear el archivo JSON: " + error.message);
        e.target.value = null;
      }
    };
    reader.readAsText(file);
  });
});

/* ====================================================================
   FIREBASE - funciones auxiliares (siempre opcional)
   - Requiere que en index.html hayas inicializado firebase y firestore
   ==================================================================== */

async function firebaseSaveOrder(order) {
  if (typeof firestore === 'undefined') return Promise.reject("Firestore no inicializado");
  try {
    // Convertir campos a tipos simples (ej. evitar Date objetos)
    const copy = Object.assign({}, order);
    // Asegurarse que no haya funciones ni referencias
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
