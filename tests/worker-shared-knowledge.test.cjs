'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createApprovedDirectorMemory,formatWorkerMemory}=
 require('../server/approved-director-memory.cjs');
const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const REQUEST='33333333-3333-4333-8333-333333333333';
const TOKEN='synthetic.owner.jwt';
function row({project='workshop',sensitivity='standard',status='approved',id=REQUEST,body='STANDARD_SHARED_FACT'}={}){
 return {id,project_id:project,kind:'preference',status,
  title:'Project preference',body,source_type:'conversation',
  source_ref:'synthetic/owner-review',observed_at:'2026-11-19T01:00:00Z',
  version:1,sensitivity};
}
function fixture({rows=[row()],owner=OWNER}={}){
 const calls=[];
 const memory=createApprovedDirectorMemory({
  identity:{authenticate:async()=>({ownerId:owner})},
  fetcher:async(url,opts)=>{
   calls.push({url,opts});
   return {ok:true,json:async()=>rows.filter(r=>r.status==='approved')};
  }});
 return {memory,calls};
}
const grant=(actor='listening-developer',ownerId=OWNER)=>({
 ownerId,actor,projectId:actor==='listening-developer'?'workshop':'pokemon',
 requestId:REQUEST,approved:true
});
test('worker sees standard approved knowledge only, not private or pending entries',async()=>{
 const {memory,calls}=fixture({rows:[
  row(),row({id:OTHER,sensitivity:'private',body:'PRIVATE_NOT_FOR_WORKERS'}),
  row({id:'44444444-4444-4444-8444-444444444444',status:'proposed',body:'NOT_APPROVED'})
 ]});
 const ctx=await memory.loadWorker({token:TOKEN,ownerId:OWNER,
  actor:'listening-developer',taskGrant:grant(),query:'Project preference'});
 assert.equal(ctx.projectId,'workshop');
 assert.equal(ctx.included,1);
 const prompt=formatWorkerMemory(ctx);
 assert.match(prompt,/STANDARD_SHARED_FACT/);
 assert.doesNotMatch(prompt,/PRIVATE_NOT_FOR_WORKERS|NOT_APPROVED/);
 assert.match(prompt,/NOT CURRENT CODE/);
 assert.deepEqual(ctx.capabilitiesGranted,[]);
 assert.ok(calls.every(x=>x.opts.headers.Authorization==='Bearer '+TOKEN));
});
test('Pokémon worker uses own project and never accesses Listening Mirror records',async()=>{
 const {memory}=fixture({rows:[row({project:'pokemon',body:'POKEMON_SHARED_RULE'})]});
 const ctx=await memory.loadWorker({token:TOKEN,ownerId:OWNER,
  actor:'pokemon-developer',taskGrant:grant('pokemon-developer')});
 assert.match(formatWorkerMemory(ctx),/POKEMON_SHARED_RULE/);
 assert.equal(ctx.projectId,'pokemon');
});
test('Worker access requires a trusted per-task owner and correct actor/project',async()=>{
 const {memory,calls}=fixture();
 for(const [actor,g] of [
  ['matt',grant()],['studio-director',grant()],
  ['listening-developer',{...grant(),approved:false}],
  ['listening-developer',{...grant(),ownerId:OTHER}],
  ['listening-developer',{...grant(),projectId:'wellbeing'}],
  ['listening-developer',{...grant(),requestId:'fake'}],
  ['pokemon-developer',grant('listening-developer')]
 ]){
  await assert.rejects(memory.loadWorker({token:TOKEN,ownerId:OWNER,actor,taskGrant:g}));
 }
 assert.equal(calls.length,0);
 const wrongOwner=fixture({owner:OTHER});
 await assert.rejects(wrongOwner.memory.loadWorker({token:TOKEN,ownerId:OWNER,
  actor:'listening-developer',taskGrant:grant()}),/memory_owner_denied/);
});
test('Cross-project storage rows and forged capabilities fail closed',async()=>{
 const wrong=fixture({rows:[row({project:'wellbeing',body:'SENSITIVE'})]});
 await assert.rejects(wrong.memory.loadWorker({token:TOKEN,ownerId:OWNER,
  actor:'listening-developer',taskGrant:grant()}),/memory_project_response_mismatch/);
 assert.throws(()=>formatWorkerMemory({actor:'listening-developer',included:1,
  text:'untrusted',untrustedContent:true,capabilitiesGranted:['tool_write']}),
  /worker_memory_invalid_context/);
});
