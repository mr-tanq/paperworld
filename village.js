(()=>{'use strict';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d'),title=document.querySelector('#title'),dialog=document.querySelector('#dialog');
const MAP=8,TW=100,TH=50,blocked=new Set(['2,2','5,2','1,1','6,1','1,6','6,6']);const state={w:1,h:1,originX:0,originY:0,panX:0,panY:0,zoom:1,fitZoom:1,hero:{x:3,y:6,tx:3,ty:6},pointer:null,selection:null};
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
function building(x,y,roof,name){const p=project(x,y),s=state.zoom,a=TW/2*s,b=TH/2*s,z=65*s;const top={x:p.x,y:p.y-b-z},right={x:p.x+a,y:p.y-z},bottom={x:p.x,y:p.y+b-z},left={x:p.x-a,y:p.y-z};polygon([left,bottom,{x:bottom.x,y:bottom.y+z},{x:left.x,y:left.y+z}],'#ecdfcb','#bfae9b');polygon([bottom,right,{x:right.x,y:right.y+z},{x:bottom.x,y:bottom.y+z}],'#d4bfa7','#bfae9b');polygon([{x:left.x-7*s,y:left.y+4*s},{x:top.x,y:top.y-22*s},{x:right.x+7*s,y:right.y+4*s},{x:bottom.x,y:bottom.y+12*s}],roof,'#8f9985');const door=project(x+.22,y+.47);ctx.fillStyle='#806c5a';ctx.fillRect(door.x-7*s,door.y-20*s,14*s,20*s);ctx.fillStyle='#f6e6b5';ctx.fillRect(door.x+2*s,door.y-10*s,2*s,2*s);ctx.fillStyle='#f4e3bb';ctx.fillRect(p.x-30*s,p.y-31*s,12*s,12*s);ctx.strokeStyle='#a18e75';ctx.lineWidth=1.2*s;ctx.strokeRect(p.x-30*s,p.y-31*s,12*s,12*s);label(name,p.x,p.y+43*s);
  // Distinct paper details identify each building without external image assets.
  if(name==='TOWN HALL'){
    const c=project(x,y,110);
    ctx.fillStyle='#f3e9d4';ctx.beginPath();ctx.arc(c.x,c.y,13*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#9a8067';ctx.lineWidth=2*s;ctx.stroke();
    ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(c.x,c.y-7*s);ctx.moveTo(c.x,c.y);ctx.lineTo(c.x+5*s,c.y+3*s);ctx.stroke();
    ctx.fillStyle='#bb8e65';ctx.fillRect(c.x-17*s,c.y-21*s,34*s,3*s);
  }else if(name==='WORKSHOP'){
    const chimney=project(x-.32,y-.15,86);
    polygon([{x:chimney.x-8*s,y:chimney.y},{x:chimney.x+7*s,y:chimney.y+6*s},{x:chimney.x+7*s,y:chimney.y+29*s},{x:chimney.x-8*s,y:chimney.y+23*s}],'#b87564','#966d61');
    ctx.fillStyle='#d9ae87';ctx.fillRect(chimney.x-10*s,chimney.y-3*s,20*s,5*s);
    const sign=project(x+.55,y+.55,38);
    ctx.fillStyle='#7e9582';ctx.fillRect(sign.x-13*s,sign.y-8*s,26*s,15*s);
    ctx.fillStyle='#f8ecce';ctx.font=`bold ${10*s}px system-ui`;ctx.textAlign='center';ctx.fillText('LM',sign.x,sign.y+3*s);
  }
}
function lantern(x,y,now){const p=project(x,y),s=state.zoom,pulse=.78+.18*Math.sin(now/680+x*3);ctx.strokeStyle='#796d58';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-31*s);ctx.stroke();ctx.fillStyle='#b5936d';ctx.fillRect(p.x-6*s,p.y-34*s,12*s,7*s);ctx.fillStyle=`rgba(255,217,134,${pulse})`;ctx.beginPath();ctx.arc(p.x,p.y-31*s,4*s,0,Math.PI*2);ctx.fill()}
function person(x,y,color,name){const p=project(x,y),s=state.zoom;ctx.fillStyle='#60715b55';ctx.beginPath();ctx.ellipse(p.x,p.y,13*s,5*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(p.x,p.y-18*s,10*s,16*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f1d6b7';ctx.beginPath();ctx.arc(p.x,p.y-39*s,12*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3e4b40';ctx.fillRect(p.x-5*s,p.y-41*s,2*s,2*s);ctx.fillRect(p.x+4*s,p.y-41*s,2*s,2*s);label(name,p.x,p.y+19*s)}
function draw(now){ctx.clearRect(0,0,state.w,state.h);for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++)tile(x,y);if(state.selection){const p=project(state.selection.x,state.selection.y),s=state.zoom;ctx.beginPath();ctx.ellipse(p.x,p.y,31*s,14*s,0,0,Math.PI*2);ctx.fillStyle='#f7e4a466';ctx.fill();ctx.strokeStyle='#b38146';ctx.lineWidth=2*s;ctx.stroke()}const objects=[{x:3,y:1,draw:()=>lantern(3,1,now)},{x:3,y:6,draw:()=>lantern(3,6,now)},{x:0,y:3,draw:()=>flower(0,3)},{x:4,y:6,draw:()=>flower(4,6)},{x:7,y:4,draw:()=>flower(7,4)},{x:1,y:1,draw:()=>tree(1,1)},{x:6,y:1,draw:()=>tree(6,1)},{x:1,y:6,draw:()=>tree(1,6)},{x:6,y:6,draw:()=>tree(6,6)},{x:2,y:2,draw:()=>building(2,2,'#9eb39b','TOWN HALL')},{x:5,y:2,draw:()=>building(5,2,'#c8866c','WORKSHOP')},...characters.map(c=>({x:c.x,y:c.y,draw:()=>person(c.x,c.y,c.color,c.name)})),{x:state.hero.x,y:state.hero.y,draw:()=>person(state.hero.x,state.hero.y,'#6f8a9c','You')}];objects.sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(o=>o.draw())}
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
    if(Math.abs(px-p.x)<=Math.max(54*s,28)&&py>=p.y-114*s&&py<=p.y+22*s)return b;
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