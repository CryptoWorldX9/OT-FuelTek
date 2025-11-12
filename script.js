/* Fueltek v7.0 - script.js
   - Mejoras de UI/UX y formato CLP (separador de miles con punto) EN TIEMPO REAL
   - Limpieza de código y unificación del botón Limpiar Campos
*/

const DB_NAME = "fueltek_db_v7"; // Versión de DB actualizada
const DB_VERSION = 1;
const STORE = "orders";
const OT_LOCAL = "fueltek_last_ot_v7";

let currentLoadedOt = null; // guarda el OT cargado para editar

// ====================================================================
// UTILIDADES DE FORMATO CLP
// ====================================================================

// Formatea un número (ej. 15000) a string con separador de miles (ej. 15.000)
function formatCLP(num) {
  if (num === null || num === undefined) return "0";
  const n = String(num).replace(/[^\d]/g, ''); // Limpia no dígitos
  if (n === "") return "";
  return new Intl.NumberFormat('es-CL').format(Number(n));
}

// Desformatea un string (ej. 15.000) a un número entero (ej. 15000)
function unformatCLP(str) {
  if (str === null || str === undefined) return 0;
  const cleaned = String(str).replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

// Handler para aplicar formato al teclear (input event)
function handleFormatOnInput(e) {
  const input = e.target;
  const value = input.value;
  // Desformatear, luego reformatear.
  const numericValue = unformatCLP(value);
  const formattedValue = formatCLP(numericValue);
  
  // Asignar el valor formateado
  input.value = formattedValue;
}

// ====================================================================
// BASE DE DATOS Y CORRELATIVO
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
  // El número inicial es 726 si no existe
  return parseInt(localStorage.getItem(OT_LOCAL) || "726", 10);
}
function setLastOt(n) { localStorage.setItem(OT_LOCAL, String(n)); }
function nextOtAndSave() {
  const n = getLastOt() + 1;
  setLastOt(n);
  return n;
}

// ====================================================================
// MANEJO DE EVENTOS DEL DOM
// ====================================================================

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

  const updateOtDisplay = () => (otInput.value = String(getLastOt() + 1));
  updateOtDisplay();
  
  // Agregar listeners para formato de miles EN TIEMPO REAL
  [valorTrabajoInput, montoAbonadoInput].forEach(input => {
    input.addEventListener("input", handleFormatOnInput);
    // Aplicar formato al cargar la página o al perder foco si se copia/pega
    input.addEventListener("blur", handleFormatOnInput);
  });

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
  
  // Borrar base de datos completa
  document.getElementById("clearBtn").addEventListener("click", async () => {
    if (!confirm("⚠️ ADVERTENCIA: Esta acción BORRARÁ toda la base de datos de Órdenes de Trabajo y reiniciará el contador a 727. ¿Desea continuar?")) return;
    await dbDeleteAll();
    setLastOt(726);
    updateOtDisplay();
    alert("Base de datos eliminada. Contador reiniciado a 727.");
  });
  
  // Limpiar campos manualmente (botón Limpiar Campos integrado en la barra superior)
  document.getElementById("resetFormBtn").addEventListener("click", () => {
    if (confirm("¿Seguro que deseas limpiar todos los campos del formulario?")) {
      form.reset();
      labelAbono.classList.add("hidden");
      currentLoadedOt = null;
      updateOtDisplay(); // Restablece el número OT al siguiente correlativo
      alert("Campos limpiados.");
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

    let saveMessage = "guardada";
    let otToSave;

    // Si se cargó una OT existente, mantener el mismo número
    if (currentLoadedOt) {
      order.ot = currentLoadedOt;
      otToSave = currentLoadedOt;
      saveMessage = "actualizada";
    } else {
      // Guardar una nueva OT y avanzar correlativo
      otToSave = String(getLastOt() + 1);
      order.ot = otToSave;
    }

    try {
      await dbPut(order);
      if (!currentLoadedOt) setLastOt(Number(otToSave)); // Solo avanza si es OT nueva
      alert(`Orden ${saveMessage} correctamente ✅ (OT #${otToSave})`);
    } catch (err) {
      alert(`Error al ${saveMessage === "guardada" ? "guardar" : "actualizar"}: ${err}`);
    }

    // Limpiar form y mostrar siguiente correlativo
    form.reset();
    labelAbono.classList.add("hidden");
    currentLoadedOt = null;
    updateOtDisplay();
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
      lucide.createIcons(); // Vuelve a renderizar los íconos de Lucide en la lista modal
    }

    ordersList.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", async ev => {
        // Usa closest para capturar el data-ot y data-action del botón, incluso si el clic es en el icono
        const targetBtn = ev.target.closest('button');
        const ot = targetBtn.dataset.ot;
        const action = targetBtn.dataset.action;
        if (action === "print") {
          const dat = await dbGet(ot); buildPrintAndPrint(dat);
        } else if (action === "load") {
          const dat = await dbGet(ot); loadOrderToForm(dat); modal.classList.add("hidden");
        } else if (action === "delete") {
          if (confirm("¿Borrar definitivamente OT #" + ot + "?")) {
            const db = await openDB();
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).delete(ot);
            tx.oncomplete = () => { alert("OT eliminada"); renderOrdersList(); };
            tx.onerror = (e) => alert("Error al eliminar: " + e.target.error);
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
      "marca","modelo","serie","anio","diagnostico","trabajo","firmaTaller","firmaCliente"];
    fields.forEach(k => { const el = form.querySelector(`[name="${k}"]`); if (el) el.value = o[k] || ""; });
    
    // Cargar campos numéricos formateados
    valorTrabajoInput.value = formatCLP(o.valorTrabajo);
    montoAbonadoInput.value = formatCLP(o.montoAbonado);
    
    // Estado de pago
    estadoPago.value = o.estadoPago || "Pendiente";
    if (estadoPago.value === "Abonado") labelAbono.classList.remove("hidden"); else labelAbono.classList.add("hidden");
    
    // Checkboxes
    form.querySelectorAll("input[name='accesorios']").forEach(ch => ch.checked = false);
    if (Array.isArray(o.accesorios)) o.accesorios.forEach(val => {
      const el = Array.from(form.querySelectorAll("input[name='accesorios']")).find(c => c.value === val);
      if (el) el.checked = true;
    });
    
    otInput.value = o.ot;
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
    
    // Para impresión, usa el valor DESFORMATEADO para el cálculo pero FORMATEADO para la visualización
    data.valorTrabajoNum = unformatCLP(data.valorTrabajo);
    data.montoAbonadoNum = unformatCLP(data.montoAbonado);
    
    buildPrintAndPrint(data);
  });

  function buildPrintAndPrint(data) {
    const valorTrabajoF = formatCLP(data.valorTrabajoNum);
    const montoAbonadoF = formatCLP(data.montoAbonadoNum);
    const saldo = data.valorTrabajoNum - data.montoAbonadoNum;
    const saldoF = formatCLP(saldo > 0 ? saldo : 0);

    const html = `
      <div style="font-family:'Inter', sans-serif;color:#111;padding-bottom:15px;border-bottom:1px solid #ddd;">
        <div style="display:flex;align-items:center;gap:20px">
          <img src="logo-fueltek.png" style="width:100px;height:100px;object-fit:contain;border:1px solid #eee;padding:5px;border-radius:8px;" alt="logo" />
          <div style="flex-grow:1">
            <h2 style="margin:0;color:#004d99;font-size:24px;">ORDEN DE TRABAJO - FUELTEK</h2>
            <div style="color:#f26522;font-weight:600;font-size:16px;">Servicio Técnico Multimarca</div>
            <div style="font-size:11px;margin-top:5px;opacity:0.8;">Tel: +56 9 4043 5805 | La Trilla 1062, San Bernardo</div>
          </div>
          <div style="text-align:right;background:#004d99;color:white;padding:10px 15px;border-radius:8px;">
            <div style="font-weight:800;font-size:22px;">N° OT: ${data.ot}</div>
            <div style="font-size:10px;margin-top:5px;">Emitida: ${new Date().toLocaleDateString('es-CL')}</div>
          </div>
        </div>
        <hr style="border:none;border-top:2px solid #004d99;margin:15px 0 18px" />
        
        <table style="width:100%;border-collapse:collapse;margin-bottom:15px;font-size:10pt;">
          <tr>
            <td style="width:50%;padding:8px 0;vertical-align:top;border-right:1px solid #eee;">
              <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:11pt;">DATOS DEL CLIENTE</strong>
              <span style="display:block;">Nombre: <b>${data.clienteNombre || "-"}</b></span>
              <span style="display:block;">Teléfono: ${data.clienteTelefono || "-"}</span>
              <span style="display:block;">Email: ${data.clienteEmail || "-"}</span>
              <span style="display:block;">Fecha Recibida: <b>${data.fechaRecibida || "-"}</b></span>
              <span style="display:block;">Fecha Entrega: <b>${data.fechaEntrega || "-"}</b></span>
            </td>
            <td style="width:50%;padding:8px 0 8px 15px;vertical-align:top;">
              <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:11pt;">DATOS DE LA HERRAMIENTA</strong>
              <span style="display:block;">Marca: <b>${data.marca || "-"}</b></span>
              <span style="display:block;">Modelo: <b>${data.modelo || "-"}</b></span>
              <span style="display:block;">N° Serie: ${data.serie || "-"}</span>
              <span style="display:block;">Año Fabricación: ${data.anio || "-"}</span>
              <div style="height:20px;"></div>
            </td>
          </tr>
        </table>

        <div style="display:flex;gap:20px;margin-bottom:15px;border-top:1px solid #ddd;padding-top:15px;">
            <div style="width:40%;">
                <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:11pt;">RESUMEN DE PAGO</strong>
                <table style="width:100%;border-collapse:collapse;font-size:10pt;background:#f8f8f8;border-radius:6px;overflow:hidden;">
                    <tr><td style="padding:5px;border:1px solid #eee;">Valor del Trabajo:</td><td style="padding:5px;text-align:right;font-weight:700;">$${valorTrabajoF} CLP</td></tr>
                    ${data.estadoPago === 'Abonado' ? `<tr><td style="padding:5px;border:1px solid #eee;">Monto Abonado:</td><td style="padding:5px;text-align:right;">$${montoAbonadoF} CLP</td></tr>` : ''}
                    <tr><td style="padding:5px;border:1px solid #eee;">Estado de Pago:</td><td style="padding:5px;text-align:right;font-weight:700;color:${data.estadoPago === 'Pagado' ? '#27ae60' : (data.estadoPago === 'Abonado' ? '#f39c12' : '#c0392b')};">${data.estadoPago}</td></tr>
                    ${data.estadoPago !== 'Pagado' && saldo > 0 ? `<tr><td style="padding:5px;border:1px solid #eee;">SALDO PENDIENTE:</td><td style="padding:5px;text-align:right;font-weight:800;color:#c0392b;">$${saldoF} CLP</td></tr>` : ''}
                </table>
            </div>
            <div style="flex:1;">
                <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:11pt;">REVISIÓN Y ACCESORIOS RECIBIDOS</strong>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                    ${(data.accesorios||[]).map(s=>`<span style='border:1px solid #ddd;background:#fff;padding:4px 8px;border-radius:4px;font-size:10px'>${s}</span>`).join('') || '<span style="color:#999;">Ningún accesorio o revisión marcada.</span>'}
                </div>
            </div>
        </div>

        <div style="margin-top:15px;">
            <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:11pt;">DIAGNÓSTICO INICIAL</strong>
            <div style="border:1px solid #ddd;padding:10px;border-radius:6px;min-height:60px;background:#fcfcfc;">${data.diagnostico || "Sin diagnóstico."}</div>
        </div>
        <div style="margin-top:15px;">
            <strong style="color:#004d99;display:block;margin-bottom:5px;font-size:11pt;">TRABAJO REALIZADO / NOTAS DEL TÉCNICO</strong>
            <div style="border:1px solid #ddd;padding:10px;border-radius:6px;min-height:60px;background:#fcfcfc;">${data.trabajo || "Trabajo Pendiente de Realizar / Sin notas."}</div>
        </div>
        
        <div style="display:flex;gap:60px;margin-top:35px;padding-top:15px;border-top:1px solid #eee;">
          <div style="flex:1;text-align:center">
            <div style="height:1px;border-bottom:1px solid #2c3e50;margin:0 auto;width:80%;"></div>
            <div style="margin-top:8px;font-weight:600;color:#2c3e50;">Firma Taller</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="height:1px;border-bottom:1px solid #2c3e50;margin:0 auto;width:80%;"></div>
            <div style="margin-top:8px;font-weight:600;color:#2c3e50;">Firma Cliente</div>
          </div>
        </div>
        
        <div style="margin-top:30px;padding:12px;background:#f0f7ff;border:1px solid #d0e0f0;border-radius:6px;font-size:9pt;color:#444;">
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
  
  // Implementación de Exportar/Importar DB JSON y Exportar a Excel (se mantiene)
  document.getElementById("exportBtn").addEventListener("click", async () => {
    const orders = await dbGetAll();
    if (orders.length === 0) return alert("No hay órdenes para exportar.");
    
    // Simplificar los datos para la exportación
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
    XLSX.writeFile(wb, "Ordenes_Trabajo_Fueltek.xlsx");
    alert("Exportación a Excel completada.");
  });

  document.getElementById("exportDbBtn").addEventListener("click", async () => {
    const orders = await dbGetAll();
    const dataStr = JSON.stringify(orders, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fueltek_db_backup.json";
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
        });

        tx.oncomplete = () => {
            alert(`Importación finalizada. ${importedCount} órdenes procesadas.`);
            // Opcional: actualizar el correlativo si hay un número OT más alto
            const maxOt = Math.max(...orders.map(o => Number(o.ot)), getLastOt());
            setLastOt(maxOt);
            updateOtDisplay();
            e.target.value = null; // Limpiar el input file
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
