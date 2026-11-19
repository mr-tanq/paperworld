'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeRoutineOwnerApi,nextUtcSlot}=require('../server/routine-owner-api.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const thread='22222222-2222-4222-8222-222222222222';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer '+('a'.repeat(24))};
const schedule={threadId:thread,projectId:'listening',goal:'Weekly new gig review',
 dayOfWeek:1,hourUtc:9,minuteUtc:30};
const saved={id:'33333333-3333-4333-8333-333333333333',owner_id:owner,
 thread_id:thread,project_id:'listening',goal:schedule.goal,enabled:false,
 day_of_week:1,hour_utc:9,minute_utc:30,max_ai_calls:0,
 additional_spend_usd:0,next_review_at:'2026-11-23T09:30:00.000Z'};
const today=new Date('2026-11-19T10:00:00.000Z');
function fixture({owns=true,rows=[saved],dbDown=false,secret='sb_secret_synthetic_no_real_credentials'}={}){
 const calls=[];
 const api=makeRoutineOwnerApi({secret,now:()=>today,
  identity:{authenticate:async()=>({ownerId:owner}),ownsThread:async()=>owns},
  fetcher:async(url,opts)=>{
   calls.push({url,opts});
   if(dbDown)throw Error('storage inaccessible');
   if(opts.method==='POST'){
    const p=JSON.parse(opts.body);
    return {ok:true,json:async()=>[{...p,id:p.id,enabled:false}]};
   }
   if(opts.method==='PATCH'){
    const p=JSON.parse(opts.body);
    return {ok:true,json:async()=>[{id:saved.id,...p}]};
   }
   return {ok:true,json:async()=>rows};
  }});
 const call=(action,data)=>api.handle({action,headers,body:JSON.stringify(data)});
 return {api,calls,call};
}
test('time calculation is future-facing, UTC and handles week boundaries',()=>{
 assert.equal(nextUtcSlot(1,9,30,today),'2026-11-23T09:30:00.000Z');
 assert.equal(nextUtcSlot(4,10,0,today),'2026-11-26T10:00:00.000Z');
 assert.equal(nextUtcSlot(4,10,5,today),'2026-11-19T10:05:00.000Z');
});
test('preview is a verified-owner read-only plan with zero storage calls',async()=>{
 const {call,calls}=fixture();
 const result=await call('preview',schedule);
 assert.equal(result.status,200);
 assert.equal(result.body.nextReviewAt,'2026-11-23T09:30:00.000Z');
 assert.equal(result.body.enabled,false);
 assert.equal(result.body.aiCalls,0);
 assert.equal(result.body.additionalSpendUsd,0);
 assert.equal(calls.length,0);
});
test('explicit create stores disabled draft only with zero spend',async()=>{
 const {call,calls}=fixture();
 assert.equal((await call('create',schedule)).status,400);
 assert.equal(calls.length,0);
 const result=await call('create',{...schedule,confirmed:true});
 assert.equal(result.status,201);
 assert.equal(result.body.enabled,false);
 assert.equal(result.body.requiresActivation,true);
 const write=JSON.parse(calls[0].opts.body);
 assert.equal(write.enabled,false);
 assert.equal(write.max_ai_calls,0);
 assert.equal(write.additional_spend_usd,0);
 assert.equal(write.owner_id,owner);
 assert.equal(write.thread_id,thread);
 assert.ok(!('status' in write));
});
test('explicit pause/enable require owner record and zero-cost policy',async()=>{
 const {call,calls}=fixture();
 const p={threadId:thread,routineId:saved.id,confirmed:true};
 const enable=await call('enable',p);
 assert.equal(enable.status,200);
 assert.equal(enable.body.enabled,true);
 assert.equal(enable.body.execution,'review_drafts_only');
 assert.equal(JSON.parse(calls[1].opts.body).enabled,true);
 const pause=await call('pause',p);
 assert.equal(pause.status,200);
 assert.equal(pause.body.enabled,false);
 assert.equal(JSON.parse(calls[3].opts.body).next_review_at,null);
 assert.match(calls[3].url,/owner_id=eq\./);
});
test('no arbitrary owner, paid budget, or cross-thread activity',async()=>{
 for(const bad of [
  {...schedule,ownerId:owner},{...schedule,dayOfWeek:9},
  {...schedule,hourUtc:24},{...schedule,maxAiCalls:1},
  {...schedule,projectId:'matt'},{...schedule,goal:''}]){
  const {call,calls}=fixture();
  assert.notEqual((await call('preview',bad)).status,200);
  assert.equal(calls.length,0);
 }
 const notOwned=fixture({owns:false});
 assert.equal((await notOwned.call('create',{...schedule,confirmed:true})).status,404);
 assert.equal(notOwned.calls.length,0);
 const paid=fixture({rows:[{...saved,max_ai_calls:2}]});
 assert.equal((await paid.call('enable',{threadId:thread,routineId:saved.id,confirmed:true})).status,409);
 assert.equal(paid.calls.length,1);
 const forged=fixture();
 assert.equal((await forged.call('enable',{threadId:thread,routineId:saved.id,confirmed:false})).status,400);
 assert.equal(forged.calls.length,0);
});
test('missing schema, database failure or secret fails closed',async()=>{
 const down=fixture({dbDown:true});
 const r=await down.call('create',{...schedule,confirmed:true});
 assert.equal(r.status,503);
 const missing=fixture({secret:''});
 const fail=await missing.call('list',{threadId:thread});
 assert.equal(fail.status,503);
});
test('server route cannot be called from cross-origin and never exposes service key',async()=>{
 const {api,calls}=fixture();
 const r=await api.handle({action:'create',headers:{...headers,origin:'https://evil.test'},
  body:JSON.stringify({...schedule,confirmed:true})});
 assert.equal(r.status,403);
 assert.equal(calls.length,0);
});
