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

test('Owner status API verifies actual recent heartbeat and never asserts AI execution',async()=>{
 const {makeAutonomousMissionApi}=require('../server/v5-autonomous-mission-api.cjs');
 const ownerId='11111111-1111-4111-8111-111111111111';
 const threadId='22222222-2222-4222-8222-222222222222';
 const token='Bearer '+('x'.repeat(30));
 const fake=last=>makeAutonomousMissionApi({
  secret:'sb_secret_synthetic_not_a_real_key',
  guard:{authenticate:async()=>({ownerId}),ownsThread:async()=>true},
  fetcher:async()=>({ok:true,json:async()=>[{
   last_tick_at:last,tick_count:11}]})
 });
 const args={headers:{origin:'https://mr-tanq.github.io',
  authorization:token},action:'status',body:JSON.stringify({threadId})};
 const active=await fake(new Date().toISOString()).handle(args);
 assert.equal(active.status,200);
 assert.equal(active.body.controller.supervisor,'active');
 assert.equal(active.body.controller.autonomousExecution,false);
 assert.equal(active.body.controller.modelCallsEnabled,false);
 const old=await fake('2025-01-01T00:00:00Z').handle(args);
 assert.equal(old.body.controller.supervisor,'not_verified');
 const bad=await fake(new Date().toISOString()).handle({
  ...args,headers:{...args.headers,origin:'https://other.example'}});
 assert.equal(bad.status,403);
});
