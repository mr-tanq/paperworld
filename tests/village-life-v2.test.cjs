'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),nav=require('../js/navigation.js');
const life=require('../js/village-life.js');
const home=[
 ['listening-director',1110,558],['pokemon-director',385,665],
 ['wellbeing-director',1238,640],['studio-director',822,861]
];
const actors=()=>home.map(([id,x,y])=>({id,x,y,direction:'down',walkDistance:14,moving:false}));
test('Natural life roams at bounded speed along only approved sidewalk links',()=>{
 const people=actors(),v=life.create(nav,people,()=>0.35);
 let moved=false;
 for(let i=0;i<1100;i++){
  const before=people.map(a=>({x:a.x,y:a.y}));
  v.tick(0.05);
  for(let j=0;j<people.length;j++){
   const now=people[j],prev=before[j],d=Math.hypot(now.x-prev.x,now.y-prev.y);
   assert.ok(d<=life.SPEED*.05+.002,now.id+' never teleports');
   assert.ok(nav.snapToPath([now.x,now.y],.7),now.id+' stays on approved paving');
   if(d>.01){assert.ok(nav.clearSegment([prev.x,prev.y],[now.x,now.y]),now.id+' avoids obstacles');moved=true}
  }
 }
 assert.ok(moved,'ambient Directors actually wander, rather than just idle');
 v.recallAll();
 for(let i=0;i<2500&&!v.ready();i++)v.tick(.05);
 assert.ok(v.ready(),'all directors safely return home for real work');
 people.forEach((a,i)=>assert.ok(Math.hypot(a.x-home[i][1],a.y-home[i][2])<1.5,a.id+' at home'));
 assert.ok(v.resume());
});
test('Ambient life stops when real work or a visual assembly takes priority',()=>{
 const people=actors(),v=life.create(nav,people,()=>0.4);
 v.recallAll();
 assert.equal(v.isSuspended(),true);
 assert.equal(v.ready(),true);
 v.tick(.05,{allowRoaming:false});
 assert.equal(v.greetings().length,0);
 assert.ok(v.resume());
 const before=people.map(a=>[a.x,a.y]);
 for(let i=0;i<120;i++)v.tick(.05,{allowRoaming:false});
 people.forEach((a,i)=>assert.deepEqual([a.x,a.y],before[i],'assembly owns motion; no ambient teleport'));
});
test('Matt report is face-to-face with human at normal speed; greetings stay illustrative',()=>{
 const a=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'../js/world-dialogue.js'),'utf8');
 assert.match(a,/speed=105\*dt/);
 assert.doesNotMatch(a,/speed=260\*dt/);
 assert.match(a,/function chooseReportSpot\(\)/);
 assert.match(a,/function startReportPose\(now\)/);
 assert.match(a,/player\.direction=directorMovement\.facingToward\(player,mattActor,player.direction\)/);
 assert.match(a,/mattActor\.direction=directorMovement\.facingToward\(mattActor,player,mattActor.direction\)/);
 assert.match(a,/agentJourney\.mode==='reporting'/);
 assert.match(a,/endReportPose\(\)/);
 assert.match(a,/villageLife\.recallAll\(\)/);
 assert.match(a,/villageLife\.greetings\(\)/);
 assert.match(a,/function idleBob\(a\)/);
 assert.match(ui,/setTimeout\(resolve,90000\)/);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(html.indexOf('js/village-life.js')<html.indexOf('js/app.js'),'life loads before renderer');
 const visual=fs.readFileSync(path.join(__dirname,'../js/village-life.js'),'utf8');
 assert.doesNotMatch(visual,/fetch\(|CopilotClient|delegateMatt\(|localStorage/);
});
