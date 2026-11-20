'use strict';
// Phase 1b: when tests fail (or no PR arrives), the engine queues exactly ONE
// follow-up mission through the normal plan/queue path; never a second one.
const test=require('node:test'),assert=require('node:assert/strict');
let createTaskDispatcher;
test.before(async()=>({createTaskDispatcher}=
 await import('../supabase/functions/paperworld-task-dispatch/index.mjs')));
const mission='11111111-1111-4111-8111-111111111111';
const owner='33333333-3333-4333-8333-333333333333';
const thread='44444444-4444-4444-8444-444444444444';
const trigger='synthetic_test_secret_0123456789012345';
const HEAD='a'.repeat(40),MAIN='d'.repeat(40);
const T0=Date.parse('2026-11-20T16:30:00Z');
const spec={projectId:'listening',directorId:'listening-director',
 repository:'mr-tanq/concerts',title:'Fix missing concerts',summary:'Concerts are missing',acceptance:['a'],
 requiredTests:['festival_discovery'],allowedPaths:['js/'],maxFiles:3,noAutoMerge:true,noAutoDeploy:true};
function fixture({policy={},existingRetry=null,runConclusion='failure'}={}){
 const calls=[],rpcs=[];
 const steps=['create_issue','start_agent','await_agent','verify','report'].map((capability,i)=>({
  id:String(i+1).repeat(8)+'-aaaa-4aaa-8aaa-'+'a'.repeat(12),seq:i+1,capability,
  state:i<3?'succeeded':i===3?'leased':'pending',input:{effectKey:'task-v1:'+mission+':'+(i+1)},
  output:capability==='create_issue'?{issueNumber:7}:
   capability==='await_agent'?{prNumber:12,prUrl:'https://github.com/mr-tanq/concerts/pull/12',headSha:HEAD}:{}}));
 let retryRow=existingRetry;
 const json=v=>({ok:true,status:200,json:async()=>v});
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),method=opts.method||'GET';
  calls.push({path:u.pathname,method,query:u.search,body:opts.body?JSON.parse(opts.body):undefined});
  if(u.hostname.includes('supabase.co')){
   if(u.pathname.includes('/rpc/')){
    const name=u.pathname.split('/').pop(),args=JSON.parse(opts.body||'{}');
    rpcs.push({name,args});
    if(name==='paperworld_v5_resume_due_budget')return json(0);
    if(name==='paperworld_v5_claim_task_step')return json([{step_id:steps[3].id,mission_id:mission,capability:'verify'}]);
    if(name==='paperworld_v5_fail_step')return json(true);
    if(name==='paperworld_v5_plan_task'){retryRow.status='planned';return json(true)}
    if(name==='paperworld_v5_queue_task'){retryRow.status='queued';return json(true)}
    throw Error('unexpected rpc '+name);
   }
   if(u.pathname.endsWith('/paperworld_autonomous_controller_v5'))
    return json([{engine:'v1',dispatch_enabled:true,live_adapters:['copilot_agent'],auto_merge_verified:true}]);
   if(u.pathname.endsWith('/paperworld_autonomous_effects_v5'))
    return json(u.searchParams.get('step_id')==='eq.'+steps[3].id?[{step_id:steps[3].id,kind:'dispatch_verify',state:'started',
     external_id:'5',confirmed_at:new Date(T0).toISOString(),
     evidence:{mainSha:MAIN,headSha:HEAD,workflowBlob:'5ef7f441cd5d4efc71ab715d7616360d8f78d1b9',
      runUrl:'https://github.com/mr-tanq/concerts/actions/runs/5'}}]:[]);
   if(u.pathname.endsWith('/paperworld_autonomous_missions_v5')){
    const id=u.searchParams.get('id');
    if(method==='POST'){retryRow={...calls.at(-1).body};return json([retryRow])}
    if(id==='eq.'+mission)return json([{id:mission,owner_id:owner,thread_id:thread,goal:'Λείπουν συναυλίες',
     engine:'v1',project_id:'listening',status:'verifying',spec,policy}]);
    return json(retryRow?[{id:retryRow.id,status:retryRow.status}]:[]);
   }
   if(u.pathname.endsWith('/paperworld_autonomous_steps_v5'))return json(steps);
  }
  if(u.hostname==='api.github.com'&&method==='GET'){
   const p=u.pathname.replace('/repos/mr-tanq/concerts','');
   if(p==='/pulls/12')return json({number:12,state:'open',draft:true,head:{sha:HEAD},base:{ref:'main'}});
   if(p==='/pulls/12/files')return json([{filename:'js/a.js',status:'modified'}]);
   if(p==='/git/ref/heads/main')return json({object:{sha:MAIN}});
   if(p.startsWith('/contents/.github/workflows/paperworld-verify.yml'))return json({sha:'5ef7f441cd5d4efc71ab715d7616360d8f78d1b9'});
   if(p==='/actions/runs/5')return json({status:'completed',conclusion:runConclusion});
  }
  throw Error('unexpected network '+method+' '+url);
 };
 const env=k=>({PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,GITHUB_COPILOT_USER_TOKEN:'synthetic_github_token_0000000000000',
  SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_test_only_00000000000000000'})})[k];
 const d=createTaskDispatcher({environment:env,fetcher,clock:()=>T0+10*60000});
 const run=async()=>(await d.handle(new Request('https://example.invalid/',{method:'POST',
  headers:{authorization:'Bearer '+trigger}}))).json();
 return {run,calls,rpcs,retry:()=>retryRow};
}
test('failed tests: one follow-up mission is planned and queued, then the original stops',async()=>{
 const f=fixture();
 assert.equal((await f.run()).state,'needs_you');
 const r=f.retry();
 assert.ok(r,'retry mission inserted');
 assert.equal(r.owner_id,owner);assert.equal(r.thread_id,thread);assert.equal(r.project_id,'listening');
 assert.equal(r.status,'queued');assert.equal(r.policy.retryOf,mission);
 const plan=f.rpcs.find(x=>x.name==='paperworld_v5_plan_task');
 assert.match(plan.args.p_spec.summary,/^Concerts are missing\n\nPrevious attempt \(PR #12\) failed the required tests \(https:\/\/github.com\/mr-tanq\/concerts\/actions\/runs\/5\)/);
 assert.equal(plan.args.p_spec.requiredTests[0],'festival_discovery');
 assert.ok(plan.args.p_spec.summary.length<=800);
 const fail=f.rpcs.find(x=>x.name==='paperworld_v5_fail_step');
 assert.equal(fail.args.p_reason,'trusted_verification_failed');
 assert.ok(f.rpcs.indexOf(fail)>f.rpcs.findIndex(x=>x.name==='paperworld_v5_queue_task'));
});
test('a follow-up mission never retries again',async()=>{
 const f=fixture({policy:{retryOf:'99999999-9999-4999-8999-999999999999'}});
 assert.equal((await f.run()).state,'needs_you');
 assert.equal(f.retry(),null);
 assert.ok(!f.rpcs.some(x=>x.name==='paperworld_v5_plan_task'));
});
test('replay after a crash reuses the same deterministic retry, never a second one',async()=>{
 const first=fixture();await first.run();
 const id=first.retry().id;
 const again=fixture({existingRetry:{id,status:'queued'}});
 await again.run();
 assert.ok(!again.calls.some(c=>c.method==='POST'&&c.path.endsWith('/paperworld_autonomous_missions_v5')));
 assert.ok(!again.rpcs.some(x=>x.name==='paperworld_v5_queue_task'));
});
test('passing tests do not create a retry',async()=>{
 const f=fixture({runConclusion:'success'});
 await f.run().catch(()=>{});
 assert.equal(f.retry(),null);
});
