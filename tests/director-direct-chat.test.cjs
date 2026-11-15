'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeDirectorChat,CONSENT}=require('../server/director-direct-chat.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const thread='22222222-2222-4222-8222-222222222222';
const id='33333333-3333-4333-8333-333333333333';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer aaa.bbb.fake12345678'};
const request={agentId:'listening-director',threadId:thread,requestId:id,
 message:'How is our music app?',consent:CONSENT};
function setup({owns=true,budget=true,link=true,wrongMemory=false,modelKnown=true,save=false}={}){
 const seen={calls:0,models:0,threads:[],owner:null,prompts:[],configs:[],actors:[]};
 const api=makeDirectorChat({
  oauth:{getLinkedToken:()=>link?'gho_TEST123456789':null},
  guard:{authenticate:async()=>({ownerId:owner}),ownsThread:async a=>{
   seen.threads.push(a);return owns&&a.agentId===request.agentId}},
  memoryLoader:{load:async a=>{
   seen.actors.push(a.actor);return {actor:a.actor,projectId:wrongMemory?'pokemon':'workshop',
    text:'Only the approved Listening Mirror project decisions',included:1,
    capabilitiesGranted:[],untrustedContent:true}
  }},
  threadRecall:{load:async()=>({text:'User: Earlier private app discussion',messageCount:1})},
  replyPersistence:{save:async a=>{seen.saved=a;return save}},
  budgetVerified:()=>budget,
  clientFactory:async opts=>{seen.owner=opts;return {
   start:async()=>{},stop:async()=>{},
   listModels:async()=>modelKnown?[{id:'test-model',billing:{tokenPrices:{
    inputPrice:1,outputPrice:2,batchSize:1000}}}]:[],
   createSession:async c=>{seen.configs.push(c);return {
    sendAndWait:async({prompt})=>{seen.calls++;seen.prompts.push(prompt);
     return {data:{content:'Luna responds without any edits'}}},
    disconnect:async()=>{}}}
  }}
 });
 return {api,seen};
}
const run=(api,body=request,h=headers)=>api.handle({headers:h,body:JSON.stringify(body)});
test('Direct Director chat is exactly one explicitly authorized, owner-scoped no-tools turn',async()=>{
 const {api,seen}=setup();
 const r=await run(api);
 assert.equal(r.status,200);
 assert.equal(r.body.agentId,'listening-director');
 assert.equal(r.body.aiTurns,1);
 assert.equal(r.body.execution,'chat_only');
 assert.equal(r.body.persisted,false);
 assert.equal(seen.calls,1);
 assert.equal(seen.threads[0].agentId,'listening-director');
 assert.equal(seen.threads[0].ownerId,owner);
 assert.deepEqual(seen.actors,['listening-director']);
 assert.equal(seen.owner.mode,'empty');
 assert.equal(seen.owner.useLoggedInUser,false);
 assert.deepEqual(seen.configs[0].availableTools,[]);
 assert.deepEqual(await seen.configs[0].onPermissionRequest(),{kind:'reject'});
 assert.match(seen.prompts[0],/ONLY responsibility is Listening Mirror/);
 assert.match(seen.prompts[0],/approved Listening Mirror/);
 assert.match(seen.prompts[0],/Earlier private app discussion/);
 assert.doesNotMatch(JSON.stringify(r),/gho_TEST|aaa.bbb/);
});
test('Missing consent, cross-owner thread and unauthorized origins never consume AI',async()=>{
 for(const change of [{owns:false},{budget:false},{link:false}]){
  const {api,seen}=setup(change);
  assert.ok([403,404,409].includes((await run(api)).status));
  assert.equal(seen.calls,0);
 }
 const {api,seen}=setup();
 assert.equal((await run(api,request,{...headers,origin:'https://evil.example'})).status,403);
 assert.equal((await run(api,{...request,consent:'not_approved'})).status,400);
 assert.equal((await run(api,{...request,agentId:'listening-developer'})).status,400);
 assert.equal((await run(api,{...request,agentId:'matt'})).status,400);
 assert.equal(seen.calls,0);
});
test('Wrong project memory and unknown pricing fail closed without inference',async()=>{
 for(const opts of [{wrongMemory:true},{modelKnown:false}]){
  const {api,seen}=setup(opts);
  const r=await run(api);
  assert.ok([403,503].includes(r.status));
  assert.equal(seen.calls,0);
 }
});
test('Replay cannot charge twice; no tool execution or cross-project dispatch',async()=>{
 const {api,seen}=setup();
 assert.equal((await run(api)).status,200);
 assert.equal((await run(api)).status,409);
 assert.equal(seen.calls,1);
 assert.ok(!seen.prompts[0].includes('Pokémon Echoes'));
});
test('Director conversation route is POST-only and owner-verified, preserving Matt route',()=>{
 const source=fs.readFileSync('server/render-matt.cjs','utf8');
 assert.match(source,/req.url==='\/chat\/director'/);
 assert.match(source,/getDirectorChat\(\)/);
 assert.match(source,/req.method!=='POST'/);
 assert.match(source,/req.headers.origin!==APP_ORIGIN/);
 const client=fs.readFileSync('js/cloud.js','utf8');
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(client,/ONE_DIRECTOR_COPILOT_TURN_INCLUDED_ALLOWANCE/);
 assert.match(ui,/askDirector\(id,text\)/);
 assert.match(ui,/window.confirm\('Άμεση συνομιλία/);
 assert.match(ui,/sendPrivateAgentMessage\(id,text\)/);
});

test('Successful reply persistence is accurately reported without adding model calls',async()=>{
 const {api,seen}=setup({save:true});
 const r=await run(api);
 assert.equal(r.status,200);
 assert.equal(r.body.persisted,true);
 assert.equal(r.body.persistedExcerpt,false);
 assert.equal(seen.saved.ownerId,owner);
 assert.equal(seen.saved.threadId,thread);
 assert.equal(seen.saved.agentId,'listening-director');
 assert.equal(seen.saved.requestId,id);
 assert.equal(seen.calls,1);
});
