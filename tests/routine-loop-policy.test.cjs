'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {normalizeRoutine,dueSlot}=require('../server/routine-loop-policy.cjs');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const routineId='33333333-3333-4333-8333-333333333333';
const plan={ownerId,threadId,routineId,projectId:'listening',enabled:true,
 goal:'Review festival changes',dayOfWeek:1,hourUtc:9,minuteUtc:15,maxAiCalls:0};
test('weekly routine chooses stable UTC slot and zero-spend draft only',()=>{
 const one=dueSlot(plan,new Date('2026-11-19T10:00:00Z'));
 const two=dueSlot(plan,new Date('2026-11-20T11:00:00Z'));
 assert.equal(one.scheduledAt,'2026-11-16T09:15:00.000Z');
 assert.equal(one.slotKey,two.slotKey);
 assert.equal(one.mission.status,'draft');
 assert.equal(one.mission.policy.executionMode,'draft_review_only');
 assert.equal(one.mission.policy.maxAiCalls,0);
 assert.equal(one.mission.policy.additionalSpendUsd,0);
 assert.equal(one.mission.policy.noAutoMerge,true);
 assert.equal(one.mission.policy.noAutoDeploy,true);
 assert.equal(one.projectId,'listening');
});
test('next weekly slot rolls back safely before scheduled time',()=>{
 const before=dueSlot(plan,new Date('2026-11-16T09:14:59Z'));
 const after=dueSlot(plan,new Date('2026-11-16T09:15:00Z'));
 assert.equal(before.scheduledAt,'2026-11-09T09:15:00.000Z');
 assert.equal(after.scheduledAt,'2026-11-16T09:15:00.000Z');
});
test('never schedule disabled, invalid or paid routines',()=>{
 assert.equal(dueSlot({...plan,enabled:false},new Date()),null);
 for(const invalid of [{maxAiCalls:1},{projectId:'evil'},{dayOfWeek:7},
  {minuteUtc:60},{ownerId:'bad'},{threadId:'bad'},{routineId:'bad'},
  {goal:''},{enabled:'yes'},{unexpected:true}]){
  assert.throws(()=>normalizeRoutine({...plan,...invalid}),/routine_invalid_plan/);
 }
});
test('SQL review-only migration never registers cron or enables paid execution',()=>{
 const s=fs.readFileSync(require.resolve('../sql/paperworld_routine_loop_v1_REVIEW_ONLY.sql'),'utf8');
 assert.match(s,/create table if not exists public\.paperworld_routines_v1/i);
 assert.match(s,/primary key\(routine_id,scheduled_at\)/i);
 assert.match(s,/status,policy\)[\s\S]*?'draft'/);
 assert.match(s,/max_ai_calls integer not null default 0 check\(max_ai_calls=0\)/i);
 assert.match(s,/additional_spend_usd numeric\(12,2\) not null default 0 check\(additional_spend_usd=0\)/i);
 assert.match(s,/grant select on public\.paperworld_routines_v1,public\.paperworld_routine_slots_v1/i);
 assert.doesNotMatch(s,/cron\.schedule\s*\(/i);
 assert.doesNotMatch(s,/net\.http_post\s*\(/i);
 assert.doesNotMatch(s,/status\s*=\s*'queued'/i);
});
