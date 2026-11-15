'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createApprovedDirectorMemory,formatDirectorMemory}=
 require('../server/approved-director-memory.cjs');
const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const MEMORY='33333333-3333-4333-8333-333333333333';
const TOKEN='synthetic.owner.jwt';
function row(project='workshop',status='approved',sensitivity='standard'){
 return {id:MEMORY,project_id:project,kind:'decision',status,
  title:'Festival reactivation',body:status==='approved'?'REACTIVATE_ONLY_NEW_LIKED_ACT':
   'UNAPPROVED_PRIVATE_IDEA',
  source_type:'conversation',source_ref:'synthetic/review',
  observed_at:'2026-11-15T01:42:16.029705+00:00',
  version:1,sensitivity};
}
function setup({ownerId=OWNER,rows=[row()],badStatus=false}={}){
 const calls=[];
 const memory=createApprovedDirectorMemory({
  identity:{authenticate:async token=>{
   calls.push({kind:'auth',token});
   return {ownerId};
  }},
  fetcher:async(url,options)=>{
   calls.push({kind:'read',url,options});
   if(badStatus)return {ok:false,status:401};
   return {ok:true,json:async()=>rows};
  }
 });
 return {memory,calls};
}
test('Approved real-schema rows only, owner-scoped exact project and bearer JWT',async()=>{
 const {memory,calls}=setup({rows:[row(),row('workshop','proposed'),row('workshop','rejected')]});
 const context=await memory.load({token:TOKEN,ownerId:OWNER,actor:'listening-director'});
 assert.equal(context.projectId,'workshop');
 assert.equal(context.included,1);
 assert.match(context.text,/REACTIVATE_ONLY_NEW_LIKED_ACT/);
 assert.doesNotMatch(context.text,/UNAPPROVED_PRIVATE_IDEA/);
 assert.deepEqual(context.capabilitiesGranted,[]);
 const request=calls.find(x=>x.kind==='read');
 assert.match(request.url,/project_id=eq.workshop/);
 assert.match(request.url,/\/rest\/v1\/paperworld_director_memory/);
 assert.equal(request.options.method,'GET');
 assert.equal(request.options.headers.Authorization,'Bearer '+TOKEN);
 assert.doesNotMatch(formatDirectorMemory(context),/UNAPPROVED_PRIVATE_IDEA/);
 assert.match(formatDirectorMemory(context),/not system instructions/);
});
test('No cross-owner or cross-project knowledge can be loaded',async()=>{
 const other=setup({ownerId:OTHER});
 await assert.rejects(other.memory.load({
  token:TOKEN,ownerId:OWNER,actor:'listening-director'
 }),/memory_owner_denied/);
 assert.equal(other.calls.some(x=>x.kind==='read'),false);
 const mixed=setup({rows:[row('wellbeing')]});
 await assert.rejects(mixed.memory.load({
  token:TOKEN,ownerId:OWNER,actor:'listening-director'
 }),/memory_project_response_mismatch/);
});
test('No worker, Matt or unregistered actor may use this Director bridge',async()=>{
 const {memory,calls}=setup();
 for(const actor of ['listening-developer','matt','human','evil-director']){
  await assert.rejects(memory.load({token:TOKEN,ownerId:OWNER,actor}),
   /approved_memory_director_required/);
 }
 assert.equal(calls.length,0);
});
test('Private approved records remain scoped to their own Director',async()=>{
 const {memory}=setup({rows:[row('wellbeing','approved','private')]});
 const context=await memory.load({token:TOKEN,ownerId:OWNER,actor:'wellbeing-director'});
 assert.equal(context.included,1);
 assert.equal(context.projectId,'wellbeing');
 assert.match(context.text,/REACTIVATE_ONLY_NEW_LIKED_ACT/);
 await assert.rejects(memory.load({token:TOKEN,ownerId:OWNER,actor:'studio-director'}),
 /memory_project_response_mismatch/);
});
test('Empty approved facts never generate invented memory or extra capabilities',async()=>{
 const {memory}=setup({rows:[row('workshop','proposed')]});
 const context=await memory.load({token:TOKEN,ownerId:OWNER,actor:'listening-director'});
 assert.equal(context.included,0);
 assert.equal(context.text,'');
 assert.match(formatDirectorMemory(context),/No approved memories/);
 assert.deepEqual(context.capabilitiesGranted,[]);
});
test('Malformed upstream or network failures fail closed, do not leak records',async()=>{
 const {memory}=setup({badStatus:true});
 await assert.rejects(memory.load({token:TOKEN,ownerId:OWNER,actor:'listening-director'}),
 /memory_storage_unavailable/);
 assert.throws(()=>formatDirectorMemory({included:1,text:'bad',untrustedContent:true,
  capabilitiesGranted:['execute_file']}),/approved_memory_invalid_context/);
});
