'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const v5=require('../server/team-orchestrator-v5.cjs');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const grantId='33333333-3333-4333-8333-333333333333';
const newJob=(project='listening')=>v5.createJob({ownerId,threadId,request:'Please inspect the project',project});
function advance(job,state,actor,extras={}){
 return v5.advance(job,{revision:job.revision,state,actor,proof:'synthetic test event',...extras});
}
test('all project directors have strictly isolated registered Workers',()=>{
 for(const [project,p] of Object.entries(v5.PROJECTS)){
  assert.ok(p.director&&Object.keys(p.workers).length>0);
  for(const [worker,abilities] of Object.entries(p.workers)){
   for(const capability of abilities)
    assert.equal(v5.validateAssignment({project,director:p.director,worker,capability}).worker,worker);
  }
 }
 assert.throws(()=>v5.validateAssignment({project:'studio',director:'studio-director',
  worker:'listening-developer',capability:'source_read'}),/unauthorized_assignment/);
 assert.throws(()=>v5.validateAssignment({project:'wellbeing',director:'listening-director',
  worker:'wellbeing-research',capability:'analysis'}),/unauthorized_assignment/);
 assert.throws(()=>v5.validateAssignment({project:'pokemon',director:'pokemon-director',
  worker:'pokemon-developer',capability:'deploy'}),/unauthorized_assignment/);
});
test('owner consent is required at exact job revision, never inferred from AI narrative',()=>{
 let job=newJob();
 job=advance(job,'assigned','matt',{assignment:{
  director:'listening-director',worker:'listening-developer',capability:'source_read'}});
 job=advance(job,'awaiting_consent','listening-director');
 assert.equal(v5.nextAction(job).action,'ask_owner');
 assert.throws(()=>advance(job,'ready','matt'),/fresh_consent_required/);
 assert.throws(()=>advance(job,'ready','owner',{consent:{
  jobId:job.id,revision:0,capability:'source_read',grantId,authorized:true
 }}),/fresh_consent_required/);
 job=advance(job,'ready','owner',{consent:{
  jobId:job.id,revision:job.revision,capability:'source_read',grantId,authorized:true
 }});
 assert.equal(v5.resumeDecision(job,{expectedRevision:job.revision}).action,'manual_review');
 assert.equal(v5.resumeDecision(job,{expectedRevision:job.revision,serverApproved:true}).action,
  'request_server_execution');
 assert.throws(()=>v5.resumeDecision(job,{expectedRevision:0,serverApproved:true}),/stale_job_revision/);
 assert.throws(()=>advance(job,'running','listening-director'),/worker_required/);
 job=advance(job,'running','listening-developer');
 assert.throws(()=>advance(job,'review','listening-director',{result:{
  verified:false,summary:'Seems done'}}),/verified_result_required/);
 job=advance(job,'review','listening-director',{result:{
  verified:true,summary:'Source inspected; no file edits'}}); 
 job=advance(job,'completed','matt');
 assert.equal(v5.nextAction(job).terminal,true);
 assert.equal(v5.resumeDecision(job,{expectedRevision:job.revision,serverApproved:true}).action,'none');
 assert.throws(()=>advance(job,'running','listening-developer'),/invalid_transition/);
});
test('cross-project reassignments, owner spoofing and unsafe approvals fail closed',()=>{
 const job=newJob('pokemon');
 assert.throws(()=>advance(job,'assigned','matt',{assignment:{
  director:'listening-director',worker:'listening-developer',capability:'source_read'
 }}),/unauthorized_assignment/);
 assert.throws(()=>advance(job,'assigned','pokemon-director',{assignment:{
  director:'pokemon-director',worker:'pokemon-developer',capability:'analysis'
 }}),/assignment_required/);
 assert.throws(()=>v5.createJob({ownerId:'not-uuid',threadId,project:'studio',request:'hello'}),/invalid_job/);
 assert.throws(()=>v5.createJob({ownerId,threadId,project:'unknown',request:'hello'}),/unknown_project/);
});
test('cancelled jobs cannot restart; failed jobs are explicit manual retry',()=>{
 let a=newJob('studio');
 a=advance(a,'assigned','matt',{assignment:{
  director:'studio-director',worker:'studio-creative',capability:'creative_brief'
 }});
 a=advance(a,'cancelled','owner');
 assert.equal(v5.resumeDecision(a,{expectedRevision:a.revision}).action,'none');
 assert.throws(()=>advance(a,'ready','owner'),/invalid_transition/);
 let b=newJob('listening');
 b=advance(b,'assigned','matt',{assignment:{
  director:'listening-director',worker:'listening-developer',capability:'analysis'
 }});
 b=advance(b,'awaiting_consent','listening-director');
 b=advance(b,'ready','owner',{consent:{
  jobId:b.id,revision:b.revision,grantId,authorized:true,capability:'analysis'
 }});
 b=advance(b,'running','listening-developer');
 b=advance(b,'failed','matt');
 assert.equal(v5.nextAction(b).action,'owner_retry_as_new_job');
 assert.equal(v5.resumeDecision(b,{expectedRevision:b.revision,serverApproved:true}).action,'none');
});
test('pure coordinator has no network, filesystem, model or provider execution',()=>{
 const fs=require('node:fs');
 const s=fs.readFileSync(require.resolve('../server/team-orchestrator-v5.cjs'),'utf8');
 assert.doesNotMatch(s,/\b(fetch|sendAndWait|execSync|spawn|setInterval|setTimeout|createPullRequest)\s*\(/);
 assert.ok(!Object.values(v5.PROJECTS).some(p=>Object.values(p.workers).flat().includes('spend')));
});
