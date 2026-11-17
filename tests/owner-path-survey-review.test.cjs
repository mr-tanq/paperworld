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
 assert.equal(survey.nodes.length,85);
 assert.equal(survey.connections.length,82);
 assert.equal(survey.hiddenConnections.length,17);
 assert.deepEqual(survey.nodes[0],[612,551]);
 assert.deepEqual(survey.nodes[83],[884,731]);
 assert.deepEqual(survey.nodes[84],[23,439]);
 assert.deepEqual(survey.connections.at(-1),[81,82]);
 const keys=new Set(survey.connections.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(':')));
 for(const [a,b] of survey.hiddenConnections)assert.ok(keys.has([Math.min(a,b),Math.max(a,b)].join(':')));
});
test('flag disconnected branches instead of inventing routes',()=>{
 const groups=components();
 assert.equal(groups.length,7);
 assert.deepEqual(groups.map(g=>g.length).sort((a,b)=>b-a),[75,5,1,1,1,1,1]);
 assert.deepEqual(groups.filter(g=>g.length===1).map(g=>g[0]).sort((a,b)=>a-b),[46,47,48,83,84]);
 assert.ok(groups.some(g=>g.join(',')==='78,79,80,81,82'));
 assert.match(app,/pathDisconnectedComponents/);
 assert.match(app,/ασύνδετα τμήματα/);
});
test('retain exact owner export as archive while live routes use repaired connected graph',()=>{
 assert.match(app,/nodes:window\.PaperworldNavigation\.nodes/);
 assert.match(app,/storageKey:'paperworld-operational-paths-studio-only-v2'/);
 assert.match(html,/owner-path-survey\.js\?v=20261117/);
 assert.ok(html.indexOf('owner-path-survey.js')<html.indexOf('navigation.js'));
 assert.ok(html.indexOf('navigation.js')<html.indexOf('js/app.js'));
 assert.equal(originalNav.safeConnections.length,originalNav.connections.length);
 assert.deepEqual(originalNav.nodes,survey.nodes.filter((_,i)=>!originalNav.operationalExcludedNodes.includes(i)));
 assert.deepEqual(originalNav.operationalExcludedNodes,[43,44,45,46,47,48,49,50,51,52,53,54,55,78,79,80,81,82,83,84]);
 assert.equal(originalNav.repairedConnections.length,0);
 assert.match(app,/navigation\.snapToPath/);
 assert.match(app,/navigation\.routeBetween/);
});
