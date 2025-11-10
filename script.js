/* Fueltek PDF Profesional - Encabezado centrado y formato CLP en vivo */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("otForm");
  const estadoPago = document.getElementById("estadoPago");
  const labelAbono = document.getElementById("labelAbono");
  const printArea = document.getElementById("printArea");
  const valorTrabajo = document.getElementById("valorTrabajo");
  const montoAbonado = document.getElementById("montoAbonado");
  const otInput = document.getElementById("otNumber");

  // ======== FORMATO CLP EN TIEMPO REAL ========
  function formatNumberInput(input) {
    input.addEventListener("input", () => {
      let value = input.value.replace(/\./g, "").replace(/\D/g, "");
      if (!value) return (input.value = "");
      input.value = new Intl.NumberFormat("es-CL").format(parseInt(value));
    });
  }
  formatNumberInput(valorTrabajo);
  formatNumberInput(montoAbonado);

  // Mostrar campo abono si corresponde
  estadoPago.addEventListener("change", () => {
    if (estadoPago.value === "Abonado") labelAbono.classList.remove("hidden");
    else {
      labelAbono.classList.add("hidden");
      montoAbonado.value = "";
    }
  });

  // =========== BOTONES ============
  document.getElementById("printBtn").addEventListener("click", e => {
    e.preventDefault();
    buildPrintAndPrint();
  });

  document.getElementById("clearBtn").addEventListener("click", e => {
    if (confirm("¿Seguro que deseas borrar la base de datos local?")) {
      indexedDB.deleteDatabase("fueltek_db_v5");
      localStorage.removeItem("fueltek_last_ot_v5");
      alert("Base de datos eliminada.");
    }
  });

  document.getElementById("newBtn").addEventListener("click", () => {
    form.reset();
    labelAbono.classList.add("hidden");
  });

  // ========== FUNCIÓN DE IMPRESIÓN ==========
  function buildPrintAndPrint() {
    const data = Object.fromEntries(new FormData(form).entries());
    const accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(c => c.value);

    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;color:#222;max-width:800px;margin:auto;">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="background:#00aaff;padding:18px;border-radius:8px 8px 0 0;">
            <img src="logo-fueltek.png" style="height:80px;background:white;padding:6px;border-radius:6px;" alt="logo"/>
            <h1 style="margin:10px 0 4px 0;color:white;">FUELTEK</h1>
            <div style="color:white;font-weight:500;">Servicio Técnico Multimarca</div>
          </div>
          <div style="text-align:right;font-size:13px;margin-top:6px;">
            <b>OT N°:</b> ${otInput.value || "—"}<br/>
            <b>Fecha impresión:</b> ${new Date().toLocaleString()}
          </div>
        </div>

        <h3 style="color:#f26522;border-bottom:2px solid #eee;padding-bottom:4px;">Datos del Cliente</h3>
        <table style="width:100%;font-size:14px;">
          <tr><td><b>Nombre:</b> ${data.clienteNombre || ""}</td><td><b>Teléfono:</b> ${data.clienteTelefono || ""}</td></tr>
          <tr><td><b>Email:</b> ${data.clienteEmail || ""}</td><td><b>Recibida:</b> ${data.fechaRecibida || ""}</td></tr>
          <tr><td><b>Entrega:</b> ${data.fechaEntrega || ""}</td><td></td></tr>
        </table>

        <h3 style="color:#f26522;border-bottom:2px solid #eee;padding-bottom:4px;margin-top:14px;">Datos de la Herramienta</h3>
        <table style="width:100%;font-size:14px;">
          <tr><td><b>Marca:</b> ${data.marca || ""}</td><td><b>Modelo:</b> ${data.modelo || ""}</td></tr>
          <tr><td><b>Serie:</b> ${data.serie || ""}</td><td><b>Año:</b> ${data.anio || ""}</td></tr>
        </table>

        <h3 style="color:#f26522;border-bottom:2px solid #eee;padding-bottom:4px;margin-top:14px;">Pago</h3>
        <table style="width:100%;font-size:14px;">
          <tr><td><b>Valor del trabajo:</b></td><td style="text-align:right;">${data.valorTrabajo || "0"} CLP</td></tr>
          <tr><td><b>Estado del pago:</b></td><td style="text-align:right;">${data.estadoPago || ""}</td></tr>
          ${data.estadoPago === "Abonado" ? `<tr><td><b>Monto abonado:</b></td><td style="text-align:right;">${data.montoAbonado || "0"} CLP</td></tr>` : ""}
        </table>

        <h3 style="color:#f26522;margin-top:16px;">Accesorios</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:13px;">
          ${accesorios.map(a => `<span style="border:1px solid #ccc;padding:4px 8px;border-radius:6px;">${a}</span>`).join("")}
        </div>

        <h3 style="color:#f26522;margin-top:16px;">Diagnóstico Inicial</h3>
        <div style="border:1px solid #ccc;padding:8px;border-radius:6px;min-height:60px;">${data.diagnostico || ""}</div>

        <h3 style="color:#f26522;margin-top:16px;">Trabajo Realizado / Notas</h3>
        <div style="border:1px solid #ccc;padding:8px;border-radius:6px;min-height:60px;">${data.trabajo || ""}</div>

        <div style="display:flex;justify-content:space-around;margin-top:40px;">
          <div style="text-align:center;">
            <div style="height:60px;border-bottom:1px solid #999;width:200px;margin:auto;"></div>
            <div>Firma Taller</div>
          </div>
          <div style="text-align:center;">
            <div style="height:60px;border-bottom:1px solid #999;width:200px;margin:auto;"></div>
            <div>Firma Cliente</div>
          </div>
        </div>

        <footer style="margin-top:20px;text-align:center;font-size:12px;color:#666;border-top:2px solid #00aaff;padding-top:8px;">
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
