/* Configuración compartida. Nunca modifica órdenes existentes ni el correlativo. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const conditions = ['No arranca','Arranque difícil','Pérdida de potencia','Fuga de combustible','Fuga de aceite','Carcasa dañada','Piezas faltantes','Pistón Rayado','Cilindro Rayado'];
  const equipment = [
    ['Motosierra','Forestal y jardín',['Espada','Cadena','Funda Espada','Bujía','Tapa de Arranque','Manilla Arranque']],
    ['Podadora de altura','Forestal y jardín',['Espada','Cadena','Funda Espada','Tubo','Extensión','Arnés']],
    ['Desbrozadora','Forestal y jardín',['Cabezal','Disco de corte','Protector','Arnés','Brazo Completo','Manillar']],
    ['Cortasetos','Forestal y jardín',['Cuchillas','Funda de cuchillas','Empuñadura','Protector']],
    ['Cortasetos de altura','Forestal y jardín',['Cuchillas','Funda de cuchillas','Tubo','Arnés']],
    ['Multiherramienta','Forestal y jardín',['Motor base','Tubo','Cabezal desbrozador','Accesorio podador','Accesorio cortasetos','Arnés']],
    ['Corta Césped','Forestal y jardín',['Cuchilla','Recolector','Manillar','Ruedas','Deflector']],
    ['Tractor cortacésped','Forestal y jardín',['Llave','Batería','Plataforma de corte','Recolector','Cuchillas']],
    ['Sopladora','Forestal y jardín',['Tubo','Boquilla','Arnés','Bolsa recolectora','Tubo de aspiración']],
    ['Chipeadora / trituradora','Forestal y jardín',['Tolva','Cuchillas','Conducto de descarga','Bolsa recolectora']],
    ['Fumigadora','Agricultura y agua',['Lanza','Boquilla','Manguera','Estanque','Arnés','Tapa de estanque']],
    ['Atomizador','Agricultura y agua',['Tubo','Boquilla','Estanque','Arnés','Dosificador']],
    ['Motobomba','Agricultura y agua',['Manguera de succión','Manguera de descarga','Filtro de succión','Acoples','Tapones']],
    ['Motocultor / motoazada','Agricultura y agua',['Fresas','Ruedas','Manillar','Espolón','Protector','Implemento']],
    ['Ahoyadora','Agricultura y agua',['Broca','Extensión de broca','Manillar','Pasador de seguridad']],
    ['Generador','Energía y limpieza',['Cables','Enchufes','Batería','Llave','Ruedas','Manilla']],
    ['Hidrolavadora','Energía y limpieza',['Pistola','Lanza','Boquillas','Manguera de alta presión','Filtro de agua']],
    ['Motor estacionario','Energía y limpieza',['Polea','Eje','Bujía','Filtro de aire','Tapa de Arranque']],
    ['Compresor a combustión','Energía y limpieza',['Manguera de aire','Acoples','Manómetro','Regulador','Filtro','Ruedas']],
    ['Motosoldadora','Energía y limpieza',['Cable de masa','Portaelectrodo','Cables','Conectores','Batería']],
    ['Barredora a combustión','Energía y limpieza',['Cepillo','Protector','Recolector','Manillar','Ruedas']],
    ['Escarificador','Forestal y jardín',['Rodillo','Cuchillas','Recolector','Manillar','Ruedas']],
    ['Quitanieves','Forestal y jardín',['Tornillo sinfín','Conducto de descarga','Llave','Ruedas','Pasadores']],
    ['Tronzadora','Construcción',['Disco','Protector de disco','Conexión de agua','Filtro','Carro']],
    ['Cortadora de pavimento','Construcción',['Disco','Protector','Estanque de agua','Manillar','Ruedas']],
    ['Placa compactadora','Construcción',['Placa','Manillar','Estanque de agua','Ruedas de traslado']],
    ['Apisonador','Construcción',['Zapata','Fuelle','Manillar','Filtro de aire']],
    ['Vibrador de hormigón','Construcción',['Sonda','Eje flexible','Acople','Bastidor']],
    ['Otro','Otros',['Accesorios adicionales']]
  ].map(([name,group,accessories]) => {
    const specific = /Motosierra|Podadora/.test(name)?['Cadena sin filo','Espada desgastada','Freno de cadena dañado','No lubrica la cadena']
      : /Desbrozadora|Multiherramienta/.test(name)?['Cabezal dañado','Transmisión dañada','Protector faltante']
      : /Cortasetos/.test(name)?['Cuchillas trabadas','Cuchillas desgastadas','Transmisión dañada']
      : /Césped|cortacésped|Escarificador/.test(name)?['Cuchilla dañada','Tracción no funciona','Recolector dañado']
      : name==='Generador'||name==='Motosoldadora'?['No genera corriente','Voltaje inestable','Conectores dañados']
      : /Motobomba/.test(name)?['No entrega agua','Pérdida de cebado','Sello mecánico con fuga']
      : /Hidrolavadora|Fumigadora|Atomizador/.test(name)?['Sin presión','Fuga en manguera','Boquilla obstruida']
      : /Sopladora/.test(name)?['Turbina dañada','Tubo quebrado','No aspira']
      : /Compresor/.test(name)?['No acumula presión','Fuga de aire','Manómetro dañado']
      : /Tronzadora|pavimento/.test(name)?['Disco dañado','Correa desgastada','Suministro de agua obstruido']
      : /compactadora|Apisonador/.test(name)?['No compacta','Fuelle dañado','Transmisión dañada']
      : /Ahoyadora|Motocultor|motoazada/.test(name)?['Implemento dañado','Transmisión dañada','Embrague no acopla']
      : ['Accesorio de trabajo dañado'];
    return {name,group,accessories,conditions:[...conditions,...specific],active:true};
  });
  const defaults = {version:1,business:{name:'FuelTek',tagline:'Servicio Técnico Multimarca',phone:'+56 9 4043 5805',address:'La Trilla 1062, San Bernardo',email:'fueltekchile@gmail.com',rut:''},workflow:{priority:'Normal',deliveryDays:7,technicians:[]},receiptNote:'Conserve este comprobante y presente el número de orden al consultar o retirar su equipo.',equipment,revision:0};
  const copy = value => JSON.parse(JSON.stringify(value));
  function clean(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.equipment)) throw new Error('Formato de configuración no compatible.');
    const text = (v,max=120) => String(v ?? '').trim().slice(0,max);
    const list = v => [...new Set((Array.isArray(v)?v:[]).map(x=>text(x,80)).filter(Boolean))].slice(0,40);
    const seen = new Set();
    const types=value.equipment.slice(0,60).map(item=>({name:text(item.name,80),group:text(item.group,60)||'Otros',accessories:list(item.accessories),conditions:list(item.conditions),active:item.active!==false})).filter(item=>{if(!item.name||seen.has(item.name))return false;seen.add(item.name);return true;});
    if(!types.length) throw new Error('Agrega al menos un tipo de equipo.');
    return {version:1,business:Object.fromEntries(Object.keys(defaults.business).map(k=>[k,text(value.business?.[k],k==='address'?240:120)])),workflow:{priority:['Normal','Alta','Urgente'].includes(value.workflow?.priority)?value.workflow.priority:'Normal',deliveryDays:Math.max(0,Math.min(365,Math.round(Number(value.workflow?.deliveryDays)||0))),technicians:list(value.workflow?.technicians)},receiptNote:text(value.receiptNote,1500),equipment:types,revision:Number.isSafeInteger(value.revision)&&value.revision>=0?value.revision:0};
  }
  let settings=copy(defaults), draft, ready;
  window.fueltekSettingsReady = new Promise(resolve=>ready=resolve);
  window.fueltekSettings = {get:()=>copy(settings), defaults:()=>copy(defaults), clean};
  const selected = () => [...document.querySelectorAll('#otForm [name="accesorios"]:checked')].map(el=>el.value);
  function renderEquipment(order) {
    const form=document.getElementById('otForm'), select=form.elements.tipoEquipo;
    const type=order?.tipoEquipo ?? select.value, marks=order?.accesorios ?? selected();
    const groups=[...new Set(settings.equipment.filter(e=>e.active||e.name===type).map(e=>e.group))];
    select.innerHTML='<option value="">Seleccionar equipo</option>'+groups.map(group=>`<optgroup label="${esc(group)}">${settings.equipment.filter(e=>e.group===group&&(e.active||e.name===type)).map(e=>`<option>${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
    if(type && !settings.equipment.some(e=>e.name===type)) select.add(new Option(type,type));
    select.value=type || '';
    const item=settings.equipment.find(e=>e.name===type), known=new Set([...(item?.accessories||[]),...(item?.conditions||[])]);
    const extras=marks.filter(value=>!known.has(value));
    const section=(title,values,kind)=>values.length?`<section class="inspection-group"><h4>${title}</h4><div class="checkbox-grid">${values.map(value=>`<label class="checkbox-item"><input type="checkbox" name="accesorios" data-kind="${kind}" value="${esc(value)}" ${marks.includes(value)?'checked':''}><span>${esc(value)}</span></label>`).join('')}</div></section>`:'';
    document.getElementById('equipmentChecklist').innerHTML=(item?section('Accesorios recibidos',item.accessories,'accessory')+section('Condiciones y hallazgos de revisión',item.conditions,'condition'):'<p class="settings-help">Selecciona el tipo de equipo para mostrar su lista de revisión.</p>')+section('Otros elementos ya registrados',extras,'legacy');
  }
  window.fueltekEquipment={load:renderEquipment,enrich(order,snapshot={}) {
    const checks=[...document.querySelectorAll('#otForm [name="accesorios"]:checked')];
    order.revisionDetalle={accessories:checks.filter(e=>e.dataset.kind==='accessory').map(e=>e.value),conditions:checks.filter(e=>e.dataset.kind==='condition').map(e=>e.value),other:checks.filter(e=>e.dataset.kind==='legacy').map(e=>e.value)};
    order.documentoTaller=snapshot.documentoTaller || {business:copy(settings.business),receiptNote:settings.receiptNote};
    return order;
  }};
  async function saveShared(next,expectedRevision) {
    window.fueltekRequireAccess?.();
    if(!navigator.onLine) throw new Error('Necesitas conexión para guardar la configuración compartida. Tus cambios siguen en el panel.');
    const ref=firestore.collection('config').doc('workshop');
    await firestore.runTransaction(async tx=>{
      const old=await tx.get(ref), revision=old.exists ? Number(old.data().revision)||0 : 0;
      if(revision!==expectedRevision) throw new Error('Otra sesión cambió la configuración. Exporta tus cambios y pulsa Recargar antes de volver a editar.');
      tx.set(ref,{...next,revision:revision+1,updatedAt:new Date().toISOString()});
    });
    return {...next,revision:expectedRevision+1};
  }
  window.fueltekSettings.saveShared=saveShared;
  document.addEventListener('DOMContentLoaded',async()=>{
    await window.fueltekAccessReady;
    const $=id=>document.getElementById(id), demo=new URLSearchParams(location.search).has('demo'), key=demo?'fueltek_demo_settings_v1':'fueltek_settings_v1';
    let cacheOnly=false, settingsDirty=false, editingName='';
    try {const cached=localStorage.getItem(key);if(cached)settings=clean(JSON.parse(cached));}catch(_){}
    if(!demo)try{window.fueltekRequireAccess?.();let timeout;const doc=await Promise.race([firestore.collection('config').doc('workshop').get(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Tiempo de espera agotado')),8000);})]).finally(()=>clearTimeout(timeout));if(doc.exists)settings=clean(doc.data());localStorage.setItem(key,JSON.stringify(settings));}catch(_){cacheOnly=true;}
    draft=copy(settings);
    function apply() {
      renderEquipment();
      $('technicians').innerHTML=settings.workflow.technicians.map(name=>`<option value="${esc(name)}"></option>`).join('');
      document.querySelector('.header-info h1').textContent=settings.business.name || 'FuelTek';
      document.querySelector('.header-info p').textContent=settings.business.tagline;
      document.querySelector('.header-info small').textContent=[settings.business.phone,settings.business.address].filter(Boolean).join(' · ');
    }
    function catalogOptions(value='') {
      $('catalogType').innerHTML='<option value="">Agregar un equipo nuevo</option>'+draft.equipment.map(e=>`<option value="${esc(e.name)}">${esc(e.name)}${e.active?'':' (oculto)'}</option>`).join('');
      $('catalogType').value=value;
    }
    function editType(name='') {
      editingName=name;const item=draft.equipment.find(e=>e.name===name)||{name:'',group:'Otros',accessories:[],conditions:[...conditions],active:true};
      $('catalogName').value=item.name;$('catalogGroup').value=item.group;$('catalogAccessories').value=item.accessories.join('\n');$('catalogConditions').value=item.conditions.join('\n');$('catalogActive').checked=item.active;
    }
    function fill() {
      for(const [k,v] of Object.entries(draft.business))$('settingsForm').elements.namedItem(k).value=v;
      $('settingsForm').elements.priority.value=draft.workflow.priority;$('settingsForm').elements.deliveryDays.value=draft.workflow.deliveryDays;
      $('settingsForm').elements.technicians.value=draft.workflow.technicians.join('\n');$('settingsForm').elements.receiptNote.value=draft.receiptNote;
      catalogOptions();editType();settingsDirty=false;
    }
    const status=message=>$('settingsStatus').textContent=message;
    function readForm() {
      const data=new FormData($('settingsForm'));
      for(const k of Object.keys(draft.business))draft.business[k]=data.get(k);
      draft.workflow={priority:data.get('priority'),deliveryDays:Number(data.get('deliveryDays')),technicians:String(data.get('technicians')).split('\n')};draft.receiptNote=data.get('receiptNote');return clean(draft);
    }
    $('settingsForm').addEventListener('input',()=>{settingsDirty=true;status('Hay cambios pendientes. Guarda la configuración para aplicarlos.');});
    $('catalogType').onchange=()=>editType($('catalogType').value);
    $('applyCatalog').onclick=()=>{
      const name=$('catalogName').value.trim();if(!name)return status('Escribe el nombre del equipo.');
      if(name!==editingName && draft.equipment.some(e=>e.name===name))return status('Ese nombre ya existe. Selecciónalo para editarlo.');
      if(!editingName&&draft.equipment.length>=60)return status('El catálogo admite hasta 60 familias de equipos.');
      const item={name,group:$('catalogGroup').value.trim()||'Otros',accessories:$('catalogAccessories').value.split('\n'),conditions:$('catalogConditions').value.split('\n'),active:$('catalogActive').checked};
      const index=draft.equipment.findIndex(e=>e.name===editingName);if(index<0)draft.equipment.push(item);else draft.equipment[index]=item;
      draft=clean(draft);catalogOptions(name);editType(name);settingsDirty=true;status('Equipo incorporado al catálogo pendiente. Pulsa Guardar configuración para aplicarlo.');
    };
    $('settingsForm').onsubmit=async e=>{
      e.preventDefault();const button=$('saveSettings');button.disabled=true;
      try{
        if($('catalogName').value.trim() && (editingName!==$('catalogName').value.trim()||(()=>{const old=draft.equipment.find(x=>x.name===editingName);return !old||old.accessories.join('\n')!==$('catalogAccessories').value||old.conditions.join('\n')!==$('catalogConditions').value||old.group!==$('catalogGroup').value.trim()||old.active!==$('catalogActive').checked;})()))throw new Error('Pulsa Aplicar equipo al catálogo para incluir los cambios del equipo antes de guardar.');
        const next=readForm();settings=demo?{...next,revision:settings.revision+1}:await saveShared(next,settings.revision);
        localStorage.setItem(key,JSON.stringify(settings));draft=copy(settings);apply();fill();status(demo?'Configuración de demostración guardada solo en este navegador.':'Configuración guardada en la nube. Disponible al recargar en los otros dispositivos.');
      }catch(error){status(error.message||'No se pudo guardar la configuración.');}finally{button.disabled=false;}
    };
    $('exportSettings').onclick=()=>{const blob=new Blob([JSON.stringify(readForm(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='FuelTek-configuracion.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Configuración exportada. Las órdenes tienen su propio respaldo.');};
    $('reloadSettings').onclick=async()=>{if(settingsDirty&&!confirm('¿Recargar la configuración? Se descartarán los cambios del panel; las órdenes no se modificarán.'))return;try{if(!demo){window.fueltekRequireAccess?.();const doc=await firestore.collection('config').doc('workshop').get();settings=doc.exists?clean(doc.data()):copy(defaults);}draft=copy(settings);fill();apply();status('Configuración actualizada.');}catch(_){status('No se pudo leer la nube. Conservamos la configuración actual.');}};
    $('importSettings').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>150000)throw new Error('El archivo de configuración es demasiado grande.');draft=clean(JSON.parse(await file.text()));draft.revision=settings.revision;fill();settingsDirty=true;status('Configuración importada para revisar. Guarda para aplicarla; ninguna orden fue modificada.');}catch(error){status(error.message);}e.target.value='';};
    document.querySelector('#otForm [name="tipoEquipo"]').addEventListener('change',()=>renderEquipment());
    document.addEventListener('fueltek:new',()=>{renderEquipment({tipoEquipo:'',accesorios:[]});const form=$('otForm');form.elements.prioridad.value=settings.workflow.priority;if(settings.workflow.deliveryDays){const date=new Date();date.setDate(date.getDate()+settings.workflow.deliveryDays);form.elements.fechaEntrega.value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}});
    window.addEventListener('beforeunload',e=>{if(settingsDirty){e.preventDefault();e.returnValue='';}});
    fill();apply();status(cacheOnly?'Mostrando la última configuración de este equipo. No se pudo consultar la nube.':demo?'Modo demostración. Puedes probar la configuración con datos ficticios.':'Configura el taller. Los cambios se aplican al guardar y no reescriben órdenes anteriores.');ready();
  });
})();
