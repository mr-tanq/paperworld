'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {dueSlot}=require('../server/routine-loop-policy.cjs');
const SQL=fs.readFileSync(require.resolve('../sql/paperworld_routine_loop_v2_REVIEW_ONLY.sql'),'utf8');
const plan={routineId:'11111111-1111-4111-8111-111111111111',
 ownerId:'22222222-2222-4222-8222-222222222222',
 threadId:'33333333-3333-4333-8333-333333333333',
 projectId:'pokemon',goal:'Review new tasks',enabled:true,
 dayOfWeek:4,hourUtc:2,minuteUtc:35,maxAiCalls:0};
test('draft slot identity stays stable through multiple 5-minute ticks',()=>{
 const first=dueSlot(plan,new Date('2026-11-19T02:35:00Z'));
 const second=dueSlot(plan,new Date('2026-11-19T02:40:00Z'));
 assert.equal(first.slotKey,second.slotKey);
 assert.equal(first.scheduledAt,'2026-11-19T02:35:00.000Z');
 assert.equal(first.mission.status,'draft');
 assert.equal(first.mission.policy.maxAiCalls,0);
 assert.equal(first.mission.policy.additionalSpendUsd,0);
});
test('the SQL stages a draft exactly once per slot and advances one week',()=>{
 assert.match(SQL,/select mission_id into existing/);
 assert.match(SQL,/if existing is null then/);
 assert.match(SQL,/insert into public\.paperworld_routine_slots_v1/);
 assert.match(SQL,/next_review_at=p_slot\+interval '7 days'/);
 assert.match(SQL,/utc_day<>r.day_of_week/);
 assert.match(SQL,/utc_hour<>r.hour_utc/);
 assert.match(SQL,/utc_minute<>r.minute_utc/);
 assert.match(SQL,/p_slot<=now\(\)-interval '8 days'/);
 assert.match(SQL,/values\(new_id,r.owner_id,r.thread_id,r.project_id,r.goal,'draft'/);
});
test('existing heartbeat is extended without any new scheduling or paid execution',()=>{
 assert.match(SQL,/create or replace function public.paperworld_v5_unified_tick/);
 assert.match(SQL,/public.paperworld_v5_controller_tick\(\)/);
 assert.match(SQL,/public.paperworld_v1_review_due_routines\(\)/);
 assert.match(SQL,/public.paperworld_v5_unified_wakeup\(\)/);
 assert.match(SQL,/public\.paperworld_v5_notify_matt\(\)/);
 assert.match(SQL,/'notifications',notices/);
 assert.match(SQL,/exception when others then[\s\S]{0,120}notices:=/);
 assert.doesNotMatch(SQL,/cron\.schedule\s*\(/i);
 assert.doesNotMatch(SQL,/net\.http_post\s*\(/i);
 assert.doesNotMatch(SQL,/status\s*=\s*'queued'/i);
 assert.doesNotMatch(SQL,/('start_agent'|'create_issue'|'await_pr'|'leased')/i);
 assert.match(SQL,/grant execute on function public.paperworld_v1_review_due_routines\(\)\s+to service_role/i);
});
test('privacy and costs remain constrained to existing owner-scoped schema',()=>{
 assert.match(SQL,/from public,anon,authenticated/);
 assert.match(SQL,/max_ai_calls=0 and additional_spend_usd=0/);
 assert.match(SQL,/"maxAiCalls":0/);
 assert.match(SQL,/"additionalSpendUsd":0/);
 assert.match(SQL,/"noAutoMerge":true/);
 assert.match(SQL,/"noAutoDeploy":true/);
});
