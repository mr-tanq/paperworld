'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const survey=require('../js/owner-path-survey.js');
const originalNav=require('../js/navigation.js');
const app=fs.readFileSync('js/app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
function components(){
 const adj=Array.from({length:survey.nodes.length},()=>[]);
 for(const [a,b] of survey.connections){adj[a].push(b);adj[b].push(a)}
 const seen=new Set(),groups=[];
 for(let i=0;i<adj.length;i++){
  if(seen.has(i))continue;
  const stack=[i],group=[];seen.add(i);
  while(stack.length){
   const at=stack.pop();group.push(at);
   for(const to of adj[at])if(!seen.has(to)){seen.add(to);stack.push(to)}
  }
  groups.push(group.sort((a,b)=>a-b));
 }
 return groups;
}
test('preserve exact owner-exported path survey counts and coordinates',()=>{
 assert.equal(survey.format,'paperworld-path-survey-v1');
 assert.deepEqual(survey.scene,{width:1671,height:941});
 assert.equal(survey.nodes.length,74);
 assert.equal(survey.connections.length,77);
 assert.equal(survey.hiddenConnections.length,7);
 assert.deepEqual(survey.nodes[0],[612,551]);
 assert.deepEqual(survey.nodes[70],[868,715]);
 assert.deepEqual(survey.nodes[73],[1446,752]);
 assert.deepEqual(survey.connections.at(-1),[72,11]);
 const keys=new Set(survey.connections.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(':')));
 for(const [a,b] of survey.hiddenConnections)assert.ok(keys.has([Math.min(a,b),Math.max(a,b)].join(':')));
});
test('owner survey is connected but three leaf spurs fail calibrated obstacle checks',()=>{
 const groups=components();
 assert.equal(groups.length,1);
 assert.equal(groups[0].length,74);
 for(const [a,b] of [[69,13],[70,7],[71,1]])assert.equal(originalNav.clearSegment(survey.nodes[a],survey.nodes[b]),false);
});
test('retain exact owner export as archive while live routes use repaired connected graph',()=>{
 assert.match(app,/nodes:window\.PaperworldNavigation\.nodes/);
 assert.match(app,/storageKey:'paperworld-operational-paths-owner-nov21-v3'/);
 assert.match(html,/owner-path-survey\\.js\\?v=20261121/);
 assert.ok(html.indexOf('owner-path-survey.js')<html.indexOf('navigation.js'));
 assert.ok(html.indexOf('navigation.js')<html.indexOf('js/app.js'));
 assert.equal(originalNav.safeConnections.length,originalNav.connections.length);
 assert.deepEqual(originalNav.nodes,survey.nodes.filter((_,i)=>!originalNav.operationalExcludedNodes.includes(i)));
 assert.deepEqual(originalNav.operationalExcludedNodes,[69,70,71]);
 assert.equal(originalNav.repairedConnections.length,0);
 assert.match(app,/navigation\.snapToPath/);
 assert.match(app,/navigation\.routeBetween/);
});
