'use strict';
// Routine schedule policy: local time (Europe/Amsterdam) with PostgreSQL-equal
// daylight-saving behaviour, zero-spend draft-only missions.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {normalizeRoutine,dueSlot,nextLocalSlot}=require('../server/routine-loop-policy.cjs');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const routineId='33333333-3333-4333-8333-333333333333';
const plan={ownerId,threadId,routineId,projectId:'listening',enabled:true,
 goal:'Review festival changes',dayOfWeek:1,hour:9,minute:15,timezone:'Europe/Amsterdam',maxAiCalls:0};

test('weekly routine picks a stable local slot and a zero-spend draft only',()=>{
 const one=dueSlot(plan,new Date('2026-11-19T10:00:00Z'));
 const two=dueSlot(plan,new Date('2026-11-20T11:00:00Z'));
 // Monday 16 Nov 2026 09:15 in Amsterdam (CET, UTC+1).
 assert.equal(one.scheduledAt,'2026-11-16T08:15:00.000Z');
 assert.equal(one.slotKey,two.slotKey);
 assert.equal(one.mission.status,'draft');
 assert.deepEqual({...one.mission.policy},{executionMode:'draft_review_only',maxAiCalls:0,
  additionalSpendUsd:0,noAutoMerge:true,noAutoDeploy:true});
});
test('summer and winter keep the same local wall-clock time',()=>{
 assert.equal(nextLocalSlot(1,9,0,'Europe/Amsterdam',new Date('2026-10-19T00:00Z')),'2026-10-19T07:00:00.000Z');
 assert.equal(nextLocalSlot(1,9,0,'Europe/Amsterdam',new Date('2026-10-19T07:00Z')),'2026-10-26T08:00:00.000Z');
 assert.equal(nextLocalSlot(1,9,0,'Europe/Amsterdam',new Date('2027-03-22T08:00Z')),'2027-03-29T07:00:00.000Z');
 assert.equal(nextLocalSlot(1,9,0,'UTC',new Date('2026-10-19T09:00Z')),'2026-10-26T09:00:00.000Z');
});
test('JS previews equal PostgreSQL scheduling on 151 golden cases incl. DST gaps/repeats',()=>{
 // Expected values were produced by paperworld_routine_slot_after() in PostgreSQL.
 const golden=JSON.parse(fs.readFileSync('tests/fixtures/routine-slots-postgres.json','utf8'));
 assert.ok(golden.length>=150);
 for(const [day,h,m,tz,after,expected] of golden)
  assert.equal(nextLocalSlot(day,h,m,tz,new Date(after)).replace('.000Z','Z'),expected,
   [day,h,m,tz,after].join(' '));
});
test('next slot rolls over the week boundary and is strictly in the future',()=>{
 assert.equal(dueSlot(plan,new Date('2026-11-16T08:14:00Z')).scheduledAt,'2026-11-09T08:15:00.000Z');
 assert.equal(dueSlot(plan,new Date('2026-11-16T08:15:00Z')).scheduledAt,'2026-11-16T08:15:00.000Z');
});
test('never schedule disabled, invalid, unknown-zone or paid routines',()=>{
 assert.equal(dueSlot({...plan,enabled:false},new Date('2026-11-19T10:00:00Z')),null);
 for(const bad of [{...plan,maxAiCalls:1},{...plan,hour:24},{...plan,minute:60},{...plan,dayOfWeek:7},
  {...plan,projectId:'unknown'},{...plan,goal:''},{...plan,timezone:'Mars/Olympus'},
  {...plan,hourUtc:9}])
  assert.throws(()=>normalizeRoutine(bad),/routine_invalid_plan/);
});
test('policy module performs no network, model or database work',()=>{
 const src=fs.readFileSync('server/routine-loop-policy.cjs','utf8');
 assert.doesNotMatch(src,/fetch\(|require\(['"]node:(?:http|https|net)|createSession|sendAndWait/);
});
