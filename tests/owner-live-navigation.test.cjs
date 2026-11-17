'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const navigation=require('../js/navigation.js');
const survey=require('../js/owner-path-survey.js');
const movement=require('../js/director-movement.js');
const villageLife=require('../js/village-life.js');
const app=fs.readFileSync('js/app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const homes={
 'listening-director':[1110,558],
 'pokemon-director':[385,665],
 'wellbeing-director':[1238,640],
 'studio-director':[822,861]
};
test('Studio-only hidden walkway leaves one fully connected public network',()=>{
 assert.equal(survey.nodes.length,85,'preserve owner export intact');
 assert.equal(navigation.nodes.length,65,'remove the right bypass and stray markers');
 assert.deepEqual(navigation.operationalExcludedNodes,[43,44,45,46,47,48,49,50,51,52,53,54,55,78,79,80,81,82,83,84]);
 assert.deepEqual(navigation.repairedConnections,[]);
 assert.equal(navigation.connections.length,68);
 assert.equal(navigation.hiddenConnections.length,7);
 assert.deepEqual(navigation.hiddenConnections,[[16,37],[37,38],[38,39],[39,40],[40,41],[41,42],[42,28]]);
 assert.equal(navigation.safeConnections.length,navigation.connections.length);
 for(let i=0;i<navigation.nodes.length;i++){
  const route=navigation.findRoute(7,i);
  assert.ok(route.length>0,'node '+i+' reachable');
  for(let j=1;j<route.length;j++)
   assert.ok(navigation.clearSegment(route[j-1],route[j]),'node '+i+' avoids buildings');
 }
});
test('walking and meeting homes are on the graph and all Directors can make a safe visit',()=>{
 const actors=Object.entries(homes).map(([id,p])=>({id,x:p[0],y:p[1],direction:'down',moving:false,walkDistance:14}));
 for(const actor of actors){
  const home=navigation.snapToPath([actor.x,actor.y],1);
  assert.ok(home&&home.distance<.01,'exact home path '+actor.id);
  const encounter=movement.stagedEncounter(navigation,actor);
  assert.ok(encounter,'face-to-face route to '+actor.id);
  const start=navigation.snapToPath([822,861],2);
  const end=navigation.snapToPath(encounter.point,2);
  const path=navigation.routeBetween(start,end);
  assert.ok(path.length>=2,'Matt can meet '+actor.id);
  for(let i=1;i<path.length;i++)
   assert.ok(navigation.clearSegment(path[i-1],path[i]),'safe face-to-face route '+actor.id);
 }
 const assembly=movement.create(navigation,actors);
 assert.ok(assembly.call(),'meeting should start');
 for(let i=0;i<10000&&assembly.status()!=='idle';i++)assembly.tick(.05);
 assert.equal(assembly.status(),'idle','meeting returns all Directors home');
 actors.forEach(a=>assert.ok(Math.hypot(a.x-homes[a.id][0],a.y-homes[a.id][1])<1));
 const village=villageLife.create(navigation,actors,()=>.2);
 for(let i=0;i<500;i++)village.tick(.05);
 village.recallAll();
 for(let i=0;i<5000&&!village.ready();i++)village.tick(.05);
 assert.equal(village.ready(),true,'ambient Directors can return home');
});
test('owner route overlay and live graph use same network, with browser load order',()=>{
 assert.ok(html.indexOf('owner-path-survey.js')<html.indexOf('navigation.js'));
 assert.ok(html.indexOf('navigation.js')<html.indexOf('js/app.js'));
 assert.match(app,/nodes:window\.PaperworldNavigation\.nodes/);
 assert.match(app,/connections:window\.PaperworldNavigation\.connections/);
 assert.match(app,/paperworld-operational-paths-studio-only-v2/);
 for(const point of ['1110,558','1238,640','822,861'])assert.ok(app.includes(point));
 assert.match(app,/navigation\.routeBetween\(start,destination\)/);
});
