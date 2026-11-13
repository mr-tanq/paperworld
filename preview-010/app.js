(()=>{'use strict';
const canvas=document.querySelector('#map'),ctx=canvas.getContext('2d'),nameEl=document.querySelector('#name'),descEl=document.querySelector('#desc'),assetEl=document.querySelector('#assets');
const W=1671,H=941;
const state={width:0,height:0,dpr:1,scale:1,fit:1,x:0,y:0,pointer:null,chosen:null,walker:{x:835,y:854},route:[],destination:null};
const defs=[
{id:'town',name:'Town Hall',file:'../assets/town-hall.png',x:535,bottom:476,width:356,entrance:[535,460],approach:[535,520],desc:'The future approval and budget hub. All operations remain disabled.'},
{id:'workshop',name:'Listening Mirror Workshop',file:'../assets/listening-mirror-workshop.png',x:1125,bottom:468,width:358,entrance:[1125,448],approach:[1125,515],desc:'The music discovery project workspace. No real tasks are connected.'},
{id:'pokemon',name:'Pokémon Hub',file:'../assets/pokemon-hub.png',x:330,bottom:646,width:370,entrance:[330,632],approach:[385,665],desc:'Future home of Pokémon: Echoes development.'},
{id:'wellbeing',name:'Wellbeing & Training Center',file:'../assets/wellbeing-training-center.png',x:1325,bottom:645,width:366,entrance:[1325,633],approach:[1240,690],desc:'Future training, nutrition, habits and progress workspace.'},
{id:'studio',name:'The Lost Wanderer Studio',file:'../assets/lost-wanderer-studio.png',x:835,bottom:801,width:438,entrance:[835,789],approach:[835,854],desc:'Future music writing and production studio.'}
];
const scene={name:'Papercraft environment',file:'../assets/environment-010.png'};
function load(item){item.image=new Image();item.ready=false;item.image.onload=()=>{item.ready=true;if(item!==scene){const c=document.createElement('canvas');c.width=128;c.height=Math.max(1,Math.round(128*item.image.naturalHeight/item.image.naturalWidth));const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(item.image,0,0,c.width,c.height);item.hitMask={data:g.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height}}renderStatus()};item.image.onerror=()=>{item.ready=false;renderStatus()};item.image.src=item.file}
[scene,...defs].forEach(load);
function renderStatus(){assetEl.innerHTML=[scene,...defs].map(d=>'<div class="'+(d.ready?'good':'bad')+'">'+(d.ready?'✓ ':'○ ')+d.name+'</div>').join('')}
const navigation=window.PaperworldNavigation;
if(!navigation)throw new Error('PAPERWORLD navigation module not loaded');
function resize(){const r=canvas.getBoundingClientRect();state.width=r.width;state.height=r.height;state.dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*state.dpr));canvas.height=Math.max(1,Math.round(r.height*state.dpr));ctx.setTransform(state.dpr,0,0,state.dpr,0,0);state.fit=Math.min((r.width-14)/W,(r.height-14)/H);resetCamera()}
function resetCamera(){state.scale=state.fit;state.x=(state.width-W*state.scale)/2;state.y=(state.height-H*state.scale)/2}
function localPoint(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function worldPoint(p){return{x:(p.x-state.x)/state.scale,y:(p.y-state.y)/state.scale}}
function spriteBox(d){const ratio=d.image.naturalHeight/d.image.naturalWidth||.75;const height=d.width*ratio;return{x:d.x-d.width/2,y:d.bottom-height,width:d.width,height}}
function hitBuilding(p){return [...defs].reverse().find(d=>{if(!d.ready||!d.hitMask)return false;const b=spriteBox(d);if(p.x<b.x||p.x>b.x+b.width||p.y<b.y||p.y>b.y+b.height)return false;const m=d.hitMask,px=Math.min(m.w-1,Math.floor((p.x-b.x)/b.width*m.w)),py=Math.min(m.h-1,Math.floor((p.y-b.y)/b.height*m.h));return m.data[(py*m.w+px)*4+3]>65})}
function inspect(d){state.chosen=d;state.route=[];state.destination=null;nameEl.textContent=d.name;descEl.textContent=d.desc}
function tap(p){
 const d=hitBuilding(p);if(d){inspect(d);state.destination=null;return}
 // Taps on/near the map resolve to the nearest point ON a surveyed paved segment.
 // Allow a comfortable finger-sized margin around mapped paving, but never jump to a far-away path.
 const touchTolerance=Math.min(115,Math.max(75,56/state.scale));
 const destination=navigation.snapToPath([p.x,p.y],touchTolerance);
 if(!destination){nameEl.textContent='Village paths';descEl.textContent='No connected walkway nearby. Tap closer to the village roads.';return}
 const start=navigation.snapToPath([state.walker.x,state.walker.y],20);
 if(!start){state.route=[];descEl.textContent='The walker is off the mapped road. Reload to reset position.';return}
 const path=navigation.routeBetween(start,destination);
 if(!path.length){descEl.textContent='No connected paved route to this destination.';return}
 state.route=path.slice(1).map(([x,y])=>({x,y}));
 state.destination=state.route.length?{x:destination.point[0],y:destination.point[1]}:null;
 state.chosen=null;
 nameEl.textContent='Village paths';
 descEl.textContent=destination.distance>24?'Walking to the nearest paved path.':'Walking along the paved paths.';
}
function draw(now){ctx.clearRect(0,0,state.width,state.height);ctx.fillStyle='#151b22';ctx.fillRect(0,0,state.width,state.height);ctx.save();ctx.translate(state.x,state.y);ctx.scale(state.scale,state.scale);
if(scene.ready)ctx.drawImage(scene.image,0,0,W,H);else{ctx.fillStyle='#a6b398';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='40px system-ui';ctx.fillText('Upload assets/environment-010.png to preview the village',105,440)}
const w=state.walker;
 const drawWalker=()=>{
  ctx.fillStyle='#3a2e29aa';ctx.beginPath();ctx.ellipse(w.x,w.y,14,6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f8e0b6';ctx.beginPath();ctx.arc(w.x,w.y-23,10,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#647e76';ctx.fillRect(w.x-10,w.y-14,20,20);
  ctx.fillStyle='#fff8e4';ctx.font='15px system-ui';ctx.textAlign='center';ctx.fillText('You',w.x,w.y+21);
 };
 // Painter order: when walking behind a building, its sprite covers the walker.
 const layers=defs.filter(d=>d.ready).map(d=>({depth:d.bottom,paint:()=>{const b=spriteBox(d);ctx.drawImage(d.image,b.x,b.y,b.width,b.height)}}));
 layers.push({depth:w.y,paint:drawWalker});layers.sort((a,b)=>a.depth-b.depth).forEach(item=>item.paint());
 if(state.chosen){
  // Marker is tied to the FRONT DOOR on the actual artwork, not the sprite base,
  // the artwork centre, or the nearest pathfinding waypoint.
  const d=state.chosen,x=d.entrance[0],y=d.entrance[1];
  ctx.save();ctx.shadowColor='#ffdda0';ctx.shadowBlur=10;
  ctx.fillStyle='#fff5d5';ctx.strokeStyle='#765c38';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x,y-16);ctx.lineTo(x+9,y-5);ctx.lineTo(x,y+6);ctx.lineTo(x-9,y-5);ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.restore();
}
 if(state.destination){const p=state.destination;ctx.strokeStyle='#fef3d9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-7,p.y);ctx.lineTo(p.x+7,p.y);ctx.moveTo(p.x,p.y-7);ctx.lineTo(p.x,p.y+7);ctx.stroke()}
 ctx.restore()}
function tick(now){const dt=Math.min(.05,(now-(tick.last||now))/1000);tick.last=now;if(state.route.length){let next=state.route[0],dx=next.x-state.walker.x,dy=next.y-state.walker.y,dist=Math.hypot(dx,dy),speed=105*dt;if(dist<=speed){Object.assign(state.walker,next);state.route.shift();if(!state.route.length)state.destination=null}else{state.walker.x+=dx/dist*speed;state.walker.y+=dy/dist*speed}}draw(now);requestAnimationFrame(tick)}
canvas.addEventListener('pointerdown',e=>{const p=localPoint(e);state.pointer={...p,originalX:p.x,originalY:p.y,dragged:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{const p=localPoint(e),v=state.pointer;if(!v)return;if(Math.hypot(p.x-v.originalX,p.y-v.originalY)>7)v.dragged=true;if(v.dragged){state.x+=p.x-v.x;state.y+=p.y-v.y}v.x=p.x;v.y=p.y});
canvas.addEventListener('pointerup',e=>{const p=localPoint(e),v=state.pointer;if(v&&!v.dragged)tap(worldPoint(p));state.pointer=null});
canvas.addEventListener('pointercancel',()=>{state.pointer=null});
function zoom(delta){const cx=state.width/2,cy=state.height/2,worldX=(cx-state.x)/state.scale,worldY=(cy-state.y)/state.scale;state.scale=Math.max(state.fit*.7,Math.min(state.fit*3,state.scale*delta));state.x=cx-worldX*state.scale;state.y=cy-worldY*state.scale}
document.querySelector('#plus').onclick=()=>zoom(1.2);document.querySelector('#minus').onclick=()=>zoom(1/1.2);document.querySelector('#home').onclick=resetCamera;
new ResizeObserver(resize).observe(canvas);renderStatus();requestAnimationFrame(tick);
})();