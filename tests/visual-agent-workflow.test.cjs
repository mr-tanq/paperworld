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
