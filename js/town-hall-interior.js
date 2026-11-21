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
// Where each person sits, as fractions of the owner's Town Hall art
// (1672x941): head-of-table armchairs left/right, two chairs behind the table,
// two in front. The face sits where a seated head would be.
const ART=Object.freeze({w:1672,h:941,day:'./assets/interiors/town-hall-day.webp',
 night:'./assets/interiors/town-hall-night.webp'});
const SEATS=Object.freeze({
 owner:[.197,.53],matt:[.795,.53],
 'listening-director':[.398,.455],'pokemon-director':[.601,.455],
 'studio-director':[.392,.655],'wellbeing-director':[.607,.655]
});
// "Cover" fit: the art fills the stage without stretching; returns the drawn rect.
function coverRect(w,h,aw=ART.w,ah=ART.h){
 // Fill the stage, but never crop the table: the six seats (12%-88% of the
 // art's width) always stay visible, e.g. on a tall phone screen.
 const s=Math.min(Math.max(w/aw,h/ah),w/(.8*aw)),dw=aw*s,dh=ah*s;
 return {x:(w-dw)/2,y:(h-dh)/2,w:dw,h:dh};
}
// The owner's meeting scene: everyone already painted around the table (you
// on the left, Luna and Joey behind, Matt on the right, Crow and Dave in
// front). Positions are where each head is; the empty room is the fallback.
const SCENE=Object.freeze({day:'./assets/interiors/town-hall-meeting-day.webp',
 night:'./assets/interiors/town-hall-meeting-night.webp'});
const PEOPLE=Object.freeze({
 owner:[.175,.47],matt:[.79,.45],
 'listening-director':[.398,.41],'pokemon-director':[.59,.40],
 'studio-director':[.383,.64],'wellbeing-director':[.643,.64]
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
 bar.append(title,agenda,done);
 // Tall screens: the room on top, and what everyone says as a clear list below.
 const lines=el('div','th-lines');
 wrap.append(stage,lines,bar);host.append(wrap);
 // Day or night art follows the village's evening light.
 const arts={},scenes={};
 for(const [store,src] of [[arts,ART],[scenes,SCENE]])for(const key of ['day','night']){
  const img=root.Image?new root.Image():null;if(!img)continue;
  img.decoding='async';img.onload=()=>{store[key]=img;if(!wrap.hidden){draw();place()}};img.src=src[key];
 }
 let painted=false;
 const isNight=()=>{try{return (root.PaperworldVillageAmbience?.darkness?.()??0)>=.5}catch(_){return false}};
 let rect={x:0,y:0,w:1,h:1};
 function layout(){
  const r=wrap.getBoundingClientRect();
  const portrait=r.width>0&&r.width/Math.max(1,r.height-60)<.9;
  wrap.classList.toggle('th-portrait',portrait);
  stage.style.height=portrait?Math.round(r.width/(.8*ART.w)*ART.h)+'px':'';
 }
 function draw(){
  layout();
  const r=stage.getBoundingClientRect();const w=Math.max(320,r.width),h=Math.max(200,r.height);
  const dpr=Math.min(2,root.devicePixelRatio||1);canvas.width=w*dpr;canvas.height=h*dpr;
  const ctx=canvas.getContext?.('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);
  const night=isNight();
  const scene=(night?scenes.night:scenes.day)||scenes.day||scenes.night;
  const art=scene||(night?arts.night:arts.day)||arts.day||arts.night;
  painted=!!scene;wrap.classList.toggle('th-scene',painted);
  rect=art?coverRect(w,h):{x:0,y:0,w,h};
  if(art)ctx.drawImage(art,rect.x,rect.y,rect.w,rect.h);else paintRoom(ctx,w,h);
 }
 // Seats follow the drawn art exactly, whatever the screen shape.
 function place(){
  for(const seat of seats.children){const [fx,fy]=(painted?PEOPLE:SEATS)[seat.dataset.id]||[.5,.5];
   seat.style.left=(rect.x+fx*rect.w)+'px';seat.style.top=(rect.y+fy*rect.h)+'px'}
 }
 function render(){
  seats.replaceChildren();
  const lines_=seatLines(statuses());
  for(const id of ORDER){
   const [fx,fy]=SEATS[id];
   const seat=el('button','th-seat');seat.type='button';seat.dataset.id=id;
   seat.style.left=(fx*100)+'%';seat.style.top=(fy*100)+'%';// refined by place()
   const face=el('span','th-face');
   if(id!=='owner')profiles?.paintAvatar?.(face,id);
   const name=el('span','th-name',id==='owner'?'Εσύ':(profiles?.get?.(id)?.name||id));
   seat.append(face,name);
   if(lines_[id]){const say=el('span','th-say',lines_[id]);seat.append(say)}
   if(id==='owner')seat.disabled=true;
   else seat.addEventListener('click',()=>onTalk?.(id));
   seat.setAttribute('aria-label',id==='owner'?'Η θέση σου':'Μίλα με '+name.textContent+'. '+(lines_[id]||''));
   seats.append(seat);
  }
  lines.replaceChildren();
  for(const id of ORDER.slice(1)){
   const row=el('button','th-line');row.type='button';
   const face=el('span','th-line-face');profiles?.paintAvatar?.(face,id);
   const text=el('span','th-line-text');
   text.append(el('strong','',profiles?.get?.(id)?.name||id),el('span','',lines_[id]||''));
   row.append(face,text);row.addEventListener('click',()=>onTalk?.(id));lines.append(row);
  }
  place();
 }
 agenda.addEventListener('click',()=>onAgenda?.());
 done.addEventListener('click',()=>{close();onEnd?.()});
 root.addEventListener?.('resize',()=>{if(!wrap.hidden){draw();place()}});
 function open(){wrap.hidden=false;render();draw();place();done.focus?.()}
 function close(){wrap.hidden=true}
 return Object.freeze({open,close,render,isOpen:()=>!wrap.hidden});
}
return Object.freeze({create,SEATS,ART,SCENE,PEOPLE,coverRect,seatLines,ORDER});
});
