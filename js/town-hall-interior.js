/* PAPERWORLD Town Hall interior — the meeting room the team walks into.
 * Owner at one head of the long table, Matt at the other, the Directors
 * around it, each saying what they are doing from REAL missions only.
 * Uses assets/interiors/town-hall.png when present (owner-provided art) and
 * otherwise paints a warm room itself. Visual only: no AI, no work started.
 */
(function(root,factory){'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldTownHallInterior=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
// Seat centres as fractions of the room image (tuned to the owner's art later).
const SEATS=Object.freeze({
 owner:[.13,.6],matt:[.87,.6],
 'listening-director':[.38,.4],'pokemon-director':[.62,.4],
 'studio-director':[.38,.8],'wellbeing-director':[.62,.8]
});
const ORDER=['owner','matt','listening-director','pokemon-director','studio-director','wellbeing-director'];
const IDLE='Όλα ήσυχα από μένα.';
function seatLines(statuses){
 const out={owner:null,matt:'Καλώς ήρθες! Ας δούμε τι κάνει η ομάδα.'};
 for(const id of ORDER.slice(2))out[id]=statuses?.[id]?.text||IDLE;
 return out;
}
function paintRoom(ctx,w,h){
 // Back wall, wainscot, floor planks, beams, windows, clock, lamps, table.
 const g=ctx.createLinearGradient(0,0,0,h*.5);g.addColorStop(0,'#5b3b26');g.addColorStop(1,'#7a5236');
 ctx.fillStyle=g;ctx.fillRect(0,0,w,h*.5);
 ctx.fillStyle='#4a2f1e';ctx.fillRect(0,h*.44,w,h*.06);
 for(let i=0;i<w;i+=w/9){ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(i,0,6,h*.44)}
 const fl=ctx.createLinearGradient(0,h*.5,0,h);fl.addColorStop(0,'#8a5d3b');fl.addColorStop(1,'#6b4429');
 ctx.fillStyle=fl;ctx.fillRect(0,h*.5,w,h*.5);
 ctx.strokeStyle='rgba(40,22,10,.35)';ctx.lineWidth=2;
 for(let y=h*.55;y<h;y+=h*.07){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 // Windows with warm evening glow.
 for(const x of [.18,.5,.82]){
  const wx=w*x-w*.07,wy=h*.08,ww=w*.14,wh=h*.26;
  ctx.fillStyle='#2b1a10';ctx.fillRect(wx-6,wy-6,ww+12,wh+12);
  const sky=ctx.createLinearGradient(0,wy,0,wy+wh);sky.addColorStop(0,'#ffd99a');sky.addColorStop(1,'#f2a65a');
  ctx.fillStyle=sky;ctx.fillRect(wx,wy,ww,wh);
  ctx.fillStyle='#2b1a10';ctx.fillRect(wx+ww/2-3,wy,6,wh);ctx.fillRect(wx,wy+wh/2-3,ww,6);
 }
 // Clock and a green banner with a little crown.
 ctx.fillStyle='#f3e6c8';ctx.beginPath();ctx.arc(w*.34,h*.2,h*.06,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#3a2414';ctx.lineWidth=4;ctx.stroke();
 ctx.beginPath();ctx.moveTo(w*.34,h*.2);ctx.lineTo(w*.34,h*.16);ctx.moveTo(w*.34,h*.2);ctx.lineTo(w*.36,h*.21);ctx.stroke();
 ctx.fillStyle='#3f7a4f';ctx.fillRect(w*.64,h*.09,w*.06,h*.22);
 ctx.fillStyle='#f2c14e';ctx.font='bold '+Math.round(h*.05)+'px serif';ctx.textAlign='center';ctx.fillText('♛',w*.67,h*.2);
 // Hanging lamps.
 for(const x of [.3,.7]){
  ctx.strokeStyle='#2b1a10';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*x,0);ctx.lineTo(w*x,h*.12);ctx.stroke();
  const lg=ctx.createRadialGradient(w*x,h*.15,2,w*x,h*.15,h*.22);
  lg.addColorStop(0,'rgba(255,214,140,.95)');lg.addColorStop(1,'rgba(255,214,140,0)');
  ctx.fillStyle=lg;ctx.beginPath();ctx.arc(w*x,h*.15,h*.22,0,Math.PI*2);ctx.fill();
 }
 // Long table with a runner.
 const tx=w*.2,ty=h*.5,tw=w*.6,th=h*.2;
 ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(w*.5,ty+th+h*.03,tw*.52,h*.04,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#9a6a40';ctx.fillRect(tx,ty,tw,th);
 ctx.fillStyle='#b98352';ctx.fillRect(tx,ty,tw,th*.18);
 ctx.fillStyle='#3f7a4f';ctx.fillRect(tx+tw*.1,ty+th*.38,tw*.8,th*.24);
 ctx.fillStyle='#5a3a22';ctx.fillRect(tx+8,ty+th,10,h*.08);ctx.fillRect(tx+tw-18,ty+th,10,h*.08);
}
function create(host,{statuses=()=>({}),onTalk=null,onEnd=null,onAgenda=null,profiles=null}={}){
 if(!host)throw Error('host required');
 const doc=host.ownerDocument||root.document;
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const wrap=el('section','th-room');wrap.hidden=true;wrap.setAttribute('aria-label','Αίθουσα συνεδριάσεων του Town Hall');
 const stage=el('div','th-stage');const canvas=el('canvas','th-canvas');stage.append(canvas);
 const seats=el('div','th-seats');stage.append(seats);
 const bar=el('div','th-bar');
 const title=el('strong','','Town Hall · συνάντηση της ομάδας');
 const agenda=el('button','th-btn','Ατζέντα');agenda.type='button';
 const done=el('button','th-btn th-primary','Τέλος συνάντησης');done.type='button';
 bar.append(title,agenda,done);wrap.append(stage,bar);host.append(wrap);
 const art=new (root.Image||function(){})();let artReady=false;
 if(art&&'onload' in art){art.onload=()=>{artReady=true;draw()};art.src='./assets/interiors/town-hall.png'}
 function draw(){
  const r=stage.getBoundingClientRect();const w=Math.max(320,r.width),h=Math.max(200,r.height);
  const dpr=Math.min(2,root.devicePixelRatio||1);canvas.width=w*dpr;canvas.height=h*dpr;
  const ctx=canvas.getContext?.('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);
  if(artReady)ctx.drawImage(art,0,0,w,h);else paintRoom(ctx,w,h);
 }
 function render(){
  seats.replaceChildren();
  const lines=seatLines(statuses());
  for(const id of ORDER){
   const [fx,fy]=SEATS[id];
   const seat=el('button','th-seat');seat.type='button';seat.dataset.id=id;
   seat.style.left=(fx*100)+'%';seat.style.top=(fy*100)+'%';
   const face=el('span','th-face');
   if(id==='owner')face.textContent='★';else profiles?.paintAvatar?.(face,id);
   const name=el('span','th-name',id==='owner'?'Εσύ':(profiles?.get?.(id)?.name||id));
   seat.append(face,name);
   if(lines[id]){const say=el('span','th-say',lines[id]);seat.append(say)}
   if(id==='owner')seat.disabled=true;
   else seat.addEventListener('click',()=>onTalk?.(id));
   seat.setAttribute('aria-label',id==='owner'?'Η θέση σου':'Μίλα με '+name.textContent+'. '+(lines[id]||''));
   seats.append(seat);
  }
 }
 agenda.addEventListener('click',()=>onAgenda?.());
 done.addEventListener('click',()=>{close();onEnd?.()});
 root.addEventListener?.('resize',()=>{if(!wrap.hidden)draw()});
 function open(){wrap.hidden=false;render();draw();done.focus?.()}
 function close(){wrap.hidden=true}
 return Object.freeze({open,close,render,isOpen:()=>!wrap.hidden});
}
return Object.freeze({create,SEATS,seatLines,ORDER});
});
