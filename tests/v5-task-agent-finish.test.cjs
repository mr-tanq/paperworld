'use strict';
// Phase 1: no dead wait. When Copilot reports it finished (timeline) and the
// head is stable across one poll, verification starts at once; otherwise the
// conservative 75-minute fallback still applies.
const test=require('node:test'),assert=require('node:assert/strict');
let createTaskDispatcher;
test.before(async()=>({createTaskDispatcher}=
 await import('../supabase/functions/paperworld-task-dispatch/index.mjs')));
const mission='11111111-1111-4111-8111-111111111111';
const owner='33333333-3333-4333-8333-333333333333';
const trigger='synthetic_test_secret_0123456789012345';
const HEAD='a'.repeat(40);
const T0=Date.parse('2026-11-20T16:30:00Z');
const spec={projectId:'listening',directorId:'listening-director',
 repository:'mr-tanq/concerts',title:'Fix missing concerts',summary:'s',acceptance:['a'],
 requiredTests:['festival_discovery'],allowedPaths:['js/'],maxFiles:3,noAutoMerge:true,noAutoDeploy:true};
function fixture({minutes,previous={},prTimeline=[],title='Fix concerts',head=HEAD}){
 const done=[],deferred=[];
 const marker='<!-- paperworld:task-v1:'+mission+':1 -->';
 const steps=['create_issue','start_agent','await_agent','verify','report'].map((capability,i)=>({
  id:String(i+1).repeat(8)+'-aaaa-4aaa-8aaa-'+'a'.repeat(12),seq:i+1,capability,
  state:i<2?'succeeded':i===2?'leased':'pending',input:{effectKey:'task-v1:'+mission+':'+(i+1)},
  output:capability==='create_issue'?{issueNumber:7,issueUrl:'https://github.com/mr-tanq/concerts/issues/7'}:
   capability==='await_agent'?previous:{}}));
 const json=v=>({ok:true,status:200,json:async()=>v});
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),method=opts.method||'GET';
  if(u.hostname.includes('supabase.co')){
   if(u.pathname.includes('/rpc/')){
    const name=u.pathname.split('/').pop(),args=JSON.parse(opts.body||'{}');
    if(name==='paperworld_v5_resume_due_budget')return json(0);
    if(name==='paperworld_v5_claim_task_step')return json([{step_id:steps[2].id,mission_id:mission,capability:'await_agent'}]);
    if(name==='paperworld_v5_finish_task_step'){done.push(args.p_result);return json(true)}
    if(name==='paperworld_v5_defer_task_step'){deferred.push(args.p_observation);return json(true)}
    throw Error('unexpected rpc '+name);
   }
   if(u.pathname.endsWith('/paperworld_autonomous_controller_v5'))
    return json([{engine:'v1',dispatch_enabled:true,live_adapters:['copilot_agent'],auto_merge_verified:true}]);
   if(u.pathname.endsWith('/paperworld_autonomous_effects_v5'))
    return json(u.searchParams.get('step_id')?[{step_id:steps[1].id,state:'done',confirmed_at:new Date(T0).toISOString()}]:[]);
   if(u.pathname.endsWith('/paperworld_autonomous_missions_v5'))
    return json([{id:mission,owner_id:owner,engine:'v1',project_id:'listening',status:'working',spec,policy:{}}]);
   if(u.pathname.endsWith('/paperworld_autonomous_steps_v5'))return json(steps);
  }
  if(u.hostname==='api.github.com'&&method==='GET'){
   const p=u.pathname.replace('/repos/mr-tanq/concerts','');
   if(p==='/issues/7')return json({number:7,state:'open',body:marker,assignees:[{login:'Copilot'}]});
   if(p==='/issues/7/timeline')return json([{event:'cross-referenced',source:{issue:{number:12,pull_request:{}}}}]);
   if(p==='/pulls/12')return json({number:12,state:'open',draft:true,title,html_url:'https://github.com/mr-tanq/concerts/pull/12',
    base:{ref:'main'},head:{ref:'copilot/fix-concerts',sha:head},body:'Fixes #7'});
   if(p==='/issues/12/timeline')return json(prTimeline);
  }
  throw Error('unexpected network '+method+' '+url);
 };
 const env=k=>({PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,GITHUB_COPILOT_USER_TOKEN:'synthetic_github_token_0000000000000',
  SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_test_only_00000000000000000'})})[k];
 const d=createTaskDispatcher({environment:env,fetcher,clock:()=>T0+minutes*60000});
 const run=async()=>(await d.handle(new Request('https://example.invalid/',{method:'POST',
  headers:{authorization:'Bearer '+trigger}}))).json();
 return {run,done,deferred};
}
const stablePrev=min=>({headSha:HEAD,stableSince:T0+min*60000});
const finished=[{event:'copilot_work_started'},{event:'committed'},{event:'copilot_work_finished'}];
test('Copilot finished + head stable for one poll → verification starts after ~10 minutes, not 75',async()=>{
 const f=fixture({minutes:10,previous:stablePrev(5),prTimeline:finished});
 assert.equal((await f.run()).state,'agent_finished_waiting_verify');
 assert.equal(f.done[0].completion,'agent_signal');assert.equal(f.done[0].signal,'timeline');
 assert.equal(f.done[0].headSha,HEAD);
});
test('finish signal but head just changed → wait one more poll',async()=>{
 const f=fixture({minutes:10,previous:{headSha:'b'.repeat(40),stableSince:T0},prTimeline:finished});
 assert.equal((await f.run()).state,'awaiting_stable_head');
 assert.equal(f.done.length,0);assert.equal(f.deferred[0].headSha,HEAD);
});
test('Copilot started again after finishing (new round) → keep waiting',async()=>{
 const f=fixture({minutes:20,previous:stablePrev(5),
  prTimeline:[...finished,{event:'copilot_work_started'}]});
 assert.equal((await f.run()).state,'awaiting_stable_head');
});
test('no timeline signal: title without [WIP] counts; [WIP] title keeps waiting',async()=>{
 const t=fixture({minutes:12,previous:stablePrev(5),title:'Fix missing concerts'});
 assert.equal((await t.run()).state,'agent_finished_waiting_verify');
 const w=fixture({minutes:12,previous:stablePrev(5),title:'[WIP] Fix missing concerts'});
 assert.equal((await w.run()).state,'awaiting_stable_head');
});
test('no signal at all still finishes through the 75-minute fallback',async()=>{
 const f=fixture({minutes:80,previous:stablePrev(50),title:'[WIP] x',prTimeline:[{event:'copilot_work_started'}]});
 assert.equal((await f.run()).state,'agent_finished_waiting_verify');
 assert.equal(f.done[0].completion,'conservative_fallback');
});
