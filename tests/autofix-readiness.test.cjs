'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createAutofixReadiness,REQUIREMENTS}=require('../server/autofix-readiness.cjs');
const ownerId='22222222-2222-4222-8222-222222222222';
const source=()=>({repository:'mr-tanq/concerts',baseCommitSha:'a'.repeat(40),
 readOnly:true,trustedSources:{'js/ticketswap-check.js':{},'js/concert-ticketswap.js':{}}});
function make({sourceFails=false,missing=[],broken=[]}={}){
 const calls=[];
 const probes=Object.fromEntries(REQUIREMENTS.map(key=>[key,async ctx=>{
  calls.push(key);assert.equal(ctx.ownerId,ownerId);
  if(broken.includes(key))throw Error('PRIVATE_KEY_NEVER_LOG');
  return !missing.includes(key);
 }]));
 const reader=async ctx=>{calls.push('source');assert.equal(ctx.repository,'mr-tanq/concerts');
  if(sourceFails)throw Error('PRIVATE_SOURCE_TOKEN');return source()};
 return {checker:createAutofixReadiness({readSources:reader,probes}),calls};
}
test('Reports all true probes but NEVER switches on autonomous writes',async()=>{
 const f=make();const result=await f.checker.inspect({ownerId});
 assert.equal(result.sourceReadReady,true);
 assert.deepEqual(result.missing,[]);
 assert.equal(result.autonomousWritesEnabled,false);
 assert.equal(result.canPublishDraftPR,false);
 assert.deepEqual(f.calls,['source',...REQUIREMENTS]);
});
test('Missing infrastructure and private probe exceptions appear only as safe codes',async()=>{
 const f=make({sourceFails:true,missing:['dedicatedSandboxHost'],broken:['atomicNonceStore']});
 const result=await f.checker.inspect({ownerId});
 assert.equal(result.sourceReadReady,false);
 assert.ok(result.missing.includes('pinnedGitHubSource'));
 assert.ok(result.missing.includes('dedicatedSandboxHost'));
 assert.ok(result.missing.includes('atomicNonceStore'));
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_KEY|PRIVATE_SOURCE/);
 assert.equal(result.canPublishDraftPR,false);
});
test('No readiness report from untrusted model booleans or missing probes',()=>{
 assert.throws(()=>createAutofixReadiness(),/trusted_readiness_probes_required/);
 assert.throws(()=>createAutofixReadiness({readSources:async()=>{},probes:{}}),
  /trusted_readiness_probes_required/);
});
