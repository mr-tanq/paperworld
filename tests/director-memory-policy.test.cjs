'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PROJECT_IDS,DIRECTORS,authorizedProject,validateEntry,
 prepareProposal,projectContext}=require('../server/director-memory-policy.cjs');
const ID='11111111-1111-4111-8111-111111111111';
const stamp='2026-11-15T00:00:00Z';
function record(projectId='workshop',extra={}){
 return {id:ID,projectId,kind:'decision',status:'approved',
  title:'Keep image fallback',body:'Prefer authentic artist imagery.',
  sourceType:'owner_note',sourceRef:'owner-approved-2026-11-15',
  observedAt:stamp,version:1,sensitivity:'standard',...extra};
}
test('Every Director from registered roster has its own project namespace',()=>{
 assert.deepEqual(PROJECT_IDS,['town','workshop','pokemon','wellbeing','studio','shop']);
 assert.deepEqual(DIRECTORS,{
  'listening-director':'workshop','pokemon-director':'pokemon',
  'wellbeing-director':'wellbeing','studio-director':'studio','shop-director':'shop'
 });
 for(const [director,project] of Object.entries(DIRECTORS)){
  assert.equal(authorizedProject(director,project),true);
  for(const other of PROJECT_IDS.filter(p=>p!==project))
   assert.equal(authorizedProject(director,other),false);
 }
});
test('No cross-project inclusion, even if caller attempts to mix approved facts',()=>{
 const mixed=[record(),record('studio',{id:'22222222-2222-4222-8222-222222222222'})];
 assert.throws(()=>projectContext(mixed,{actor:'listening-director',projectId:'workshop'}),
  /mixed_project_records_denied/);
 assert.throws(()=>projectContext([record('studio')],{
  actor:'listening-director',projectId:'studio'}),/memory_access_denied/);
 assert.throws(()=>projectContext([record()],{actor:'studio-director',
  projectId:'workshop'}),/memory_access_denied/);
});
test('Workers need explicit per-task context approval and only receive standard entries',()=>{
 const standard=record(),sensitive=record('workshop',{
  id:'22222222-2222-4222-8222-222222222222',
  sensitivity:'private',body:'PRIVATE_DATA_DO_NOT_SHARE'});
 assert.throws(()=>projectContext([standard],{
  actor:'listening-developer',projectId:'workshop'}),/worker_memory_grant_required/);
 const result=projectContext([standard,sensitive],{
  actor:'listening-developer',projectId:'workshop',workerTaskApproved:true});
 assert.match(result.text,/authentic artist imagery/);
 assert.doesNotMatch(result.text,/PRIVATE_DATA/);
 assert.deepEqual(result.capabilitiesGranted,[]);
 assert.equal(result.untrustedContent,true);
 const director=projectContext([standard,sensitive],{
  actor:'listening-director',projectId:'workshop'});
 assert.match(director.text,/PRIVATE_DATA/);
});
test('Matt can access project summary with explicit handoff, but never private content',()=>{
 const items=[record(),record('workshop',{id:'22222222-2222-4222-8222-222222222222',
  sensitivity:'private',body:'PRIVATE'})];
 assert.throws(()=>projectContext(items,{actor:'matt',projectId:'workshop'}),
  /memory_access_denied/);
 const result=projectContext(items,{actor:'matt',projectId:'workshop',
  explicitHandoff:true});
 assert.doesNotMatch(result.text,/PRIVATE/);
 assert.equal(result.included,1);
});
test('Rejected, proposed and superseded knowledge never becomes operative context',()=>{
 const entries=['proposed','rejected','superseded','approved'].map((status,i)=>
  record('studio',{id:String(i+1).repeat(8)+'-1111-4111-8111-111111111111',
   status,body:'claim-'+status}));
 const ctx=projectContext(entries,{actor:'studio-director',projectId:'studio'});
 assert.equal(ctx.included,1);
 assert.match(ctx.text,/claim-approved/);
 assert.doesNotMatch(ctx.text,/claim-proposed|claim-rejected|claim-superseded/);
});
test('Proposed changes cannot be directly classified approved or assigned to another project',()=>{
 const proposed=prepareProposal(record('pokemon'),{actor:'pokemon-director'});
 assert.equal(proposed.status,'proposed');
 assert.throws(()=>prepareProposal(record('studio'),{actor:'pokemon-director'}),
  /cross_project_proposal_denied/);
 assert.throws(()=>prepareProposal(record('studio'),{actor:'matt'}),
  /cross_project_proposal_denied/);
});
test('Validation rejects unverified/missing provenance and unsafe oversized notes',()=>{
 for(const extra of [{sourceRef:''},{title:' '},{body:'x'.repeat(4001)},
  {projectId:'other'},{kind:'secret'},{observedAt:'yesterday'},
  {version:0},{sensitivity:'global'},{sourceType:'model_verified'}]){
  assert.throws(()=>validateEntry(record('workshop',extra)));
 }
});
test('Result context bounded and cannot issue tool authority',()=>{
 const result=projectContext([record()],{
  actor:'listening-director',projectId:'workshop',maxChars:256});
 assert.equal(result.capabilitiesGranted.length,0);
 assert.equal(result.untrustedContent,true);
 assert.ok(result.text.length<=256);
 assert.ok(Object.isFrozen(result));
});
