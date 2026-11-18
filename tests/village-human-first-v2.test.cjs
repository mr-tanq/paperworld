'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const activity=require('../js/village-activity.js');
const read=path=>fs.readFileSync(path,'utf8');
test('user sees verified, human-readable status for every Director',()=>{
 for(const projectId of ['listening','pokemon','studio','wellbeing']){
  const item=activity.view({id:'safe',projectId,goal:'Βελτίωση εφαρμογής',
   status:'working'});
  assert.equal(item.stage,'active');assert.equal(item.resultLink,null);
  assert.doesNotMatch(item.message,/API|PR|SHA|worker|database|JSON/i);
 }
 assert.equal(activity.view({projectId:'listening',goal:'Στόχος',status:'paused_budget'}).stage,'waiting');
 assert.equal(activity.view({projectId:'studio',goal:'Στόχος',status:'needs_you'}).stage,'attention');
});
test('only verified completed PR results are linked, not fake execution',()=>{
 const source={projectId:'listening',id:'a',goal:'Fix',status:'completed'};
 assert.equal(activity.view(source).resultLink,null);
 assert.equal(activity.view({...source,report:{prUrl:'https://github.com/mr-tanq/concerts/pull/9',
  headStillCurrent:true,requiredTests:['festival_revisit']}}).resultLink,
  'https://github.com/mr-tanq/concerts/pull/9');
 for(const unsafe of [
  'https://github.com/other/concerts/pull/9',
  'https://github.com/mr-tanq/concerts/issues/9',
  'https://github.com/mr-tanq/concerts/pull/9?token=x',
  'https://github.com.evil.test/mr-tanq/concerts/pull/9'
 ])assert.equal(activity.safeUrl(unsafe),null);
 const simulated=activity.view({...source,simulation:true,report:{
  prUrl:'https://github.com/mr-tanq/concerts/pull/9',
  headStillCurrent:true,requiredTests:['one']}});
 assert.equal(simulated.resultLink,null);
});
test('maintenance controls are visually hidden, without removing live implementation or approvals',()=>{
 const html=read('index.html'),ui=read('js/cloud-ui.js'),dialogue=read('js/world-dialogue.js');
 assert.match(html,/data-paperworld-maintenance/);
 for(const name of ['#path-editor-toggle','#building-placement-toggle',
  '#depth-demo','#walkway-overlay','.dev-tools','.crow-technical-tools'])
  assert.ok(html.includes(name),name);
 assert.match(ui,/PaperworldVillageActivity/);
 assert.match(ui,/Τι κάνει η ομάδα/);
 assert.doesNotMatch(ui,/Πρώτη πραγματική δοκιμή Copilot/);
 assert.doesNotMatch(ui,/Δοκιμή υποδομής · χωρίς AI/);
 assert.match(dialogue,/Έλεγχοι σύνδεσης για συντήρηση/);
 assert.match(dialogue,/window\.confirm\(consent\)/);
 assert.match(dialogue,/requiresSeparateConsent===true/);
});
test('Matt uses colleague-like language in both queued task and normal conversations',()=>{
 const server=read('server/matt-delegation.cjs');
 assert.match(server,/Speak as a trusted colleague/);
 assert.match(server,/Το ανέλαβε/);
 assert.match(server,/Δεν θα δημοσιεύσω αλλαγές χωρίς εσένα/);
});
