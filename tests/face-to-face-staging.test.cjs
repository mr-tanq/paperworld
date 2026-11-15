'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const navigation=require('../js/navigation.js'),visual=require('../js/director-movement.js');
const actors=[
 {id:'listening-director',x:1125,y:515,direction:'down'},
 {id:'pokemon-director',x:385,y:665,direction:'down'},
 {id:'wellbeing-director',x:1240,y:690,direction:'down'},
 {id:'studio-director',x:835,y:854,direction:'down'}
];
test('all director talk positions are on mapped unobstructed sidewalks with breathing room',()=>{
 for(const actor of actors){
  const stage=visual.stagedEncounter(navigation,actor);
  assert.ok(stage,actor.id+' has a safe sidewalk staging point');
  assert.ok(stage.distance>=42&&stage.distance<=85,actor.id+' never overlaps visitor');
  assert.ok(navigation.clearSegment(stage.point,[actor.x,actor.y]),actor.id+' unobstructed sightline');
  const start=navigation.snapToPath([835,854],110),end=navigation.snapToPath(stage.point,2);
  const route=navigation.routeBetween(start,end);
  assert.ok(route.length>1,actor.id+' reachable from Matthew spawn');
  for(let i=1;i<route.length;i++)assert.ok(navigation.clearSegment(route[i-1],route[i]),actor.id+' walking remains collision-safe');
  const visitor={x:stage.point[0],y:stage.point[1]};
  assert.equal(stage.visitorFacing,visual.facingToward(visitor,actor),actor.id+' visitor faces Director');
  assert.equal(stage.directorFacing,visual.facingToward(actor,visitor),actor.id+' Director faces visitor');
 }
});
test('visual code turns both characters only after arrival and restores Director heading',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
 assert.match(src,/if\(!planMattEncounter\(target\)\)return false/);
 assert.match(src,/if\(target&&planMattEncounter\(target\)\)/);
 assert.match(src,/agentJourney\.meetingSince=now;startFaceToFace\(\)/);
 assert.match(src,/endFaceToFace\(\)/);
 assert.match(src,/director\.direction=agentJourney\.priorDirectorDirection/);
 assert.match(src,/actors\.find\(a=>a\.id===agentJourney\.meetingDirectorId\)/);
});
test('staging module does not authorize any new AI activity',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../js/director-movement.js'),'utf8');
 assert.doesNotMatch(src,/fetch\(|CopilotClient|delegateMatt\(/);
 assert.equal(visual.stagedEncounter(navigation,{id:'unknown',x:0,y:0}),null);
});
