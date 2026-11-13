(()=>{'use strict';
const canvas=document.querySelector('#map'),ctx=canvas.getContext('2d'),nameEl=document.querySelector('#name'),descEl=document.querySelector('#desc'),assetEl=document.querySelector('#assets');
const W=1671,H=941;
const state={width:0,height:0,dpr:1,scale:1,fit:1,x:0,y:0,pointer:null,chosen:null,walker:{x:835,y:870},route:[]};
const defs=[
{id:'town',name:'Town Hall',file:'../assets/town-hall.png',x:535,bottom:476,width:356,desc:'The future approval and budget hub. All operations remain disabled.'},
{id:'workshop',name:'Listening Mirror Workshop',file:'../assets/listening-mirror-workshop.png',x:1125,bottom:468,width:358,desc:'The music discovery project workspace. No real tasks are connected.'},
{id:'pokemon',name:'Pokémon Hub',file:'../assets/pokemon-hub.png',x:330,bottom:646,width:370,desc:'Future home of Pokémon: Echoes development.'},
{id:'wellbeing',name:'Wellbeing & Training Center',file:'../assets/wellbeing-training-center.png',x:1325,bottom:645,width:366,desc:'Future training, nutrition, habits and progress workspace.'},
{id:'studio',name:'The Lost Wanderer Studio',file:'../assets/lost-wanderer-studio.png',x:835,bottom:801,width:438,desc:'Future music writing and production studio.'}
];
const scene={name:'Papercraft environment',file:'../assets/environment-010.png'};
function load(item){item.image=new Image();item.ready=false;item.image.onload=()=>{item.ready=true;renderStatus()};item.image.onerror=()=>{item.ready=false;renderStatus()};item.image.src=item.file}
[scene,...defs].forEach(load);
function renderStatus(){assetEl.innerHTML=[scene,...defs].map(d=>'<div class="'+(d.ready?'good':'bad')+'">'+(d.ready?'✓ ':'○ ')+d.name+'</div>').join('')}
const navigation=window.PaperworldNavigation;
if(!navigation)throw new Error('PAPERWORLD navigation module not loaded');
function resize(){const r=canvas.getBoundingClientRect();state.width=r.width;state.height=r.height;state.dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*state.dpr));canvas.height=Math.max(1,Math.round(r.height*state.dpr));ctx.setTransform(state.dpr,0,0,state.dpr,0,0);state.fit=Math.min((r.width-14)/W,(r.height-14)/H);resetCamera()}
function resetCamera(){state.scale=state.fit;state.x=(state.width-W*state.scale)/2;state.y=(state.height-H*state.scale)/2}
function localPoint(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function worldPoint(p){return{x:(p.x-state.x)/state.scale,y:(p.y-state.y)/state.scale}}
function spriteBox(d){const ratio=d.image.naturalHeight/d.image.naturalWidth||.75;const height=d.width*ratio;return{x:d.x-d.width/2,y:d.bottom-height,width:d.width,height}}
function hitBuilding(p){return [...defs].reverse().find(d=>{if(!d.ready)return false;const b=spriteBox(d);return p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height})}
function inspect(d){state.chosen=d;nameEl.textContent=d.name;descEl.textContent=d.desc}
function tap(p){
 const d=hitBuilding(p);if(d){inspect(d);return}
 const destination=navigation.nearestNode([p.x,p.y],65);
 if(destination<0){nameEl.textContent='Village paths';descEl.textContent='That spot is not on a verified walkway. Choose a paved path.';return}
 let prefix=[],start;
 if(state.route.length){
  // Finish the currently safe segment first, rather than cutting diagonally.
  const next=state.route[0];
  start=navigation.nearestNode([next.x,next.y],1);
  prefix=[next];
 }else{
  start=navigation.nearestNode([state.walker.x,state.walker.y],90);
  if(start>=0){
   const node=navigation.nodes[start];
   if(!navigation.clearSegment([state.walker.x,state.walker.y],node))start=-1;
   else if(Math.hypot(node[0]-state.walker.x,node[1]-state.walker.y)>2)prefix=[{x:node[0],y:node[1]}];
  }
 }
 if(start<0){state.route=[];descEl.textContent='No safe path from here. Use Home to restore the view and choose a paved path.';return}
 const path=navigation.findRoute(start,destination);
 if(!path.length){descEl.textContent='There is no verified route to that point yet.';return}
 state.route=prefix.concat(path.slice(1).map(([x,y])=>({x,y})));
 nameEl.textContent='Village paths';
 descEl.textContent='Walking only along the reviewed path network. Building ground areas are blocked.';
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
 if(state.chosen){const d=state.chosen;ctx.strokeStyle='#ffe6a4';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(d.x,d.bottom-6,d.width*.35,20,0,0,Math.PI*2);ctx.stroke()}
 ctx.restore()}
function tick(now){const dt=Math.min(.05,(now-(tick.last||now))/1000);tick.last=now;if(state.route.length){let next=state.route[0],dx=next.x-state.walker.x,dy=next.y-state.walker.y,dist=Math.hypot(dx,dy),speed=105*dt;if(dist<=speed){Object.assign(state.walker,next);state.route.shift()}else{state.walker.x+=dx/dist*speed;state.walker.y+=dy/dist*speed}}draw(now);requestAnimationFrame(tick)}
canvas.addEventListener('pointerdown',e=>{const p=localPoint(e);state.pointer={...p,originalX:p.x,originalY:p.y,dragged:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{const p=localPoint(e),v=state.pointer;if(!v)return;if(Math.hypot(p.x-v.originalX,p.y-v.originalY)>7)v.dragged=true;if(v.dragged){state.x+=p.x-v.x;state.y+=p.y-v.y}v.x=p.x;v.y=p.y});
canvas.addEventListener('pointerup',e=>{const p=localPoint(e),v=state.pointer;if(v&&!v.dragged)tap(worldPoint(p));state.pointer=null});
canvas.addEventListener('pointercancel',()=>{state.pointer=null});
function zoom(delta){const cx=state.width/2,cy=state.height/2,worldX=(cx-state.x)/state.scale,worldY=(cy-state.y)/state.scale;state.scale=Math.max(state.fit*.7,Math.min(state.fit*3,state.scale*delta));state.x=cx-worldX*state.scale;state.y=cy-worldY*state.scale}
document.querySelector('#plus').onclick=()=>zoom(1.2);document.querySelector('#minus').onclick=()=>zoom(1/1.2);document.querySelector('#home').onclick=resetCamera;
new ResizeObserver(resize).observe(canvas);renderStatus();requestAnimationFrame(tick);
})();