/* PAPERWORLD visual-only director assembly along reviewed sidewalk links.
 * This does not trigger model calls, tasks, approvals, or real meetings.
 * No teleportation and no paths through building footprints.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldDirectorMovement=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Town Hall gathering v2: each Director walks to their own spot on the paving
 // right below the Town Hall steps, climbs the steps to the real front door
 // and goes inside. Door/steps measured on the Town Hall artwork (world px).
 const DOOR=Object.freeze({x:612,y:318}),STEPS=Object.freeze({x:614,y:362});
 const meetingPlaces=Object.freeze({
  'listening-director':[668,405],
  'pokemon-director':[623,446],
  'wellbeing-director':[655,417],
  'studio-director':[639,432]
 });
 // Dedicated safe sidewalk positions next to each Director, never their feet.
 // Coordinates were chosen from the existing reviewed navigation graph.
 const talkSpots=Object.freeze({
  'listening-director':Object.freeze([1040,580]),
  'pokemon-director':Object.freeze([415,625]),
  'wellbeing-director':Object.freeze([1170,625]),
  'studio-director':Object.freeze([750,837.6])
 });
 function facingToward(from,to,previous='down'){
  const dx=to.x-from.x,dy=to.y-from.y;
  if(Math.hypot(dx,dy)<0.001)return previous;
  return Math.abs(dx)>=Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
 }
 function stagedEncounter(navigation,director){
  if(!director)return null;
  const spot=talkSpots[director.id];
  if(!spot||!navigation)return null;
  const end=navigation.snapToPath(spot,2);
  if(!end||end.distance>2||!navigation.clearSegment(end.point,[director.x,director.y]))return null;
  const dist=Math.hypot(end.point[0]-director.x,end.point[1]-director.y);
  if(dist<42||dist>85)return null;
  return Object.freeze({point:Object.freeze([...end.point]),distance:dist,
   visitorFacing:facingToward({x:end.point[0],y:end.point[1]},director),
   directorFacing:facingToward(director,{x:end.point[0],y:end.point[1]})});
 }
 function create(navigation,actors){
  if(!navigation||!Array.isArray(actors))throw Error('Navigation and actors required');
  const members=actors.filter(a=>Object.prototype.hasOwnProperty.call(meetingPlaces,a.id));
  const homes=new Map(members.map(a=>[a.id,[a.x,a.y]]));
  const routes=new Map(),waits=new Map();
  let phase='idle',holdSeconds=0,held=false;
  function plan(actor,target){
   const start=navigation.snapToPath([actor.x,actor.y],25);
   const end=navigation.snapToPath(target,25);
   if(!start||!end)return null;
   const route=navigation.routeBetween(start,end);
   if(!Array.isArray(route)||route.length===0)return null;
   // Only use the vetted path points. Initial actor locations are nodes.
   return route.map(([x,y])=>({x,y})).filter(p=>Math.hypot(p.x-actor.x,p.y-actor.y)>0.5);
  }
  function call({hold=false}={}){
   if(phase!=='idle')return false;
   routes.clear();waits.clear();held=hold===true;
   for(const actor of members){
    const route=plan(actor,meetingPlaces[actor.id]);
    if(route!==null)routes.set(actor.id,route);
   }
   if(routes.size===0)return false;
   phase='outbound';holdSeconds=0;
   return true;
  }
  // The owner closes the meeting: everyone comes out and walks home.
  function end(){
   if(phase!=='meeting'&&phase!=='entering'&&phase!=='outbound')return false;
   held=false;holdSeconds=Infinity;return true;
  }
  function stepAlong(actor,route,budget){
   let moved=false;
   while(route.length&&budget>0){
    const point=route[0],dx=point.x-actor.x,dy=point.y-actor.y;
    const length=Math.hypot(dx,dy);
    if(length<0.005){route.shift();continue}
    const used=Math.min(budget,length);
    actor.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
    actor.x+=dx/length*used;actor.y+=dy/length*used;
    actor.walkDistance=(actor.walkDistance||0)+used;
    moved=true;budget-=used;
    if(used>=length-0.005){actor.x=point.x;actor.y=point.y;route.shift()}
   }
   if(moved)actor.moving=true;else actor.moving=false;
   return moved;
  }
  function tick(dt){
   if(phase==='idle')return;
   const stepTime=Math.min(0.05,Math.max(0,Number.isFinite(dt)?dt:0));
   if(phase==='meeting'){
    holdSeconds+=stepTime;
    if(held||holdSeconds<6)return;
    // Out through the door, down the steps, then home along the paving.
    routes.clear();
    members.forEach((actor,i)=>{
     actor.inside=false;actor.x=DOOR.x;actor.y=DOOR.y;actor.direction='down';
     const spot=meetingPlaces[actor.id];
     const home=plan({x:spot[0],y:spot[1]},homes.get(actor.id))||[];
     routes.set(actor.id,[{...STEPS},{x:spot[0],y:spot[1]},...home]);
     waits.set(actor.id,i*.5);
    });
    phase='returning';
   }
   let moving=false;
   for(const actor of members){
    const route=routes.get(actor.id);
    if(!route||actor.inside){actor.moving=false;continue}
    const wait=waits.get(actor.id)||0;
    if(wait>0){waits.set(actor.id,Math.max(0,wait-stepTime));actor.moving=false;moving=true;continue}
    if(stepAlong(actor,route,90*stepTime))moving=true;
    if(phase==='entering'&&!route.length){actor.inside=true;actor.moving=false}
   }
   const allDone=[...routes.values()].every(r=>r.length===0);
   if(phase==='outbound'&&!moving&&allDone){
    // Up the steps one after another, and in through the door.
    phase='entering';
    members.forEach((actor,i)=>{if(routes.has(actor.id)){routes.set(actor.id,[{...STEPS},{...DOOR}]);waits.set(actor.id,i*.6)}});
   }else if(phase==='entering'&&members.every(a=>!routes.has(a.id)||a.inside)){
    phase='meeting';holdSeconds=0;
   }else if(phase==='returning'&&!moving&&allDone){
    phase='idle';routes.clear();waits.clear();
   }
  }
  // Keep the team inside until the owner ends the meeting (Town Hall room).
  function keepMeeting(){if(phase==='idle')return false;held=true;return true}
  return Object.freeze({call,end,keepMeeting,tick,status:()=>phase,
   insideIds:()=>members.filter(a=>a.inside).map(a=>a.id)});
 }
 return Object.freeze({create,meetingPlaces,talkSpots,stagedEncounter,facingToward,DOOR,STEPS});
});
