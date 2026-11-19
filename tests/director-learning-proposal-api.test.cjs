'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeLearningProposalApi}=require('../server/director-learning-proposal-api.cjs');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const messageId='33333333-3333-4333-8333-333333333333';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer '+'a'.repeat(24)};
const payload={actor:'listening-director',threadId,messageId,
 title:'Use real concert imagery',kind:'preference',sensitivity:'private'};
const saved={id:messageId,thread_id:threadId,role:'human',
 content:'Να βάζεις πραγματικές φωτογραφίες των καλλιτεχνών.',
 created_at:'2026-11-19T00:00:00Z'};
function setup({owns=true,rows=[saved],persist=true}={}){
 const calls=[],savedProposals=[];
 const api=makeLearningProposalApi({
  identity:{authenticate:async()=>({ownerId}),ownsThread:async()=>owns},
  fetcher:async(url,options)=>{calls.push({url,options});
   return {ok:true,json:async()=>rows}},
  store:{propose:async args=>{savedProposals.push(args);
   if(!persist)throw Error('storage');
   return {id:args.entry.id,status:'proposed',projectId:args.entry.projectId}}}
 });
 return {api,calls,savedProposals};
}
test('only verified owner human message becomes a private, pending project proposal',async()=>{
 const {api,calls,savedProposals}=setup();
 const response=await api.handle({headers,body:JSON.stringify(payload)});
 assert.equal(response.status,201);
 assert.equal(response.body.approved,false);
 assert.equal(response.body.projectId,'workshop');
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/role=eq.human/);
 assert.equal(savedProposals.length,1);
 assert.equal(savedProposals[0].ownerId,ownerId);
 assert.equal(savedProposals[0].entry.body,saved.content);
 assert.equal(savedProposals[0].entry.id,messageId);
 assert.equal(savedProposals[0].entry.status,'proposed');
 assert.equal(savedProposals[0].entry.sensitivity,'private');
 assert.equal(savedProposals[0].entry.sourceRef,'owner-thread:'+threadId+'/message:'+messageId);
});
test('rejects unverified origin, credentials, actor and forged project without DB calls',async()=>{
 const {api,calls,savedProposals}=setup();
 assert.equal((await api.handle({headers:{...headers,origin:'https://evil.test'},
  body:JSON.stringify(payload)})).status,403);
 assert.equal((await api.handle({headers:{origin:headers.origin},
  body:JSON.stringify(payload)})).status,401);
 assert.equal((await api.handle({headers,body:JSON.stringify({
  ...payload,actor:'matt'})})).status,400);
 assert.equal((await api.handle({headers,body:JSON.stringify({
  ...payload,projectId:'wellbeing'})})).status,400);
 assert.equal(calls.length,0);
 assert.equal(savedProposals.length,0);
});
test('cross-thread, non-human and unknown messages never get written',async()=>{
 for(const config of [{owns:false},{rows:[]},
  {rows:[{...saved,role:'agent'}]},
  {rows:[{...saved,thread_id:'44444444-4444-4444-8444-444444444444'}]}]){
  const {api,savedProposals}=setup(config);
  const r=await api.handle({headers,body:JSON.stringify(payload)});
  assert.notEqual(r.status,201);
  assert.equal(savedProposals.length,0);
 }
});
test('multiline human correction is normalized before strict memory validation',async()=>{
 const {api,savedProposals}=setup({rows:[{...saved,content:'Keep this.\\n\\tAlways do it.'}]});
 const r=await api.handle({headers,body:JSON.stringify(payload)});
 assert.equal(r.status,201);
 assert.equal(savedProposals[0].entry.body,'Keep this. Always do it.');
});
test('storage failure never claims learning succeeded',async()=>{
 const {api}=setup({persist:false});
 const r=await api.handle({headers,body:JSON.stringify(payload)});
 assert.equal(r.status,409);
 assert.equal(r.body.error,'learning_proposal_not_saved');
});
