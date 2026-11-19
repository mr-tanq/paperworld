'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {asksAboutVillage,teamSummary,makeMattTeamSnapshot}=require('../server/matt-team-snapshot.cjs');
const {makeDelegation,CONSENT}=require('../server/matt-delegation.cjs');
const {encode,recover}=require('../js/matt-history.js');
const OWNER='22222222-2222-4222-8222-222222222222';
const THREAD='11111111-1111-4111-8111-111111111111';
const REQUEST='33333333-3333-4333-8333-333333333333';
const HEADERS={origin:'https://mr-tanq.github.io',
 authorization:'Bearer '+('a'.repeat(24))};
const state={directors:[
 {projectId:'listening',active:1,attention:0,recent:[{status:'working',goal:'TicketSwap'}]},
 {projectId:'pokemon',active:0,attention:1,recent:[]},
 {projectId:'studio',active:0,attention:0,recent:[{status:'completed',result:{hasReport:true,existingTestsPassed:true}}]},
 {projectId:'wellbeing',active:0,attention:0,recent:[]}
]};
test('status intents include natural Greek questions but not build requests',()=>{
 for(const question of ['Τι κάνει η Luna;', 'Πώς πάνε οι εργασίες μας;',
 'Πού βρισκόμαστε με το Pokémon;', 'Τι έγινε με το TicketSwap;',
 'What is the status of the project?'])assert.equal(asksAboutVillage(question),true,question);
 for(const request of ['Πάμε','Φτιάξε το TicketSwap','Θέλω νέο τραγούδι',
 'Πώς φτιάχνουμε το Pokémon;', 'Πώς πάνε όλοι;'])
  assert.equal(asksAboutVillage(request),false,request);
});
test('team messages focus on relevant Director and never expose wellbeing goals',()=>{
 const msg=teamSummary(state,'Τι κάνει η Luna;');
 assert.match(msg,/Luna/);
 assert.doesNotMatch(msg,/Joey|Crow|Dave/);
 assert.match(teamSummary(state),/Joey/);
 const unsafe={directors:[...state.directors.slice(0,3),
  {projectId:'wellbeing',active:1,attention:0,recent:[{
   goal:'PRIVATE WELLBEING DETAILS',status:'working'}]}]};
 assert.doesNotMatch(teamSummary(unsafe),/PRIVATE WELLBEING DETAILS/);
});
test('owner-proven status question uses 0 AI turns and 0 OAuth or paid sessions',async()=>{
 const calls=[],saves=[];
 const handler=makeDelegation({
  oauth:{getLinkedToken:()=>{throw Error('GitHub OAuth should not run')}},
  clientFactory:async()=>{throw Error('Copilot should not run')},
  budgetVerified:async()=>{throw Error('AI budget should not run')},
  guard:{authenticate:async()=>({ownerId:OWNER}),ownsThread:async()=>true},
  teamSnapshot:{load:async owner=>{calls.push(owner);return state}},
  persistence:{save:async payload=>{saves.push(payload);return true}},
  memoryLoader:{load:async()=>{throw Error('No specialist memory read')}}
 });
 const reply=await handler.handle({headers:HEADERS,
  body:JSON.stringify({threadId:THREAD,requestId:REQUEST,
   message:'Τι κάνει η Luna;',targetDirector:'auto',consent:CONSENT})});
 assert.equal(reply.status,200,JSON.stringify(reply.body));
 assert.equal(reply.body.aiTurns,0);
 assert.equal(reply.body.execution,'status_only');
 assert.equal(reply.body.persisted,true);
 assert.deepEqual(calls,[OWNER]);
 assert.equal(saves[0].director,'matt');
 assert.match(reply.body.content,/Luna/);
 const denied=await handler.handle({headers:{...HEADERS,origin:'https://wrong.test'},
  body:JSON.stringify({threadId:THREAD,requestId:REQUEST,
   message:'Τι κάνει η Luna;',targetDirector:'auto',consent:CONSENT})});
 assert.equal(denied.status,403);
 assert.deepEqual(calls,[OWNER]);
});
test('Matt-only status history does not change Director context; notifications still ignored',()=>{
 const notes=[{role:'human',content:'Τι κάνει η ομάδα;'},
  {role:'agent',content:encode('matt','Η ομάδα ασχολείται με κάτι.')}];
 const result=recover(notes);
 assert.equal(result.activeDirector,null);
 assert.deepEqual(result.turns,[]);
 assert.equal(result.display[1].text,'Η ομάδα ασχολείται με κάτι.');
 const existing=encode('studio-director','Θέλεις πιο αργό ρυθμό;');
 const old=recover([{role:'human',content:'Ένα τραγούδι'},
  {role:'agent',content:existing}]);
 assert.equal(old.activeDirector,'studio-director');
});

test('completed status without evidence never claims implementation or verified success',()=>{
 const snapshot={directors:[{projectId:'studio',active:0,attention:0,recent:[
  {status:'completed',result:{hasReport:false,existingTestsPassed:false,applied:false}}
 ]}]};
 const unverified=teamSummary(snapshot);
 assert.match(unverified,/δεν έχω επαληθευμένο αποτέλεσμα/);
 assert.doesNotMatch(unverified,/έχει ολοκληρώσει μια εργασία|εφαρμόστηκε αλλαγή/);
 snapshot.directors[0].recent[0].result={hasReport:true,existingTestsPassed:true,applied:false};
 const report=teamSummary(snapshot);
 assert.match(report,/αναφορά για έλεγχο/);
 assert.match(report,/Δεν υπάρχει επιβεβαίωση/);
 assert.doesNotMatch(report,/η αλλαγή εφαρμόστηκε|το έργο ολοκληρώθηκε/);
});
