const fs=require('node:fs'),assert=require('node:assert/strict');
const window={PDFLib:require('../vendor/pdf-lib.min.js')},document={addEventListener(){}};
for(const file of ['settings.js','stamp.js','receipt.js','receipt-pdf.js'])new Function('window','document',fs.readFileSync(__dirname+'/../'+file,'utf8'))(window,document);
(async()=>{
 const settings=window.fueltekSettings.defaults(),order={ot:'123',clienteNombre:'Prueba',marca:'STIHL',tipoEquipo:'Motosierra',diagnostico:'Una línea.\n\nUna segunda línea.',trabajo:'Revisión completa.',valorTrabajo:100,montoAbonado:20,estadoPago:'Abonado'};
 const bytes=await window.fueltekPdf.create(order,settings),short=await window.PDFLib.PDFDocument.load(bytes);
 assert.equal(short.getPageCount(),1);assert.equal(short.getPage(0).getWidth(),612);assert.equal(short.getPage(0).getHeight(),792);
 const imageResources=short.getPage(0).node.Resources().lookup(window.PDFLib.PDFName.of('XObject'),window.PDFLib.PDFDict);
 assert.ok(imageResources.entries().some(([,ref])=>short.context.lookup(ref).dict.get(window.PDFLib.PDFName.of('Subtype'))?.toString()==='/Image'));
 const long=await window.fueltekPdf.create({...order,diagnostico:Array.from({length:150},(_,i)=>`Línea ${i+1} de una revisión extensa.\n`).join('\n')},settings);
 const longPdf=await window.PDFLib.PDFDocument.load(long);
 assert.ok(longPdf.getPageCount()>1);
 assert.ok(longPdf.getPages().every(p=>p.getWidth()===612&&p.getHeight()===792));
 await assert.rejects(()=>window.fueltekPdf.create({...order,diagnostico:'Símbolo no admitido por la fuente: 🛠'},settings));
 const savedStamp=window.fueltekStamp;delete window.fueltekStamp;
 await assert.rejects(()=>window.fueltekPdf.create(order,settings),/timbre/);
 window.fueltekStamp=savedStamp;
 console.log('PASS PDF descargable: carta en todas las páginas, timbre incrustado y obligatorio, paginación y caracteres no compatibles detectados sin omitirlos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
