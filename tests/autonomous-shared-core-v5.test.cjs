'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PROJECTS,missionSpec,capability,transition,classification}=require('../server/v5-autonomous-policy.cjs');
const ids={ownerId:'11111111-1111-4111-8111-111111111111',
 threadId:'22222222-2222-4222-8222-222222222222'};
test('All four Directors share one durable mission policy without cross-project access',()=>{
 assert.deepEqual(Object.keys(PROJECTS).sort(),['listening','pokemon','studio','wellbeing']);
 for(const [projectId,expectedDirector] of Object.entries({
  listening:'listening-director',pokemon:'pokemon-director',
  studio:'studio-director',wellbeing:'wellbeing-director'})){
  const spec=missionSpec({...ids,projectId,goal:'Complete a safe work plan'});
  assert.equal(spec.projectId,projectId);
  assert.equal(spec.director,expectedDirector);
  assert.equal(spec.status,'draft');
  assert.equal(spec.policy.additionalSpendUsd,0);
  assert.deepEqual(spec.policy.permissions,[]);
  assert.equal(spec.policy.maxAiCalls,0);
  assert.equal(spec.policy.noAutoMerge,true);
  assert.equal(spec.policy.noAutoDeploy,true);
  assert.equal(classification(projectId,'plan').director,expectedDirector);
 }
});
test('No project can perform high risk actions even if a caller forges approval flags',()=>{
 for(const projectId of Object.keys(PROJECTS)){
  for(const action of ['merge','deploy','publish','send_email','send_message',
   'external_health_data','paid_suno','purchase','unlimited_ai',
   'run_untrusted_code_with_secrets']){
   const result=capability(projectId,action,{approved:true,verifiedBudget:true});
   assert.equal(result.allowed,false,projectId+' '+action);
  }
  assert.equal(capability(projectId,'plan',{approved:false,verifiedBudget:true}).allowed,false);
  assert.equal(capability(projectId,'plan',{approved:true,verifiedBudget:false}).allowed,false);
  assert.equal(capability(projectId,'plan',{approved:true,verifiedBudget:true}).allowed,true);
 }
 assert.equal(capability('wellbeing','read_repo',{approved:true}).allowed,false);
 assert.equal(capability('studio','write_branch',{approved:true}).allowed,false);
 assert.equal(capability('pokemon','draft_lyrics',{approved:true}).allowed,false);
});
test('Unsafe resource caps and invalid mission identities fail closed',()=>{
 for(const limit of [{maxSteps:9},{maxSteps:0},{maxAiCalls:9},{maxAiCalls:-1},
  {maxAttempts:0},{maxAttempts:4},{maxAiCalls:'8'}]){
  assert.throws(()=>missionSpec({...ids,goal:'x',projectId:'pokemon',limit}),/unsafe_limit/);
 }
 assert.throws(()=>missionSpec({...ids,goal:'x',projectId:'unknown'}),/unknown_project/);
 assert.throws(()=>missionSpec({...ids,ownerId:'wrong',goal:'x',projectId:'pokemon'}),/invalid_mission/);
 assert.throws(()=>missionSpec({...ids,goal:' ',projectId:'pokemon'}),/invalid_mission/);
});
test('Mission terminal states cannot resume or be silently requeued',()=>{
 for(const state of ['completed','failed','cancelled']){
  assert.throws(()=>transition(state,'queued'),/invalid_mission_transition/);
 }
 assert.deepEqual(transition('draft','queued'),{from:'draft',to:'queued'});
 assert.deepEqual(transition('paused_budget','queued'),{from:'paused_budget',to:'queued'});
 assert.throws(()=>transition('draft','completed'),/invalid_mission_transition/);
});
test('SQL storage has atomic leases, replay receipts, owner RLS and no web-client write privileges',()=>{
 const sql=fs.readFileSync('sql/paperworld_autonomous_core_v5.sql','utf8');
 for(const name of ['paperworld_autonomous_missions_v5','paperworld_autonomous_steps_v5',
  'paperworld_autonomous_events_v5','paperworld_v5_claim_step',
  'paperworld_v5_complete_step','paperworld_v5_reclaim_expired'])assert.match(sql,new RegExp(name));
 assert.match(sql,/for update of s skip locked/);
 assert.match(sql,/lease_owner=p_worker/);
 assert.match(sql,/lease_expires_at>now\(\)/);
 assert.match(sql,/create policy autonomous_missions_read_v5/);
 assert.match(sql,/create policy autonomous_steps_read_v5/);
 assert.match(sql,/create policy autonomous_events_read_v5/);
 assert.match(sql,/revoke all on public\.paperworld_autonomous_missions_v5/);
 assert.match(sql,/revoke all on function public\.paperworld_v5_claim_step/);
 assert.match(sql,/grant execute on function public\.paperworld_v5_claim_step\(uuid,integer\) to service_role/);
 assert.doesNotMatch(sql,/grant\s+(insert|update|delete)\s+on[^;]*to authenticated/i);
});
