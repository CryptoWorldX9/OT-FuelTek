const fs=require('node:fs'),assert=require('node:assert/strict');
const window={PDFLib:require('../vendor/pdf-lib.min.js')},document={addEventListener(){}};
for(const file of ['settings.js','receipt.js','receipt-pdf.js'])new Function('window','document',fs.readFileSync(__dirname+'/../'+file,'utf8'))(window,document);
(async()=>{
 const settings=window.fueltekSettings.defaults(),order={ot:'123',clienteNombre:'Prueba',marca:'STIHL',tipoEquipo:'Motosierra',diagnostico:'Una línea.\n\nUna segunda línea.',trabajo:'Revisión completa.',valorTrabajo:100,montoAbonado:20,estadoPago:'Abonado'};
 const bytes=await window.fueltekPdf.create(order,settings),short=await window.PDFLib.PDFDocument.load(bytes);
 assert.equal(short.getPageCount(),1);assert.equal(Math.round(short.getPage(0).getWidth()),595);assert.equal(Math.round(short.getPage(0).getHeight()),842);
 const long=await window.fueltekPdf.create({...order,diagnostico:Array.from({length:150},(_,i)=>`Línea ${i+1} de una revisión extensa.\n`).join('\n')},settings);
 assert.ok((await window.PDFLib.PDFDocument.load(long)).getPageCount()>1);
 await assert.rejects(()=>window.fueltekPdf.create({...order,diagnostico:'Símbolo no admitido por la fuente: 🛠'},settings));
 console.log('PASS PDF descargable: A4, documento válido, paginación de texto largo y caracteres no compatibles detectados sin omitirlos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
