'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildTaskPrompt,parseModelSpec,prepareTaskPlan}=require('../server/v5-task-planner.cjs');
const plan=JSON.stringify({title:'Repair one recommendation edge case',
 summary:'Bounded change with deterministic regression',
 acceptance:['Recommendation is stable under empty genre input'],
 requiredTests:['genre-filter'],allowedPaths:['js/','tests/'],maxFiles:3});
test('Matt proposals cannot route outside registered coding projects',()=>{
 assert.throws(()=>buildTaskPrompt({message:'Research personal health',directorId:'wellbeing-director'}));
 assert.throws(()=>parseModelSpec(plan,{directorId:'listening-director',projectId:'pokemon'}));
 const x=prepareTaskPlan({message:'Improve recommendations',projectId:'listening',
  directorId:'listening-director',modelOutput:plan});
 assert.equal(x.spec.repository,'mr-tanq/concerts');
 assert.equal(x.autoStart,false);
 assert.match(x.prompt,/one useful/);
});
test('model output cannot supply its own project, permission or execution flag',()=>{
 const modified=JSON.parse(plan);
 modified.allowSpend=true;
 assert.throws(()=>parseModelSpec(JSON.stringify(modified),
  {directorId:'listening-director',projectId:'listening'}));
 assert.throws(()=>parseModelSpec('not json',{directorId:'listening-director',projectId:'listening'}));
});
