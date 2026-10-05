/* FuelTek Professional: compatible con fueltek_db_v7 y las colecciones existentes. */

/* -------------------------
   CONFIG / CONSTANTES
   ------------------------- */
const DB_NAME = "fueltek_db_v7";
const DB_VERSION = 1;
const STORE = "orders";
const OT_LOCAL = "fueltek_last_ot_v7";
const OT_FIREBASE_DOC = "lastOt"; // Nombre del documento en Firebase para el correlativo

let currentLoadedOt = null;
let loadedOrderSnapshot = {};
let saveInProgress = false;
let lastKnownOt = 10724; // Valor inicial por defecto local

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
    tx.oncomplete = () => { res(true); db.close(); };
    tx.onabort = tx.onerror = () => { rej(tx.error || r.error); db.close(); };
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

/* ====================================================================
   CORRELATIVO / LOCALSTORAGE / FIREBASE
   ==================================================================== */

// Obtiene el último OT desde la variable global (inicializada desde Firebase/Local)
function getLastOt() {
  return lastKnownOt;
}

// Guarda el correlativo localmente y, si es mayor, lo guarda en Firebase
function setLastOt(n) {
  lastKnownOt = Math.max(lastKnownOt, Number(n) || 0);
  localStorage.setItem(OT_LOCAL, String(lastKnownOt));
}

// 💥 NUEVA FUNCIÓN: Obtiene el correlativo maestro desde Firebase
async function getFirebaseCorrelative() {
  if (window.fueltekRequireAccess) window.fueltekRequireAccess();
  const localValue = parseInt(localStorage.getItem(OT_LOCAL) || "10724", 10);
  if (typeof firestore === 'undefined') {
    // Si Firebase no está cargado, usa el valor local/default
    return parseInt(localStorage.getItem(OT_LOCAL) || "10724", 10);
  }

  try {
    const doc = await firestore.collection("config").doc(OT_FIREBASE_DOC).get();

    // El valor por defecto es el de localStorage o 10724


    if (doc.exists) {
      const firebaseValue = doc.data().value;
      // Usar el valor MÁS ALTO entre local y Firebase para evitar regresiones
      return Math.max(localValue, firebaseValue);
    } else {
      // Si el documento maestro no existe, lo creamos con el valor local
      lastKnownOt = localValue;
      return localValue;
    }
  } catch (error) {
    console.error("Fallo al leer correlativo de Firebase, usando valor local.", error);
    // En caso de fallo (ej. sin conexión), usamos el valor local
    return localValue;
  }
}


/* ====================================================================
   BOTÓN GUARDAR - RESET
   ==================================================================== */
const resetSaveButton = () => {
    const saveBtn = document.getElementById("saveBtn");
    if (!saveBtn) return;
    saveBtn.title = "Guardar OT";
    saveBtn.innerHTML = '<i data-lucide="save"></i><span>Guardar</span>';
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

    // Comprobaciones de seguridad
    if (!valorTrabajoInput || !montoAbonadoInput || !estadoPago || !labelAbono) return;

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
document.addEventListener("DOMContentLoaded", async () => {
  if (window.fueltekAccessReady) await window.fueltekAccessReady;
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
  const saveBtn = document.getElementById("saveBtn");
  const newOtBtn = document.getElementById("newOtBtn");
  const resetFormBtn = document.getElementById("resetFormBtn");
  const viewBtn = document.getElementById("viewBtn");
  const printBtn = document.getElementById("printBtn");
  const exportBtn = document.getElementById("exportBtn");
  const exportDbBtn = document.getElementById("exportDbBtn");
  const importFile = document.getElementById("importFile");
  form.addEventListener("submit", e => { e.preventDefault(); saveBtn.click(); });


  // 💥 FUNCIÓN CORREGIDA: Asíncrona para obtener el correlativo de Firebase
  const updateOtDisplay = async () => {
    // 1. Obtiene el último correlativo Sincronizado (Firebase o Local)
    const latestOt = await getFirebaseCorrelative();
    lastKnownOt = latestOt; // Actualiza la variable global

    if (otInput && !currentLoadedOt) {
        // Muestra el siguiente OT disponible
        otInput.value = String(latestOt + 1);
    }
    resetSaveButton();
  }

  // 💥 Llamada inicial asíncrona
  updateOtDisplay();

  // Agregar listeners para formato de miles Y ACTUALIZACIÓN DE SALDO EN TIEMPO REAL
  [valorTrabajoInput, montoAbonadoInput].forEach(input => {
    if (input) { // ⬅️ COMPROBACIÓN
        input.addEventListener("input", e => {
            handleFormatOnInput(e);
            updateSaldo();
        });
        // Aplicar formato y actualizar saldo al perder foco si se copia/pega
        input.addEventListener("blur", updateSaldo);
    }
  });

  // Mostrar / ocultar campo Abonado y recalcular Saldo
  if (estadoPago) { // ⬅️ COMPROBACIÓN
      estadoPago.addEventListener("change", updateSaldo);
  }

  // Inicializar estado de pago
  updateSaldo();

  // --- LÓGICA DEL MENÚ MÓVIL ---

  // 1. Toggle mobile menu
  if(mobileMenuBtn && mobileMenuDropdown) { // ⬅️ COMPROBACIÓN ROBUSTA: Si uno falta, no se ejecuta
      mobileMenuBtn.addEventListener("click", () => {
          mobileMenuDropdown.classList.toggle("active");
          // Cambiar icono: menú o X
          const iconContainer = mobileMenuBtn.querySelector('i');
          const newIconName = mobileMenuDropdown.classList.contains('active') ? 'x' : 'menu';
          if (iconContainer) iconContainer.innerHTML = `<i data-lucide="${newIconName}"></i>`;
          lucide.createIcons({ parent: mobileMenuBtn });
      });
  }


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


  if (newOtBtn) newOtBtn.addEventListener("click", async () => {
    if ((window.fueltekDirty || window.fueltekRecoverable) && !confirm("Hay cambios sin guardar. ¿Abrir una nueva orden?")) return;
    form.reset(); currentLoadedOt = null; loadedOrderSnapshot = {};
    window.fueltekDirty = false;
    await updateOtDisplay(); updateSaldo();
    document.dispatchEvent(new Event("fueltek:new"));
  });

  // Limpiar campos manualmente
  if (resetFormBtn) resetFormBtn.addEventListener("click", async () => {
    if (confirm("¿Seguro que deseas limpiar todos los campos del formulario?")) {
      form.reset();
      if (labelAbono) labelAbono.classList.add("hidden");
      currentLoadedOt = null; loadedOrderSnapshot = {};
      document.dispatchEvent(new Event("fueltek:discard"));
      await updateOtDisplay(); // Restablece el número OT al siguiente correlativo y el botón
      updateSaldo(); // Limpia el saldo
      alert("Campos limpiados. Listo para una nueva OT.");
    }
  });


  // Guardar o actualizar
  if (saveBtn) saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!form || saveInProgress || !form.reportValidity()) return;

    const fd = new FormData(form);
    const order = { ...loadedOrderSnapshot };
    for (const [k, v] of fd.entries()) {
      if (k === "accesorios") continue;
      order[k] = v;
    }
    order.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(c => c.value);
    order.fechaGuardado = new Date().toISOString();

    // Convertir a número entero limpio antes de guardar
    order.valorTrabajo = unformatCLP(order.valorTrabajo);
    order.estadoPago = order.estadoPago || "Pendiente";
    order.montoAbonado = order.estadoPago === "Pagado" ? order.valorTrabajo : unformatCLP(order.montoAbonado);
    if (order.fechaEntrega && order.fechaRecibida && order.fechaEntrega < order.fechaRecibida) return alert("La entrega no puede ser anterior a la recepción.");

    // Validación de lógica de negocio, no de campo obligatorio
    if (order.montoAbonado > order.valorTrabajo && order.estadoPago !== "Pagado") {
        return alert("Error: El monto abonado no puede ser mayor que el valor del trabajo.");
    }

    let saveMessage = "guardada";
    let otToSave;
    let isNewOt = false; // Variable para determinar si es OT nueva

    // Si se cargó una OT existente, mantener el mismo número
    if (currentLoadedOt) {
      // Asegurar que el OT sea string para IndexedDB
      order.ot = String(currentLoadedOt);
      otToSave = currentLoadedOt;
      saveMessage = "actualizada";
    } else {
      // 💥 Si es OT nueva, usa el último OT conocido (sincronizado)
      const latestOt = getLastOt(); // Obtiene el correlativo MÁS alto conocido
      otToSave = String(latestOt + 1);
      order.ot = otToSave;
      isNewOt = true; // Marcar como nueva
    }

    saveInProgress = true; saveBtn.disabled = true;
    try {
      if (isNewOt) {
        if (typeof firestore === "undefined" || !navigator.onLine) throw new Error("Para asignar una OT nueva sin duplicar números, conecta la nube. Tu borrador permanece en este equipo.");
        order.ot = await createCloudOrder(order); otToSave = order.ot;
        currentLoadedOt = order.ot; loadedOrderSnapshot = {...order}; otInput.value = order.ot;
        setLastOt(Number(order.ot));
      } else {
        if (typeof firestore === "undefined" || !navigator.onLine) throw new Error("Conecta la nube antes de actualizar la orden. Tu borrador permanece en este equipo.");
        await firebaseSaveOrder(order, loadedOrderSnapshot);
      }
      loadedOrderSnapshot = {...order};
      try { await dbPut(order); } catch(error) { alert("La orden está guardada en la nube, pero no se pudo crear su copia local. Descarga un respaldo cuando sea posible."); }

      // 2. Si es OT nueva, avanzar el correlativo local Y FIREBASE después de guardar en IndexedDB
      if (isNewOt) {
          setLastOt(Number(otToSave)); // Incrementa el local y Firebase
      }

      document.dispatchEvent(new Event("fueltek:saved"));
      alert(`Orden ${saveMessage} correctamente ✅ (OT #${otToSave})`);
    } catch (err) {
      // Este catch ahora es para errores de IndexedDB, que son críticos
      alert(`Error al ${saveMessage === "guardada" ? "guardar" : "actualizar"} la OT: ${err}`);
      return;
    } finally { saveInProgress = false; saveBtn.disabled = false; }

    // Limpiar form y mostrar siguiente correlativo
    form.reset();
    if (labelAbono) labelAbono.classList.add("hidden");
    currentLoadedOt = null; loadedOrderSnapshot = {};
    await updateOtDisplay(); // 💥 Sincroniza y muestra el siguiente correlativo (otToSave + 1)
    updateSaldo(); // Limpia el saldo
    document.dispatchEvent(new Event("fueltek:balance"));
  });

  let historyOrders = null;
  // Modal - Ver OT
  document.addEventListener("fueltek:open-order", e => loadOrderToForm(e.detail));
  if (viewBtn) viewBtn.addEventListener("click", async () => {
    historyOrders = null;
    await renderOrdersList();
    if (modal) modal.classList.remove("hidden");
  });
  if (closeModal) closeModal.addEventListener("click", () => modal.classList.add("hidden"));
  if (searchOt) searchOt.addEventListener("input", () => renderOrdersList(searchOt.value.trim()));

  async function renderOrdersList(filter = "") {
    if (!ordersList) return; // ⬅️ COMPROBACIÓN BÁSICA
    ordersList.innerHTML = "<div style='padding:10px;color:#666'>Cargando...</div>";

    if (!historyOrders) historyOrders = (await getCombinedOrders()).orders;
    const all = historyOrders;
    const rows = all
      .filter(o => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return (String(o.ot).toLowerCase().includes(f)) ||
               [o.clienteNombre, o.marca, o.modelo, o.serie, o.tecnico].some(v => String(v || "").toLowerCase().includes(f));
      })
      .sort((a, b) => Number(b.ot) - Number(a.ot));

    if (rows.length === 0) { ordersList.innerHTML = "<div style='padding:10px'>No hay órdenes guardadas.</div>"; return; }

    ordersList.innerHTML = "";
    for (const o of rows) {
      const div = document.createElement("div");
      div.className = "order-row";
      div.innerHTML = `
        <div><b>OT #${escapeHTML(o.ot)}</b> — ${escapeHTML(o.clienteNombre || "Sin Nombre")}<br><small>${escapeHTML(o.marca || "")} ${escapeHTML(o.modelo || "")}</small></div>
        <div class="order-actions">
          <button class="small" data-ot="${escapeHTML(o.ot)}" data-action="print" title="Imprimir"><i data-lucide="printer" style="width:14px;height:14px;"></i></button>
          <button class="small" data-ot="${escapeHTML(o.ot)}" data-action="load" title="Cargar para Editar"><i data-lucide="edit" style="width:14px;height:14px;"></i></button>

        </div>`;
      ordersList.appendChild(div);
      // Solo renderiza los íconos de la fila
      lucide.createIcons({ parent: div });
    }

    ordersList.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", async ev => {
        const targetBtn = ev.target.closest('button');
        if (!targetBtn) return; // Safety check
        // Aseguramos que el OT extraído del data-attribute sea string para la consulta
        const ot = String(targetBtn.dataset.ot);
        const action = targetBtn.dataset.action;
        if (action === "print") {
          const dat = all.find(o => String(o.ot) === ot);
          if (dat) buildPrintAndPrint(dat);
          else alert("Orden no encontrada para imprimir.");
        } else if (action === "load") {
          if ((window.fueltekDirty || window.fueltekRecoverable) && !confirm("Hay cambios sin guardar. ¿Abrir otra orden?")) return;
          const dat = all.find(o => String(o.ot) === ot);
          if (dat) { loadOrderToForm(dat); if (modal) modal.classList.add("hidden"); }
          else alert("Orden no encontrada para cargar.");
        }
      });
    });
  }

  function loadOrderToForm(o) {
    if (!o) return alert("Orden no encontrada.");
    const saveBtn = document.getElementById("saveBtn"); // ⬅️ Obtener saveBtn aquí para actualización
    if (!form || !otInput || !saveBtn) return alert("Error interno: Elementos del formulario no cargados."); // ⬅️ COMPROBACIÓN ADICIONAL
    form.reset();
    loadedOrderSnapshot = {...o};
    currentLoadedOt = String(o.ot); // Aseguramos que el OT cargado sea string
    const fields = ["clienteNombre","clienteTelefono","clienteEmail","fechaRecibida","fechaEntrega",
      "marca","modelo","serie","anio","diagnostico","trabajo","firmaTaller","firmaCliente","tecnico","estadoServicio","prioridad","tipoEquipo"];
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

    form.elements.estadoServicio.value = o.estadoServicio || "Recibida";
    form.elements.prioridad.value = o.prioridad || "Normal";
    document.dispatchEvent(new Event("fueltek:loaded"));
    otInput.value = o.ot;
    // Actualiza el contenido de texto para el botón de escritorio
    saveBtn.title = "Actualizar OT #" + o.ot;
    saveBtn.innerHTML = '<i data-lucide="refresh-cw"></i><span>Actualizar</span>';
    lucide.createIcons();


  }

  // Imprimir actual o vista previa
  if (printBtn) printBtn.addEventListener("click", async e => {
    e.preventDefault();
    if (!form || !otInput) return; // Safety check

    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) if (k !== "accesorios") data[k] = v;
    data.accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(c => c.value);

    // 💥 Al imprimir, usa el OT actual o el siguiente si es un formulario nuevo
    let otValue = otInput.value;
    data.ot = otValue;

    // Para impresión, usa el valor DESFORMATEADO para el cálculo
    data.valorTrabajoNum = unformatCLP(data.valorTrabajo);
    data.montoAbonadoNum = unformatCLP(data.montoAbonado);
    data.estadoPago = data.estadoPago || "Pendiente"; // Asegurar que tenga estado

    buildPrintAndPrint(data);
  });

  function buildPrintAndPrint(data) {
    if (!printArea) return; // ⬅️ COMPROBACIÓN BÁSICA

    data = { ...data };
    Object.keys(data).forEach(k => { if (typeof data[k] === "string") data[k] = escapeHTML(data[k]); });
    data.accesorios = (data.accesorios || []).map(escapeHTML);
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
          <img src="logo-fueltek.png" style="width:100px;height:100px;object-fit:contain;border-radius:8px;" alt="logo" />
          <div style="flex-grow:1">
            <h2 style="margin:0;color:#004d99;font-size:20px;">ORDEN DE TRABAJO - FUELTEK</h2>
            <div style="color:#f26522;font-weight:600;font-size:14px;">Servicio Técnico Multimarca</div>
            <div style="font-size:11px;margin-top:3px;color:#555;">Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</div>
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

        <div style="display:flex;gap:40px;margin-top:40px;padding-top:10px;border-top:1px solid #eee;">
          <div style="flex:1;text-align:center; position: relative;">
            <img src="stamp-motosierra.png" style="width: 150px; height: 150px; opacity: 1.0; position: absolute; top: -70px; left: 50%; transform: translateX(-50%);" alt="Sello Taller" />
            <div style="height:1px;border-bottom:1px solid #2c3e50;margin:0 auto;width:80%;font-size:9.5pt;">${data.firmaTaller || ""}</div>
            <div style="margin-top:6px;font-weight:600;color:#2c3e50;font-size:9.5pt;">Firma Taller</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="height:1px;border-bottom:1px solid #2c3e50;margin:0 auto;width:80%;font-size:9.5pt;">${data.firmaCliente || ""}</div>
            <div style="margin-top:6px;font-weight:600;color:#2c3e50;font-size:9.5pt;">Firma Cliente</div>
          </div>
        </div>

        <div style="margin-top:40px;padding:8px;background:#f0f7ff;border:1px solid #d0e0f0;border-radius:6px;font-size:9pt;color:#444;">
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
  if (exportBtn) exportBtn.addEventListener("click", async () => {
    const {orders, cloudAvailable} = await getCombinedOrders();
    if (!cloudAvailable && !confirm("La nube no está disponible. Este respaldo incluirá solo las órdenes locales y puede estar incompleto. ¿Descargarlo?")) return;
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
      'Estado Servicio': o.estadoServicio || 'Recibida',
      'Técnico': o.tecnico || '',
      'Prioridad': o.prioridad || 'Normal',
      'Estado Pago': o.estadoPago,
      'Monto Abonado (CLP)': o.montoAbonado,
      'Fecha Guardado': new Date(o.fechaGuardado).toLocaleString('es-CL'),
    }));

    if (typeof XLSX !== 'undefined' && XLSX.utils) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Órdenes de Trabajo");
        XLSX.writeFile(wb, `Ordenes_Trabajo_Fueltek_${new Date().toISOString().slice(0, 10)}.xlsx`);
        alert("Exportación a Excel completada.");
    } else {
        alert("Error: La librería de exportación (xlsx.full.min.js) no está cargada correctamente.");
    }
  });

  if (exportDbBtn) exportDbBtn.addEventListener("click", async () => {
    const {orders, cloudAvailable} = await getCombinedOrders();
    if (!cloudAvailable && !confirm("La nube no está disponible. Este respaldo incluirá solo las órdenes locales y puede estar incompleto. ¿Descargarlo?")) return;
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

  if (importFile) importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const orders = JSON.parse(event.target.result);
        if (!Array.isArray(orders) || orders.some(o => typeof o.ot === 'undefined')) {
          return alert("Error: El archivo JSON no tiene el formato de Órdenes de Trabajo correcto.");
        }

        if (orders.some(o => !o || typeof o !== "object" || !/^\d+$/.test(String(o.ot)) || !Number.isSafeInteger(Number(o.ot)) || Number(o.ot) <= 0)) throw new Error("Hay números de orden inválidos.");
        const {orders: existing, cloudAvailable} = await getCombinedOrders();
        if (!cloudAvailable) throw new Error("Conecta la nube para comprobar duplicados antes de importar.");
        const ids = new Set(existing.map(o => String(o.ot)));
        const incoming = [...new Map(orders.map(o => [String(o.ot), o])).values()];
        const missing = incoming.filter(o => !ids.has(String(o.ot)));
        if (!confirm(`Se agregarán ${missing.length} órdenes únicamente a este equipo. Los números existentes se omiten. El archivo no se subirá automáticamente a la nube. ¿Importar?`)) return;
        for (const order of missing) { await dbPut({...order, ot: String(order.ot)}); ids.add(String(order.ot)); }
        const maxOt = Math.max(getLastOt(), ...missing.map(o => Number(o.ot)));
        setLastOt(maxOt); await updateOtDisplay();
        document.dispatchEvent(new Event("fueltek:refresh"));
        alert("Respaldo importado localmente sin reemplazar registros existentes.");
        e.target.value = "";
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
   ==================================================================== */

async function firebaseSaveOrder(order, expected) {
  if (window.fueltekRequireAccess) window.fueltekRequireAccess();
  if (typeof firestore === 'undefined') throw new Error("Nube no disponible");
  const ref = firestore.collection("orders").doc(String(order.ot));
  await firestore.runTransaction(async tx => {
    const remote = await tx.get(ref);
    if (remote.exists && expected && (remote.data().fechaGuardado || "") !== (expected.fechaGuardado || "")) {
      throw new Error("Esta orden cambió en otro equipo. Conserva tu borrador y vuelve a abrir la versión actual antes de guardar.");
    }
    tx.set(ref, {...order}, {merge: true});
  });
  return true;
}

async function firebaseGetAllOrders() {
  if (window.fueltekRequireAccess) window.fueltekRequireAccess();
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
  if (window.fueltekRequireAccess) window.fueltekRequireAccess();
  if (typeof firestore === 'undefined') throw new Error("Firestore no inicializado");
  try {
    const doc = await firestore.collection("orders").doc(String(ot)).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error("Firebase ERROR al obtener OT:", error);
    throw error;
  }
}
