'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {classify}=require('../js/routine-intent.js');
test('clear weekly Greek intent uses local Amsterdam time and the intended project',()=>{
 const p=classify('Κάθε Δευτέρα στις 09:00 έλεγχε το Listening Mirror');
 assert.equal(p.kind,'weekly_preview');
 assert.equal(p.projectId,'listening');
 assert.equal(p.dayOfWeek,1);
 assert.equal(p.hour,9);assert.equal(p.minute,0);
 assert.equal(p.timezone,'Europe/Amsterdam');
 assert.match(p.goal,/Listening Mirror/);
 assert.equal(classify('Κάθε Δευτέρα στις 09:00 UTC έλεγχε το Listening Mirror').timezone,'UTC');
 assert.equal(classify('Κάθε Παρασκευή στις 8 μ.μ. δες το Lost Wanderer').hour,20);
});
test('all registered projects and weekday spellings work',()=>{
 for(const [str,project,day] of [
  ['Κάθε Τρίτη 11:30 κάνε έλεγχο Pokémon Echoes','pokemon',2],
  ['Every Friday 20:15 review Lost Wanderer','studio',5],
  ['Κάθε Κυριακή στις 08:45 έλεγχε την ευεξία','wellbeing',0],
  ['Κάθε Σάββατο στις 07:05 δες τις συναυλίες','listening',6]
 ]){
  const p=classify(str);assert.equal(p.kind,'weekly_preview',str);
  assert.equal(p.projectId,project,str);
  assert.equal(p.dayOfWeek,day,str);
 }
});
test('ambiguous schedules ask for clarification instead of guessing',()=>{
 for(const message of [
  'Κάθε Δευτέρα 09:00 κάνε κάτι',
  'Κάθε Δευτέρα 09:00 έλεγχε Listening Mirror και Pokémon',
  'Κάθε μέρα έλεγχε το Listening Mirror',
  'Κάθε Δευτέρα 30:00 έλεγχε το Listening Mirror'
 ]){
  assert.equal(classify(message).kind,'clarify',message);
 }
 assert.equal(classify('Άλλαξε το πρόγραμμα').kind,'list_routines');
});
test('ordinary messages never trigger a weekly routine or a model-free interception',()=>{
 for(const message of ['Πώς πάει το Listening Mirror;',
  'Έχω συναυλία τη Δευτέρα','Καλημέρα Matt','']){
  assert.equal(classify(message),null);
 }
});
test('Messenger only requests preview until explicit owner confirmation',()=>{
 const s=fs.readFileSync(require.resolve('../js/world-dialogue.js'),'utf8');
 const cloud=fs.readFileSync(require.resolve('../js/cloud.js'),'utf8');
 const shell=fs.readFileSync(require.resolve('../js/cloud-ui.js'),'utf8');
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 assert.match(s,/const routineIntent=window\.PaperworldRoutineIntent\?\.classify\?\.\(text\)/);
 assert.match(s,/if\(routineIntent\)\{[\s\S]{0,90}await previewMattRoutine\(routineIntent\)/);
 assert.match(s,/await cloudClient\.previewRoutine\(plan\)/);
 assert.match(s,/confirm\.addEventListener\('click',async\(\)=>\{/);
 assert.match(s,/await cloudClient\.createRoutine\(routineRequest\)/);
 assert.match(s,/enable\.addEventListener\('click',async\(\)=>\{/);
 assert.match(s,/await cloudClient\.changeRoutine\(saved\.routineId,true\)/);
 assert.match(s,/Δεν δημιουργήθηκε καμία ρουτίνα/);
 assert.match(cloud,/async function routineAction\(action,details=\{\}\)/);
 assert.match(cloud,/confirmed:true/);
 assert.match(cloud,/result\.enabled!==false/);
 assert.match(shell,/previewRoutine:plan=>client\.previewRoutine\(plan\)/);
 assert.match(html,/routine-intent\.js\?v=release-1/);
 assert.match(html,/world-dialogue\.js\?v=[^"]*routine-v4/);
});

test('show routines intent and pause stay model-free and owner-click-only',()=>{
 const intent=classify('Δείξε μου τις ρουτίνες');
 assert.equal(intent.kind,'list_routines');
 assert.equal(classify('Σταμάτα τα προγράμματα μου').kind,'list_routines');
 const js=fs.readFileSync(require.resolve('../js/world-dialogue.js'),'utf8');
 const cloud=fs.readFileSync(require.resolve('../js/cloud.js'),'utf8');
 assert.match(js,/if\(routineIntent\.kind==='list_routines'\)await listMattRoutines\(\)/);
 assert.match(js,/await cloud\(\)\.listRoutines\(\)/);
 assert.match(js,/pause\.addEventListener\('click',async\(\)=>/);
 assert.match(js,/await cloud\(\)\.changeRoutine\(r\.id,false\)/);
 assert.match(cloud,/async function listRoutines\(\)/);
 assert.match(cloud,/result\.routines\.length>30/);
});
