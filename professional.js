/* Additive extension: retains IndexedDB fueltek_db_v7 / orders and Firebase orders. */
const demoMode = new URLSearchParams(location.search).has('demo');
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function balanceOf(order) {
  return order.estadoPago === 'Pagado' ? 0 : Math.max(0, unformatCLP(order.valorTrabajo) - unformatCLP(order.montoAbonado));
}
function todayLocal() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function mergeOrderSources(local, cloud) {
  const map = new Map();
  for (const o of [...local, ...cloud]) {
    if (!o || o.ot == null) continue;
    const key = String(o.ot), old = map.get(key);
    const stamp = x => Date.parse(x?.fechaGuardado || '') || 0;
    if (!old || stamp(o) >= stamp(old)) map.set(key, {...old, ...o, ot:key});
  }
  return [...map.values()];
}
async function getCombinedOrders() {
  if (window.fueltekRequireAccess) window.fueltekRequireAccess();
  if (demoMode) return {orders: demoOrders(), cloudAvailable: true, demo: true};
  const local = await dbGetAll();
  try {
    if (typeof firestore === 'undefined' || !navigator.onLine) throw new Error('Nube no disponible');
    const cloud = await firebaseGetAllOrders();
    return {orders: mergeOrderSources(local, cloud), cloudAvailable:true};
  } catch (error) {
    return {orders:local, cloudAvailable:false};
  }
}
async function createCloudOrder(order) {
  if (window.fueltekRequireAccess) window.fueltekRequireAccess();
  const configRef = firestore.collection('config').doc(OT_FIREBASE_DOC);
  // Las reglas pueden evaluar el contador recién cambiado antes de que el SDK detecte el conflicto.
  // Releer en una transacción nueva permite reintentar esa carrera sin sobrescribir registros.
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await firestore.runTransaction(async tx => {
    const config = await tx.get(configRef);
    const counter = Math.max(Number(config.data()?.value) || 10724, getLastOt());
    const ot = String(counter + 1);
    const ref = firestore.collection('orders').doc(ot);
    const existing = await tx.get(ref);
    if (existing.exists) throw new Error('El número previsto ya existe. Actualiza el correlativo antes de guardar; ninguna orden se reemplazó.');
    tx.set(ref, {...order, ot});
    tx.set(configRef, {value:Number(ot), lastOrderId:ot, updatedAt:new Date().toISOString()}, {merge:true});
    return ot;
    }); } catch (error) {
      if (error.code !== 'permission-denied' || attempt === 2) throw error;
    }
  }
}
function demoOrders() {
  return [
    {ot:'10781', clienteNombre:'Cliente de ejemplo A', marca:'STIHL', modelo:'MS 250', tipoEquipo:'Motosierra', estadoServicio:'En reparación', tecnico:'Técnico A', prioridad:'Alta', valorTrabajo:85000, montoAbonado:30000, estadoPago:'Abonado', fechaEntrega:todayLocal()},
    {ot:'10780', clienteNombre:'Cliente de ejemplo B', marca:'Husqvarna', modelo:'135 Mark II', tipoEquipo:'Motosierra', estadoServicio:'Lista para entrega', tecnico:'Técnico B', valorTrabajo:62000, estadoPago:'Pendiente', fechaEntrega:todayLocal()},
    {ot:'10779', clienteNombre:'Cliente de ejemplo C', marca:'Makita', modelo:'EM2650UH', estadoServicio:'Esperando repuestos', prioridad:'Urgente', valorTrabajo:110000, estadoPago:'Pendiente', fechaEntrega:'2026-01-01'},
    {ot:'10778', clienteNombre:'Cliente de ejemplo D', marca:'STIHL', modelo:'FS 55', estadoServicio:'Entregada', valorTrabajo:45000, estadoPago:'Pagado'}
  ];
}
document.addEventListener('DOMContentLoaded', async () => {
  if (window.fueltekAccessReady) await window.fueltekAccessReady;
  const $ = id => document.getElementById(id);
  const form = $('otForm');
  let allOrders = [], refreshId = 0, draftTimer, deferredInstall, modalFocus;
  const draftKey = demoMode ? 'fueltek_demo_draft_v1' : 'fueltek_draft_v1';
  const currency = n => '$' + formatCLP(n);
  const view = name => {
    $('dashboard').classList.toggle('hidden', name !== 'dashboard');
    $('editor').classList.toggle('hidden', name !== 'editor');
    $('navDashboard').classList.toggle('selected', name === 'dashboard');
    $('navOrder').classList.toggle('selected', name === 'editor');
    for (const id of ['navDashboard','navOrder']) $(id).removeAttribute('aria-current');
    $(name === 'dashboard' ? 'navDashboard' : 'navOrder').setAttribute('aria-current','page');
  };
  function drawOrders() {
    const query = $('dashboardSearch').value.trim().toLocaleLowerCase('es');
    const state = $('dashboardState').value, payment = $('dashboardPayment').value;
    const rows = allOrders.filter(o => (!state || (o.estadoServicio || 'Recibida') === state) && (!payment || o.estadoPago === payment) && [o.ot,o.clienteNombre,o.marca,o.modelo,o.serie,o.tecnico].some(v => String(v || '').toLocaleLowerCase('es').includes(query))).sort((a,b) => Number(b.ot)-Number(a.ot));
    $('dashboardOrders').innerHTML = rows.length ? rows.map(o => {
      const status = o.estadoServicio || 'Recibida';
      const overdue = o.fechaEntrega && o.fechaEntrega < todayLocal() && status !== 'Entregada';
      return `<article class="job-card"><div class="job-top"><strong>OT #${escapeHTML(o.ot)}</strong><span class="badge ${status === 'Entregada' ? 'done' : status === 'Lista para entrega' ? 'ready' : ''}">${escapeHTML(status)}</span></div><h4>${escapeHTML(o.clienteNombre || 'Sin nombre')}</h4><p>${escapeHTML([o.marca,o.modelo].filter(Boolean).join(' ') || 'Equipo sin especificar')}</p><div class="job-meta"><span>${escapeHTML(o.tecnico || 'Sin técnico asignado')}</span><span class="${overdue?'overdue':''}">${overdue?'Entrega atrasada · ':''}${escapeHTML(o.fechaEntrega || 'Sin fecha de entrega')}</span></div><div class="job-bottom"><div><small>Saldo pendiente</small><strong>${currency(balanceOf(o))}</strong></div><button data-edit="${escapeHTML(o.ot)}">Ver orden →</button></div></article>`;
    }).join('') : '<div class="empty-state"><h3>Sin órdenes para mostrar</h3><p>Crea una orden o ajusta los filtros de búsqueda.</p></div>';
  }
  async function refresh() {
    const requestId = ++refreshId;
    $('dataStatus').textContent = 'Actualizando información…';
    try {
      const result = await getCombinedOrders();
      if (requestId !== refreshId) return;
      allOrders = result.orders;
      const active = allOrders.filter(o => o.estadoServicio !== 'Entregada');
      const metrics = [
        ['Órdenes activas', active.length, 'Equipos en proceso'],
        ['Listas para entrega', active.filter(o=>o.estadoServicio === 'Lista para entrega').length, 'Coordina el retiro'],
        ['Entregas atrasadas', active.filter(o=>o.fechaEntrega && o.fechaEntrega<todayLocal()).length, 'Requieren seguimiento'],
        ['Saldo por cobrar', currency(allOrders.reduce((n,o)=>n+balanceOf(o),0)), 'Total registrado, en CLP']
      ];
      $('metrics').innerHTML = metrics.map(([label,value,help])=>`<article class="metric"><span>${label}</span><strong>${value}</strong><small>${help}</small></article>`).join('');
      $('dataStatus').textContent = demoMode ? 'VISTA DEMOSTRATIVA · Datos ficticios. La nube está desconectada.' : `${allOrders.length} órdenes · ${result.cloudAvailable ? 'Datos locales y nube consultados' : 'Solo datos de este equipo; la nube no está disponible'} · ${new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}`;
      $('dataStatus').classList.toggle('overdue', !result.cloudAvailable);
      drawOrders();
    } catch (error) { $('dataStatus').textContent = 'No se pudieron leer los datos locales. No se modificaron los registros.'; }
  }
  function balance() { $('balanceAmount').textContent = currency(balanceOf(Object.fromEntries(new FormData(form)))); }
  const connection = () => { $('connectionStatus').textContent = navigator.onLine ? 'Con conexión' : 'Sin conexión · conserva tu borrador'; };
  connection(); window.addEventListener('online', connection); window.addEventListener('offline', connection);
  $('navDashboard').onclick = () => {view('dashboard'); refresh();};
  $('navOrder').onclick = () => view('editor');
  $('backDashboard').onclick = () => {view('dashboard'); refresh();};
  $('navHistory').onclick = () => $('viewBtn').click();
  $('dashboardNew').onclick = () => { $('newOtBtn').click(); };
  $('refreshDashboard').onclick = refresh;
  $('syncCorrelativeBtn').onclick = async () => {
    if (currentLoadedOt) { await refresh(); return; }
    const n = await getFirebaseCorrelative(); setLastOt(n); $('otNumber').value=String(n+1); await refresh();
  };
  $('dashboardBackup').onclick = () => $('exportDbBtn').click();
  ['dashboardSearch','dashboardState','dashboardPayment'].forEach(id => $(id).addEventListener(id === 'dashboardSearch'?'input':'change', drawOrders));
  $('dashboardOrders').onclick = async e => {
    const button = e.target.closest('[data-edit]'); if (!button) return;
    if ((window.fueltekDirty || window.fueltekRecoverable) && !confirm('Hay cambios sin guardar. ¿Abrir otra orden? El borrador actual será reemplazado.')) return;
    const order = allOrders.find(o => String(o.ot) === button.dataset.edit);
    if (order) document.dispatchEvent(new CustomEvent('fueltek:open-order', {detail: order}));
  };
  function clearDraft() { clearTimeout(draftTimer); localStorage.removeItem(draftKey); window.fueltekDirty=false; window.fueltekRecoverable=false; $('draftRecovery').classList.add('hidden'); $('draftStatus').textContent='Completa la recepción del equipo.'; }
  function persistDraft() {
    try {
      const fields=Object.fromEntries(new FormData(form)); fields.accesorios=[...form.querySelectorAll('[name="accesorios"]:checked')].map(x=>x.value);
      localStorage.setItem(draftKey, JSON.stringify({fields, ot:currentLoadedOt, snapshot:loadedOrderSnapshot, updated:new Date().toISOString()}));
      $('draftStatus').textContent='Borrador guardado en este equipo · falta guardar la orden.';
    } catch(error) { $('draftStatus').textContent='No se pudo guardar el borrador. Guarda la orden antes de salir.'; }
  }
  form.addEventListener('input', () => {window.fueltekDirty=true; balance(); clearTimeout(draftTimer); draftTimer=setTimeout(persistDraft,400);});
  form.addEventListener('change', () => {window.fueltekDirty=true; balance(); clearTimeout(draftTimer); draftTimer=setTimeout(persistDraft,400);});
  window.addEventListener('beforeunload', e => {if(window.fueltekDirty) {persistDraft(); e.preventDefault(); e.returnValue='';}});
  if (localStorage.getItem(draftKey)) {window.fueltekRecoverable=true; $('draftRecovery').classList.remove('hidden');}
  $('restoreDraft').onclick = () => {
    try {
      const draft=JSON.parse(localStorage.getItem(draftKey)); if (!draft?.fields) return;
      form.reset();
      for(const [key,value] of Object.entries(draft.fields)) {const el=form.elements.namedItem(key);if(el && key!=='accesorios') el.value=value;}
      form.querySelectorAll('[name="accesorios"]').forEach(el=>el.checked=(draft.fields.accesorios||[]).includes(el.value));
      currentLoadedOt=draft.ot; loadedOrderSnapshot=draft.snapshot||{};
      if(draft.ot) {$('otNumber').value=draft.ot; $('saveBtn').querySelector('span').textContent='Actualizar';}
      window.fueltekDirty=true; window.fueltekRecoverable=false; updateSaldo(); balance(); $('draftRecovery').classList.add('hidden'); $('draftStatus').textContent='Borrador recuperado. Revisa y guarda los cambios.';
    } catch(error) {$('draftStatus').textContent='El borrador no se pudo leer.';}
  };
  $('dismissDraft').onclick=()=>{if(confirm('¿Descartar el borrador local? Las órdenes guardadas no se modificarán.')) clearDraft();};
  document.addEventListener('fueltek:saved',()=>{clearDraft(); balance(); refresh();});
  document.addEventListener('fueltek:discard',clearDraft);
  document.addEventListener('fueltek:new',()=>{clearDraft(); form.elements.fechaRecibida.value=todayLocal(); view('editor'); balance();});
  document.addEventListener('fueltek:loaded',()=>{clearDraft(); view('editor'); balance();});
  document.addEventListener('fueltek:refresh',refresh);
  document.addEventListener('fueltek:balance',balance);
  const syncQuickSave=()=>{ $('quickSave').disabled=$('saveBtn').disabled; $('quickSave').textContent=$('saveBtn').textContent.trim()+' orden'; };
  $('quickSave').onclick=()=> $('saveBtn').click();
  new MutationObserver(syncQuickSave).observe($('saveBtn'), {childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
  syncQuickSave();
  $('mobileMenuBtn').setAttribute('aria-label','Más acciones');
  $('mobileMenuBtn').setAttribute('aria-controls','mobileMenuDropdown');
  $('mobileMenuBtn').onclick=()=>{$('mobileMenuBtn').setAttribute('aria-expanded',String($('mobileMenuDropdown').classList.contains('active')));};
  const modal=$('modal');
  new MutationObserver(()=>{if(!modal.classList.contains('hidden')) {modalFocus=document.activeElement; $('searchOt').focus();} else modalFocus?.focus();}).observe(modal,{attributes:true,attributeFilter:['class']});
  modal.addEventListener('keydown', e=>{
    if(e.key==='Escape') $('closeModal').click();
    if(e.key==='Tab') {const focusable=[...modal.querySelectorAll('button,input')].filter(el=>!el.disabled); const first=focusable[0],last=focusable[focusable.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  window.addEventListener('beforeinstallprompt', e=>{e.preventDefault();deferredInstall=e;$('installApp').classList.remove('hidden');});
  $('installApp').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;$('installApp').classList.add('hidden');}};
  if ('serviceWorker' in navigator && !demoMode) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if (demoMode) {
    const banner=document.createElement('div'); banner.className='demo-banner'; banner.textContent='DEMOSTRACIÓN · Información ficticia · Guardado y nube desactivados'; document.body.prepend(banner);
    ['saveBtn','exportDbBtn','exportBtn','printBtn','syncCorrelativeBtn','importFile'].forEach(id=>{if($(id)) $(id).disabled=true;});
  }
  refresh(); balance();
});
