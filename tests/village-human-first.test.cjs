'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {view,summary,safeUrl}=require('../js/village-activity.js');
const baseline={id:'a',projectId:'listening',goal:'Να διορθώσουμε την ενημέρωση εισιτηρίων',status:'working'};
test('one natural status language across projects without pretending to execute',()=>{
 const scenarios=[
  ['listening','working','Luna','active'],
  ['pokemon','queued','Joey','active'],
  ['studio','draft','Crow','waiting'],
  ['wellbeing','needs_you','Dave','attention']
 ];
 for(const [projectId,status,person,stage] of scenarios){
  const r=view({...baseline,projectId,status});
  assert.equal(r.person,person);assert.equal(r.stage,stage);
  assert.doesNotMatch(r.message,/SHA|workflow|API|PR|JSON|HTTP|queue/i);
 }
});
test('verified result may link only to exact trusted project pull request',()=>{
 const result={...baseline,status:'completed',report:{
  prUrl:'https://github.com/mr-tanq/concerts/pull/9',
  headStillCurrent:true,requiredTests:['festival_revisit']}};
 assert.equal(view(result).resultLink,result.report.prUrl);
 assert.equal(view({...result,report:{...result.report,headStillCurrent:false}}).resultLink,null);
 assert.equal(view({...result,report:{...result.report,prUrl:'https://evil.example/pull/9'}}).resultLink,null);
 assert.equal(view({...result,simulation:true}).resultLink,null);
 assert.equal(view({...result,projectId:'pokemon'}).resultLink,null);
 assert.match(view({...result,report:null}).message,/Δεν υπάρχει εδώ επαληθευμένο αποτέλεσμα/);
 assert.equal(safeUrl('https://github.com/mr-tanq/concerts/pull/9?token=secret'),null);
 assert.equal(safeUrl('https://github.com/mr-tanq/concerts/pull/9'),result.report.prUrl);
});
test('unknown status and unsafe records cannot become visible completion',()=>{
 assert.equal(view({...baseline,status:'invented'}),null);
 assert.equal(view({...baseline,projectId:'other'}),null);
 assert.equal(view({...baseline,goal:''}),null);
 assert.deepEqual(summary([{...baseline,status:'working'},
  {...baseline,status:'completed'},
  {...baseline,status:'needs_you'}]).active,1);
});
test('ordinary UI contains no visible maintenance launchers or developer mission forms',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const cloud=fs.readFileSync('js/cloud-ui.js','utf8');
 assert.match(html,/html:not\(\[data-paperworld-maintenance="yes"\]\) #path-editor-toggle/);
 assert.match(html,/village-activity\.js/);
 assert.match(cloud,/function renderAutonomousMissions/);
 const missionPanel=cloud.split('function renderAutonomousMissions(target){')[1]
  .split('function renderHumanWork(target){')[0];
 assert.doesNotMatch(missionPanel,/simulateAutonomousMission|launchCopilotPilot|autonomousMissions\.create|<select|renderTechnical/);
 assert.match(missionPanel,/item\.resultLink/);
});
