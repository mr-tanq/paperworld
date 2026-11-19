'use strict';
// Owner-only routine API: preview, create (disabled), list, enable, pause, update.
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeRoutineOwnerApi}=require('../server/routine-owner-api.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const thread='22222222-2222-4222-8222-222222222222';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer '+('a'.repeat(24))};
const schedule={threadId:thread,projectId:'listening',goal:'Weekly new gig review',
 dayOfWeek:1,hour:9,minute:30};
const saved={id:'33333333-3333-4333-8333-333333333333',owner_id:owner,thread_id:thread,
 project_id:'listening',goal:schedule.goal,enabled:false,day_of_week:1,local_hour:9,local_minute:30,
 timezone:'Europe/Amsterdam',max_ai_calls:0,additional_spend_usd:0,next_review_at:null};
const today=new Date('2026-11-19T10:00:00.000Z');
function fixture({owns=true,rows=[saved],dbDown=false,secret='sb_secret_synthetic_no_real_credentials'}={}){
 const calls=[];
 const api=makeRoutineOwnerApi({secret,now:()=>today,
  identity:{authenticate:async()=>({ownerId:owner}),ownsThread:async()=>owns},
  fetcher:async(url,opts)=>{
   calls.push({url,opts});
   if(dbDown)throw Error('storage inaccessible');
   if(opts.method==='POST'){const p=JSON.parse(opts.body);return {ok:true,json:async()=>[{...p,next_review_at:null}]}}
   if(opts.method==='PATCH'){
    const p=JSON.parse(opts.body);
    // Simulates the database trigger: enabling computes the slot, pausing clears it.
    const enabled=p.enabled??rows[0].enabled;
    return {ok:true,json:async()=>[{...rows[0],...p,next_review_at:enabled?'2026-11-23T08:30:00.000Z':null}]};
   }
   return {ok:true,json:async()=>rows};
  }});
 const call=(action,data)=>api.handle({action,headers,body:JSON.stringify(data)});
 return {api,calls,call};
}
test('preview shows the local schedule and first date, with zero storage calls',async()=>{
 const f=fixture();
 const r=await f.call('preview',schedule);
 assert.equal(r.status,200);
 assert.equal(r.body.timezone,'Europe/Amsterdam');
 // Monday 23 Nov 09:30 Amsterdam (CET) = 08:30Z.
 assert.equal(r.body.nextReviewAt,'2026-11-23T08:30:00.000Z');
 assert.equal(r.body.enabled,false);assert.equal(r.body.aiCalls,0);assert.equal(r.body.additionalSpendUsd,0);
 assert.equal(f.calls.length,0);
 const utc=await f.call('preview',{...schedule,timezone:'UTC'});
 assert.equal(utc.body.nextReviewAt,'2026-11-23T09:30:00.000Z');
});
test('explicit create stores a disabled, zero-spend routine with local fields only',async()=>{
 const f=fixture();
 assert.equal((await f.call('create',schedule)).body.error,'invalid_routine_fields');
 assert.equal((await f.call('create',{...schedule,confirmed:false})).body.error,'explicit_confirmation_required');
 const r=await f.call('create',{...schedule,confirmed:true});
 assert.equal(r.status,201);assert.equal(r.body.enabled,false);assert.equal(r.body.requiresActivation,true);
 const body=JSON.parse(f.calls[0].opts.body);
 assert.deepEqual([body.enabled,body.max_ai_calls,body.additional_spend_usd,body.local_hour,body.local_minute,body.timezone],
  [false,0,0,9,30,'Europe/Amsterdam']);
 assert.equal(body.owner_id,owner);
 assert.ok(!('next_review_at' in body),'the database computes the schedule');
 assert.ok(!('hour_utc' in body));
});
test('enable/pause/update need confirmation, are owner-scoped and keep budget at zero',async()=>{
 const f=fixture();
 assert.equal((await f.call('enable',{threadId:thread,routineId:saved.id})).body.error,'explicit_confirmation_required');
 const on=await f.call('enable',{threadId:thread,routineId:saved.id,confirmed:true});
 assert.equal(on.status,200);assert.equal(on.body.enabled,true);
 assert.equal(on.body.nextReviewAt,'2026-11-23T08:30:00.000Z','returned from the database, not the client');
 const patch=f.calls.find(c=>c.opts.method==='PATCH');
 for(const scoped of ['owner_id=eq.'+owner,'thread_id=eq.'+thread,'max_ai_calls=eq.0','additional_spend_usd=eq.0','enabled=eq.false'])
  assert.ok(patch.url.includes(scoped),scoped);
 assert.deepEqual(JSON.parse(patch.opts.body),{enabled:true});
 const edit=await f.call('update',{threadId:thread,routineId:saved.id,confirmed:true,hour:18,goal:'Νέος στόχος'});
 assert.equal(edit.status,200);assert.equal(edit.body.hour,18);assert.equal(edit.body.goal,'Νέος στόχος');
 assert.deepEqual(JSON.parse(f.calls.at(-1).opts.body),{goal:'Νέος στόχος',local_hour:18});
 for(const bad of [{hour:24},{minute:-1},{goal:''},{max_ai_calls:5},{enabled:true}])
  assert.equal((await f.call('update',{threadId:thread,routineId:saved.id,confirmed:true,...bad})).status,400,JSON.stringify(bad));
 assert.equal((await f.call('update',{threadId:thread,routineId:saved.id,confirmed:true})).body.error,'invalid_routine_fields');
});
test('a paid or foreign routine is never changed',async()=>{
 const paid=fixture({rows:[{...saved,max_ai_calls:2}]});
 assert.equal((await paid.call('enable',{threadId:thread,routineId:saved.id,confirmed:true})).status,409);
 assert.ok(!paid.calls.some(c=>c.opts.method==='PATCH'));
 const foreign=fixture({rows:[{...saved,owner_id:'99999999-9999-4999-8999-999999999999'}]});
 assert.equal((await foreign.call('pause',{threadId:thread,routineId:saved.id,confirmed:true})).status,404);
});
test('list returns local fields for the owner only',async()=>{
 const f=fixture({rows:[{...saved,enabled:true,next_review_at:'2026-11-23T08:30:00.000Z'}]});
 const r=await f.call('list',{threadId:thread});
 assert.deepEqual(r.body.routines[0],{id:saved.id,projectId:'listening',goal:schedule.goal,enabled:true,
  dayOfWeek:1,hour:9,minute:30,timezone:'Europe/Amsterdam',nextReviewAt:'2026-11-23T08:30:00.000Z'});
 assert.ok(f.calls[0].url.includes('owner_id=eq.'+owner));
});
test('missing schema, database failure, wrong thread or secret fails closed',async()=>{
 assert.equal((await fixture({dbDown:true}).call('create',{...schedule,confirmed:true})).status,503);
 assert.equal((await fixture({secret:''}).call('list',{threadId:thread})).status,503);
 assert.equal((await fixture({owns:false}).call('preview',schedule)).status,404);
 const f=fixture();
 assert.equal((await f.api.handle({action:'preview',headers:{...headers,origin:'https://evil.example'},
  body:JSON.stringify(schedule)})).status,403);
 assert.equal((await f.call('delete',{threadId:thread})).status,400);
 assert.equal(f.calls.length,0);
});
