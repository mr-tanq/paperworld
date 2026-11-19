'use strict';
// Static guarantees of the Routine Loop release migration. Behaviour is
// executed for real in tests/sql/paperworld-routine-loop-integration.sql
// (PostgreSQL in CI); these checks guard the invariants in plain review.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const SQL=fs.readFileSync('sql/paperworld_routine_loop_release_v1.sql','utf8');
const body=SQL.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');

test('reuses the existing V5 cron: no new schedule, no job, no extension',()=>{
 assert.doesNotMatch(body,/cron\.schedule|cron\.job|create extension/i);
 assert.match(body,/create or replace function public\.paperworld_v5_unified_tick\(\)/);
});
test('the unified tick keeps every live stage and isolates the routine stage',()=>{
 const tick=body.slice(body.indexOf('create or replace function public.paperworld_v5_unified_tick'));
 for(const stage of ['paperworld_v5_controller_tick()','paperworld_v5_unified_wakeup()','paperworld_v5_notify_matt()'])
  assert.ok(tick.includes(stage),stage);
 assert.match(tick,/begin\s+routines:=public\.paperworld_v1_review_due_routines\(\);\s+exception when others then/);
 assert.match(tick,/begin\s+notices:=public\.paperworld_v5_notify_matt\(\);\s+exception when others then/);
 assert.match(tick,/set search_path to 'public'/);
 assert.doesNotMatch(tick,/revoke|grant/i,'existing grants on the live tick are preserved');
});
test('routines are local-time, DST-aware, zero-spend and draft-only',()=>{
 assert.match(body,/timezone text not null default 'Europe\/Amsterdam'/);
 assert.match(body,/max_ai_calls integer not null default 0 check \(max_ai_calls=0\)/);
 assert.match(body,/additional_spend_usd numeric\(12,2\) not null default 0 check \(additional_spend_usd=0\)/);
 assert.match(body,/'executionMode','draft_review_only','maxAiCalls',0/);
 assert.doesNotMatch(body,/interval '7 days'/,'weekly advance must follow local time, not +7×24h');
 assert.match(body,/paperworld_routine_slot_after\(r\.day_of_week,r\.local_hour,r\.local_minute,r\.timezone,p_slot\)/);
 assert.doesNotMatch(body,/paperworld_autonomous_steps_v5/,'no runnable steps are created');
});
test('exactly once per slot, owner-scoped reads, service-only writes',()=>{
 assert.match(body,/primary key \(routine_id,scheduled_at\)/);
 assert.match(body,/pg_try_advisory_xact_lock\(534128,31\)/);
 assert.match(body,/for update skip locked/);
 assert.match(body,/revoke all on public\.paperworld_routines_v1,public\.paperworld_routine_slots_v1\s+from public,anon,authenticated/);
 assert.match(body,/using \(\(select auth\.uid\(\)\)=owner_id\)/);
 assert.match(body,/grant execute on function public\.paperworld_v1_stage_routine_draft\(uuid,timestamptz\) to service_role/);
});
test('stale or invalid slots move forward instead of getting stuck',()=>{
 assert.match(body,/repaired:=repaired\+1/);
 assert.match(body,/r\.next_review_at>now\(\)-interval '8 days'/);
});
test('Matt notification is idempotent and only extends the allowed kinds',()=>{
 assert.match(body,/check \(kind in \('completed','needs_you','stalled','routine_due'\)\)/);
 assert.match(body,/md5\(new_id::text\|\|':routine_due'\)::uuid/);
 assert.match(body,/on conflict do nothing/);
 assert.match(body,/δεν ξεκινά τίποτα χωρίς εσένα/);
});
test('CI executes the integration SQL on a real PostgreSQL service',()=>{
 const ci=fs.readFileSync('.github/workflows/private-agent-chat-tests.yml','utf8');
 assert.match(ci,/-f tests\/sql\/paperworld-routine-loop-integration\.sql/);
 const it=fs.readFileSync('tests/sql/paperworld-routine-loop-integration.sql','utf8');
 assert.match(it,/\\ir \.\.\/\.\.\/sql\/paperworld_routine_loop_release_v1\.sql/);
 assert.doesNotMatch(it,/^DO \$$/m,'dollar quoting must be $$ (PR #247 failure)');
});
