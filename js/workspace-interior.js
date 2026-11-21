/* PAPERWORLD Director workspaces — the inside of each Director's house.
 * The Director sits at the desk while they have REAL work (an active mission
 * from the resident feed); you sit in the guest chair. Without work the desk
 * is empty: they are out strolling in the village. Uses the owner's day/night
 * art; visual only: no AI, no work started. While the Director is at work
 * the owner's painted scene (Director at the desk, you in the guest chair) is
 * shown, with the bubble above their head.
 */
(function(root,factory){'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldWorkspaceInterior=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
const ART=Object.freeze({w:1672,h:941});
// Desk chair and guest chair as fractions of each room's art (1672x941):
// where a seated head would be.
const ROOMS=Object.freeze({
 'listening-director':Object.freeze({key:'listening',sceneDesk:[.463,.35],sceneGuest:[.733,.425],title:'Listening Mirror Workshop',desk:[.47,.41],guest:[.69,.58]}),
 'pokemon-director':Object.freeze({key:'pokemon',sceneDesk:[.446,.457],sceneGuest:[.733,.51],title:'Pokémon Hub',desk:[.425,.49],guest:[.645,.68]}),
 'studio-director':Object.freeze({key:'studio',sceneDesk:[.463,.37],sceneGuest:[.727,.48],title:'The Lost Wanderer Studio',desk:[.478,.41],guest:[.69,.58]}),
 'wellbeing-director':Object.freeze({key:'wellbeing',sceneDesk:[.487,.38],sceneGuest:[.733,.48],title:'Wellbeing & Training Center',desk:[.487,.41],guest:[.69,.56]})
});
const PORTRAIT={'listening-director':'luna','pokemon-director':'joey','studio-director':'crow','wellbeing-director':'dave'};
const WHO={'listening-director':'Η Luna','pokemon-director':'Ο Joey','studio-director':'Ο Crow','wellbeing-director':'Ο Dave'};
const artUrl=(id,time)=>ROOMS[id]?'./assets/interiors/'+ROOMS[id].key+'-'+time+'.webp':null;
const sceneUrl=(id,time)=>ROOMS[id]?'./assets/interiors/'+ROOMS[id].key+'-meeting-'+time+'.webp':null;
// Same "cover" fit as the Town Hall: fill the stage but keep both chairs visible.
function coverRect(w,h,aw=ART.w,ah=ART.h){
 const s=Math.min(Math.max(w/aw,h/ah),w/(.8*aw)),dw=aw*s,dh=ah*s;
 return {x:(w-dw)/2,y:(h-dh)/2,w:dw,h:dh};
}
// What the room says: only real work is described; private topics stay private
// (resident-status already masks them).
function roomLine(status,name){
 if(status?.tone==='active')return status.text||'Δουλεύει';
 if(status?.tone==='attention')return 'Χρειάζεται εσένα — πάτα «Μίλα»';
 return (name||'Ο Director')+' δεν έχει δουλειά τώρα· κάνει βόλτα στο χωριό.';
}
function create(host,{statuses=()=>({}),isInside=()=>false,onTalk=null,onLeave=null,profiles=null}={}){
 if(!host)throw Error('host required');
 const doc=host.ownerDocument||root.document;
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const wrap=el('section','th-room ws-room');wrap.hidden=true;
 const stage=el('div','th-stage');const canvas=el('canvas','th-canvas');stage.append(canvas);
 const seats=el('div','th-seats');stage.append(seats);
 const note=el('p','ws-note');
 const bar=el('div','th-bar');const title=el('strong','');
 const talk=el('button','th-btn th-primary','Μίλα');talk.type='button';
 const leave=el('button','th-btn','Βγες έξω');leave.type='button';
 bar.append(title,talk,leave);wrap.append(stage,note,bar);host.append(wrap);
 const images=new Map();
 const isNight=()=>{try{return (root.PaperworldVillageAmbience?.darkness?.()??0)>=.5}catch(_){return false}};
 let current=null,rect={x:0,y:0,w:1,h:1},painted=false,inside=false;
 function art(){
  const time=isNight()?'night':'day';
  if(inside){const scene=load(sceneUrl(current,time));if(scene){painted=true;return scene}}
  painted=false;return load(artUrl(current,time));
 }
 function load(url){
  if(!url)return null;
  let img=images.get(url);
  if(!img&&root.Image){img=new root.Image();img.decoding='async';
   img.onload=()=>{if(!wrap.hidden){draw();place()}};img.src=url;images.set(url,img)}
  return img?.complete&&img.naturalWidth?img:null;
 }
 function draw(){
  const r=wrap.getBoundingClientRect();
  const portrait=r.width>0&&r.width/Math.max(1,r.height-60)<.9;
  wrap.classList.toggle('th-portrait',portrait);
  stage.style.height=portrait?Math.round(r.width/(.8*ART.w)*ART.h)+'px':'';
  const s=stage.getBoundingClientRect(),w=Math.max(320,s.width),h=Math.max(200,s.height);
  const dpr=Math.min(2,root.devicePixelRatio||1);canvas.width=w*dpr;canvas.height=h*dpr;
  const ctx=canvas.getContext?.('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);
  const img=art();rect=coverRect(w,h);wrap.classList.toggle('th-scene',painted);
  ctx.fillStyle='#2a1a10';ctx.fillRect(0,0,w,h);
  if(img)ctx.drawImage(img,rect.x,rect.y,rect.w,rect.h);
 }
 function place(){
  for(const seat of seats.children){const room=ROOMS[current]||{};
   const [fx,fy]=(painted?room[seat.dataset.seat==='desk'?'sceneDesk':'sceneGuest']:room[seat.dataset.seat])||[.5,.5];
   seat.style.left=(rect.x+fx*rect.w)+'px';seat.style.top=(rect.y+fy*rect.h)+'px'}
 }
 function render(){
  if(!current)return;
  const room=ROOMS[current],name=profiles?.get?.(current)?.name||current;
  const status=statuses()?.[current];inside=isInside(current)===true;
  title.textContent=room.title;talk.textContent='Μίλα με '+name;
  seats.replaceChildren();
  if(inside){
   const seat=el('button','th-seat');seat.type='button';seat.dataset.seat='desk';
   const face=el('span','th-face'),img=el('img');img.alt='';img.src='./assets/portraits/'+PORTRAIT[current]+'.webp';
   img.onerror=()=>{img.remove();profiles?.paintAvatar?.(face,current)};face.append(img);
   seat.append(face,el('span','th-name',name),el('span','th-say',roomLine(status,name)));
   seat.setAttribute('aria-label','Μίλα με '+name+'. '+roomLine(status,name));
   seat.addEventListener('click',()=>onTalk?.(current));seats.append(seat);
  }
  // "Εσύ" only labels the owner who is painted in the scene; an empty room
  // shows no placeholder star.
  if(inside){const you=el('span','th-seat');you.dataset.seat='guest';
   you.append(el('span','th-face'),el('span','th-name','Εσύ'));seats.append(you)}
  note.textContent=inside?roomLine(status,name):roomLine(null,WHO[current]||name);
  wrap.setAttribute('aria-label',room.title+' · '+note.textContent);
  draw();place();
 }
 talk.addEventListener('click',()=>{const id=current;close();onTalk?.(id)});
 leave.addEventListener('click',()=>{close();onLeave?.()});
 root.addEventListener?.('resize',()=>{if(!wrap.hidden){draw();place()}});
 function open(id){if(!ROOMS[id])return false;current=id;wrap.hidden=false;render();talk.focus?.();return true}
 function close(){wrap.hidden=true}
 return Object.freeze({open,close,render,isOpen:()=>!wrap.hidden,current:()=>wrap.hidden?null:current});
}
return Object.freeze({create,ROOMS,PORTRAIT,WHO,ART,artUrl,sceneUrl,coverRect,roomLine});
});
