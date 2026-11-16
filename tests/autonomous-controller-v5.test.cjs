'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const sql=fs.readFileSync('sql/paperworld_v5_safe_controller.sql','utf8');
test('The V5 controller actually registers a five-minute unattended database schedule',()=>{
 assert.match(sql,/create extension if not exists pg_cron/);
 assert.match(sql,/cron\.schedule\(/);
 assert.match(sql,/paperworld-v5-safe-controller/);
 assert.match(sql,/\*\/5 \* \* \* \*/);
 assert.match(sql,/paperworld_v5_controller_tick\(\)/);
});
test('Supervisor safely handles expired worker leases without dispatching AI',()=>{
 assert.match(sql,/paperworld_v5_reclaim_expired\(\)/);
 assert.match(sql,/worker_attempts_exhausted/);
 assert.match(sql,/mission_needs_you/);
 assert.match(sql,/pg_try_advisory_xact_lock/);
 assert.doesNotMatch(sql,/net\.http|workflow_dispatch|startCopilot|createCopilot|model\.send|service_role_key/);
});
test('Supervisor status is inaccessible to unauthenticated and browser users',()=>{
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.paperworld_autonomous_controller_v5 from anon,authenticated/);
 assert.match(sql,/revoke all on function public\.paperworld_v5_controller_tick\(\)/);
 assert.match(sql,/security invoker/);
 assert.doesNotMatch(sql,/security definer/);
});
test('Cron cannot create a mission or claim work on its own',()=>{
 assert.doesNotMatch(sql,/insert into public\.paperworld_autonomous_missions_v5/);
 assert.doesNotMatch(sql,/paperworld_v5_claim_step\(/);
 assert.match(sql,/aiCalls.*0/);
 assert.match(sql,/externalActions.*0/);
});
