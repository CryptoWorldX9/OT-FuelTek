/* El mismo documento HTML se usa para impresión y para Guardar como PDF. */
(() => {
  'use strict';
  const escape = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>'$ '+Math.max(0,Number(String(value??0).replace(/[^0-9-]/g,''))||0).toLocaleString('es-CL');
  const amount=value=>Number(String(value??0).replace(/[^0-9-]/g,''))||0;
  const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'Por definir';
  const retire='El cliente deberá retirar el equipo dentro de 60 días corridos desde la comunicación de su disponibilidad. Vencido ese plazo, deberá coordinar su retiro con el taller. Esta condición no limita los derechos del consumidor ni modifica el plazo legal de abandono establecido en el artículo 42 de la Ley 19.496.';
  const storage='El equipo dispone de 30 días corridos sin cobro de bodegaje, contados desde el día siguiente al aviso comprobable al cliente de que está disponible para retiro.\n\nDesde el día 31 se cobrará $1.500 (mil quinientos pesos chilenos) por cada día corrido adicional de almacenamiento hasta el retiro efectivo. Es el precio final por día, incluidos los impuestos que correspondan. El cobro se detallará por separado, indicando el período y los días cobrados.\n\nEsta condición debe informarse antes de contratar y ser aceptada expresamente por el cliente de forma separada. Si no existe aceptación expresa, no se aplicará el cobro. No se aplica retroactivamente a órdenes anteriores ni durante la reparación, antes del aviso de disponibilidad o cuando el taller impida el retiro. El silencio o la firma general de recepción no constituyen aceptación de este servicio adicional.';
  const storageRetire='El cliente deberá coordinar el retiro dentro de los 30 días corridos sin bodegaje. El taller mantendrá sus obligaciones de custodia y los derechos del consumidor. Esta condición no autoriza la venta ni eliminación del equipo. El artículo 42 de la Ley 19.496 establece un año desde el documento de recepción otorgado y suscrito para el abandono de especies entregadas en reparación.';
  const acceptance='Marcar una sola opción antes de firmar:\n[ ] Acepto el servicio adicional de bodegaje en las condiciones indicadas.\n[ ] No acepto.\nFirma del cliente: ____________________  Fecha: ______________\nComplete o inutilice los espacios restantes y entregue una copia al cliente. Conserve el acuerdo firmado y el aviso de disponibilidad.';
  const policyFor=order=>order.documentoTaller?.storagePolicyVersion===1?{storage,retire:storageRetire,acceptance}:{retire};
  function build(order,settings={}) {
    const snapshot=order.documentoTaller || settings, business=snapshot.business || {}, note=snapshot.receiptNote || '', policy=policyFor(order);
    const value=amount(order.valorTrabajoNum??order.valorTrabajo), paid=order.estadoPago==='Pagado'?value:amount(order.montoAbonadoNum??order.montoAbonado), balance=Math.max(0,value-paid);
    const detail=order.revisionDetalle, all=Array.isArray(order.accesorios)?order.accesorios:[];
    const row=(label,value)=>`<div class="receipt-row"><span>${label}</span><strong>${escape(value||'—')}</strong></div>`;
    const tags=values=>(values||[]).map(value=>`<span class="receipt-tag">${escape(value)}</span>`).join('')||'<span class="receipt-muted">Sin elementos marcados.</span>';
    const text=(heading,value,empty)=>`<section class="receipt-text"><h3>${heading}</h3><div class="receipt-pre">${escape(value||empty)}</div></section>`;
    const sections=detail?[['Accesorios recibidos',detail.accessories],['Condiciones y hallazgos verificados',detail.conditions],['Otros elementos registrados',detail.other]].filter(([,values])=>values?.length):[['Revisión y accesorios registrados',all]];
    return `<article class="receipt">
      <header class="receipt-header"><img src="logo-fueltek.png" alt="Logo del taller" onerror="this.hidden=true"><div class="receipt-brand"><h1>${escape(business.name||'FuelTek')}</h1><p>${escape(business.tagline||'Servicio Técnico Multimarca')}</p><small>${escape([business.phone,business.email].filter(Boolean).join(' · '))}</small><small>${escape(business.address||'')}${business.rut?' · RUT '+escape(business.rut):''}</small></div><div class="receipt-number"><span>ORDEN DE TRABAJO</span><strong>#${escape(order.ot||'BORRADOR')}</strong><small>Emisión ${new Date().toLocaleDateString('es-CL')}</small></div></header>
      <div class="receipt-intro"><span>Comprobante de recepción y servicio</span><strong>${escape(order.estadoServicio||'Recibida')}</strong></div>
      <div class="receipt-columns"><section class="receipt-card"><h3>01 · Cliente</h3>${row('Nombre',order.clienteNombre)}${row('Teléfono',order.clienteTelefono)}${row('Correo',order.clienteEmail)}${row('Recepción',date(order.fechaRecibida))}${row('Entrega estimada',date(order.fechaEntrega))}</section><section class="receipt-card"><h3>02 · Equipo</h3>${row('Tipo',order.tipoEquipo)}${row('Marca / modelo',[order.marca,order.modelo].filter(Boolean).join(' '))}${row('N° de serie',order.serie)}${row('Año',order.anio)}${row('Técnico',order.tecnico)}</section></div>
      <section class="receipt-inspection"><h3>03 · Recepción y revisión</h3>${sections.map(([title,values])=>`<div class="receipt-check-section"><h4>${title}</h4><div class="receipt-tags">${tags(values)}</div></div>`).join('')}<p class="receipt-muted">Los elementos sin marcar no constituyen un diagnóstico. Los hallazgos internos corresponden a la revisión realizada.</p></section>
      ${text('04 · Diagnóstico inicial',order.diagnostico,'Pendiente de diagnóstico.')}
      ${text('05 · Trabajo realizado / notas del técnico',order.trabajo,'Pendiente de realizar. No se han registrado trabajos.')}
      <section class="receipt-payment"><div><h3>06 · Resumen de pago</h3><p>${escape(order.estadoPago||'Pendiente')} · Valores en pesos chilenos (CLP)</p></div><div class="receipt-totals">${row('Valor del trabajo',money(value))}${row('Pagado / abonado',money(paid))}<div class="receipt-balance">${row('Saldo pendiente',money(balance))}</div></div></section>
      <div class="receipt-signatures"><div><p>${escape(order.firmaTaller||'')}</p><strong>Firma / responsable del taller</strong></div><div><p>${escape(order.firmaCliente||'')}</p><strong>Firma / recepción del cliente</strong></div></div>
      <footer class="receipt-footer ${policy.storage?'receipt-current-terms':''}">${note?`<p class="receipt-pre">${escape(note)}</p>`:''}${policy.storage?`<section class="receipt-storage"><h3>IMPORTANTE · Bodegaje después de 30 días</h3><p class="receipt-policy-price">$1.500 diarios desde el día 31 · Aceptación específica requerida</p><p class="receipt-pre">${escape(policy.storage)}</p><div class="receipt-storage-acceptance"><h4>Aceptación separada del servicio de bodegaje</h4><p class="receipt-pre">${escape(policy.acceptance)}</p></div></section>`:''}<div class="receipt-policy"><strong>Condiciones de retiro del equipo</strong><p>${escape(policy.retire)}</p></div><small>Conserve este comprobante · OT #${escape(order.ot||'BORRADOR')} · Este documento no reemplaza una boleta o factura.</small></footer>
    </article>`;
  }
  function preview(html, order, settings) {
    const panel=document.getElementById('receiptPreview'), body=document.getElementById('receiptPreviewBody'), previous=document.activeElement;
    body.innerHTML=html; panel.classList.remove('hidden'); document.body.classList.add('receipt-preview-open');
    const close=()=>{panel.classList.add('hidden'); document.body.classList.remove('receipt-preview-open'); previous?.focus();};
    document.getElementById('receiptClose').onclick=close;
    document.getElementById('receiptDownloadStatus').textContent='';
    document.getElementById('receiptDownload').onclick=async()=>{const button=document.getElementById('receiptDownload'),status=document.getElementById('receiptDownloadStatus');button.disabled=true;status.textContent='Preparando PDF…';try{await window.fueltekPdf.download(order,settings);status.textContent='PDF descargado. Revisa la carpeta de descargas.';}catch(error){status.textContent='No se pudo generar el PDF. Usa Imprimir / Guardar PDF para conservar todos los caracteres del documento.';}finally{button.disabled=false;}};
    document.getElementById('receiptPrint').onclick=async()=>{
      const area=document.getElementById('printArea');area.style.display='block';
      await Promise.all([...area.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;})));
      window.addEventListener('afterprint',()=>{area.style.display='none';},{once:true});window.print();
    };
    panel.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const first=document.getElementById('receiptDownload'),last=document.getElementById('receiptClose');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    document.getElementById('receiptClose').focus();
  }
  window.fueltekReceipt={build,retire,storage,acceptance,policyFor,preview};
})();
