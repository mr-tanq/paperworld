/* PAPERWORLD visual-only identities; online status is never inferred. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperworldProfiles=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
const roster=Object.freeze({
 matt:{name:'Matt',role:'Chief of Staff',project:'Paperworld',kind:'director',portrait:'./assets/portraits/matt.webp',sheet:'characters-hq-v2.png',rect:[64,352,64,88]},
 'listening-director':{name:'Luna',role:'Director',project:'Listening Mirror',kind:'director',portrait:'./assets/portraits/luna.webp',sheet:'characters-hq-v2.png',rect:[64,704,64,88]},
 'pokemon-director':{name:'Joey',role:'Director',project:'Pokémon: Echoes',kind:'director',portrait:'./assets/portraits/joey.webp',sheet:'pokemon-director-walk-hq-v2.png',rect:[64,0,64,88]},
 'studio-director':{name:'Crow',role:'Director',project:'The Lost Wanderer',kind:'director',portrait:'./assets/portraits/crow.webp',sheet:'studio-director-hooded-v2.png',rect:[96,0,96,132]},
 'wellbeing-director':{name:'Dave',role:'Director',project:'Wellbeing & Training',kind:'director',portrait:'./assets/portraits/dave.webp',sheet:'wellbeing-director-walk-hq-v2.png',rect:[64,0,64,88]},
 // James: the village trader. His own project: researching, making and selling digital products.
 'shop-director':{name:'James',role:'Director',project:'Digital Shop',kind:'director',portrait:'./assets/portraits/james.webp?v=v3',sheet:'shop-director-walk-v3.png',rect:[0,0,64,88]},
 // Mike: watches the owner's stocks and ETFs. Read-only, private, never advises.
 'markets-director':{name:'Mike',role:'Director',project:'Markets',kind:'director',portrait:'./assets/portraits/mike.webp?v=v3',sheet:'markets-director-walk-v3.png',rect:[0,0,64,88]},
 'listening-developer':{name:'Listening Mirror Developer',role:'Worker',project:'Listening Mirror',kind:'worker'},
 'pokemon-developer':{name:'Pokémon Developer',role:'Worker',project:'Pokémon: Echoes',kind:'worker'}
});
function get(id){return Object.prototype.hasOwnProperty.call(roster,id)?roster[id]:null}
function entries(kind){return Object.keys(roster).filter(id=>roster[id].kind===kind).map(id=>({id,...roster[id]}))}
function paintAvatar(host,id){
 const p=get(id);if(!host)return;host.dataset.profileId=id;host.replaceChildren();
 host.classList.add('agent-profile-avatar');
 const fallback=document.createElement('span');fallback.textContent=(p?.name||'?')[0].toUpperCase();host.append(fallback);
 // Prefer the new owner-reviewed bust portrait; keep the original character sheet as safe fallback.
 if(p?.portrait){
  const portrait=new Image();portrait.decoding='async';
  portrait.onload=()=>{
   if(host.dataset.profileId!==id||!host.isConnected)return;
   const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
   const ctx=canvas.getContext('2d');if(!ctx)return;
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   const size=Math.min(portrait.naturalWidth,portrait.naturalHeight);
   ctx.drawImage(portrait,(portrait.naturalWidth-size)/2,(portrait.naturalHeight-size)/2,size,size,0,0,128,128);
   canvas.dataset.portraitReady='true';host.replaceChildren(canvas);
  };
  portrait.src=p.portrait;
 }
 if(!p?.sheet)return;
 const image=new Image();image.decoding='async';
 image.onload=()=>{
  if(host.dataset.profileId!==id||!host.isConnected)return;
  const [x,y,w,h]=p.rect;
  if(image.naturalWidth<x+w||image.naturalHeight<y+h)return;
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  // Old sprite fallback should not overwrite a successfully loaded new portrait.
  if(host.querySelector('canvas[data-portrait-ready]'))return;
  ctx.drawImage(image,x,y,w,h*.7,0,0,96,96);host.replaceChildren(canvas);
 };
 image.src='./assets/'+p.sheet;
}
return Object.freeze({get,entries,paintAvatar});
});
