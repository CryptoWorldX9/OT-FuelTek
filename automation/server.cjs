'use strict';
const http=require('node:http');
const {timingSafeEqual}=require('node:crypto');
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {createService}=require('./service.cjs');
const secret=process.env.OT_API_TOKEN || '';
if (secret.length<32) throw new Error('OT_API_TOKEN debe tener al menos 32 caracteres aleatorios.');
if (!process.env.GOOGLE_CLOUD_PROJECT) throw new Error('Configura GOOGLE_CLOUD_PROJECT.');
const ids=name=>new Set((process.env[name]||'').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s)));
initializeApp({credential:applicationDefault(),projectId:process.env.GOOGLE_CLOUD_PROJECT});
const handle=createService({db:getFirestore(),allowedUsers:ids('TELEGRAM_ALLOWED_USER_IDS'),allowedChats:ids('TELEGRAM_ALLOWED_CHAT_IDS'),botId:process.env.TELEGRAM_BOT_ID});
const server=http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
  if(req.url==='/health'&&req.method==='GET') return send(200,{ok:true});
  const provided=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+secret);
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected)) return send(401,{error:'Unauthorized'});
  if(req.url!=='/telegram'||req.method!=='POST') return send(404,{error:'Not found'});
  if(!String(req.headers['content-type']).startsWith('application/json')) return send(415,{error:'JSON required'});
  try {
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>65536){send(413,{error:'Payload too large'});return;}chunks.push(chunk);}
    let update;
    try{update=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Invalid JSON'});}
    return send(200,await handle(update));
  }catch(error){
    // No messages, customer data, tokens or database records in logs.
    console.error('OT processing failed', ['COUNTER_INVALID','COUNTER_COLLISION'].includes(error.message)?error.message:'CHECK_SERVER_CONNECTION');
    return send(503,{error:'No se pudo completar. Reintenta la misma ejecución de n8n: conserva update_id para evitar duplicados.'});
  }
});
server.requestTimeout=30000;
server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1',()=>console.log('FuelTek OT service ready'));
