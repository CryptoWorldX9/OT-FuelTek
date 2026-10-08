'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse,makeOrder,pdf,template,defaults}=require('./order.cjs');
const {createService}=require('./service.cjs');
const sample=()=>parse(template);
function fakeDatabase(seed={}){
  let data=new Map(Object.entries(seed)),queue=Promise.resolve();
  const snap=key=>({exists:data.has(key),data:()=>structuredClone(data.get(key))});
  return {
    collection:name=>({doc:id=>({key:`${name}/${id}`,get:async()=>snap(`${name}/${id}`)})}),
    runTransaction(fn){const run=queue.then(async()=>{const writes=[];const value=await fn({get:async ref=>snap(ref.key),create(ref,value){if(data.has(ref.key))throw new Error('EXISTS');writes.push([ref.key,value]);},set(ref,value,options){writes.push([ref.key,options?.merge?{...data.get(ref.key),...value}:value]);}});for(const [k,v] of writes)data.set(k,structuredClone(v));return value;});queue=run.catch(()=>{});return run;},
    entries:()=>[...data.entries()]
  };
}
const update=(id=1,text=template)=>({update_id:id,message:{from:{id:123,is_bot:false},chat:{id:123,type:'private'},text}});
const service=(db,renderPdf=async()=>Buffer.from('%PDF-test'))=>createService({db,botId:'99',allowedUsers:new Set(['123']),allowedChats:new Set(['123']),renderPdf,now:()=>new Date('2026-10-09T01:00:00Z')});
test('required fields, unknown/duplicate fields, country code and explicit missing values',()=>{
  const order=makeOrder(sample(),defaults(),new Date('2026-10-09T01:00:00Z'));
  assert.equal(order.fechaRecibida,'2026-10-08');assert.equal(order.fechaEntrega,'');
  assert.equal(order.estadoServicio,'Recibida');assert.equal(order.presupuestoPendiente,true);
  assert.equal(order.firmaCliente,'');assert.match(order.diagnostico,/Diagnóstico técnico pendiente/);
  assert.throws(()=>parse(template.replace('Serie: Sin serie visible','')),/Faltan: serie/);
  assert.throws(()=>parse(template+'\nCliente: Duplicado'),/repetido/);
  assert.throws(()=>parse(template+'\nOT: 123'),/desconocido/);
  assert.throws(()=>makeOrder({...sample(),telefono:'912345678'},defaults()),/código de país/);
});
test('money, dates, equipment and payment consistency',()=>{
  assert.throws(()=>makeOrder({...sample(),abono:'1000'},defaults()),/Abono debe ser 0/);
  assert.throws(()=>makeOrder({...sample(),valor:'1,5'},defaults()),/pesos enteros/);
  assert.throws(()=>makeOrder({...sample(),entrega:'2026-02-30'},defaults()),/fecha válida/);
  assert.throws(()=>makeOrder({...sample(),equipo:'Inventado'},defaults()),/catálogo/);
  const order=makeOrder({...sample(),valor:'45.000',abono:'15000'},defaults());
  assert.equal(order.valorTrabajo,45000);assert.equal(order.estadoPago,'Abonado');
});
test('unauthorized users, groups and edited updates never touch the database',async()=>{
  const db={collection(){throw new Error('Must not read');}};
  const handle=service(db);
  for(const event of [{...update(),message:{...update().message,from:{id:999}}},{...update(),message:{...update().message,chat:{id:123,type:'group'}}},{update_id:1,edited_message:update().message}]) assert.deepEqual(await handle(event),{kind:'ignore'});
});
test('simultaneous repeated delivery creates one OT, advances counter once and returns same document',async()=>{
  const db=fakeDatabase({'config/lastOt':{value:10724}}),handle=service(db);
  const results=await Promise.all([handle(update()),handle(update()),handle(update())]);
  assert.deepEqual(results.map(x=>x.ot),['10725','10725','10725']);
  assert.equal(db.entries().filter(([k])=>k.startsWith('orders/')).length,1);
  assert.equal(db.entries().find(([k])=>k==='config/lastOt')[1].value,10725);
  const second=await handle(update(2));assert.equal(second.ot,'10726');
});
test('invalid text or failed PDF validation never reserves an OT',async()=>{
  const db=fakeDatabase({'config/lastOt':{value:10}}),handle=service(db);
  assert.equal((await handle(update(1,'/ot\nCliente: Prueba'))).kind,'message');
  await assert.rejects(service(db,async()=>{throw new Error('PDF broken');})(update()));
  assert.equal(db.entries().length,1);
});
test('collision and missing counter stop without replacing an order',async()=>{
  const db=fakeDatabase({'config/lastOt':{value:10},'orders/11':{clienteNombre:'Anterior'}});
  await assert.rejects(service(db)(update()),/COUNTER_COLLISION/);
  assert.equal(db.entries().length,2);
  assert.equal(db.entries().find(([k])=>k==='orders/11')[1].clienteNombre,'Anterior');
  await assert.rejects(service(fakeDatabase())(update()),/COUNTER_INVALID/);
});
test('PDF delivery failure after commit can be retried without creating another OT',async()=>{
  const db=fakeDatabase({'config/lastOt':{value:10}});let renders=0;
  const handle=service(db,async()=>{if(++renders===2)throw new Error('Temporary failure');return Buffer.from('%PDF-test');});
  await assert.rejects(handle(update()),/Temporary failure/);
  assert.equal((await handle(update())).ot,'11');
  assert.equal(db.entries().filter(([k])=>k.startsWith('orders/')).length,1);
});
test('real app PDF renderer includes letter pages and rejects unsupported characters before persistence',async()=>{
  const order={...makeOrder(sample(),defaults()),ot:'123'};
  const bytes=await pdf(order);
  const {PDFDocument}=require('../vendor/pdf-lib.min.js'),doc=await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount()>=1);
  for(const page of doc.getPages()){assert.equal(page.getWidth(),612);assert.equal(page.getHeight(),792);}
  await assert.rejects(pdf({...order,clienteNombre:'Prueba 🛠'}),/sin emojis/);
});
