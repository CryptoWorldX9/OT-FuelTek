// Solo emulador local: este archivo nunca debe conectarse a ot-fueltek real.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,deleteDoc,runTransaction}=require('firebase/firestore');
(async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Se requiere el emulador local.');
 const env=await initializeTestEnvironment({projectId:'demo-fueltek-tests',firestore:{rules:fs.readFileSync(__dirname+'/../firestore.rules','utf8')}});
 try{
  await env.clearFirestore();
  const legacy={ot:'10781',clienteNombre:'Prueba',marca:'STIHL',valorTrabajo:100,montoAbonado:0,extra:'conservar',fechaGuardado:'anterior'};
  await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'config/lastOt'),{value:10781,updatedAt:'anterior',extra:'conservar'});await setDoc(doc(db,'orders/10781'),legacy);});
  const account=email=>env.authenticatedContext(email,{email,email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const admin=account('servtecfueltek@gmail.com'),second=account('fueltekchile@gmail.com');
  const anonymous=env.unauthenticatedContext().firestore(),outsider=account('outside@example.com');
  const unverified=env.authenticatedContext('unverified',{email:'servtecfueltek@gmail.com',email_verified:false,firebase:{sign_in_provider:'google.com'}}).firestore();
  for(const db of [anonymous,outsider,unverified]){await assertFails(getDoc(doc(db,'orders/10781')));await assertFails(getDocs(collection(db,'orders')));await assertFails(setDoc(doc(db,'orders/10781'),legacy));}
  for(const db of [admin,second]){await assertSucceeds(getDoc(doc(db,'orders/10781')));await assertFails(deleteDoc(doc(db,'orders/10781')));}
  await assertFails(setDoc(doc(admin,'orders/999'),{...legacy,ot:'999'}));
  await assertFails(setDoc(doc(admin,'config/lastOt'),{value:10780,lastOrderId:'10780'}));
  await assertFails(setDoc(doc(admin,'config/lastOt'),{value:10782,lastOrderId:'10782'}));
  const facade=db=>({collection:path=>({doc:id=>doc(db,path,String(id))}),runTransaction:fn=>runTransaction(db,tx=>fn({get:async ref=>{const snap=await tx.get(ref);return {exists:snap.exists(),data:()=>snap.data()};},set:(ref,data,options)=>options?tx.set(ref,JSON.parse(JSON.stringify(data)),options):tx.set(ref,JSON.parse(JSON.stringify(data)))}))});
  const sandbox={window:{},console,Intl,Date,Map,Set,URLSearchParams,location:{search:''},document:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},navigator:{onLine:true},firestore:facade(admin)};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(__dirname+'/../script.js','utf8'),sandbox);vm.runInContext(fs.readFileSync(__dirname+'/../professional.js','utf8'),sandbox);
  const ids=await Promise.all([sandbox.createCloudOrder({...legacy,clienteNombre:'Concurrente A'}),sandbox.createCloudOrder({...legacy,clienteNombre:'Concurrente B'})]);assert.equal(new Set(ids).size,2);assert.deepEqual([...ids].sort(),['10782','10783']);
  assert.equal((await getDoc(doc(admin,'config/lastOt'))).data().extra,'conservar');
  await sandbox.firebaseSaveOrder({...legacy,clienteNombre:'Actualizada',fechaGuardado:'nueva'},{fechaGuardado:'anterior'});assert.equal((await getDoc(doc(admin,'orders/10781'))).data().extra,'conservar');
  await assert.rejects(()=>sandbox.firebaseSaveOrder({...legacy,fechaGuardado:'otra'},{fechaGuardado:'anterior'}),/otro equipo/);
  await assertFails(setDoc(doc(admin,'orders/10781'),{...legacy,montoAbonado:200}));
  sandbox.firestore=facade(second);await sandbox.firebaseSaveOrder({...legacy,clienteNombre:'Segunda cuenta',fechaGuardado:'final'},{fechaGuardado:'nueva'});
  console.log('PASS emulador: dos cuentas autorizadas, denegación anónima/externa/no verificada, borrado denegado, creación concurrente, campos conservados y conflictos detectados. Sin conexión a producción.');
 }finally{await env.cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1;});
