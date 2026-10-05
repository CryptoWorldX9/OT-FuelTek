/* PDF vectorial: texto seleccionable, saltos de línea y paginación sin capturas de pantalla. */
(() => {
  'use strict';
  async function create(order,settings={},logoBytes) {
    const {PDFDocument,StandardFonts,rgb}=window.PDFLib;
    const pdf=await PDFDocument.create(), regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const snapshot=order.documentoTaller||settings,b=snapshot.business||{}, width=612,height=792,margin=36,usable=width-2*margin;
    if(!window.fueltekStamp?.bytes) throw new Error('No se pudo cargar el timbre del taller. Recarga la aplicación.');
    const stamp=await pdf.embedPng(window.fueltekStamp.bytes());
    const navy=rgb(.078,.176,.275),orange=rgb(.914,.463,.141),ink=rgb(.137,.224,.294),muted=rgb(.322,.416,.49),lineColor=rgb(.86,.89,.92),pale=rgb(.965,.975,.984);
    let page,y,logo;
    if(logoBytes)try{logo=await pdf.embedPng(logoBytes);}catch(_){}
    const str=value=>String(value??'').replace(/\r\n?/g,'\n').replace(/\t/g,'    ');
    const lines=(value,maxWidth=usable,size=10,font=regular)=>{
      const result=[];
      for(const paragraph of str(value).split('\n')) {
        if(!paragraph){result.push('');continue;}
        let current='';
        for(const ch of paragraph){if(font.widthOfTextAtSize(current+ch,size)>maxWidth&&current){const space=current.lastIndexOf(' ');if(space>0){result.push(current.slice(0,space));current=current.slice(space+1)+ch;}else{result.push(current);current=ch;}}else current+=ch;}
        result.push(current);
      }
      return result;
    };
    const draw=(text,x,top,size=10,font=regular,color=ink)=>page.drawText(str(text),{x,y:height-top-size,size,font,color});
    function newPage(first=false) {
      page=pdf.addPage([width,height]);y=margin;
      if(first){
        if(logo)page.drawImage(logo,{x:margin,y:height-margin-50,width:50,height:50});
        const x=margin+(logo?75:0),brandWidth=width-margin-x-155;
        const brandLines=lines(b.name||'FuelTek',brandWidth,20,bold);for(const text of brandLines){draw(text,x,y,20,bold,navy);y+=22;}
        for(const text of lines(b.tagline||'Servicio Técnico Multimarca',brandWidth,9)){draw(text,x,y,9,regular,muted);y+=11;}
        for(const text of lines([b.phone,b.email].filter(Boolean).join(' · '),brandWidth,8)){draw(text,x,y,8,regular,muted);y+=10;}
        for(const text of lines([b.address,b.rut?'RUT '+b.rut:''].filter(Boolean).join(' · '),brandWidth,8)){draw(text,x,y,8,regular,muted);y+=10;}
        const right=width-margin-140;draw('ORDEN DE TRABAJO',right,margin+2,8,bold,navy);draw('#'+str(order.ot||'BORRADOR'),right,margin+17,22,bold,navy);draw('Emisión '+new Date().toLocaleDateString('es-CL'),right,margin+49,8,regular,muted);
        y=Math.max(y,margin+58)+8;page.drawLine({start:{x:margin,y:height-y},end:{x:width-margin,y:height-y},color:orange,thickness:2});y+=10;
        draw('Comprobante de recepción y servicio',margin,y,9,regular,muted);y+=19;
      }else{for(const text of lines((b.name||'FuelTek')+' · OT #'+str(order.ot||'BORRADOR'),usable,10,bold)){draw(text,margin,y,10,bold,navy);y+=14;}y+=6;page.drawLine({start:{x:margin,y:height-y},end:{x:width-margin,y:height-y},color:lineColor,thickness:1});y+=15;}
    }
    const ensure=space=>{if(y+space>height-48)newPage();};
    function paragraph(value,{size=10,font=regular,color=ink,x=margin,maxWidth=usable,gap=13}={}){
      for(const text of lines(value,maxWidth,size,font)){ensure(gap);if(text)draw(text,x,y,size,font,color);y+=gap;}
    }
    function heading(title){ensure(34);y+=3;draw(title,margin,y,10,bold,navy);y+=14;page.drawLine({start:{x:margin,y:height-y},end:{x:width-margin,y:height-y},color:lineColor,thickness:.6});y+=5;}
    const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'Por definir';
    const pair=(label,value)=>label+': '+str(value||'-');
    const number=value=>Number(str(value||0).replace(/[^0-9-]/g,''))||0;
    const money=value=>'$ '+Math.max(0,value).toLocaleString('es-CL');
    newPage(true);
    const colWidth=(usable-18)/2,left=[pair('Nombre',order.clienteNombre),pair('Teléfono',order.clienteTelefono),pair('Correo',order.clienteEmail),pair('Recepción',date(order.fechaRecibida)),pair('Entrega estimada',date(order.fechaEntrega))],right=[pair('Tipo',order.tipoEquipo),pair('Marca / modelo',[order.marca,order.modelo].filter(Boolean).join(' ')),pair('N° de serie',order.serie),pair('Año',order.anio),pair('Técnico',order.tecnico)];
    const leftLines=left.flatMap(text=>lines(text,colWidth-20,9)),rightLines=right.flatMap(text=>lines(text,colWidth-20,9)),cardHeight=32+Math.max(leftLines.length,rightLines.length)*12;ensure(cardHeight);
    if(cardHeight>240){heading('01 · Cliente');for(const text of left)paragraph(text,{size:9,gap:13});heading('02 · Equipo');for(const text of right)paragraph(text,{size:9,gap:13});}else{
    for(const [x,title,content]of [[margin,'01 · Cliente',leftLines],[margin+colWidth+18,'02 · Equipo',rightLines]]){page.drawRectangle({x,y:height-y-cardHeight,width:colWidth,height:cardHeight,color:pale,borderColor:lineColor,borderWidth:.6});draw(title,x+10,y+8,10,bold,navy);content.forEach((text,index)=>draw(text,x+10,y+26+index*12,9));}y+=cardHeight+10;
    }
    heading('03 · Recepción y revisión');
    paragraph('Estado: '+(order.estadoServicio||'Recibida'),{size:9,color:muted});
    const d=order.revisionDetalle, sections=d?[['Accesorios recibidos',d.accessories],['Condiciones y hallazgos verificados',d.conditions],['Otros elementos registrados',d.other]].filter(([,values])=>values?.length):[['Revisión y accesorios registrados',order.accesorios||[]]];
    for(const [title,values]of sections){ensure(40);paragraph(title,{size:9,font:bold,gap:13});paragraph(values?.length?values.join(' · '):'Sin elementos marcados.',{size:9,gap:13});y+=3;}
    paragraph('Los elementos sin marcar no constituyen un diagnóstico. Los hallazgos internos corresponden a la revisión realizada.',{size:8,color:muted,gap:11});
    heading('04 · Diagnóstico inicial');paragraph(order.diagnostico||'Pendiente de diagnóstico.');
    heading('05 · Trabajo realizado / notas del técnico');paragraph(order.trabajo||'Pendiente de realizar. No se han registrado trabajos.');
    ensure(100);heading('06 · Resumen de pago');
    const total=number(order.valorTrabajoNum??order.valorTrabajo),paid=order.estadoPago==='Pagado'?total:number(order.montoAbonadoNum??order.montoAbonado);
    paragraph((order.estadoPago||'Pendiente')+' · Valores en pesos chilenos (CLP)',{size:9,color:muted});
    for(const [label,value]of [['Valor del trabajo',total],['Pagado / abonado',paid],['Saldo pendiente',Math.max(0,total-paid)]]){draw(label,margin,y,10,label==='Saldo pendiente'?bold:regular,navy);const text=money(value);draw(text,width-margin-bold.widthOfTextAtSize(text,11),y,11,bold,navy);y+=18;}
    const signatureHeight=58+Math.max(lines(order.firmaTaller||'',colWidth,9).length,lines(order.firmaCliente||'',colWidth,9).length)*12;ensure(signatureHeight+12);y+=12;
    const sigStart=y;page.drawImage(stamp,{x:margin+(colWidth-110)/2,y:height-(sigStart-40)-110,width:110,height:110});
    for(const [x,text,label]of [[margin,order.firmaTaller,'Timbre / responsable del taller'],[margin+colWidth+18,order.firmaCliente,'Firma / recepción del cliente']]){const sigLines=lines(text||'',colWidth,9);sigLines.forEach((value,index)=>draw(value,x,sigStart+32+index*12,9));const ruleTop=sigStart+signatureHeight-27;page.drawLine({start:{x,y:height-ruleTop},end:{x:x+colWidth,y:height-ruleTop},color:muted,thickness:.6});draw(label,x,ruleTop+6,8,bold,muted);}y=sigStart+signatureHeight;
    if(snapshot.receiptNote){y+=5;paragraph(snapshot.receiptNote,{size:8,color:muted,gap:11});}
    const policy=window.fueltekReceipt.retire,policyLines=lines(policy,usable-24,8),policyHeight=33+policyLines.length*11;ensure(policyHeight+12);y+=10;
    page.drawRectangle({x:margin,y:height-y-policyHeight,width:usable,height:policyHeight,color:pale});page.drawRectangle({x:margin,y:height-y-policyHeight,width:3,height:policyHeight,color:orange});draw('Condiciones de retiro del equipo',margin+12,y+9,9,bold,navy);policyLines.forEach((text,index)=>draw(text,margin+12,y+27+index*11,8,regular,muted));y+=policyHeight;
    const pages=pdf.getPages();for(let index=0;index<pages.length;index++){page=pages[index];page.drawLine({start:{x:margin,y:38},end:{x:width-margin,y:38},color:lineColor,thickness:.6});page.drawText('OT #'+str(order.ot||'BORRADOR')+' · No reemplaza una boleta o factura.',{x:margin,y:25,size:7,font:regular,color:muted});const text=`Página ${index+1} de ${pages.length}`;page.drawText(text,{x:width-margin-regular.widthOfTextAtSize(text,7),y:25,size:7,font:regular,color:muted});}
    pdf.setTitle('FuelTek - Orden de trabajo '+str(order.ot||'Borrador'));pdf.setAuthor(b.name||'FuelTek');pdf.setSubject('Comprobante de recepción y servicio');return pdf.save();
  }
  async function download(order,settings) {
    let logo;try{const response=await fetch('logo-fueltek.png');if(response.ok)logo=new Uint8Array(await response.arrayBuffer());}catch(_){}
    const bytes=await create(order,settings,logo),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download='FuelTek-OT-'+String(order.ot||'Borrador').replace(/[^0-9a-z-]/gi,'')+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  window.fueltekPdf={create,download};
})();
