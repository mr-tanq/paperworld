/* James's product templates: pure layout (no IO). Each template turns a small,
 * validated spec into pages of drawing operations (top-left origin, points).
 * The same operations become the sold PDF and the public SVG preview, so the
 * preview always shows the real product. Fonts: built-in Helvetica (English). */
const A4={w:595.28,h:841.89};
const PALETTE=Object.freeze({terracotta:'#c96f2d',sage:'#6f8f6a',navy:'#2f4a6b',plum:'#7a4a6e',ochre:'#c9962d',slate:'#55606b'});
const INK='#2b2118',SOFT='#8a7a68',LINE='#d9cbb6',TINT='#f6efe3';
const TEMPLATES=Object.freeze(['weekly_planner','habit_tracker','budget_planner']);
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const ASCII=/^[\x20-\x7E]*$/;
// Etsy asks sellers to say in the description when AI helped make an item.
const AI_NOTE='Made by Digital Business Studio with the help of AI tools; every product is approved by the shop owner before release.';
function txt(s,max){
 const t=String(s??'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
 if(!t||t.length>max||!ASCII.test(t))throw Error('invalid_text');
 return t;
}
function list(a,min,max,len){
 if(!Array.isArray(a)||a.length<min||a.length>max)throw Error('invalid_list');
 return a.map(x=>txt(x,len));
}
// The ONLY shape of a product the model may propose; everything else is fixed here.
function validateSpec(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))throw Error('invalid_spec');
 if(!TEMPLATES.includes(spec.template))throw Error('unknown_template');
 if(!Object.hasOwn(PALETTE,spec.accent))throw Error('unknown_accent');
 const slug=String(spec.slug||'');if(!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug))throw Error('invalid_slug');
 const price=Number(spec.price_eur);
 if(!Number.isFinite(price)||price<1||price>29||Math.round(price*100)!==price*100)throw Error('invalid_price');
 const p=spec.params||{};
 const out={template:spec.template,accent:spec.accent,slug,price_eur:price,
  title:txt(spec.title,60),subtitle:txt(spec.subtitle||'Printable - A4',80),
  summary:String(spec.summary||'').trim().slice(0,200),
  description:(String(spec.description||'').trim().slice(0,800-AI_NOTE.length-2)+'\n\n'+AI_NOTE).trim(),
  // Etsy listing: a searchable title (<=140) and up to 13 tags (<=20 chars each).
  etsy_title:spec.etsy_title?txt(spec.etsy_title,140):txt(spec.title,60),
  tags:Array.isArray(spec.tags)?[...new Set(spec.tags.map(t=>txt(String(t).toLowerCase(),20)))].slice(0,13):[]};
 if(!out.summary)throw Error('invalid_summary');
 if(spec.template==='weekly_planner')
  out.params={weeks:Math.max(1,Math.min(52,Math.round(Number(p.weeks)||12))),focus:list(p.focus||['Top priorities','To do','Notes'],3,3,28)};
 if(spec.template==='habit_tracker')
  out.params={habits:list(p.habits,3,12,26),months:Math.max(1,Math.min(12,Math.round(Number(p.months)||12)))};
 if(spec.template==='budget_planner')
  out.params={income:list(p.income||['Salary','Side income','Other'],1,6,24),expenses:list(p.expenses,4,14,24),months:Math.max(1,Math.min(12,Math.round(Number(p.months)||12)))};
 return out;
}
function header(ops,s,title,sub){
 const c=PALETTE[s.accent];
 ops.push({t:'rect',x:0,y:0,w:A4.w,h:84,fill:c});
 ops.push({t:'text',x:40,y:44,size:22,text:title,color:'#ffffff',bold:true});
 ops.push({t:'text',x:40,y:66,size:11,text:sub,color:'#ffffff'});
}
function footer(ops,s,n){
 ops.push({t:'line',x1:40,y1:A4.h-36,x2:A4.w-40,y2:A4.h-36,color:LINE,width:0.8});
 ops.push({t:'text',x:40,y:A4.h-22,size:8,text:s.title+' - Digital Business Studio - personal use only',color:SOFT});
 ops.push({t:'text',x:A4.w-40,y:A4.h-22,size:8,text:String(n),color:SOFT,align:'right'});
}
function box(ops,x,y,w,h,label,c,lines=0){
 ops.push({t:'rect',x,y,w,h,stroke:LINE,width:1});
 ops.push({t:'rect',x,y,w,h:20,fill:TINT});
 ops.push({t:'text',x:x+8,y:y+14,size:9.5,text:label,color:c,bold:true});
 for(let i=1;i<=lines;i++){const ly=y+20+i*((h-20)/(lines+1));ops.push({t:'line',x1:x+8,y1:ly,x2:x+w-8,y2:ly,color:LINE,width:0.5})}
}
function weekly(s){
 const c=PALETTE[s.accent],pages=[];
 for(let wk=1;wk<=s.params.weeks;wk++){
  const ops=[];header(ops,s,s.title,'Week '+wk+'   ______ to ______');
  const gx=40,gy=104,gw=A4.w-80,colW=(gw-12)/2,rowH=(A4.h-gy-54-30)/4;
  DAYS.forEach((d,i)=>{const col=i%2,row=Math.floor(i/2);box(ops,gx+col*(colW+12),gy+row*(rowH+10),colW,rowH,d,c,4)});
  // eighth cell: the three focus lists
  const fx=gx+colW+12,fy=gy+3*(rowH+10),fh=rowH,third=(fh-0)/3;
  s.params.focus.forEach((f,i)=>box(ops,fx,fy+i*third,colW,third-4,f,c,1));
  footer(ops,s,wk);pages.push(ops);
 }
 return pages;
}
function habits(s){
 const c=PALETTE[s.accent],pages=[];
 for(let m=0;m<s.params.months;m++){
  const ops=[];header(ops,s,s.title,MONTHS[m]+'   Year ______');
  const x0=40,y0=110,nameW=150,cell=(A4.w-80-nameW)/31,rowH=Math.min(44,(A4.h-200)/(s.params.habits.length+1));
  ops.push({t:'rect',x:x0,y:y0,w:A4.w-80,h:rowH,fill:TINT});
  ops.push({t:'text',x:x0+8,y:y0+rowH/2+3,size:9.5,text:'Habit',color:c,bold:true});
  for(let d=1;d<=31;d++)ops.push({t:'text',x:x0+nameW+(d-0.5)*cell,y:y0+rowH/2+3,size:7,text:String(d),color:SOFT,align:'center'});
  s.params.habits.forEach((h,i)=>{
   const y=y0+(i+1)*rowH;
   ops.push({t:'text',x:x0+8,y:y+rowH/2+3,size:10,text:h,color:INK});
   for(let d=0;d<31;d++)ops.push({t:'rect',x:x0+nameW+d*cell+1.5,y:y+rowH/2-cell/2+1.5,w:cell-3,h:cell-3,stroke:LINE,width:0.7});
   ops.push({t:'line',x1:x0,y1:y+rowH,x2:A4.w-40,y2:y+rowH,color:LINE,width:0.5});
  });
  box(ops,x0,A4.h-150,A4.w-80,96,'Reflection',c,3);
  footer(ops,s,m+1);pages.push(ops);
 }
 return pages;
}
function budget(s){
 const c=PALETTE[s.accent],pages=[];
 for(let m=0;m<s.params.months;m++){
  const ops=[];header(ops,s,s.title,MONTHS[m]+'   Year ______');
  const x0=40,w=A4.w-80,rowH=22;let y=106;
  const table=(label,items)=>{
   ops.push({t:'rect',x:x0,y,w,h:rowH,fill:TINT});
   ops.push({t:'text',x:x0+8,y:y+15,size:10,text:label,color:c,bold:true});
   [['Planned',w-170],['Actual',w-85]].forEach(([h,ox])=>ops.push({t:'text',x:x0+ox,y:y+15,size:9,text:h,color:SOFT}));
   y+=rowH;
   for(const it of items){ops.push({t:'text',x:x0+8,y:y+15,size:10,text:it,color:INK});
    ops.push({t:'line',x1:x0+w-175,y1:y+18,x2:x0+w-95,y2:y+18,color:LINE,width:0.6});
    ops.push({t:'line',x1:x0+w-90,y1:y+18,x2:x0+w-10,y2:y+18,color:LINE,width:0.6});y+=rowH}
   ops.push({t:'text',x:x0+8,y:y+15,size:10,text:'Total',color:INK,bold:true});
   ops.push({t:'line',x1:x0,y1:y,x2:x0+w,y2:y,color:c,width:1});y+=rowH+12;
  };
  table('Income',s.params.income);table('Expenses',s.params.expenses);
  // Summary + goal + notes fill the rest of the page.
  box(ops,x0,y,w,74,'Summary',c,0);
  [['Total income',0],['Total expenses',1],['Left over',2]].forEach(([l,i])=>{const bx=x0+12+i*(w-24)/3;
   ops.push({t:'text',x:bx,y:y+42,size:9,text:l,color:SOFT});ops.push({t:'line',x1:bx,y1:y+62,x2:bx+(w-24)/3-14,y2:y+62,color:LINE,width:0.7})});
  y+=86;const rest=Math.max(80,A4.h-54-y);
  box(ops,x0,y,w/2-6,rest,'Savings goal',c,Math.max(2,Math.floor(rest/26)-1));
  box(ops,x0+w/2+6,y,w/2-6,rest,'Notes',c,Math.max(2,Math.floor(rest/26)-1));
  footer(ops,s,m+1);pages.push(ops);
 }
 return pages;
}
function pagesFor(spec){
 const s=validateSpec(spec);
 return {spec:s,pages:s.template==='weekly_planner'?weekly(s):s.template==='habit_tracker'?habits(s):budget(s),size:A4};
}
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Public preview: page 1 only, with a diagonal PREVIEW mark.
function previewSvg(spec){
 const {pages,size}=pagesFor(spec);const parts=[];
 for(const o of pages[0]){
  if(o.t==='rect')parts.push('<rect x="'+o.x.toFixed(1)+'" y="'+o.y.toFixed(1)+'" width="'+o.w.toFixed(1)+'" height="'+o.h.toFixed(1)+'" fill="'+(o.fill||'none')+'"'+(o.stroke?' stroke="'+o.stroke+'" stroke-width="'+o.width+'"':'')+'/>');
  else if(o.t==='line')parts.push('<line x1="'+o.x1.toFixed(1)+'" y1="'+o.y1.toFixed(1)+'" x2="'+o.x2.toFixed(1)+'" y2="'+o.y2.toFixed(1)+'" stroke="'+o.color+'" stroke-width="'+o.width+'"/>');
  else parts.push('<text x="'+o.x.toFixed(1)+'" y="'+o.y.toFixed(1)+'" font-family="Helvetica,Arial,sans-serif" font-size="'+o.size+'"'+(o.bold?' font-weight="700"':'')+' fill="'+o.color+'"'+(o.align==='right'?' text-anchor="end"':o.align==='center'?' text-anchor="middle"':'')+'>'+esc(o.text)+'</text>');
 }
 parts.push('<text x="'+(size.w/2)+'" y="'+(size.h/2)+'" font-family="Helvetica,Arial,sans-serif" font-size="64" font-weight="700" fill="#000" fill-opacity="0.07" text-anchor="middle" transform="rotate(-30 '+(size.w/2)+' '+(size.h/2)+')">PREVIEW</text>');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size.w+' '+size.h+'" width="'+Math.round(size.w)+'" height="'+Math.round(size.h)+'"><rect width="100%" height="100%" fill="#ffffff"/>'+parts.join('')+'</svg>';
}
// The sold file, drawn with an injected pdf-lib (npm:pdf-lib in Deno).
async function renderPdf(spec,PDFLib){
 const {pages,size,spec:s}=pagesFor(spec);
 const doc=await PDFLib.PDFDocument.create();
 doc.setTitle(s.title);doc.setAuthor('Digital Business Studio');doc.setCreator('Digital Business Studio');
 const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica),bold=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
 const col=h=>{const n=parseInt(h.slice(1),16);return PDFLib.rgb((n>>16&255)/255,(n>>8&255)/255,(n&255)/255)};
 for(const ops of pages){
  const pg=doc.addPage([size.w,size.h]);
  for(const o of ops){
   if(o.t==='rect')pg.drawRectangle({x:o.x,y:size.h-o.y-o.h,width:o.w,height:o.h,...(o.fill?{color:col(o.fill)}:{}),
    ...(o.stroke?{borderColor:col(o.stroke),borderWidth:o.width}:{})});
   else if(o.t==='line')pg.drawLine({start:{x:o.x1,y:size.h-o.y1},end:{x:o.x2,y:size.h-o.y2},thickness:o.width,color:col(o.color)});
   else{const f=o.bold?bold:font,w=f.widthOfTextAtSize(o.text,o.size);
    const x=o.align==='right'?o.x-w:o.align==='center'?o.x-w/2:o.x;
    pg.drawText(o.text,{x,y:size.h-o.y,size:o.size,font:f,color:col(o.color)})}
  }
 }
 return doc.save();
}
export {validateSpec,pagesFor,previewSvg,renderPdf,TEMPLATES,PALETTE,AI_NOTE};
