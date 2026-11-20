'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeMattTaskIntake}=require('../server/v5-matt-task-intake.cjs');
const {parseIntent}=require('../server/matt-semantic-router.cjs');
const OWNER='11111111-1111-4111-8111-111111111111';
const THREAD='22222222-2222-4222-8222-222222222222';
const REQUEST='33333333-3333-4333-8333-333333333333';
const MODEL=JSON.stringify({title:'Fix concert matching filter',
 summary:'One bounded code and regression change',acceptance:['The festival regression passes'],
 requiredTests:['festival_revisit'],allowedPaths:['js/','tests/'],maxFiles:3});
function setup({engine='v1',enabled=true,queue=true}={}){
 const calls=[];
 let saved=null;
 const fetcher=async(url,opts)=>{
  const path=new URL(url).pathname,method=opts.method;
  calls.push({path,method,body:opts.body&&JSON.parse(opts.body)});
  const response=data=>({ok:true,json:async()=>data});
  if(path.endsWith('/paperworld_autonomous_controller_v5'))return response([{
   engine,dispatch_enabled:true,live_adapters:['copilot_agent']}]);
  if(path.endsWith('/paperworld_autonomous_missions_v5')){
   if(method==='GET')return response(saved?[saved]:[]);
   if(method==='POST'){
    const payload=JSON.parse(opts.body);
    if(saved)throw Error('duplicate_mission');
    saved={...payload};return response([{...payload}]);
   }
  }
  if(path.endsWith('/paperworld_v5_plan_task')){
   if(!saved||saved.status!=='draft')return response(false);
   saved.status='planned';saved.spec=JSON.parse(opts.body).p_spec;
   return response(true);
  }
  if(path.endsWith('/paperworld_v5_queue_task')){
   if(queue&&saved&&saved.status==='planned')saved.status='queued';
   return response(queue);
  }
  throw Error('unexpected call '+path);
 };
 const intake=makeMattTaskIntake({fetcher,enabled:()=>enabled,
  secret:'sb_secret_synthetic_in_test_123456789012345'});
 const args={ownerId:OWNER,threadId:THREAD,requestId:REQUEST,
  directorId:'listening-director',message:'Improve the festival recommendations',
  modelOutput:MODEL};
 return {intake,args,calls};
}
test('semantic Matt router accepts coding build; rejects wellbeing execution',()=>{
 assert.deepEqual(parseIntent('{"director":"listening-director","action":"build"}'),
  {director:'listening-director',action:'build',consult:null,workerId:null});
 assert.deepEqual(parseIntent('{"director":"pokemon-director","action":"build"}'),
  {director:'pokemon-director',action:'build',consult:null,workerId:null});
 assert.equal(parseIntent('{"director":"studio-director","action":"build"}'),null);
 assert.equal(parseIntent('{"director":"wellbeing-director","action":"build"}'),null);
});
test('disabled engine prevents mission writes and model-supplied tasks',async()=>{
 for(const config of [{enabled:false},{engine:'pilot'},{engine:'off'}]){
  const {intake,args,calls}=setup(config);
  assert.equal(await intake.available(),false);
  assert.deepEqual(await intake.submit(args),{state:'disabled'});
  assert.equal(calls.filter(x=>x.method==='POST').length,0);
 }
});
test('one authenticated plan is created with owner, thread and requestId',async()=>{
 const {intake,args,calls}=setup();
 const result=await intake.submit(args);
 assert.equal(result.state,'queued');assert.equal(result.projectId,'listening');
 assert.equal(result.autoMerge,false);assert.equal(result.autoDeploy,false);
 const writes=calls.filter(x=>x.method==='POST');
 assert.equal(writes.length,3);
 assert.equal(writes[0].body.owner_id,OWNER);
 assert.equal(writes[0].body.thread_id,THREAD);
 assert.equal(writes[0].body.id,REQUEST);
 assert.equal(writes[0].body.policy.maxSteps,5);
 assert.equal(writes[0].body.policy.maxAiCalls,0);
 assert.equal(writes[1].body.p_spec.repository,'mr-tanq/concerts');
 assert.equal(writes[2].body.p_mission,REQUEST);
});
test('model cannot choose repo or forbidden paths, no SQL writes',async()=>{
 for(const model of [
  {...JSON.parse(MODEL),repository:'mr-tanq/pokemon-echoes'},
  {...JSON.parse(MODEL),allowedPaths:['.github/']},
  {...JSON.parse(MODEL),requiredTests:['untrusted_test']}]){
  const {intake,args,calls}=setup();
  await assert.rejects(intake.submit({...args,modelOutput:JSON.stringify(model)}));
  assert.equal(calls.filter(x=>x.method==='POST').length,0);
 }
});
test('a planned but unqueued mission never claims a Worker started',async()=>{
 const {intake,args}=setup({queue:false});
 const r=await intake.submit(args);
 assert.equal(r.state,'planned');
 assert.equal(r.autoMerge,false);
});

test('request replay returns existing mission without duplicate insert or queue',async()=>{
 const {intake,args,calls}=setup();
 const first=await intake.submit(args),second=await intake.submit(args);
 assert.equal(first.state,'queued');
 assert.equal(second.state,'queued');
 assert.equal(second.replayed,true);
 assert.equal(calls.filter(x=>x.method==='POST').length,3);
});
test('request replay cannot cross ownership, thread, or goal boundaries',async()=>{
 const {intake,args,calls}=setup();
 await intake.submit(args);
 for(const modified of [
  {...args,ownerId:'44444444-4444-4444-8444-444444444444'},
  {...args,threadId:'55555555-5555-4555-8555-555555555555'},
  {...args,message:'Change a different feature'}])
  await assert.rejects(intake.submit(modified),/task_replay_scope_conflict/);
 assert.equal(calls.filter(x=>x.method==='POST').length,3);
});
test('planned mission resumes queueing without creating another row',async()=>{
 const {intake,args,calls}=setup({queue:false});
 const r=await intake.submit(args);
 assert.equal(r.state,'planned');
 const again=await intake.submit(args);
 assert.equal(again.state,'planned');
 assert.equal(calls.filter(x=>x.path.endsWith('paperworld_autonomous_missions_v5')&&x.method==='POST').length,1);
});
