'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeSandboxPlan}=require('../server/autofix-sandbox-plan.cjs');
const {prepareCandidate}=require('../server/autofix-candidate-policy.cjs');
const taskId='11111111-1111-4111-8111-111111111111',base='a'.repeat(40),sha='b'.repeat(40);
const image='node:22-alpine@sha256:'+'c'.repeat(64);
const workspace='/var/lib/paperworld-autofix/jobs/'+taskId+'/work';
const initial="import {check} from './helper.js';\nexport const healthy=()=>true;\n";
const update="import {check} from './helper.js';\nexport const healthy=()=>false;\n";
const regression="import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('regression',()=>assert.equal(true,true));\n";
function example(){
 const candidate=prepareCandidate({
  repository:'mr-tanq/concerts',taskId,baseCommitSha:base,
  trustedSources:{'js/ticketswap-check.js':{sha,content:initial}},
  proposedFiles:[
   {path:'js/ticketswap-check.js',content:update},
   {path:'tests/autofix/ticketswap-regression.test.mjs',content:regression}
  ]
 });
 return {candidate,image,workspace,approvedImageDigest:'c'.repeat(64),expectedBaseSha:base};
}
test('Isolated syntax + regression plan contains no dangerous Docker flags or shell',()=>{
 const p=makeSandboxPlan(example());
 assert.equal(p.approvedForPublish,false);
 assert.equal(p.attestation,'not_issued');
 assert.equal(p.network,'disabled');assert.equal(p.secrets,'none');
 assert.equal(p.maxTotalChecks,4);
 assert.deepEqual(p.checks.map(c=>c.command),[
  ['node','--check','js/ticketswap-check.js'],
  ['node','--test','tests/autofix/ticketswap-regression.test.mjs']
 ]);
 const flags=p.containerOptions;
 for(const mandatory of ['--pull=never','--network=none','--read-only',
  '--cap-drop=ALL','--security-opt=no-new-privileges',
  '--user=65534:65534','--pids-limit=64','--memory=256m']){
  assert.ok(flags.includes(mandatory),mandatory);
 }
 assert.ok(flags.includes('--mount=type=bind,src='+workspace+',dst=/work,readonly'));
 assert.equal(flags.some(x=>/--privileged|--network=host|docker\.sock/.test(x)),false);
 assert.equal(flags.includes('sh'),false);
 assert.equal(flags.includes('bash'),false);
 assert.equal(p.candidateDigest.length,64);
});
test('Reject caller-controlled directories and images, including mutable tags',()=>{
 for(const changes of [
  {workspace:'/tmp/escape/work'},{workspace:workspace.replace(taskId,'other')},
  {image:'node:22-alpine'},{image:'evil.example/node:22-alpine@sha256:'+'c'.repeat(64)},
  {approvedImageDigest:'d'.repeat(64)}, {expectedBaseSha:'d'.repeat(40)}
 ]){
  assert.throws(()=>makeSandboxPlan({...example(),...changes}));
 }
});
test('Reject extra files, unauthorized source and missing tests',()=>{
 const a=example();a.candidate={...a.candidate,files:[
  ...a.candidate.files,{path:'package.json',kind:'modify',content:'{}'}]};
 assert.throws(()=>makeSandboxPlan(a),/candidate_path_denied/);
 const b=example();b.candidate={...b.candidate,files:[
  b.candidate.files[0],{path:'tests/secrets.test.mjs',kind:'new-test',content:regression}]};
 assert.throws(()=>makeSandboxPlan(b),/candidate_path_denied/);
 const c=example();c.candidate={...c.candidate,files:[
  c.candidate.files[0],{...c.candidate.files[0]}]};
 assert.throws(()=>makeSandboxPlan(c),/regression_test_missing/);
});
test('Plan cannot issue self-asserted sandbox success or unlock publication',()=>{
 const plan=makeSandboxPlan(example());
 assert.equal(Object.isFrozen(plan),true);
 assert.equal(Object.isFrozen(plan.containerOptions),true);
 assert.equal(Object.isFrozen(plan.checks),true);
 assert.equal(Object.isFrozen(plan.checks[0].command),true);
 assert.equal('passed' in plan,false);
 assert.equal('signature' in plan,false);
});
