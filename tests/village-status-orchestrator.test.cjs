'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {asksAboutVillage,briefing,createVillageStatus}=require('../server/village-status.cjs');
const {makeDelegation}=require('../server/matt-delegation.cjs');
const {encode,recover}=require('../js/matt-history.js');
const OWNER='11111111-1111-4111-8111-111111111111';
const THREAD='22222222-2222-4222-8222-222222222222';
const REQ='33333333-3333-4333-8333-333333333333';
const HEADERS={origin:'https://mr-tanq.github.io',authorization:'Bearer '+('a'.repeat(24))};
function input(message){return JSON.stringify({threadId:THREAD,requestId:REQ,message,
 targetDirector:'auto',consent:'MATT_DIRECTOR_UP_TO_THREE_AI_TURNS'});}
test('natural questions ask about the real team; ordinary requests stay routed normally',()=>{
 for(const msg of ['Τι κάνει η Luna;','Πώς πάνε οι εργασίες μας;','Πού βρισκόμαστε με το Pokémon;',
 'Τι έγινε με το TicketSwap;', 'What is the status of the project?'])
  assert.equal(asksAboutVillage(msg),true,msg);
 for(const msg of ['Φτιάξε το TicketSwap','Γράψε μου ένα τραγούδι Crow',
  'Πάμε', 'Πώς φτιάχνουμε ένα παιχνίδι;', 'Έχω πόνο στη μέση'])
  assert.equal(asksAboutVillage(msg),false,msg);
});
test('trusted read is strictly owner- and Matt-thread-scoped with no POST or paid side effects',async()=>{
 let url,method,headers;
 const status=createVillageStatus({secret:'sb_secret_synthetic_test_key_not_real',
  fetcher:async(u,opt)=>{url=u;method=opt.method;headers=opt.headers;
   return {ok:true,json:async()=>[{project_id:'listening',goal:'Bug fix',status:'working'}]}}});
 const answer=await status.read({ownerId:OWNER,threadId:THREAD});
 assert.match(answer,/Luna/);assert.equal(method,'GET');
 assert.ok(url.includes('owner_id=eq.'));assert.ok(url.includes('thread_id=eq.'));
 assert.ok(url.includes(OWNER));assert.ok(url.includes(THREAD));
 assert.equal(headers.apikey,'sb_secret_synthetic_test_key_not_real');
 assert.equal(await status.read({ownerId:'invalid',threadId:THREAD}),null);
});
test('no unverified coding success or private wellbeing goal gets revealed',()=>{
 const msg=briefing([{project_id:'wellbeing',goal:'VERY PRIVATE HEALTH DETAIL',
  status:'working'},{project_id:'listening',status:'completed',goal:'Fix',
  report:{headStillCurrent:false,prUrl:'https://github.com/mr-tanq/concerts/pull/9',
   requiredTests:['a']}}]);
 assert.match(msg,/Dave/);assert.doesNotMatch(msg,/VERY PRIVATE HEALTH DETAIL/);
 assert.doesNotMatch(msg,/έχει ετοιμάσει και ελέγξει μια αλλαγή/);
});
test('Matt status reply uses zero model turns, no GitHub token, no billing and is saved',async()=>{
 const saved=[];let modelCalls=0,oauthCalls=0;
 const delegate=makeDelegation({
  oauth:{getLinkedToken:()=>{oauthCalls++;return null}},
  clientFactory:async()=>{modelCalls++;throw Error('model must not start')},
  guard:{authenticate:async()=>({ownerId:OWNER}),
   ownsThread:async()=>true},
  memoryLoader:{load:async()=>{throw Error('no memory needed')}},
  persistence:{save:async x=>{saved.push(x);return true}},
  handoffLedger:{record:async()=>{throw Error('no handoff needed')}},
  taskIntake:{available:async()=>{throw Error('no coding task needed')}},
  villageStatus:{read:async()=> 'Η Luna δουλεύει σε μία εργασία.'},
  budgetVerified:async()=>{throw Error('no model budget needed')}
 });
 const result=await delegate.handle({headers:HEADERS,body:input('Τι κάνει η ομάδα;')});
 assert.equal(result.status,200);
 assert.equal(result.body.aiTurns,0);
 assert.equal(result.body.delegated,false);
 assert.equal(result.body.execution,'status_only');
 assert.equal(saved[0].director,'matt');assert.equal(modelCalls,0);assert.equal(oauthCalls,0);
 const invalid=await delegate.handle({headers:{...HEADERS,origin:'https://fake.test'},
  body:input('Τι κάνει η ομάδα;')});
 assert.equal(invalid.status,403);
});
test('saved Matt-only status never becomes a Director or contaminates follow-up routing',()=>{
 const history=recover([{role:'human',content:'Τι κάνει η ομάδα;'},
  {role:'agent',content:encode('matt','Η ομάδα εργάζεται.')}]);
 assert.equal(history.activeDirector,null);
 assert.deepEqual(history.turns,[]);
 assert.equal(history.display[1].text,'Η ομάδα εργάζεται.');
});
