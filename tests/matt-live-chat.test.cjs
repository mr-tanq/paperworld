'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeMattChat,CONSENT}=require('../server/matt-live-chat.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const thread='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const payload={threadId:thread,requestId:request,message:'Hello, Matt',consent:CONSENT};
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer aaaaaaa.bbbbbbb.ccccccc'};
function mock({connected=true,owns=true,remaining=80,budgetVerified=true,pricingKnown=true}={}){
 const seen={factory:[],sessions:[],start:0,reply:0};
 const guard={authenticate:async()=>({ownerId:owner}),ownsThread:async()=>owns};
 const oauth={getLinkedToken:()=>connected?'gho_PRIVATE_SERVER_ONLY':null};
 const clientFactory=async opts=>{
  seen.factory.push(opts);
  return {start:async()=>{seen.start++},
   listModels:async()=>[{id:'gpt-4.1',billing:pricingKnown?{tokenPrices:{inputPrice:1,outputPrice:2,batchSize:1000}}:{}}],
   rpc:{account:{getQuota:async()=>({quotaSnapshots:{ai_credits:{
      entitlementRequests:100,usedRequests:100-remaining}}})}},
   createSession:async cfg=>{
    seen.sessions.push(cfg);
    return {sendAndWait:async()=>{seen.reply++;return {data:{content:'A genuine mocked AI response'}}},
      disconnect:async()=>{}};
   },
   stop:async()=>{}
  };
 };
 return {chat:makeMattChat({oauth,guard,clientFactory,budgetVerified:async()=>budgetVerified}),seen};
}
test('No hard-stop billing verification means no SDK access',async()=>{
 const {chat,seen}=mock({budgetVerified:false});
 const r=await chat.handle({headers,body:JSON.stringify(payload)});
 assert.equal(r.status,403);
 assert.equal(r.body.error,'verify_github_zero_overage_budget');
 assert.equal(seen.factory.length,0);
});
test('Authenticated explicit single turn returns real SDK result with no tools',async()=>{
 const {chat,seen}=mock();
 const r=await chat.handle({headers,body:JSON.stringify(payload)});
 assert.equal(r.status,200);
 assert.equal(r.body.executed,true);
 assert.equal(r.body.content,'A genuine mocked AI response');
 assert.equal(r.body.sessionCreditSoftLimit,1);
 assert.equal(seen.start,1);
 assert.equal(seen.reply,1);
 assert.equal(seen.factory[0].gitHubToken,'gho_PRIVATE_SERVER_ONLY');
 assert.equal(seen.factory[0].useLoggedInUser,false);
 assert.deepEqual(seen.sessions[0].availableTools,[]);
 assert.deepEqual(seen.sessions[0].sessionLimits,{maxAiCredits:1});
 assert.deepEqual(await seen.sessions[0].onPermissionRequest(),{kind:'reject'});
 assert.equal((await seen.sessions[0].hooks.onPreToolUse()).permissionDecision,'deny');
 assert.ok(!JSON.stringify(r).includes('gho_PRIVATE'));
});
test('Unknown model pricing rejects before model call',async()=>{
 const {chat,seen}=mock({pricingKnown:false});
 const r=await chat.handle({headers,body:JSON.stringify(payload)});
 assert.equal(r.status,403);
 assert.equal(r.body.error,'no_verified_price_model');
 assert.equal(seen.reply,0);
});
test('A GitHub disconnect fails closed',async()=>{
 const {chat,seen}=mock({connected:false});
 const r=await chat.handle({headers,body:JSON.stringify(payload)});
 assert.equal(r.status,409);
 assert.equal(r.body.error,'github_reconnect_required');
 assert.equal(seen.factory.length,0);
});
test('Spoofed origins, missing consent, missing thread ownership do not spend',async()=>{
 const {chat,seen}=mock({owns:false});
 const data=JSON.stringify(payload);
 assert.equal((await chat.handle({headers:{...headers,origin:'https://evil.com'},body:data})).status,403);
 assert.equal((await chat.handle({headers,body:JSON.stringify({...payload,consent:'no'})})).status,400);
 assert.equal((await chat.handle({headers,body:data})).status,404);
 assert.equal(seen.reply,0);
});
test('Single-use request ID blocks repeated model calls even for zero-multiplier models',async()=>{
 const {chat,seen}=mock();
 const body=JSON.stringify(payload);
 assert.equal((await chat.handle({headers,body})).status,200);
 assert.equal((await chat.handle({headers,body})).status,409);
 assert.equal(seen.reply,1);
});
