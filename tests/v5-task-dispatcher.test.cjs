'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let createTaskDispatcher;
test.before(async()=>({createTaskDispatcher}=
 await import('../supabase/functions/paperworld-task-dispatch/index.mjs')));
const mission='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222';
const trigger='synthetic_test_secret_0123456789012345';
const githubToken='synthetic_github_token_0000000000000';
const owner='33333333-3333-4333-8333-333333333333';
const marker='<!-- paperworld:task-v1:'+mission+':1 -->';
const spec={projectId:'listening',directorId:'listening-director',
 repository:'mr-tanq/concerts',title:'Test one change',
 summary:'A safe narrow change',acceptance:['A regression is fixed'],
 requiredTests:['festival_revisit'],allowedPaths:['tests/'],maxFiles:2,
 noAutoMerge:true,noAutoDeploy:true};
function fixture({enabled=true,assignment='Copilot'}={}){
 const calls=[];
 const steps=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',seq:1,capability:'create_issue',
  state:'succeeded',input:{effectKey:'task-v1:'+mission+':1'},
  output:{issueNumber:7,issueUrl:'https://github.com/mr-tanq/concerts/issues/7'}},
 {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',seq:2,capability:'start_agent',
  state:'leased',input:{effectKey:'task-v1:'+mission+':2'},output:{}},
 ...['await_agent','verify','report'].map((capability,i)=>({
  id:'c'+String(i).repeat(35),seq:i+3,capability,state:'pending',
  input:{effectKey:'task-v1:'+mission+':'+(i+3)},output:{}
 }))];
 const fetcher=async(url,opts)=>{
  const u=new URL(url),method=opts.method||'GET';
  calls.push({url,method,body:opts.body});
  if(u.hostname.includes('supabase.co')){
   if(u.pathname.includes('/rpc/')){
    const name=u.pathname.split('/').pop();
    if(name==='paperworld_v5_resume_due_budget')return {ok:true,json:async()=>0};
    if(name==='paperworld_v5_claim_task_step')return {ok:true,json:async()=>[
     {step_id:steps[1].id,mission_id:mission,capability:'start_agent'}]};
    if(name==='paperworld_v5_begin_effect')return {ok:true,json:async()=> 'reserved'};
    if(name==='paperworld_v5_confirm_effect'||name==='paperworld_v5_finish_task_step'||
     name==='paperworld_v5_mark_task_uncertain')return {ok:true,json:async()=>true};
    throw Error('unknown database RPC: '+name);
   }
   if(u.pathname.endsWith('/paperworld_autonomous_controller_v5'))
    return {ok:true,json:async()=>[{engine:enabled?'v1':'pilot',
     dispatch_enabled:true,live_adapters:['copilot_agent']}]};
   if(u.pathname.endsWith('/paperworld_autonomous_effects_v5'))
    return {ok:true,json:async()=>[]};
   if(u.pathname.endsWith('/paperworld_autonomous_missions_v5'))
    return {ok:true,json:async()=>[{id:mission,owner_id:owner,
     engine:'v1',project_id:'listening',status:'queued',spec,policy:{maxAiCalls:1}}]};
   if(u.pathname.endsWith('/paperworld_autonomous_steps_v5'))
    return {ok:true,json:async()=>steps};
  }
  if(u.hostname==='api.github.com'){
   if(u.pathname.endsWith('/issues/7'))
    return {ok:true,status:200,json:async()=>({number:7,state:'open',body:marker,
     assignees:[]})};
   if(u.pathname.endsWith('/issues/7/assignees'))
    return {ok:true,status:200,json:async()=>({
     assignees:[{login:assignment}]})};
  }
  throw Error('unexpected network '+method+' '+url);
 };
 const env=k=>({
  PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,
  GITHUB_COPILOT_USER_TOKEN:githubToken,
  SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_test_only_00000000000000000'})
 })[k];
 const dispatcher=createTaskDispatcher({environment:env,fetcher});
 const invoke=()=>dispatcher.handle(new Request('https://example.invalid/',{
  method:'POST',headers:{authorization:'Bearer '+trigger}
 }));
 return {calls,invoke,dispatcher};
}
test('disabled gate means no GitHub call or paid reservation',async()=>{
 const f=fixture({enabled:false}),r=await f.invoke();
 assert.equal((await r.json()).state,'disabled');
 assert.equal(f.calls.filter(c=>c.url.includes('api.github.com')).length,0);
 assert.equal(f.calls.filter(c=>c.url.includes('paperworld_v5_begin_effect')).length,0);
});
test('DB effect reservation strictly precedes one paid GitHub agent assignment',async()=>{
 const f=fixture(),r=await f.invoke(),v=await r.json();
 assert.equal(r.status,200,JSON.stringify(v));
 assert.equal(v.state,'agent_assigned');
 assert.equal(v.sessionsStarted,1);
 const op=f.calls.findIndex(c=>c.url.includes('paperworld_v5_begin_effect'));
 const post=f.calls.findIndex(c=>c.url.endsWith('/assignees'));
 const confirm=f.calls.findIndex(c=>c.url.includes('paperworld_v5_confirm_effect'));
 assert.ok(op>=0&&post>op&&confirm>post);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/assignees')).length,1);
});
test('unknown Copilot identity is uncertain and never repeats the paid POST',async()=>{
 const f=fixture({assignment:'unexpected-agent'}),r=await f.invoke(),v=await r.json();
 assert.equal(r.status,200);
 assert.equal(v.state,'reconciling');
 assert.equal(f.calls.filter(c=>c.url.endsWith('/assignees')).length,1);
 assert.equal(f.calls.filter(c=>c.url.includes('paperworld_v5_mark_task_uncertain')).length,1);
 assert.equal(f.calls.filter(c=>c.url.includes('paperworld_v5_confirm_effect')).length,0);
});
test('forged bearer cannot touch Supabase or GitHub',async()=>{
 const f=fixture();
 const r=await f.dispatcher.handle(new Request('https://example.invalid/',{
  method:'POST',headers:{authorization:'Bearer wrong'}
 }));
 assert.equal(r.status,401);assert.equal(f.calls.length,0);
});
