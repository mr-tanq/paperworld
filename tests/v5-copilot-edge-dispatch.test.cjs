'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const adapterPath='../supabase/functions/paperworld-copilot-dispatch/index.mjs';
let createDispatcher;
test.before(async()=>{({createDispatcher}=await import(adapterPath));});
const trigger='test-trigger-secret-0000000000000000000000';
const token='synthetic_github_token_0123456789';
const service='sb_secret_synthetic_service_key';
const missionId='11111111-1111-4111-8111-111111111111';
const stepId='22222222-2222-4222-8222-222222222222';
const effectKey='copilot:'+missionId;
const marker='<!-- paperworld-v5-effect:'+effectKey+' -->';
const secrets=key=>({
 PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,
 GITHUB_COPILOT_USER_TOKEN:token,
 SUPABASE_SERVICE_ROLE_KEY:service
})[key];
function makeFake({enabled=true,postResult='assigned',phase='start_agent'}={}){
 const calls=[],step={step_id:stepId,mission_id:missionId,
 issue_number:1,effect_key:effectKey,capability:phase};
 let issueBody='Synthetic one-step task',assigned=false;
 const fetcher=async(url,opts)=>{
  const method=opts.method||'GET';const u=new URL(url);
  calls.push({url,method,body:opts.body});
  if(u.hostname.includes('supabase.co')){
   if(u.pathname.endsWith('paperworld_autonomous_controller_v5'))
    return {ok:true,json:async()=>[{dispatch_enabled:enabled,
     live_adapters:enabled?['copilot_agent']:[]}]};
   if(u.pathname.includes('/rpc/')){
    const name=u.pathname.split('/').pop();
    const result={
     paperworld_v5_claim_copilot_pilot:[step],
     paperworld_v5_begin_effect:'reserved',
     paperworld_v5_confirm_effect:true,
     paperworld_v5_complete_step:true,
     paperworld_v5_record_unverified_copilot_pr:true,
     paperworld_v5_defer_step:true,
     paperworld_v5_mark_copilot_uncertain:true,
     paperworld_v5_fail_step:true
    };
    if(!(name in result))throw Error('unknown database rpc '+name);
    return {ok:true,json:async()=>result[name]};
   }
   if(u.pathname.endsWith('paperworld_autonomous_missions_v5'))
    return {ok:true,json:async()=>[{created_at:new Date().toISOString()}]};
  }
  if(u.hostname==='api.github.com'){
   if(u.pathname.endsWith('/issues/1')&&method==='PATCH'){
    issueBody=JSON.parse(opts.body).body;return {ok:true,json:async()=>({number:1})};
   }
   if(u.pathname.endsWith('/issues/1/assignees')){
    if(postResult==='timeout')throw Error('simulated response lost');
    assigned=true;return {ok:true,json:async()=>({
     assignees:[{login:'copilot-swe-agent[bot]'}]})};
   }
   if(u.pathname.endsWith('/issues/1'))return {ok:true,json:async()=>({
    number:1,state:'open',title:'Synthetic',body:issueBody,
    assignees:assigned?[{login:'copilot-swe-agent[bot]'}]:[]})};
   if(u.pathname.endsWith('/pulls'))return {ok:true,json:async()=>[{
    number:17,draft:true,html_url:'https://github.com/mr-tanq/pokemon-echoes/pull/17',
    user:{login:'copilot-swe-agent[bot]'},body:'Fixes #1'
   }]};
  }
  throw Error('unexpected fetch '+method+' '+url);
 };
 const handler=createDispatcher({environment:secrets,fetcher});
 const invoke=()=>handler.handle(new Request('http://localhost/',{method:'POST',
  headers:{authorization:'Bearer '+trigger}}));
 return {handler,invoke,calls,marker};
}
test('No GitHub token, service key, or trigger auth means no database or model calls',async()=>{
 let count=0;
 const h=createDispatcher({environment:()=>undefined,fetcher:async()=>{count++;throw Error('called')}});
 const r=await h.handle(new Request('http://localhost/',{method:'POST'}));
 assert.equal(r.status,503);assert.equal(count,0);
 const f=makeFake();
 const wrong=await f.handler.handle(new Request('http://localhost/',{method:'POST',
  headers:{authorization:'Bearer wrong'}}));
 assert.equal(wrong.status,401);assert.equal(f.calls.length,0);
});
test('Database kill switch blocks every outbound GitHub API call',async()=>{
 const f=makeFake({enabled:false});
 const r=await f.invoke();
 assert.equal((await r.json()).state,'disabled');
 assert.equal(f.calls.filter(c=>c.url.includes('api.github.com')).length,0);
 assert.equal(f.calls.filter(c=>c.url.includes('/rpc/')).length,0);
});
test('Full start path reserves DB effect BEFORE one assignment and then waits for PR',async()=>{
 const f=makeFake();
 const r=await f.invoke(),value=await r.json();
 assert.equal(r.status,200);
 assert.equal(value.state,'agent_assigned');
 const ops=f.calls.filter(c=>c.url.includes('/rpc/')||c.url.includes('/assignees'));
 const reserve=ops.findIndex(c=>c.url.includes('paperworld_v5_begin_effect'));
 const assign=ops.findIndex(c=>c.url.includes('/assignees'));
 const confirm=ops.findIndex(c=>c.url.includes('paperworld_v5_confirm_effect'));
 assert.ok(reserve>=0&&assign>reserve&&confirm>assign);
 assert.equal(f.calls.filter(c=>c.url.includes('/assignees')).length,1);
 assert.equal(f.calls.filter(c=>c.url.includes('issues/1')&&c.method==='PATCH').length,1);
 assert.equal(value.sessionsStarted,1);
});
test('After ambiguous GitHub timeout never resend assignment and mark effect uncertain',async()=>{
 const f=makeFake({postResult:'timeout'});
 const r=await f.invoke(),value=await r.json();
 assert.equal(value.state,'needs_you');
 assert.equal(value.reason,'assignment_uncertain_do_not_retry');
 assert.equal(f.calls.filter(c=>c.url.includes('/assignees')).length,1);
 assert.equal(f.calls.filter(c=>c.url.includes('paperworld_v5_mark_copilot_uncertain')).length,1);
});
test('Polling PR does not start a second AI session',async()=>{
 const f=makeFake({phase:'await_pr'});
 // Existing issue has a marker and an existing assignee after a previously
 // completed start. Exposed as a fake GET response without any POST.
 const original=f.handler; // replaced fetcher in separate fixture below
 const g=createDispatcher({environment:secrets,fetcher:async(url,opts)=>{
  const method=opts.method||'GET';
  if(url.includes('paperworld_autonomous_controller_v5'))
   return {ok:true,json:async()=>[{dispatch_enabled:true,live_adapters:['copilot_agent']}]};
  if(url.includes('rpc/paperworld_v5_claim_copilot_pilot'))
   return {ok:true,json:async()=>[{step_id:stepId,mission_id:missionId,
    issue_number:1,effect_key:effectKey,capability:'await_pr'}]};
  if(url.includes('rpc/paperworld_v5_record_unverified_copilot_pr'))return {ok:true,json:async()=>true};
  if(url.includes('/issues/1'))return {ok:true,json:async()=>({
   number:1,state:'open',title:'synthetic',body:marker,
   assignees:[{login:'copilot-swe-agent[bot]'}]})};
  if(url.includes('/pulls'))return {ok:true,json:async()=>[{
   number:5,html_url:'https://github.com/mr-tanq/pokemon-echoes/pull/5',
   draft:true,user:{login:'copilot-swe-agent[bot]'},body:'Closes #1'
  }]};
  throw Error('unexpected network '+method+' '+url);
 }});
 const r=await g.handle(new Request('http://localhost/',{method:'POST',
  headers:{authorization:'Bearer '+trigger}}));
 assert.equal((await r.json()).state,'pr_found_requires_independent_verification');
});
test('Portable Edge adapter stays equivalent to tested backend adapter',()=>{
 const cjs=fs.readFileSync('server/v5-copilot-issue-adapter.cjs','utf8');
 const esm=fs.readFileSync('supabase/functions/paperworld-copilot-dispatch/copilot-agent.mjs','utf8');
 assert.equal(esm,cjs.replace('module.exports=Object.freeze({createCopilotIssueAdapter,allowedRepo,validateIntent});',
 'export {createCopilotIssueAdapter,allowedRepo,validateIntent};'));
});
