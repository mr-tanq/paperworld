'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {makeDelegation,CONSENT,CAPABILITIES}=require('../server/matt-delegation.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const thread='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer aaaaa.bbbbb.ccccc'};
const data={threadId:thread,requestId:request,message:'Investigate the concert image issue in Listening Mirror',consent:CONSENT};
function make({route='listening-director',owns=true,linked=true,budget=true,failTurn=0}={}){
 const seen={created:[],prompts:[],sent:0,stopped:0,diagnostics:[]};
 const clientFactory=async options=>{
  seen.options=options;
  return {
   start:async()=>{},
   listModels:async()=>[{id:'model-a',billing:{tokenPrices:{
    inputPrice:2,outputPrice:3,batchSize:1000}}}],
   createSession:async config=>{
    seen.created.push(config);
    return {sendAndWait:async({prompt})=>{
      seen.sent++;seen.prompts.push(prompt);
      if(failTurn===seen.sent)throw Error('SECRET NEVER LOG THIS');
      const reply=seen.sent===1?route:
       seen.sent===2?'Director found hypotheses and recommends investigating, no files read.':
       'Matt: Director suggests investigation; no changes have been made.';
      return {data:{content:reply}};
    },disconnect:async()=>{}};
   },
   stop:async()=>{seen.stopped++}
  };
 };
 const gateway=makeDelegation({
  oauth:{getLinkedToken:()=>linked?'gho_VALID_TEST_ONLY':null},
  guard:{authenticate:async()=>({ownerId:owner}),
   ownsThread:async()=>owns},
  budgetVerified:async()=>budget,
  clientFactory,diagnostics:stage=>seen.diagnostics.push(stage)
 });
 return {gateway,seen};
}
const requestBody=payload=>JSON.stringify(payload);
test('Listening Mirror director is real routed AI turn and reports via Matt, without tools',async()=>{
 const {gateway,seen}=make();
 const out=await gateway.handle({headers,body:requestBody(data)});
 assert.equal(out.status,200);
 assert.equal(out.body.delegated,true);
 assert.equal(out.body.directorId,'listening-director');
 assert.equal(out.body.aiTurns,3);
 assert.equal(seen.sent,3);
 assert.equal(seen.created.length,3);
 assert.equal(out.body.execution,'analysis_only');
 assert.match(out.body.directorReport,/recommends investigating/);
 assert.match(out.body.content,/no changes have been made/);
 assert.ok(!JSON.stringify(out.body).includes('gho_VALID'));
 for(const cfg of seen.created){
  assert.deepEqual(cfg.availableTools,[]);
  assert.equal((await cfg.onPermissionRequest()).kind,'reject');
  assert.equal('hooks' in cfg,false);
  assert.equal('systemMessage' in cfg,false);
 }
 assert.equal(seen.options.useLoggedInUser,false);
 assert.equal(seen.stopped,1);
 assert.ok(seen.prompts[1].includes('CANNOT inspect their source code'));
});
test('Matt AI routing cannot delegate to nonexistent or unauthorized directors',async()=>{
 for(const route of ['pokemon-director','not_ready','listening-developer','unknown-route']){
  const {gateway,seen}=make({route});
  const r=await gateway.handle({headers,body:requestBody(data)});
  assert.equal(r.status,200);
  assert.equal(r.body.delegated,false);
  assert.equal(r.body.aiTurns,1);
  assert.equal(seen.sent,1);
 }
});
test('Empty AI routing fails closed and does not fabricate a Director',async()=>{
 const {gateway,seen}=make({route:''});
 const result=await gateway.handle({headers,body:requestBody(data)});
 assert.equal(result.status,503);
 assert.equal(result.body.attemptedAiTurns,1);
 assert.equal(seen.sent,1);
});
test('Owner auth, budget and exact 3-call consent guard all inference',async()=>{
 for(const opts of [{owns:false},{linked:false},{budget:false}]){
  const {gateway,seen}=make(opts);
  const r=await gateway.handle({headers,body:requestBody(data)});
  assert.ok([403,404,409].includes(r.status));
  assert.equal(seen.sent,0);
 }
 const {gateway,seen}=make();
 assert.equal((await gateway.handle({headers:{...headers,origin:'https://evil.tld'},body:requestBody(data)})).status,403);
 assert.equal((await gateway.handle({headers,body:requestBody({...data,consent:'ONE_COPILOT_TURN_INCLUDED_ALLOWANCE'})})).status,400);
 assert.equal((await gateway.handle({headers,body:requestBody({...data,threadId:'invalid'})})).status,400);
 assert.equal(seen.sent,0);
});
test('One-time request ID prevents repeated multi-turn spend',async()=>{
 const {gateway,seen}=make();
 assert.equal((await gateway.handle({headers,body:requestBody(data)})).status,200);
 assert.equal((await gateway.handle({headers,body:requestBody(data)})).status,409);
 assert.equal(seen.sent,3);
});
test('Director turn errors fail closed and never disclose exception text',async()=>{
 const {gateway,seen}=make({failTurn:2});
 const r=await gateway.handle({headers,body:requestBody(data)});
 assert.equal(r.status,503);
 assert.equal(r.body.error,'delegation_runtime_unavailable');
 assert.equal(r.body.attemptedAiTurns,2);
 assert.equal(seen.sent,2);
 assert.equal(seen.diagnostics[0],'model_reply');
 assert.doesNotMatch(JSON.stringify(r),/SECRET|gho_VALID/);
});
test('Only Listening Mirror Director has enabled AI delegation in this PR',()=>{
 assert.deepEqual(Object.keys(CAPABILITIES),['listening-director']);
 assert.equal(CAPABILITIES['listening-director'].reportsTo,'matt');
 const server=fs.readFileSync(path.join(__dirname,'../server/render-matt.cjs'),'utf8');
 assert.match(server,/\/delegate\/matt/);
 const browser=fs.readFileSync(path.join(__dirname,'../js/cloud.js'),'utf8');
 assert.match(browser,/MATT_DIRECTOR_UP_TO_THREE_AI_TURNS/);
 const ui=fs.readFileSync(path.join(__dirname,'../js/world-dialogue.js'),'utf8');
 assert.match(ui,/Ανάθεση μέσω Matt/);
 assert.match(ui,/έως 3 AI κλήσεις/);
});
