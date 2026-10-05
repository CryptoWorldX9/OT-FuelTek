const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const callbacks=[],elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,classList:{values:new Set(),add(x){this.values.add(x)},remove(x){this.values.delete(x)},toggle(x,on){on?this.add(x):this.remove(x)}}});return elements.get(id);};
 let observer,cloudCalls=0,domReads=0;
 const auth={async setPersistence(){},onAuthStateChanged(fn){observer=fn},async signOut(){await observer(null)}};
 const authFactory=()=>auth;authFactory.Auth={Persistence:{SESSION:'session'}};
 const sandbox={window:{},URLSearchParams,location:{search:''},console,Intl,Date,Map,Set,navigator:{onLine:true},localStorage:{getItem(){return null},setItem(){}},firebase:{apps:[{}],auth:authFactory},Event:class{},document:{body:element('body'),addEventListener(name,fn){callbacks.push(fn)},getElementById(id){domReads++;return element(id)},dispatchEvent(){}},firestore:{collection(){cloudCalls++;throw new Error('No debe consultar la nube antes de ingresar')}}};
 sandbox.window.firebase=sandbox.firebase;
 vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(__dirname+'/../access.js','utf8'),sandbox);
 vm.runInContext(fs.readFileSync(__dirname+'/../script.js','utf8'),sandbox);
 const pending=callbacks[1]();await Promise.resolve();assert.equal(domReads,0);assert.equal(cloudCalls,0);
 await callbacks[0]();
 assert.throws(()=>sandbox.window.fueltekRequireAccess(),/Ingresa/);
 await assert.rejects(()=>sandbox.getFirebaseCorrelative(),/Ingresa/);assert.equal(cloudCalls,0);
 await observer({email:'outside@example.com',emailVerified:true,providerData:[{providerId:'google.com'}]});assert.throws(()=>sandbox.window.fueltekRequireAccess(),/Ingresa/);
 // Se verifica el cambio de autorización sin iniciar los eventos completos de la app.
 for(const email of ['servtecfueltek@gmail.com','fueltekchile@gmail.com']){
  await observer({email,emailVerified:true,providerData:[{providerId:'google.com'}]});assert.doesNotThrow(()=>sandbox.window.fueltekRequireAccess());
  await observer(null);assert.throws(()=>sandbox.window.fueltekRequireAccess(),/Ingresa/);
 }
 console.log('PASS acceso: no consultas previas al ingreso, cuenta externa denegada, dos cuentas permitidas y bloqueo al cerrar sesión.');
 pending.catch(()=>{});
})().catch(error=>{console.error(error);process.exitCode=1;});
