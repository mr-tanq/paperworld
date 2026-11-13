(()=>{'use strict';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d'),title=document.querySelector('#title'),dialog=document.querySelector('#dialog');
const MAP=8,TW=100,TH=50,blocked=new Set(['2,2','5,2','1,1','6,1','1,6','6,6']);const state={w:1,h:1,originX:0,originY:0,panX:0,panY:0,zoom:1,fitZoom:1,hero:{x:3,y:6,tx:3,ty:6},pointer:null,selection:null};
// Town Hall artwork is an optional local asset; preserve Canvas fallback until uploaded.
const townHallArt=new Image();
let townHallReady=false;
townHallArt.onload=()=>{townHallReady=true};
townHallArt.onerror=()=>{townHallReady=false};
townHallArt.src='./assets/town-hall.png';
const characters=[{x:2,y:3,name:'Chief',color:'#839e90',message:'I am a placeholder Chief of Staff. Real AI and task execution are disabled.'},{x:5,y:3,name:'Worker',color:'#c48b70',message:'I am a demo Worker. No code is being written or submitted.'}];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));const key=(x,y)=>x+','+y;const walkable=(x,y)=>x>=0&&y>=0&&x<MAP&&y<MAP&&!blocked.has(key(x,y));
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);state.w=r.width;state.h=r.height;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);state.originX=r.width/2;state.fitZoom=clamp(Math.min((r.width-36)/(MAP*TW),(r.height-110)/(MAP*TH+115)),.55,1.65);state.zoom=state.fitZoom;state.originY=r.height/2-105*state.zoom}
function project(x,y,z=0){return{x:state.originX+state.panX+(x-y)*TW/2*state.zoom,y:state.originY+state.panY+(x+y)*TH/2*state.zoom-z*state.zoom}}
function unproject(x,y){const dx=(x-state.originX-state.panX)/state.zoom,dy=(y-state.originY-state.panY)/state.zoom;return{x:dx/TW+dy/TH,y:dy/TH-dx/TW}}
function polygon(points,fill,stroke){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8*state.zoom;ctx.stroke()}}
function tile(x,y){const p=project(x,y),a=TW/2*state.zoom,b=TH/2*state.zoom;const road=(x===3||y===4);polygon([{x:p.x,y:p.y-b},{x:p.x+a,y:p.y},{x:p.x,y:p.y+b},{x:p.x-a,y:p.y}],road?'#e6d8be':(x+y)%2?'#c9d7bc':'#d7e2ca','#b7c7ac');if(!road&&((x*7+y*11)%4===0)){const q=project(x,y);ctx.fillStyle='#a9bd9b';ctx.beginPath();ctx.arc(q.x-8*state.zoom,q.y+2*state.zoom,2.2*state.zoom,0,Math.PI*2);ctx.fill()}}
function label(str,x,y){ctx.font=`600 ${Math.max(9,11*state.zoom)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#4f6252';ctx.fillText(str,x,y)}
function flower(x,y){const p=project(x,y),z=state.zoom;ctx.fillStyle='#c58e87';for(const [dx,dy] of [[-4,0],[4,0],[0,-4],[0,4]]){ctx.beginPath();ctx.arc(p.x+dx*z,p.y+dy*z,3*z,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#edcf85';ctx.beginPath();ctx.arc(p.x,p.y,2.2*z,0,Math.PI*2);ctx.fill()}
function tree(x,y){const p=project(x,y),s=state.zoom;ctx.strokeStyle='#8d7968';ctx.lineWidth=5*s;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-27*s);ctx.stroke();for(const [dx,dy,r,col] of [[0,-44,17,'#839e83'],[-10,-37,13,'#a8bd9b'],[10,-35,13,'#93ad89']]){ctx.beginPath();ctx.arc(p.x+dx*s,p.y+dy*s,r*s,0,Math.PI*2);ctx.fillStyle=col;ctx.fill()}}
function building(x,y,roof,name){
 const p=project(x,y),sc=state.zoom,unit=TW/2*sc,half=TH/2*sc,height=64*sc;
 const top={x:p.x,y:p.y-half-height},right={x:p.x+unit,y:p.y-height},front={x:p.x,y:p.y+half-height},left={x:p.x-unit,y:p.y-height};
 // Separate side panels, narrow paper seams and a raised folded roof.
 polygon([left,front,{x:front.x,y:front.y+height},{x:left.x,y:left.y+height}],'#f2e7d2','#bda98f');
 polygon([front,right,{x:right.x,y:right.y+height},{x:front.x,y:front.y+height}],'#d9c7ad','#af9a83');
 polygon([{x:left.x-5*sc,y:left.y+2*sc},{x:top.x,y:top.y-20*sc},{x:front.x,y:front.y+7*sc},{x:left.x-5*sc,y:left.y+9*sc}],name==='TOWN HALL'?'#9aae9b':'#c78471','#8c9380');
 polygon([{x:top.x,y:top.y-20*sc},{x:right.x+6*sc,y:right.y+2*sc},{x:right.x+6*sc,y:right.y+9*sc},{x:front.x,y:front.y+7*sc}],name==='TOWN HALL'?'#7e9988':'#ab695f','#8c8375');
 // Folded paper eaves and translucent windows: no external assets.
 ctx.fillStyle='#b69a7b';ctx.fillRect(p.x-26*sc,p.y-32*sc,2*sc,23*sc);
 ctx.fillStyle='#f7deb1';ctx.fillRect(p.x-20*sc,p.y-33*sc,12*sc,13*sc);
 ctx.strokeStyle='#a48d73';ctx.lineWidth=1.4*sc;ctx.strokeRect(p.x-20*sc,p.y-33*sc,12*sc,13*sc);
 ctx.beginPath();ctx.moveTo(p.x-14*sc,p.y-33*sc);ctx.lineTo(p.x-14*sc,p.y-20*sc);ctx.moveTo(p.x-20*sc,p.y-27*sc);ctx.lineTo(p.x-8*sc,p.y-27*sc);ctx.stroke();
 ctx.fillStyle='#826e5b';ctx.fillRect(p.x+12*sc,p.y-19*sc,15*sc,25*sc);
 ctx.fillStyle='#eed5a2';ctx.beginPath();ctx.arc(p.x+24*sc,p.y-7*sc,1.6*sc,0,Math.PI*2);ctx.fill();
 if(name==='TOWN HALL'){
  const clock=project(x,y,111),r=12*sc;
  ctx.fillStyle='#f7ecda';ctx.beginPath();ctx.arc(clock.x,clock.y,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#987d65';ctx.lineWidth=2*sc;ctx.stroke();
  ctx.beginPath();ctx.moveTo(clock.x,clock.y);ctx.lineTo(clock.x,clock.y-6*sc);ctx.moveTo(clock.x,clock.y);ctx.lineTo(clock.x+5*sc,clock.y+2*sc);ctx.stroke();
  polygon([{x:clock.x-18*sc,y:clock.y-17*sc},{x:clock.x+18*sc,y:clock.y-17*sc},{x:clock.x+18*sc,y:clock.y-14*sc},{x:clock.x-18*sc,y:clock.y-14*sc}],'#b08f74');
 }else{
  const chimney=project(x-.30,y-.12,87);
  polygon([{x:chimney.x-8*sc,y:chimney.y},{x:chimney.x+8*sc,y:chimney.y+5*sc},{x:chimney.x+8*sc,y:chimney.y+31*sc},{x:chimney.x-8*sc,y:chimney.y+25*sc}],'#b57a67','#8e6f64');
  ctx.fillStyle='#dec09f';ctx.fillRect(chimney.x-10*sc,chimney.y-3*sc,20*sc,5*sc);
  const sign=project(x+.48,y+.42,30);
  polygon([{x:sign.x-15*sc,y:sign.y-8*sc},{x:sign.x+15*sc,y:sign.y-8*sc},{x:sign.x+15*sc,y:sign.y+8*sc},{x:sign.x-15*sc,y:sign.y+8*sc}],'#718c7e','#526d63');
  ctx.fillStyle='#fff0ce';ctx.font=`bold ${10*sc}px system-ui`;ctx.textAlign='center';ctx.fillText('LM',sign.x,sign.y+3*sc);
 }
}
function townHall(x,y){
 if(!townHallReady){building(x,y,'#9eb39b','TOWN HALL');return}
 // Align the base of the richly detailed image with the building's ground tile.
 // This is a single decorative object; collision remains on the existing 8x8 map.
 const p=project(x,y),sc=state.zoom;
 const width=204*sc,height=width*(1024/1403);
 ctx.drawImage(townHallArt,p.x-width*.5,p.y-height*.87,width,height);
}
function lantern(x,y,now){const p=project(x,y),s=state.zoom,pulse=.78+.18*Math.sin(now/680+x*3);ctx.strokeStyle='#796d58';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-31*s);ctx.stroke();ctx.fillStyle='#b5936d';ctx.fillRect(p.x-6*s,p.y-34*s,12*s,7*s);ctx.fillStyle=`rgba(255,217,134,${pulse})`;ctx.beginPath();ctx.arc(p.x,p.y-31*s,4*s,0,Math.PI*2);ctx.fill()}
function person(x,y,color,name){
 const p=project(x,y),sc=state.zoom;
 ctx.fillStyle='#54665344';ctx.beginPath();ctx.ellipse(p.x,p.y,13*sc,4.5*sc,0,0,Math.PI*2);ctx.fill();
 // Paper boots and two distinct cut-out legs.
 ctx.strokeStyle='#625d56';ctx.lineWidth=4*sc;ctx.lineCap='round';ctx.beginPath();
 ctx.moveTo(p.x-5*sc,p.y-12*sc);ctx.lineTo(p.x-6*sc,p.y-2*sc);
 ctx.moveTo(p.x+5*sc,p.y-12*sc);ctx.lineTo(p.x+7*sc,p.y-2*sc);ctx.stroke();
 // Layered coat, sleeves and collar.
 polygon([{x:p.x-10*sc,y:p.y-31*sc},{x:p.x+10*sc,y:p.y-31*sc},{x:p.x+11*sc,y:p.y-14*sc},{x:p.x,y:p.y-11*sc},{x:p.x-11*sc,y:p.y-14*sc}],color,'#657068');
 ctx.strokeStyle=color;ctx.lineWidth=5*sc;ctx.beginPath();
 ctx.moveTo(p.x-10*sc,p.y-28*sc);ctx.lineTo(p.x-14*sc,p.y-18*sc);
 ctx.moveTo(p.x+10*sc,p.y-28*sc);ctx.lineTo(p.x+14*sc,p.y-18*sc);ctx.stroke();
 polygon([{x:p.x-4*sc,y:p.y-30*sc},{x:p.x+4*sc,y:p.y-30*sc},{x:p.x,y:p.y-19*sc}],'#e8d6bc');
 // Head with subtle hair / hat variation.
 ctx.fillStyle='#f0d4b4';ctx.beginPath();ctx.arc(p.x,p.y-41*sc,11.5*sc,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#62574e';
 if(name==='Chief'){
  polygon([{x:p.x-12*sc,y:p.y-46*sc},{x:p.x+12*sc,y:p.y-46*sc},{x:p.x+8*sc,y:p.y-53*sc},{x:p.x-8*sc,y:p.y-53*sc}],'#536f64');
 }else if(name==='Worker'){
  ctx.beginPath();ctx.arc(p.x,p.y-47*sc,11*sc,Math.PI,2*Math.PI);ctx.fill();
  ctx.fillRect(p.x-12*sc,p.y-47*sc,24*sc,3*sc);
 }else{
  ctx.beginPath();ctx.ellipse(p.x,p.y-49*sc,10*sc,5*sc,0,Math.PI,2*Math.PI);ctx.fill();
 }
 ctx.fillStyle='#4f4943';ctx.beginPath();ctx.arc(p.x-4*sc,p.y-41*sc,1.15*sc,0,Math.PI*2);ctx.arc(p.x+4*sc,p.y-41*sc,1.15*sc,0,Math.PI*2);ctx.fill();
}
function selectedLabel(){
 if(!state.selection)return;
 const target=state.selection;
 const buildingLabel=target.x===2&&target.y===2?'TOWN HALL':target.x===5&&target.y===2?'WORKSHOP':null;
 const character=characters.find(c=>c.x===target.x&&c.y===target.y);
 const name=buildingLabel||(character&&character.name);
 if(!name)return;
 const p=project(target.x,target.y,(buildingLabel?(buildingLabel==='TOWN HALL'&&townHallReady?162:137):72));
 const fontSize=Math.max(11,12*state.zoom),pad=9*state.zoom;
 ctx.font=`600 ${fontSize}px system-ui`;ctx.textAlign='center';
 const width=ctx.measureText(name).width+pad*2;
 const bx=p.x-width/2,by=p.y-17*state.zoom;
 ctx.fillStyle='#fff9eedd';ctx.strokeStyle='#b7a78e';ctx.lineWidth=1;
 ctx.beginPath();ctx.roundRect(bx,by,width,23*state.zoom,7*state.zoom);ctx.fill();ctx.stroke();
 ctx.fillStyle='#47584c';ctx.fillText(name,p.x,by+16*state.zoom);
}
function draw(now){ctx.clearRect(0,0,state.w,state.h);for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++)tile(x,y);if(state.selection){const p=project(state.selection.x,state.selection.y),s=state.zoom;ctx.beginPath();ctx.ellipse(p.x,p.y,31*s,14*s,0,0,Math.PI*2);ctx.fillStyle='#f7e4a466';ctx.fill();ctx.strokeStyle='#b38146';ctx.lineWidth=2*s;ctx.stroke()}const objects=[{x:3,y:1,draw:()=>lantern(3,1,now)},{x:3,y:6,draw:()=>lantern(3,6,now)},{x:0,y:3,draw:()=>flower(0,3)},{x:4,y:6,draw:()=>flower(4,6)},{x:7,y:4,draw:()=>flower(7,4)},{x:1,y:1,draw:()=>tree(1,1)},{x:6,y:1,draw:()=>tree(6,1)},{x:1,y:6,draw:()=>tree(1,6)},{x:6,y:6,draw:()=>tree(6,6)},{x:2,y:2,draw:()=>townHall(2,2)},{x:5,y:2,draw:()=>building(5,2,'#c8866c','WORKSHOP')},...characters.map(c=>({x:c.x,y:c.y,draw:()=>person(c.x,c.y,c.color,c.name)})),{x:state.hero.x,y:state.hero.y,draw:()=>person(state.hero.x,state.hero.y,'#6f8a9c','You')}];objects.sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(o=>o.draw());selectedLabel()}
function show(t,m){title.textContent=t;dialog.textContent=m}
function bfs(sx,sy,gx,gy){const start=key(sx,sy),goal=key(gx,gy),queue=[[sx,sy]],prev=new Map([[start,null]]);for(let i=0;i<queue.length;i++){const [x,y]=queue[i];if(key(x,y)===goal)break;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(walkable(nx,ny)&&!prev.has(k)){prev.set(k,key(x,y));queue.push([nx,ny])}}}if(!prev.has(goal))return [];const path=[];for(let k=goal;k!==start;k=prev.get(k)){const [x,y]=k.split(',').map(Number);path.unshift({x,y})}return path}
let route=[];
const buildings=[
{x:2,y:2,name:'Town Hall',message:'The Town Hall will hold approvals and budget controls. Nothing is connected yet.'},
{x:5,y:2,name:'Listening Mirror Workshop',message:'This workshop is a placeholder for future, reviewed project tasks. No GitHub worker is running.'}
];
function inspect(item){state.selection={x:item.x,y:item.y};route=[];show(item.name,item.message)}
function hitObject(px,py){
  // Screen-space checks include the artwork above each object's ground tile.
  // This works when zoomed or panned, unlike using ground-only tile selection.
  for(const c of characters){
    const p=project(c.x,c.y),s=state.zoom;
    if(Math.abs(px-p.x)<=Math.max(17*s,19)&&py>=p.y-57*s-5&&py<=p.y+Math.max(10*s,9))return c;
  }
  for(const b of buildings){
    const p=project(b.x,b.y),s=state.zoom;
    const isTown=b.x===2&&b.y===2&&townHallReady;
    const extentX=isTown?103*s:54*s;
    const top=isTown?140*s:114*s;
    if(Math.abs(px-p.x)<=Math.max(extentX,28)&&py>=p.y-top&&py<=p.y+22*s)return b;
  }
  return null;
}
function select(x,y){
  const gx=Math.round(x),gy=Math.round(y);
  if(!walkable(gx,gy)){show('Path blocked','Choose an empty tile to walk to.');return}
  const sx=Math.round(state.hero.x),sy=Math.round(state.hero.y);
  route=bfs(sx,sy,gx,gy);state.selection=null;
  if(route.length===0&&!(sx===gx&&sy===gy))show('No path','That location is not reachable.');
}
function pointer(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
canvas.addEventListener('pointerdown',e=>{const p=pointer(e);state.pointer={...p,downX:p.x,downY:p.y,dragged:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!state.pointer)return;const p=pointer(e),q=state.pointer;if(Math.hypot(p.x-q.downX,p.y-q.downY)>8)q.dragged=true;if(q.dragged){state.panX+=p.x-q.x;state.panY+=p.y-q.y}q.x=p.x;q.y=p.y});
canvas.addEventListener('pointerup',e=>{const q=state.pointer;if(!q)return;if(!q.dragged){const p=pointer(e),item=hitObject(p.x,p.y);if(item)inspect(item);else{const t=unproject(p.x,p.y);select(t.x,t.y)}}state.pointer=null});canvas.addEventListener('pointercancel',()=>{state.pointer=null});
document.querySelector('#chief').onclick=()=>inspect(characters[0]);document.querySelector('#workshop').onclick=()=>inspect(buildings[1]);document.querySelector('#town').onclick=()=>inspect(buildings[0]);
document.querySelector('#zoom-in').onclick=()=>state.zoom=clamp(state.zoom+.15,.5,2);document.querySelector('#zoom-out').onclick=()=>state.zoom=clamp(state.zoom-.15,.5,2);document.querySelector('#reset').onclick=()=>{state.zoom=state.fitZoom;state.panX=state.panY=0};
new ResizeObserver(resize).observe(canvas);let previous=performance.now();function frame(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(route.length){const target=route[0],dx=target.x-state.hero.x,dy=target.y-state.hero.y,dist=Math.hypot(dx,dy);if(dist<.025){state.hero.x=target.x;state.hero.y=target.y;route.shift()}else{const step=Math.min(dist,dt*2.5);state.hero.x+=dx/dist*step;state.hero.y+=dy/dist*step}}draw(now);requestAnimationFrame(frame)}requestAnimationFrame(frame);
})();