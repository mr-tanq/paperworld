/* PAPERWORLD visual-only identities; online status is never inferred. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperworldProfiles=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
const roster=Object.freeze({
 matt:{name:'Matt',role:'Chief of Staff',project:'Paperworld',kind:'director',sheet:'characters-hq-v2.png',rect:[64,352,64,88]},
 'listening-director':{name:'Luna',role:'Director',project:'Listening Mirror',kind:'director',sheet:'characters-hq-v2.png',rect:[64,704,64,88]},
 'pokemon-director':{name:'Joey',role:'Director',project:'Pokémon: Echoes',kind:'director',sheet:'pokemon-director-walk-hq-v2.png',rect:[64,0,64,88]},
 'studio-director':{name:'Crow',role:'Director',project:'The Lost Wanderer',kind:'director',sheet:'studio-director-hooded-v2.png',rect:[96,0,96,132]},
 'wellbeing-director':{name:'Dave',role:'Director',project:'Wellbeing & Training',kind:'director',sheet:'wellbeing-director-walk-hq-v2.png',rect:[64,0,64,88]},
 'listening-developer':{name:'Listening Mirror Developer',role:'Worker',project:'Listening Mirror',kind:'worker'},
 'pokemon-developer':{name:'Pokémon Developer',role:'Worker',project:'Pokémon: Echoes',kind:'worker'}
});
function get(id){return Object.prototype.hasOwnProperty.call(roster,id)?roster[id]:null}
function entries(kind){return Object.keys(roster).filter(id=>roster[id].kind===kind).map(id=>({id,...roster[id]}))}
function paintAvatar(host,id){
 const p=get(id);if(!host)return;host.dataset.profileId=id;host.replaceChildren();
 host.classList.add('agent-profile-avatar');
 const fallback=document.createElement('span');fallback.textContent=(p?.name||'?')[0].toUpperCase();host.append(fallback);
 if(!p?.sheet)return;
 const image=new Image();image.decoding='async';
 image.onload=()=>{
  if(host.dataset.profileId!==id||!host.isConnected)return;
  const [x,y,w,h]=p.rect;
  if(image.naturalWidth<x+w||image.naturalHeight<y+h)return;
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(image,x,y,w,h*.7,0,0,96,96);host.replaceChildren(canvas);
 };
 image.src='./assets/'+p.sheet;
}
return Object.freeze({get,entries,paintAvatar});
});
