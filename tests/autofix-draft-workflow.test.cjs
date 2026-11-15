'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createDraftAutofix,MAX_AI_TURNS,MAX_JOBS_PER_DAY}=
 require('../server/autofix-draft-workflow.cjs');
const repo='mr-tanq/concerts',taskId='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222',sha='a'.repeat(40);
const old="import {helper} from './module.js';\nexport const check=()=>true;\n";
const next="import {helper} from './module.js';\nexport const check=()=>false;\n";
const regression="import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('regression',()=>assert.equal(2,2));\n";
const input={taskId,ownerId,request:'TicketSwap check stopped working'};
function fake({authorized=true,budget=true,quotaAllowed=true,passed=true,
 networkDisabled=true,secretsMounted=false,turnsUsed=4,draft=true}={}){
 const seen=[];
 const authorize=async()=>{seen.push('authorize');return {ownerId,scope:'ticketing',allowDraftPR:authorized,zeroOverageVerified:budget}};
 const quota={claim:async config=>{seen.push('quota:'+config.limit);return quotaAllowed}};
 const readSources=async()=>{seen.push('source');return {repository:repo,baseCommitSha:sha,
  trustedSources:{'js/ticketswap-check.js':{sha,content:old}}}};
 const analyze=async config=>{seen.push('analyze');assert.equal(config.allowance,5);
  return {turnsUsed,files:[{path:'js/ticketswap-check.js',content:next},
   {path:'tests/autofix/ticketswap-check-regression.test.mjs',content:regression}]}};
 const sandboxVerify=async args=>{seen.push('sandbox');assert.equal(args.network,'disabled');assert.equal(args.secrets,'none');
  return {passed,networkDisabled,secretsMounted,baseCommitSha:sha,testNames:['ticketing regression']}};
 const publisher={createDraftPullRequest:async props=>{seen.push('publisher');assert.equal(props.draft,true);
  assert.equal(props.repository,repo);assert.equal(props.candidate.merge,'blocked');
  assert.equal(props.candidate.deployment,'blocked');
  return {draft,repository:repo,url:'https://github.com/mr-tanq/concerts/pull/123'}}};
 const audit=async item=>{seen.push('audit:'+item.event)};
 return {service:createDraftAutofix({authorize,quota,readSources,analyze,sandboxVerify,publisher,audit}),seen};
}
test('Draft-only workflow: verified source, budget, sandbox tests then draft PR',async()=>{
 const {service,seen}=fake();
 const result=await service.run(input);
 assert.equal(result.state,'draft_pr_created');
 assert.equal(result.draft,true);
 assert.equal(result.merge,'blocked');assert.equal(result.deployment,'blocked');
 assert.equal(result.prUrl,'https://github.com/mr-tanq/concerts/pull/123');
 assert.deepEqual(seen,['authorize','quota:2','audit:reserved','source','analyze',
  'sandbox','authorize','publisher','audit:draft_pr_created']);
 assert.equal(MAX_AI_TURNS,5);assert.equal(MAX_JOBS_PER_DAY,2);
});
test('Budget/approval and quota deny BEFORE reading code or spending calls',async()=>{
 for(const opts of [{authorized:false},{budget:false},{quotaAllowed:false}]){
  const {service,seen}=fake(opts);
  await assert.rejects(service.run(input),/autofix_not_authorized|daily_limit_reached/);
  assert.equal(seen.includes('analyze'),false);
  assert.equal(seen.includes('publisher'),false);
 }
});
test('Unverified source, model turn count and sandbox attestation deny publishing',async()=>{
 for(const opts of [{turnsUsed:6},{passed:false},{networkDisabled:false},
  {secretsMounted:true}]){
  const {service,seen}=fake(opts);
  await assert.rejects(service.run(input),/turn_limit_unverified|sandbox_verification_required/);
  assert.equal(seen.includes('publisher'),false);
 }
});
test('Publisher must confirm DRAFT PR in exact allowed repository',async()=>{
 const {service,seen}=fake({draft:false});
 await assert.rejects(service.run(input),/draft_pr_not_verified/);
 assert.ok(seen.includes('publisher'));
 assert.equal(seen.includes('audit:draft_pr_created'),false);
});
test('Adapter requirements fail closed; no hidden execution path',async()=>{
 assert.throws(()=>createDraftAutofix({}),/trusted_adapters_required/);
 const {service}=fake();
 await assert.rejects(service.run({...input,ownerId:'unauthorized'}),/invalid_request/);
});
