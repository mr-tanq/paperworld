'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeDelegation,CONSENT}=require('../server/matt-delegation.cjs');
const THREAD='11111111-1111-4111-8111-111111111111';
const OWNER='22222222-2222-4222-8222-222222222222';
const REQUEST='33333333-3333-4333-8333-333333333333';
const PLAN=JSON.stringify({title:'One small tested recommendation fix',
 summary:'Small bounded repair with existing regression',
 acceptance:['Festival revisit regression passes'],
 requiredTests:['festival_revisit'],allowedPaths:['js/','tests/'],maxFiles:3});
const model=(response)=>({data:{content:response}});
function create({enabled=true,route='{"director":"listening-director","action":"build"}'}={}){
 const writes=[],prompts=[],calls=[];
 const output=[route,PLAN,'This is analysis, not an execution'];
 const gateway=makeDelegation({
  oauth:{getLinkedToken:()=> 'gho_TEST_TEST_TEST'},
  guard:{authenticate:async()=>({ownerId:OWNER}),ownsThread:async()=>true},
  budgetVerified:async()=>true,
  memoryLoader:{load:async()=>({projectId:'workshop',included:1,text:'PROJECT_ONLY',untrustedContent:true,
   actor:'listening-director',capabilitiesGranted:[]})},
  persistence:{save:async p=>{writes.push(p);return true}},
  handoffLedger:{record:async()=>true},
  taskIntake:{available:async()=>enabled,submit:async x=>{
   calls.push(x);return {state:'queued',missionId:x.requestId,
    title:'One small tested recommendation fix',projectId:'listening',
    autoMerge:false,autoDeploy:false};
  }},
  clientFactory:async()=>({
   start:async()=>{},
   listModels:async()=>[{id:'model-a',billing:{tokenPrices:{
    inputPrice:1,outputPrice:2,batchSize:1000}}}],
   createSession:async()=>({sendAndWait:async({prompt})=>{
    prompts.push(prompt);
    return model(output[prompts.length-1]);
   },disconnect:async()=>{}}),
   stop:async()=>{}
  })
 });
 return {gateway,writes,prompts,calls};
}
const params={headers:{origin:'https://mr-tanq.github.io',
 authorization:'Bearer abcdefghijklmnop'},
 body:JSON.stringify({threadId:THREAD,requestId:REQUEST,
 message:'Improve Listening Mirror concert recommendations',consent:CONSENT})};
test('one natural Messenger request routes Matt, plans once and queues a durable task',async()=>{
 const f=create();const r=await f.gateway.handle(params);
 assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.execution,'queued');
 assert.equal(r.body.taskMission.id,REQUEST);
 assert.equal(r.body.taskMission.projectId,'listening');
 assert.equal(r.body.workProposal,null);
 assert.equal(r.body.persisted,true);
 assert.equal(f.prompts.length,2);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].ownerId,OWNER);
 assert.equal(f.calls[0].threadId,THREAD);
 assert.equal(f.calls[0].requestId,REQUEST);
 assert.equal(f.calls[0].directorId,'listening-director');
 assert.match(f.prompts[1],/festival_revisit/);
 assert.match(f.prompts[1],/PROJECT_ONLY/);
 assert.match(r.body.content,/Δεν γίνεται αυτόματο merge/);
});
test('when engine is not enabled Matt keeps normal 3-turn advice, no task write',async()=>{
 const f=create({enabled:false});
 const r=await f.gateway.handle(params);
 assert.equal(r.status,200);
 assert.equal(r.body.execution,'analysis_only');
 assert.equal(f.calls.length,0);
 assert.equal(f.prompts.length,3);
});
test('model cannot request build execution for studio',async()=>{
 const f=create({route:'{"director":"studio-director","action":"build"}'});
 const r=await f.gateway.handle(params);
 assert.equal(r.status,200);
 assert.equal(r.body.execution,'analysis_only');
 assert.equal(f.calls.length,0);
});
