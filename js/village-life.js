/* PAPERWORLD natural Village Life: visual-only walking and neighbor greetings.
 * No speech, AI, real news, network, task, approval or billing event.
 * World positions remain on the existing user-reviewed sidewalk graph.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldVillageLife=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DIRECTORS=['listening-director','pokemon-director','wellbeing-director','studio-director'];
 const SPEED=68,PAUSE_MIN=3.4,PAUSE_MAX=8.2;
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const face=(a,b)=>Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?(b.x>a.x?'right':'left'):(b.y>a.y?'down':'up');
 function create(navigation,actors,random=Math.random){
  if(!navigation||!Array.isArray(actors))throw Error('VillageLife requires navigation and actors');
  const members=actors.filter(a=>DIRECTORS.includes(a.id));
  const records=new Map(members.map((a,i)=>[a.id,{actor:a,home:{x:a.x,y:a.y},
    route:[],timer:4+i*2.3,greeting:0,friend:null,cooldown:8+i*3,homeward:false}]));
  let suspended=false,seconds=0,assemblyBusy=false;
  const connected=(a,b)=>{const s=navigation.snapToPath([a.x,a.y],26),e=navigation.snapToPath([b.x,b.y],2);
   return s&&e?navigation.routeBetween(s,e):[]};
  function go(r,target){
   const path=connected(r.actor,target);
   if(!path.length)return false;
   r.route=path.map(([x,y])=>({x,y})).filter(p=>dist(p,r.actor)>0.6);
   return true;
  }
  function home(r){return dist(r.actor,r.home)<1.5}
  function recallAll(){
   suspended=true;
   for(const r of records.values()){r.friend=null;r.greeting=0;r.timer=0;r.route=[];
    r.homeward=true;if(!home(r))go(r,r.home);else r.actor.moving=false}
  }
  function ready(){return [...records.values()].every(r=>home(r)&&r.route.length===0)}
  function resume(){if(!ready())return false;suspended=false;
   for(const r of records.values()){r.homeward=false;r.timer=2+random()*5;r.cooldown=9+random()*12}
   return true}
  function chooseRoam(r){
   const candidates=navigation.nodes.filter(p=>{
    const dest={x:p[0],y:p[1]},span=dist(r.home,dest);
    return span>=70&&span<=230&&!navigation.blockedPoint(p,12)&&
      [...records.values()].every(o=>o===r||dist(o.actor,dest)>38);
   });
   for(let tries=0;tries<Math.min(candidates.length,8);tries++){
    const p=candidates[Math.floor(random()*candidates.length)];
    if(go(r,{x:p[0],y:p[1]}))return true;
   }
   if(!home(r))return go(r,r.home);
   return false;
  }
  function advance(r,dt){
   let budget=SPEED*dt;const a=r.actor;a.moving=false;
   while(r.route.length&&budget>0){
    const point=r.route[0],d=dist(a,point);
    if(d<.01){r.route.shift();continue}
    const used=Math.min(d,budget);a.direction=face(a,point);
    a.x+=(point.x-a.x)*used/d;a.y+=(point.y-a.y)*used/d;
    a.walkDistance=(a.walkDistance||0)+used;
    a.moving=used>.01;budget-=used;
    if(used>=d-.01){a.x=point.x;a.y=point.y;r.route.shift()}
   }
  }
  function greet(r,other){
   const a=r.actor,b=other.actor;
   if(dist(a,b)<38||dist(a,b)>98||!navigation.clearSegment([a.x,a.y],[b.x,b.y]))return false;
   r.greeting=other.greeting=2.2+random()*1.8;
   r.friend=b.id;other.friend=a.id;
   r.cooldown=other.cooldown=20+random()*12;
   r.timer=other.timer=3+random()*5;
   a.moving=b.moving=false;
   a.direction=face(a,b);b.direction=face(b,a);
   return true;
  }
  function tick(dt,{allowRoaming=true}={}){
   const step=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0));seconds+=step;
   assemblyBusy=!allowRoaming;
   for(const r of records.values()){
    const a=r.actor;
    if(suspended){
     if(assemblyBusy){a.moving=false;continue}
     if(r.homeward&&!home(r)&&!r.route.length)go(r,r.home);
     advance(r,step);r.greeting=0;
     continue;
    }
    if(assemblyBusy){r.route=[];r.greeting=0;r.timer=Math.max(r.timer,2);continue}
    r.cooldown=Math.max(0,r.cooldown-step);
    if(r.greeting>0){
     r.greeting=Math.max(0,r.greeting-step);a.moving=false;
     const friend=records.get(r.friend)?.actor;
     if(friend)a.direction=face(a,friend);
     if(r.greeting===0)r.friend=null;
     continue;
    }
    if(r.route.length){advance(r,step);if(!r.route.length)r.timer=PAUSE_MIN+random()*(PAUSE_MAX-PAUSE_MIN);continue}
    a.moving=false;r.timer-=step;
    if(r.timer<=0){
     const nearby=[...records.values()].filter(o=>o!==r&&!o.route.length&&o.greeting<=0&&o.cooldown<=0);
     const friend=nearby.find(o=>greet(r,o));
     if(friend)continue;
     if(!chooseRoam(r))r.timer=PAUSE_MIN+random()*PAUSE_MAX;
    }
   }
  }
  function greetings(){return [...records.values()].filter(r=>r.greeting>0).map(r=>({id:r.actor.id,with:r.friend}))}
  return Object.freeze({tick,recallAll,ready,resume,greetings,isSuspended:()=>suspended,homeOf:id=>records.get(id)?.home||null});
 }
 return Object.freeze({create,DIRECTORS,SPEED});
});
