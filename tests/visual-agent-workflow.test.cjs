'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const visual=require('../js/visual-agent-workflow.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('No movement before verified Matt route',()=>{
 assert.equal(visual.project([]).travel,false);
 assert.equal(visual.project([{state:'created',actor:'matt'}]).travel,false);
});
test('Assigned job displays meeting and completed job triggers return',()=>{
 const stages=[{state:'routed',actor:'matt'},{state:'scoped',actor:'listening-director'}];
 assert.equal(visual.project(stages).travel,true);
 assert.equal(visual.project(stages).meeting,true);
 assert.equal(visual.project([...stages,{state:'reported',actor:'matt'}]).returning,true);
 assert.equal(visual.project([...stages,{state:'failed',actor:'matt'}]).failed,true);
});
test('Untrusted or unknown events cannot trigger journey',()=>{
 assert.equal(visual.project([{state:'routed',actor:'unknown'}]).travel,false);
 assert.equal(visual.project([{state:'deployed',actor:'matt'}]).travel,false);
});
test('Matt path traversal uses mapped navigation and proper sprite movement',()=>{
 const app=read('js/app.js');
 assert.match(app,/navigation\.routeBetween\(start,end\)/);
 assert.match(app,/agentJourney\.mode==='outbound'/);
 assert.match(app,/mattActor\.walkDistance\+=step/);
 assert.match(app,/setAgentWorkflowStage/);
 assert.doesNotMatch(app,/mattActor\.x=1125/);
});
test('Natural Matt message uses explicit consent and polls owned history without extra AI',()=>{
 const ui=read('js/world-dialogue.js');
 assert.match(ui,/runMattWorkflow\(text\)/);
 assert.match(ui,/mattJobHistory\(\)/);
 assert.match(ui,/requestId=id/);
 assert.match(ui,/window\.confirm\(/);
 assert.doesNotMatch(ui,/result\.workerReport,time/);
 assert.doesNotMatch(ui,/result\.directorReport,time/);
 const html=read('index.html');
 assert.ok(html.indexOf('js/visual-agent-workflow.js')<html.indexOf('js/app.js'));
});

test('Failure indication does not masquerade as successful Director meeting',()=>{
 const app=read('js/app.js'),ui=read('js/world-dialogue.js');
 assert.match(app,/function setAgentWorkflowFailure\(\)/);
 assert.match(app,/agentJourney\.failed=true/);
 assert.match(app,/⚠ Εργασία απέτυχε/);
 assert.match(ui,/setAgentWorkflowFailure\?\.\(\)/);
 assert.match(ui,/⚠ Η εργασία απέτυχε/);
 assert.ok(read('index.html').includes('js/app.js?v=61-director-journey'));
});

test('Matt walks to the real server-confirmed director and returns on surveyed paths',()=>{
 const app=read('js/app.js');
 const ui=read('js/world-dialogue.js');
 assert.match(app,/function startMattDirectorJourney\(directorId\)/);
 assert.match(app,/actors\.find\(a=>a\.id===directorId/);
 assert.match(app,/planMattRoute\(\[target\.x,target\.y\]\)/);
 assert.match(app,/agentJourney\.pendingReturn=true/);
 assert.match(app,/agentJourney\.mode='outbound'/);
 assert.match(app,/agentJourney\.mode==='meeting'&&agentJourney\.pendingReturn/);
 assert.match(app,/agentJourney\.mode='returning'/);
 assert.match(ui,/result\.delegated===true&&/);
 assert.match(ui,/startMattDirectorJourney\?\.\(result\.directorId\)/);
 assert.match(ui,/world-chat-journey/);
 assert.doesNotMatch(app,/planMattRoute\(\[1125,515\]\)/);
 const nav=require('../js/navigation.js');
 const targets=[[620,530],[475,580],[415,625]];
 const origin=nav.snapToPath([835,854],110);
 for(const target of targets){
  const end=nav.snapToPath(target,55);
  assert.ok(origin&&end,'director and Matt must have valid path anchors');
  const route=nav.routeBetween(origin,end);
  assert.ok(route.length>1,'Matt must be able to reach every non-sensitive Director');
  for(let i=1;i<route.length;i++)
   assert.ok(nav.clearSegment(route[i-1],route[i]),'route never cuts through buildings');
 }
});
