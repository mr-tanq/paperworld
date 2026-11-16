'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeTeamHandoffLedger}=require('../server/team-handoff-ledger-v5.cjs');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const row={owner_id:ownerId,thread_id:threadId,request_id:requestId,
 project:'pokemon',director_id:'pokemon-director',worker_id:'pokemon-developer',
 status:'awaiting_consent',request_summary:'Review Route 1'};
const input={ownerId,threadId,requestId,project:'pokemon',
 workerId:'pokemon-developer',message:'Review Route 1'};
function make(rows){
 let requests=0;
 const fetcher=async(url,opts)=>{
  requests++;
  assert.equal(opts.method,'GET');
  assert.ok(url.startsWith('https://jrevhzvrgenucuozjowm.supabase.co/rest/v1/paperworld_team_handoffs_v5?'));
  assert.ok(!url.includes('Review Route 1'));
  return {ok:true,json:async()=>rows};
 };
 return {ledger:makeTeamHandoffLedger({fetcher,secret:'sb_secret_synthetic'}),calls:()=>requests};
}
test('Verified saved Matt handoff is tied to exact project, Worker, thread, owner and request text',async()=>{
 const {ledger,calls}=make([row]);
 assert.deepEqual(await ledger.verifyWorkerRequest(input),{
  matched:true,project:'pokemon',workerId:'pokemon-developer',requestId});
 assert.equal(calls(),1);
});
test('No handoff permits a fresh direct owner-consented worker, never invents consent',async()=>{
 const {ledger}=make([]);
 assert.deepEqual(await ledger.verifyWorkerRequest(input),{matched:false});
});
test('Mismatched and stale handoffs fail closed without AI, even with valid owner',async()=>{
 for(const bad of [
  {...row,status:'reported'},
  {...row,request_summary:'Other task'},
  {...row,thread_id:'44444444-4444-4444-8444-444444444444'},
  {...row,worker_id:'listening-developer'},
  {...row,project:'listening'},
  {...row,owner_id:'55555555-5555-4555-8555-555555555555'}
 ]){
  const {ledger}=make([bad]);
  await assert.rejects(()=>ledger.verifyWorkerRequest(input),
   /worker_handoff_mismatch|unauthorized_assignment/);
 }
});
test('Cannot authorize other project Worker or arbitrary capabilities',async()=>{
 const {ledger,calls}=make([row]);
 await assert.rejects(()=>ledger.verifyWorkerRequest({...input,workerId:'studio-creative'}),
 /invalid_worker_request/);
 await assert.rejects(()=>ledger.verifyWorkerRequest({...input,project:'wellbeing'}),
 /invalid_worker_request/);
 assert.equal(calls(),0);
});
test('Ambiguous or upstream-failed persisted record prevents privileged Worker execution',async()=>{
 const {ledger}=make([row,row]);
 await assert.rejects(()=>ledger.verifyWorkerRequest(input),/ambiguous_worker_handoff/);
 const unavailable=makeTeamHandoffLedger({secret:'sb_secret_synthetic',
  fetcher:async()=>({ok:false})});
 await assert.rejects(()=>unavailable.verifyWorkerRequest(input),/team_ledger_unavailable/);
});
test('Both real Worker runtimes verify persisted handoff before any Copilot session',()=>{
 for(const path of ['server/matt-worker-delegation.cjs','server/pokemon-worker-delegation.cjs']){
  const source=fs.readFileSync(path,'utf8');
  assert.match(source,/trustedHandoffs\.verifyWorkerRequest/);
  assert.match(source,/worker_handoff_unverified/);
  assert.ok(source.indexOf('trustedHandoffs.verifyWorkerRequest')<source.indexOf('client.start()'));
  assert.match(source,/budgetVerified/);
 }
});
