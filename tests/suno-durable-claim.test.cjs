'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeSunoClaim}=require('../server/suno-durable-claim.cjs');
const ownerId='22222222-2222-4222-8222-222222222222';
const threadId='33333333-3333-4333-8333-333333333333';
const idempotencyKey='11111111-1111-4111-8111-111111111111';
const brief={title:'Original',style:'slow folk',lyrics:'[Verse] The dark'};
const params={ownerId,threadId,idempotencyKey,brief};
const secret='sb_secret_test_not_real';
test('durable claim posts owner-bound digest, never lyrics or tokens',async()=>{
 const calls=[];
 const claim=makeSunoClaim({secret,fetcher:async(url,opts)=>{
  calls.push({url,opts});return {ok:true,json:async()=>true};
 }});
 assert.equal(await claim.reserve(params),true);
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/\/rpc\/paperworld_suno_claim_create$/);
 const sent=JSON.parse(calls[0].opts.body);
 assert.deepEqual(Object.keys(sent).sort(),['p_digest','p_key','p_owner','p_thread']);
 assert.match(sent.p_digest,/^[a-f0-9]{64}$/);
 assert.equal(sent.p_owner,ownerId);
 assert.equal(sent.p_thread,threadId);
 assert.equal(sent.p_key,idempotencyKey);
 assert.doesNotMatch(JSON.stringify(sent),/The dark|slow folk|Original|Bearer/);
});
test('DB collision fails closed; no local memory assumptions',async()=>{
 const unique=new Set();
 const fetcher=async(_url,opts)=>{
  const data=JSON.parse(opts.body);const k=data.p_owner+':'+data.p_key;
  if(unique.has(k))return {ok:true,json:async()=>false};
  unique.add(k);return {ok:true,json:async()=>true};
 };
 const first=makeSunoClaim({secret,fetcher});
 const afterRestart=makeSunoClaim({secret,fetcher});
 assert.equal(await first.reserve(params),true);
 assert.equal(await afterRestart.reserve(params),false);
 assert.equal(await afterRestart.reserve({...params,brief:{...brief,title:'Other'}}),false);
 assert.equal(await first.reserve({...params,ownerId:'44444444-4444-4444-8444-444444444444'}),true);
});
test('DB outage, invalid response or missing secret never authorize submission',async()=>{
 for(const fetcher of [
  async()=>{throw Error('network')},
  async()=>({ok:false,status:503}),
  async()=>({ok:true,json:async()=>({accepted:true})})
 ]){
  const claim=makeSunoClaim({secret,fetcher});
  await assert.rejects(()=>claim.reserve(params));
 }
 await assert.rejects(()=>makeSunoClaim({secret:''}).reserve(params));
 await assert.rejects(()=>makeSunoClaim({secret}).reserve({...params,ownerId:'invalid'}));
});
