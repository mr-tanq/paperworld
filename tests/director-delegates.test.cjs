'use strict';
// Luna/Joey can hand code work to their Developer from a direct chat; the
// mission goes through the same Task Engine and is reported by Matt.
const test=require('node:test'),assert=require('node:assert/strict');
const {makeDirectorChat,ownerGoal,CONSENT}=require('../server/director-direct-chat.cjs');
const owner='11111111-1111-4111-8111-111111111111',thread='22222222-2222-4222-8222-222222222222';
const mattThread='44444444-4444-4444-8444-444444444444',id='33333333-3333-4333-8333-333333333333';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer aaa.bbb.fake12345678'};
function setup({agentId='listening-director',available=true,reply='Θα το δώσω στον Developer να το ψάξει.\nSTART_DEVELOPER_TASK',
 submitState='queued',mattThreadId=mattThread}={}){
 const seen={prompts:[],submits:[]};
 const api=makeDirectorChat({
  oauth:{getLinkedToken:()=>'gho_TEST123456789'},
  guard:{authenticate:async()=>({ownerId:owner}),ownsThread:async()=>true},
  memoryLoader:{load:async a=>({actor:a.actor,projectId:agentId==='listening-director'?'workshop':
   agentId==='pokemon-director'?'pokemon':'studio',text:'notes',included:1,capabilitiesGranted:[],untrustedContent:true})},
  threadRecall:{load:async()=>({text:'User: Νομίζω έχουμε πρόβλημα στην εύρεση συναυλιών\nPrior agent: Δεν μπορώ να στείλω μήνυμα στον developer ούτε να εκτελέσω ελέγχους.',messageCount:2})},
  replyPersistence:{save:async a=>{seen.saved=a.content;return true}},
  budgetVerified:()=>true,
  taskIntake:{available:async()=>available,submit:async a=>{seen.submits.push(a);
   return {state:submitState,missionId:a.requestId,title:'Διόρθωση εύρεσης συναυλιών'}}},
  mattThreadLookup:async()=>mattThreadId,
  clientFactory:async()=>({start:async()=>{},stop:async()=>{},
   listModels:async()=>[{id:'m',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1000}}}],
   createSession:async()=>({sendAndWait:async({prompt})=>{seen.prompts.push(prompt);
    return {data:{content:seen.prompts.length===1?reply:'{"title":"x"}'}}},disconnect:async()=>{}})})
 });
 const run=(message='μπορείς όμως να ρωτήσεις τον developer σου να το κοιτάξει;')=>api.handle({headers,
  body:JSON.stringify({agentId,threadId:thread,requestId:id,message,consent:CONSENT})});
 return {run,seen};
}
test('asked to involve the developer: Luna hands it over and Matt will report back',async()=>{
 const {run,seen}=setup();const r=await run();
 assert.equal(r.status,200);assert.equal(r.body.execution,'task_queued');assert.equal(r.body.aiTurns,2);
 assert.match(seen.prompts[0],/You CAN hand real code work to your Developer/);
 assert.doesNotMatch(r.body.content,/START_DEVELOPER_TASK/);
 assert.match(r.body.content,/Το ανέθεσα στον Developer: «Διόρθωση εύρεσης συναυλιών»/);
 assert.equal(seen.submits.length,1);
 const s=seen.submits[0];
 assert.equal(s.threadId,mattThread,'mission lives in the Matt thread so Matt reports it');
 assert.equal(s.directorId,'listening-director');assert.equal(s.requestId,id);
 assert.match(s.message,/πρόβλημα στην εύρεση συναυλιών/,'short follow-ups carry the conversation context');
 assert.doesNotMatch(s.message,/Δεν μπορώ να στείλω/,'never the Director\'s own words');
 assert.match(seen.prompts[1],/bounded coding-task planner/);
 assert.match(seen.saved,/Το ανέθεσα στον Developer/);
});
test('no marker → plain advice, no task, one AI turn',async()=>{
 const {run,seen}=setup({reply:'Οι συναυλίες στην Αθήνα αυτόν τον μήνα…'});const r=await run('Τι συναυλίες έχει;');
 assert.equal(r.body.execution,'chat_only');assert.equal(r.body.aiTurns,1);assert.equal(seen.submits.length,0);
});
test('Crow and Dave never delegate; engine off keeps the old honest wording',async()=>{
 const crow=setup({agentId:'studio-director'});const r=await crow.run();
 assert.equal(crow.seen.submits.length,0);assert.match(crow.seen.prompts[0],/you CANNOT execute tools/);
 const off=setup({available:false});await off.run();
 assert.equal(off.seen.submits.length,0);assert.match(off.seen.prompts[0],/you CANNOT execute tools/);
});
test('handoff failure is said plainly and never claimed as started',async()=>{
 const {run,seen}=setup({mattThreadId:null});const r=await run();
 assert.equal(r.body.execution,'chat_only');assert.equal(seen.submits.length,0);
 assert.match(r.body.content,/Δεν μπόρεσα να το αναθέσω στον Developer/);
 assert.doesNotMatch(r.body.content,/Το ανέθεσα/);
});
test('the Developer brief is the owner\'s own words, never the Director\'s replies or half messages',()=>{
 const prev='User: Δεν βρίσκει συναυλίες στην Αθήνα\nPrior agent: Δεν μπορώ να στείλω μήνυμα στον developer.\nΠες μου ένα παράδειγμα.\nUser: π.χ. τον Δεκέμβριο';
 const g=ownerGoal(prev,'ρώτα τον developer');
 assert.equal(g,'Νωρίτερα: Δεν βρίσκει συναυλίες στην Αθήνα / π.χ. τον Δεκέμβριο\nΤώρα: ρώτα τον developer');
 assert.doesNotMatch(g,/Δεν μπορώ/);
 assert.equal(ownerGoal('', 'x'.repeat(250)).length,250);
 assert.ok(ownerGoal(('User: '+'α'.repeat(500)+'\n').repeat(6),'κοίτα το').length<=1200);
});
