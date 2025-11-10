document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("otForm");
  const estadoPago = document.getElementById("estadoPago");
  const labelAbono = document.getElementById("labelAbono");
  const valorTrabajo = document.getElementById("valorTrabajo");
  const montoAbonado = document.getElementById("montoAbonado");
  const printArea = document.getElementById("printArea");

  // ======== FORMATO CLP ========
  const formatCLP = (input) => {
    input.addEventListener("input", () => {
      let val = input.value.replace(/\D/g, "");
      if (!val) return (input.value = "");
      input.value = new Intl.NumberFormat("es-CL").format(parseInt(val));
    });
  };
  formatCLP(valorTrabajo);
  formatCLP(montoAbonado);

  // ======== MOSTRAR ABONO ========
  estadoPago.addEventListener("change", () => {
    if (estadoPago.value === "Abonado") labelAbono.classList.remove("hidden");
    else {
      labelAbono.classList.add("hidden");
      montoAbonado.value = "";
    }
  });

  // ======== IMPRIMIR PDF ========
  document.getElementById("printBtn").addEventListener("click", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const accesorios = Array.from(form.querySelectorAll("input[name='accesorios']:checked")).map(a => a.value);

    const html = `
      <div style="font-family:'Open Sans',sans-serif;color:#222;max-width:800px;margin:auto;border:1px solid #ccc;box-shadow:0 0 10px rgba(0,0,0,0.1);padding:20px;">
        <div style="background:#00aaff;color:white;padding:14px 20px;display:flex;align-items:center;border-radius:6px 6px 0 0;">
          <img src='logo-fueltek.png' style="height:60px;width:60px;background:white;border-radius:6px;padding:4px;margin-right:14px;" />
          <h2 style="margin:0;font-size:20px;">FUELTEK - Servicio Técnico Multimarca</h2>
        </div>
        <div style="height:4px;background:#f26522;margin-bottom:10px;"></div>

        <table style="width:100%;font-size:14px;margin-bottom:10px;">
          <tr><td><b>OT N°:</b> ${document.getElementById("otNumber").value || "—"}</td>
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
          <tr><td><b>Valor del trabajo:</b></td><td style="text-align:right;">${data.valorTrabajo || "0"} CLP</td></tr>
          <tr><td><b>Estado del pago:</b></td><td style="text-align:right;">${data.estadoPago || ""}</td></tr>
          ${data.estadoPago === "Abonado" ? `<tr><td><b>Monto abonado:</b></td><td style="text-align:right;">${data.montoAbonado || "0"} CLP</td></tr>` : ""}
        </table>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Accesorios</h3>
        <div style="font-size:13px;display:flex;flex-wrap:wrap;gap:6px;">
          ${accesorios.map(a => `<span style="border:1px solid #ccc;padding:3px 8px;border-radius:6px;">${a}</span>`).join("")}
        </div>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Diagnóstico Inicial</h3>
        <div style="border:1px solid #ccc;border-radius:6px;padding:8px;min-height:40px;">${data.diagnostico || ""}</div>

        <h3 style="color:#f26522;border-bottom:1px solid #ddd;margin-top:8px;">Trabajo Realizado / Notas</h3>
        <div style="border:1px solid #ccc;border-radius:6px;padding:8px;min-height:40px;">${data.trabajo || ""}</div>

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
  });
});
