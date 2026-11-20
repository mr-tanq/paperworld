'use strict';
// Phase 2: residents show real work only; finished fixes say they are live.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {statuses}=require('../js/resident-status.js');
const activity=require('../js/village-activity.js');
const NOW=Date.parse('2026-11-20T18:00:00Z');
const at=h=>new Date(NOW-h*3600000).toISOString();
test('bubbles come only from real missions: needs you > working > just finished',()=>{
 const s=statuses([
  {projectId:'listening',status:'working',goal:'Διόρθωση εύρεσης συναυλιών',updatedAt:at(0.2)},
  {projectId:'listening',status:'completed',report:{merged:true,headStillCurrent:true},goal:'x',updatedAt:at(1)},
  {projectId:'pokemon',status:'needs_you',goal:'Μάχες',updatedAt:at(2)},
  {projectId:'pokemon',status:'working',goal:'Χάρτης',updatedAt:at(0.1)},
  {projectId:'studio',status:'completed',report:{merged:true,headStillCurrent:true},goal:'old',updatedAt:at(30)},
  {projectId:'wellbeing',status:'working',goal:'Πόνος στο γόνατο',updatedAt:at(0.1)}
 ],NOW);
 assert.deepEqual(s['listening-director'],{tone:'active',text:'Δουλεύει: Διόρθωση εύρεσης συναυλιών'});
 assert.deepEqual(s['pokemon-director'],{tone:'attention',text:'Χρειάζεται εσένα'});
 assert.equal(s['studio-director'],undefined,'finished work older than a day is not shown');
 assert.equal(s['wellbeing-director'].text,'Δουλεύει: κάτι προσωπικό','private topics never on the map');
 assert.ok(!JSON.stringify(s).includes('γόνατο'));
});
test('no records, simulations or unverified completions → no bubble',()=>{
 assert.deepEqual(statuses([],NOW),{});
 assert.deepEqual(statuses([{projectId:'listening',status:'working',goal:'x',simulation:true,updatedAt:at(0)}],NOW),{});
 assert.deepEqual(statuses([{projectId:'listening',status:'completed',report:{},goal:'x',updatedAt:at(0)}],NOW),{});
 assert.equal(statuses([{projectId:'listening',status:'completed',report:{merged:true},goal:'x',updatedAt:at(0)}],NOW)['listening-director'].text,'✓ Το φτιάξαμε');
});
test('work cards: merged fix says it is live and shows cause and fix',()=>{
 const report={headStillCurrent:true,requiredTests:['festival_discovery'],merged:true,
  prUrl:'https://github.com/mr-tanq/concerts/pull/11',cause:'Η πηγή άλλαξε μορφή.',fix:'Διαβάζουμε τη νέα μορφή.'};
 const v=activity.view({id:'1',projectId:'listening',status:'completed',goal:'Διόρθωση',report});
 assert.equal(v.resultNote,'Πέρασε τα tests και μπήκε ήδη στην εφαρμογή.');
 assert.equal(v.resultLabel,'Δες τι αλλάξαμε');
 assert.equal(v.cause,'Η πηγή άλλαξε μορφή.');assert.equal(v.fix,'Διαβάζουμε τη νέα μορφή.');
 const draft=activity.view({id:'2',projectId:'listening',status:'completed',goal:'D',report:{...report,merged:false}});
 assert.equal(draft.resultNote,'Η αλλαγή έχει ελεγχθεί, αλλά δεν έχει δημοσιευτεί.');
});
test('the map draws bubbles from the feed; feed is read-only and visibility-aware',()=>{
 const app=fs.readFileSync('js/app.js','utf8'),feed=fs.readFileSync('js/resident-feed.js','utf8');
 assert.match(app,/setResidentStatus:\(map\)=>/);
 assert.match(app,/for\(const a of actors\)if\(residentStatus\[a\.id\]\)drawResidentBubble\(a,residentStatus\[a\.id\]\);/);
 assert.match(feed,/listAutonomousMissions\(\)/);assert.match(feed,/document\.hidden/);
 assert.doesNotMatch(feed,/delegate|createAutonomousMission|askMatt|fetch\(/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('resident-status.js')<html.indexOf('js/app.js'));
 assert.match(html,/resident-feed\.js\?v=1/);
});
