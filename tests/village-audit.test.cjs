'use strict';
// Owner's audit (21/11): the village must show the truth and explain itself.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {statuses}=require('../js/resident-status.js');
const NOW=Date.parse('2026-11-21T20:00:00Z'),ago=h=>new Date(NOW-h*3600e3).toISOString();
test('bubbles use the planned title, never the raw "Νωρίτερα:" chat goal',()=>{
 const s=statuses([{id:'a',projectId:'pokemon',status:'working',title:'Έλεγχος sprite sheet',
  goal:'Νωρίτερα: Ποιο είναι το επόμενο βήμα;\nΤώρα: έλεγξε',updatedAt:ago(.5)}],NOW)['pokemon-director'];
 assert.equal(s.text,'Δουλεύει: Έλεγχος sprite sheet');
 const g=statuses([{id:'b',projectId:'pokemon',status:'working',goal:'Νωρίτερα: x\nΤώρα: δες τον χάρτη',updatedAt:ago(.5)}],NOW)['pokemon-director'];
 assert.doesNotMatch(g.text,/Νωρίτερα/);
});
test('a check that changed nothing is shown as done, not as "needs you"; details ride along',()=>{
 const s=statuses([{id:'c',projectId:'pokemon',status:'needs_you',lastError:'agent_no_changes',title:'Έλεγχος',updatedAt:ago(1)}],NOW)['pokemon-director'];
 assert.equal(s.tone,'done');assert.match(s.text,/τίποτα να αλλάξει/);
 assert.deepEqual({...s.detail},{missionId:'c',title:'Έλεγχος',status:'needs_you',lastError:'agent_no_changes'});
});
test('old or removed "needs you" items never come back as bubbles',()=>{
 const m={id:'d',projectId:'listening',status:'needs_you',lastError:'agent_files_out_of_scope',title:'x'};
 assert.ok(statuses([{...m,updatedAt:ago(2)}],NOW)['listening-director']);
 assert.equal(statuses([{...m,updatedAt:ago(30)}],NOW)['listening-director'],undefined,'older than a day');
 assert.equal(statuses([{...m,updatedAt:ago(2)}],NOW,['mission:d'])['listening-director'],undefined,'owner removed it');
 assert.match(fs.readFileSync('js/resident-feed.js','utf8'),/status\.statuses\(missions,Date\.now\(\),dismissed\)/);
});
test('tapping a Director with a bubble explains it, with a way to clear it; tapping a resident opens chat',()=>{
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/function residentNote\(id\)/);assert.match(ui,/'Δεν χρειάζεται πια'/);
 assert.match(ui,/autoGrow\(\);residentNote\(id\);/);
 const app=fs.readFileSync('js/app.js','utf8');
 assert.match(app,/const who=actors\.find\(a=>!a\.inside&&Math\.hypot/);
 assert.match(app,/onAgenda:\(\)=>window\.PaperworldWorkspace\?\.open\?\.\('work'\)/);
});
test('no placeholder star; tidy settings; focused memory page',()=>{
 assert.doesNotMatch(fs.readFileSync('js/workspace-interior.js','utf8'),/'★'/);
 assert.doesNotMatch(fs.readFileSync('js/town-hall-interior.js','utf8'),/textContent='★'/);
 const ws=fs.readFileSync('js/workspace.js','utf8');
 assert.match(ws,/Συνδεδεμένο μόνιμα/);assert.doesNotMatch(ws,/'Προσωρινή εξουσιοδότηση\. /);
 assert.match(fs.readFileSync('js/cloud-ui.js','utf8'),/pw-classic-focus/);
 assert.match(fs.readFileSync('messenger.css','utf8'),/@media \(pointer:coarse\)\{\.world-talk-actions\{display:none!important\}\}/);
});
