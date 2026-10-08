'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const window = {PDFLib: require('../vendor/pdf-lib.min.js')};
// Load the application's own trusted, versioned PDF/catalog functions.
for (const file of ['settings.js', 'stamp.js', 'receipt.js', 'receipt-pdf.js']) {
  new Function('window', 'document', fs.readFileSync(path.join(root, file), 'utf8'))(window, {addEventListener(){}});
}
const logo = new Uint8Array(fs.readFileSync(path.join(root, 'logo-fueltek.png')));
class InputError extends Error {}
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const fields = ['cliente','telefono','correo','equipo','marca','modelo','serie','ano','falla','accesorios','hallazgos','trabajo','valor','abono','tecnico','entrega','prioridad','recepcion'];
const required = ['cliente','telefono','equipo','marca','modelo','serie','falla','accesorios','valor','abono','tecnico','entrega'];
const template = `/ot
Cliente: Cliente de ejemplo
Telefono: +56912345678
Equipo: Motosierra
Marca: STIHL
Modelo: MS 180
Serie: Sin serie visible
Falla: El cliente informa que no enciende
Accesorios: Espada; Cadena
Valor: pendiente
Abono: 0
Tecnico: Por asignar
Entrega: por definir`;
function parse(text) {
  if (typeof text !== 'string' || text.length > 12000) throw new InputError('Envía una orden de hasta 12.000 caracteres.');
  const [command, ...lines] = text.trim().split(/\r?\n/);
  if (!/^\/ot(?:@[A-Za-z0-9_]+)?$/.test(command.trim())) throw new InputError('Usa /ot seguido de los campos en líneas separadas.');
  const result = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    const key = normalize(line.slice(0, colon));
    if (colon < 1 || !fields.includes(key)) throw new InputError('Campo desconocido. Usa /ayuda para ver los nombres admitidos.');
    if (Object.hasOwn(result, key)) throw new InputError('Campo repetido: ' + key);
    result[key] = line.slice(colon + 1).trim();
  }
  const missing = required.filter(k => !result[k]);
  if (missing.length) throw new InputError('Faltan: ' + missing.join(', ') + '. Reenvía la orden completa.');
  for (const [key, value] of Object.entries(result)) {
    if (value.length > (['falla','trabajo'].includes(key) ? 3000 : 500)) throw new InputError('Campo demasiado extenso: ' + key);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new InputError('El texto contiene caracteres de control.');
  }
  return result;
}
function money(value, label) {
  const text = String(value).trim().replace(/^\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) throw new InputError(label + ': usa pesos enteros, por ejemplo 45000.');
  const amount = Number(text.replace(/\./g, ''));
  if (!Number.isSafeInteger(amount) || amount > 1000000000) throw new InputError(label + ' fuera de rango.');
  return amount;
}
function date(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new InputError(label + ': usa AAAA-MM-DD y una fecha válida.');
  return value;
}
function today(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function list(value) {
  if (!value || ['ninguno','ninguna','sin accesorios','sin hallazgos'].includes(normalize(value))) return [];
  const items = value.split(';').map(x=>x.trim()).filter(Boolean);
  if (items.length > 40 || items.some(x=>x.length>120)) throw new InputError('Lista demasiado extensa. Separa los elementos con punto y coma.');
  return [...new Set(items)];
}
function makeOrder(input, settings, now = new Date()) {
  const phone = input.telefono.replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new InputError('Telefono: incluye código de país, por ejemplo +56912345678.');
  const email = input.correo || '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('Correo inválido. Omite Correo si no fue informado.');
  const equipment = settings.equipment.find(e=>e.active !== false && normalize(e.name)===normalize(input.equipo));
  if (!equipment) throw new InputError('Equipo no encontrado en el catálogo. Consulta /equipos.');
  const pending = normalize(input.valor) === 'pendiente';
  const total = pending ? 0 : money(input.valor, 'Valor');
  const paid = money(input.abono, 'Abono');
  if (paid > total) throw new InputError(pending ? 'Con Valor pendiente, Abono debe ser 0. Define el valor antes de registrar un abono.' : 'El abono no puede superar el valor.');
  const received = input.recepcion ? date(input.recepcion, 'Recepcion') : today(now);
  const delivery = normalize(input.entrega) === 'por definir' ? '' : date(input.entrega, 'Entrega');
  if (delivery && delivery < received) throw new InputError('La entrega no puede ser anterior a la recepción.');
  if (input.ano && !/^(19\d{2}|20\d{2}|2100)$/.test(input.ano)) throw new InputError('Ano: usa un año entre 1900 y 2100.');
  const priority = ['Normal','Alta','Urgente'].find(p=>normalize(p)===normalize(input.prioridad || settings.workflow.priority || 'Normal'));
  if (!priority) throw new InputError('Prioridad: Normal, Alta o Urgente.');
  const accessories = list(input.accesorios), conditions = list(input.hallazgos);
  return {
    clienteNombre:input.cliente, clienteTelefono:phone, clienteEmail:email,
    tipoEquipo:equipment.name, marca:input.marca, modelo:input.modelo, serie:input.serie, anio:input.ano || '',
    tecnico:input.tecnico, prioridad:priority, estadoServicio:'Recibida',
    fechaRecibida:received, fechaEntrega:delivery, fechaGuardado:now.toISOString(),
    diagnostico:'Síntoma informado por el cliente: ' + input.falla + '\nDiagnóstico técnico pendiente.',
    trabajo:[input.trabajo || '',pending ? 'Valor del trabajo por definir. El monto $0 es provisional; no indica un servicio gratuito.' : ''].filter(Boolean).join('\n'),
    valorTrabajo:total, montoAbonado:paid, estadoPago:paid > 0 ? (paid===total ? 'Pagado' : 'Abonado') : 'Pendiente',
    presupuestoPendiente:pending, accesorios:[...new Set([...accessories,...conditions])],
    revisionDetalle:{accessories,conditions,other:[]}, firmaTaller:'', firmaCliente:'',
    documentoTaller:{business:settings.business,receiptNote:settings.receiptNote}
  };
}
async function pdf(order) {
  try { return Buffer.from(await window.fueltekPdf.create(order, {}, logo)); }
  catch (error) {
    if (/WinAnsi cannot encode/.test(error.message)) throw new InputError('El PDF no admite algún carácter del texto. Reenvía sin emojis ni símbolos especiales.');
    throw error;
  }
}
module.exports = {InputError,parse,makeOrder,pdf,template,required,defaults:window.fueltekSettings.defaults,cleanSettings:window.fueltekSettings.clean};
