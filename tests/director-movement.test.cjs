'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const navigation=require('../js/navigation.js');
const assembly=require('../js/director-movement.js');
const origins=[
 ['listening-director',1110,558],
 ['pokemon-director',385,665],
 ['wellbeing-director',1238,640],
 ['studio-director',822,861]
];
test('all four approved Director paths stay on the surveyed network',()=>{
 for(const [id,x,y] of origins){
  const from=navigation.snapToPath([x,y],25);
  const to=navigation.snapToPath(assembly.meetingPlaces[id],25);
  assert.ok(from&&to,id+' has mapped endpoints');
  const route=navigation.routeBetween(from,to);
  assert.ok(route.length>=2,id+' has a connected safe route');
  for(let i=1;i<route.length;i++)assert.ok(navigation.clearSegment(route[i-1],route[i]),id+' route avoids obstacle');
 }
});
test('visual-only gathering walks and returns without teleporting or simulating AI',()=>{
 const actors=origins.map(([id,x,y])=>({id,x,y,direction:'down',moving:false,walkDistance:14}));
 const instance=assembly.create(navigation,actors);
 assert.equal(instance.status(),'idle');
 assert.equal(instance.call(),true);
 assert.equal(instance.call(),false,'no overlapping meeting sessions');
 let changed=false;
 for(let t=0;t<8000&&instance.status()!=='idle';t++){
  const before=actors.map(a=>[a.x,a.y]);
  instance.tick(.05);
  actors.forEach((a,i)=>{
   const step=Math.hypot(a.x-before[i][0],a.y-before[i][1]);
   assert.ok(step<=4.501,'frame motion bounded without teleport');
   if(step>.1)changed=true;
  });
 }
 assert.ok(changed,'characters visibly walk');
 assert.equal(instance.status(),'idle','meeting and return finish');
 actors.forEach((a,i)=>assert.ok(Math.hypot(a.x-origins[i][1],a.y-origins[i][2])<.01, a.id+' returned'));
});
test('movement is only initiated by visible user control',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 const moduleText=fs.readFileSync(path.join(root,'js/director-movement.js'),'utf8');
 assert.match(html,/id="call-visual-meeting"/);
 assert.match(html,/director-movement\.js/);
 assert.match(js,/#call-visual-meeting/);
 assert.match(js,/directorAssembly\.call\(\)/);
 assert.doesNotMatch(moduleText,/fetch\(|localStorage|Copilot|approval\(/);
});
test('Town Hall v2: everyone climbs the steps, enters the real door, stays until the owner ends it',()=>{
 const actors=origins.map(([id,x,y])=>({id,x,y,direction:'down',moving:false,walkDistance:14}));
 const instance=assembly.create(navigation,actors);
 assert.equal(instance.call(),true);assert.equal(instance.keepMeeting(),true);
 for(let t=0;t<6000&&instance.status()!=='meeting';t++)instance.tick(.05);
 assert.equal(instance.status(),'meeting');
 actors.forEach(a=>{assert.equal(a.inside,true,a.id+' inside');
  assert.deepEqual([a.x,a.y],[assembly.DOOR.x,assembly.DOOR.y],a.id+' went through the real door')});
 for(let t=0;t<400;t++)instance.tick(.05);
 assert.equal(instance.status(),'meeting','held while the owner is in the room');
 assert.equal(instance.end(),true);
 for(let t=0;t<8000&&instance.status()!=='idle';t++)instance.tick(.05);
 assert.equal(instance.status(),'idle');
 actors.forEach((a,i)=>{assert.equal(a.inside,false);assert.ok(Math.hypot(a.x-origins[i][1],a.y-origins[i][2])<.01,a.id+' home')});
 // Door/steps sit on the Town Hall artwork, above the paving spots.
 for(const [x,y] of Object.values(assembly.meetingPlaces))assert.ok(navigation.snapToPath([x,y],25),'spot on paving');
 assert.ok(assembly.DOOR.y<assembly.STEPS.y);
});
