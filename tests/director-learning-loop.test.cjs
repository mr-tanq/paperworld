'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ownerCorrectionProposal}=require('../server/director-learning-loop.cjs');
const threadId='11111111-1111-4111-8111-111111111111';
const messageId='22222222-2222-4222-8222-222222222222';
const entryId='33333333-3333-4333-8333-333333333333';
const input={actor:'listening-director',ownerConfirmed:true,threadId,messageId,
 entryId,observedAt:'2026-11-19T00:00:00Z',title:'Concert image rule',
 correction:'Prefer real artist images over generic fallback.'};
test('learning correction stays an unapproved, scoped, no-action proposal',()=>{
 const p=ownerCorrectionProposal(input);
 assert.equal(p.projectId,'workshop');
 assert.equal(p.status,'proposed');
 assert.equal(p.sourceType,'conversation');
 assert.equal(p.sourceRef,'owner-thread:'+threadId+'/message:'+messageId);
 assert.equal(p.sensitivity,'private');
 assert.equal(p.requiresOwnerReview,true);
 assert.equal(p.execution,'none');
 assert.deepEqual(p.capabilitiesGranted,[]);
 assert.ok(Object.isFrozen(p));
});
test('four directors never borrow another project or sensitivity by default',()=>{
 for(const [actor,projectId] of Object.entries({
  'listening-director':'workshop','pokemon-director':'pokemon',
  'studio-director':'studio','wellbeing-director':'wellbeing'
 })){
  const p=ownerCorrectionProposal({...input,actor});
  assert.equal(p.projectId,projectId);
  assert.equal(p.sensitivity,'private');
 }
});
test('no autonomous or model-invented correction can become approved memory',()=>{
 for(const invalid of [{ownerConfirmed:false},{actor:'matt'},{actor:'pokemon-developer'},
  {threadId:'bad'},{messageId:'bad'},{kind:'work_history'},
  {sensitivity:'global'},{correction:''},{title:''},
  {correction:'x'.repeat(4001)},{observedAt:'not-a-date'}]){
  assert.throws(()=>ownerCorrectionProposal({...input,...invalid}));
 }
});
