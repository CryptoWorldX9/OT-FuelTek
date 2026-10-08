'use strict';
const {createHash} = require('node:crypto');
const {InputError,parse,makeOrder,pdf,template,defaults,cleanSettings} = require('./order.cjs');
function createService({db,allowedUsers,allowedChats,botId,renderPdf=pdf,now=()=>new Date()}) {
  if (!/^\d+$/.test(botId) || !allowedUsers.size || !allowedChats.size) throw new Error('Configura bot y usuarios/chats autorizados.');
  return async function handle(update) {
    const msg = update?.message;
    if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0 || !msg || msg.from?.is_bot || msg.chat?.type !== 'private' || !allowedUsers.has(String(msg.from?.id)) || !allowedChats.has(String(msg.chat?.id))) return {kind:'ignore'};
    const chatId = String(msg.chat.id), reply = text=>({kind:'message',chatId,text});
    if (typeof msg.text !== 'string') return reply('Por ahora envía la orden como texto. /ayuda muestra la plantilla.');
    const digest = createHash('sha256').update(`${botId}:${update.update_id}`).digest('hex');
    const requestRef = db.collection('telegramRequests').doc(digest);
    // Replay committed results before parsing: retries must return the original OT.
    const previous = await requestRef.get();
    async function result(order) {
      const bytes = await renderPdf(order);
      return {kind:'pdf',chatId,ot:order.ot,fileName:`FuelTek-OT-${order.ot}.pdf`,pdfBase64:bytes.toString('base64'),text:`OT #${order.ot} guardada en FuelTek.`};
    }
    if (previous.exists) return result(previous.data().order);
    const settingsRef = db.collection('config').doc('workshop');
    const settingsDoc = await settingsRef.get();
    const settings = settingsDoc.exists ? cleanSettings(settingsDoc.data()) : defaults();
    if (/^\/(ayuda|start)(?:@[\w]+)?\s*$/.test(msg.text)) return reply('Envía todos estos campos. Serie puede ser «Sin serie visible», Valor «pendiente», Técnico «Por asignar» y Entrega «por definir».\n\n' + template + '\n\nOpcionales: Correo, Ano, Recepcion (AAAA-MM-DD), Prioridad, Hallazgos y Trabajo. No inventes hallazgos ni firmas.');
    if (/^\/equipos(?:@[\w]+)?\s*$/.test(msg.text)) return reply('Tipos de equipo:\n' + settings.equipment.filter(e=>e.active!==false).map(e=>e.name).join('\n'));
    try {
      const order = makeOrder(parse(msg.text),settings,now());
      // Rendering is checked before any write, so unsupported text never creates an OT.
      await renderPdf({...order,ot:'BORRADOR'});
      const stored = await db.runTransaction(async tx=>{
        const prior = await tx.get(requestRef);
        if (prior.exists) return prior.data().order;
        const counterRef = db.collection('config').doc('lastOt');
        const counterDoc = await tx.get(counterRef);
        const count = counterDoc.data()?.value;
        if (!counterDoc.exists || !Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER) throw new Error('COUNTER_INVALID');
        const ot = String(count+1), ref=db.collection('orders').doc(ot);
        if ((await tx.get(ref)).exists) throw new Error('COUNTER_COLLISION');
        // Ensure a concurrent workshop-settings edit retries the snapshot selection.
        const currentSettings = await tx.get(settingsRef);
        const latest = currentSettings.exists ? cleanSettings(currentSettings.data()) : defaults();
        if (JSON.stringify(latest) !== JSON.stringify(settings)) throw new InputError('Cambió la configuración del taller. Reenvía la orden completa.');
        const saved = {...order,ot,origen:'telegram',telegram:{botId,updateId:update.update_id,chatId,userId:String(msg.from.id)}};
        tx.create(ref,saved);
        tx.set(counterRef,{value:Number(ot),lastOrderId:ot,updatedAt:now().toISOString()},{merge:true});
        tx.create(requestRef,{order:saved,createdAt:now().toISOString()});
        return saved;
      });
      return result(stored);
    } catch (error) {
      if (error instanceof InputError) return reply(error.message + '\nNo se creó una orden nueva. Usa /ayuda para consultar el formato.');
      throw error;
    }
  };
}
module.exports={createService};
