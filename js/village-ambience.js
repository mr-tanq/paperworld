/* PAPERWORLD village ambience — small, purely visual signs of life:
 * chimney smoke, birds crossing the sky, butterflies and evening fireflies.
 * No network, no AI, no task meaning. Respects prefers-reduced-motion and
 * keeps a hard cap on particles so phones stay smooth.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldVillageAmbience=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
// Chimney tops measured on each building's artwork (fractions of the sprite box).
const CHIMNEYS=Object.freeze({
 town:[[0.265,0.30],[0.735,0.29]],
 workshop:[[0.646,0.165]],
 pokemon:[[0.34,0.165]],
 wellbeing:[[0.705,0.165]],
 studio:[[0.736,0.135]]
});
const MAX_SMOKE=70,MAX_FLIES=26;
function create({defs,W,H,random=Math.random,reducedMotion=false}={}){
 const smoke=[],birds=[],butterflies=[],flies=[];
 let lastBirds=0,lastTime=0,emitAcc=0;
 for(let i=0;i<5;i++)butterflies.push({x:200+random()*(W-400),y:420+random()*(H-520),
  vx:0,vy:0,phase:random()*6.28,hue:[48,330,200,20,280][i]});
 for(let i=0;i<MAX_FLIES;i++)flies.push({x:random()*W,y:300+random()*(H-360),
  phase:random()*6.28,speed:.3+random()*.5});
 function chimneyPoints(){
  const out=[];
  for(const d of defs||[]){
   if(!d.ready||!d.image||!CHIMNEYS[d.id])continue;
   const ratio=d.image.naturalHeight/d.image.naturalWidth||.75,height=d.width*ratio;
   const x0=d.x-d.width/2,y0=d.bottom-height;
   for(const [fx,fy] of CHIMNEYS[d.id])out.push({x:x0+fx*d.width,y:y0+fy*height});
  }
  return out;
 }
 // Evening glow: fireflies only show from 18:00 to 06:00 local time.
 function evening(date=new Date()){const h=date.getHours();return h>=18||h<6}
 function step(now){
  const dt=Math.min(.05,Math.max(0,(now-(lastTime||now))/1000));lastTime=now;
  if(reducedMotion)return dt;
  emitAcc+=dt;
  if(emitAcc>.35&&smoke.length<MAX_SMOKE){
   emitAcc=0;
   for(const c of chimneyPoints())if(random()<.55)
    smoke.push({x:c.x+(random()-.5)*4,y:c.y,r:5+random()*3,age:0,life:4+random()*2.5,drift:6+random()*8});
  }
  for(let i=smoke.length-1;i>=0;i--){
   const p=smoke[i];p.age+=dt;p.y-=14*dt;p.x+=p.drift*dt;p.r+=4.2*dt;
   if(p.age>=p.life)smoke.splice(i,1);
  }
  if(now-lastBirds>22000+random()*20000&&birds.length===0){
   lastBirds=now;const fromLeft=random()<.5,y=60+random()*160,n=3+Math.floor(random()*3);
   for(let i=0;i<n;i++)birds.push({x:fromLeft?-40-i*26:W+40+i*26,y:y+(i%2)*14+i*4,
    v:(fromLeft?1:-1)*(70+random()*20),flap:random()*6.28});
  }
  for(let i=birds.length-1;i>=0;i--){const b=birds[i];b.x+=b.v*dt;b.flap+=dt*9;
   if(b.x<-120||b.x>W+120)birds.splice(i,1)}
  for(const b of butterflies){
   b.phase+=dt*3;
   b.vx+=(random()-.5)*40*dt;b.vy+=(random()-.5)*40*dt;
   b.vx=Math.max(-22,Math.min(22,b.vx));b.vy=Math.max(-16,Math.min(16,b.vy));
   b.x=Math.max(120,Math.min(W-120,b.x+b.vx*dt));b.y=Math.max(380,Math.min(H-80,b.y+b.vy*dt));
  }
  for(const f of flies){f.phase+=dt*f.speed*3;f.x+=Math.cos(f.phase*.7)*8*dt;f.y+=Math.sin(f.phase)*6*dt}
  return dt;
 }
 function draw(ctx,now,{night=evening()}={}){
  step(now);
  if(reducedMotion)return;
  ctx.save();
  for(const p of smoke){
   const k=p.age/p.life,alpha=(k<.15?k/.15:1-k)*.42;
   const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
   g.addColorStop(0,'rgba(245,242,236,'+alpha.toFixed(3)+')');g.addColorStop(1,'rgba(245,242,236,0)');
   ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  }
  ctx.strokeStyle='rgba(40,34,30,.75)';ctx.lineWidth=2;ctx.lineCap='round';
  for(const b of birds){
   const w=Math.sin(b.flap)*5;
   ctx.beginPath();ctx.moveTo(b.x-8,b.y-w);ctx.quadraticCurveTo(b.x-3,b.y-2,b.x,b.y);
   ctx.quadraticCurveTo(b.x+3,b.y-2,b.x+8,b.y-w);ctx.stroke();
  }
  for(const b of butterflies){
   const open=Math.abs(Math.sin(b.phase*3))*4+1.5;
   ctx.fillStyle='hsla('+b.hue+',85%,68%,.92)';
   ctx.beginPath();ctx.ellipse(b.x-open/2,b.y,open,3.2,-.5,0,Math.PI*2);ctx.fill();
   ctx.beginPath();ctx.ellipse(b.x+open/2,b.y,open,3.2,.5,0,Math.PI*2);ctx.fill();
  }
  if(night){
   for(const f of flies){
    const a=.35+Math.max(0,Math.sin(f.phase*2.3))*.55;
    const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,7);
    g.addColorStop(0,'rgba(255,236,150,'+a.toFixed(2)+')');g.addColorStop(1,'rgba(255,236,150,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,7,0,Math.PI*2);ctx.fill();
   }
  }
  ctx.restore();
 }
 return Object.freeze({draw,step,chimneyPoints,evening,counts:()=>({smoke:smoke.length,birds:birds.length,
  butterflies:butterflies.length,flies:flies.length})});
}
return Object.freeze({create,CHIMNEYS,MAX_SMOKE});
});
