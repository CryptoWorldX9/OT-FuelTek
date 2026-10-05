const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const sandbox={window:{},console,Intl,Date,Map,Set,URLSearchParams,location:{search:''},document:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},navigator:{onLine:true}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/../script.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/../professional.js','utf8'),sandbox);
(async()=>{
 assert.equal(sandbox.balanceOf({valorTrabajo:85000,montoAbonado:30000,estadoPago:'Abonado'}),55000);
 assert.equal(sandbox.balanceOf({valorTrabajo:45000,estadoPago:'Pagado'}),0);
 assert.equal(sandbox.balanceOf({valorTrabajo:200,montoAbonado:300}),0);
 const combined=sandbox.mergeOrderSources([{ot:1,fechaGuardado:'2026-01-02',clienteNombre:'Local',extra:'retained'},{ot:'2'}],[{ot:'1',fechaGuardado:'2026-01-01',clienteNombre:'Old'},{ot:'3'}]);
 assert.equal(combined.length,3);assert.equal(combined[0].clienteNombre,'Local');assert.equal(combined[0].extra,'retained');
 assert.equal(sandbox.escapeHTML('<img src=x onerror="evil()">'), '&lt;img src=x onerror=&quot;evil()&quot;&gt;');
 const storage=new Map([['config/lastOt',{value:10724}]]);let lock=Promise.resolve();
 sandbox.firestore={collection(c){return {doc(id){return `${c}/${id}`;}}},runTransaction(fn){const run=lock.then(async()=>{const writes=[];const tx={async get(key){const value=storage.get(key);return {exists:!!value,data:()=>value};},set(key,data,options){writes.push([key,data,options]);}};const result=await fn(tx);for(const [key,data,options]of writes)storage.set(key,options?.merge?{...storage.get(key),...data}:data);return result;});lock=run.catch(()=>{});return run;}};
 const ids=await Promise.all([sandbox.createCloudOrder({clienteNombre:'A'}),sandbox.createCloudOrder({clienteNombre:'B'})]);assert.equal(new Set(ids).size,2);assert.equal(storage.get('orders/10725').clienteNombre,'A');assert.equal(storage.get('orders/10726').clienteNombre,'B');
 storage.set('orders/10727',{clienteNombre:'Do not overwrite'});
 await assert.rejects(()=>sandbox.createCloudOrder({clienteNombre:'New'}),/ya existe/);assert.equal(storage.get('orders/10727').clienteNombre,'Do not overwrite');assert.equal(storage.get('config/lastOt').value,10726);
 storage.set('orders/99',{ot:'99',fechaGuardado:'new',extra:'retain'});
 await assert.rejects(()=>sandbox.firebaseSaveOrder({ot:'99',clienteNombre:'Edit'},{fechaGuardado:'old'}),/otro equipo/);
 await sandbox.firebaseSaveOrder({ot:'99',clienteNombre:'Edit',fechaGuardado:'newer'},{fechaGuardado:'new'});assert.equal(storage.get('orders/99').extra,'retain');
 // A failed local transaction must never report success on request completion alone.
 let tx,request;
 sandbox.indexedDB={open(){const openRequest={result:{objectStoreNames:{contains:()=>true},transaction(){tx={objectStore(){return {put(){request={};return request;}};}};return tx;},close(){}}};queueMicrotask(()=>openRequest.onsuccess());return openRequest;}};
 let resolved=false;const save=sandbox.dbPut({ot:'5'}).then(()=>resolved=true).catch(e=>e);
 await new Promise(r=>setTimeout(r,0)); if(request.onsuccess)request.onsuccess(); assert.equal(resolved,false);tx.error=new Error('Storage full');tx.onabort();const result=await save;assert.equal(result.message,'Storage full');
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');assert(!html.includes('id="clearBtn"'));assert(!fs.readFileSync(__dirname+'/../script.js','utf8').includes('deleteDatabase'));
 const manifest=JSON.parse(fs.readFileSync(__dirname+'/../manifest.json','utf8'));assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
 console.log('PASS: saldos, combinación de registros, escape HTML, correlativos concurrentes, protección de colisiones, edición concurrente, transacción local abortada y rutas PWA. Firebase simulado; no se escribieron datos reales.');
})().catch(e=>{console.error(e);process.exitCode=1;});
