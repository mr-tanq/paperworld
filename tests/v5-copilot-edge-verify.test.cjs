'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const MISSION='11111111-1111-4111-8111-111111111111';
const HEAD='a'.repeat(40),RUN=777,PR=19;
const TOKEN='synthetic_only_github_user_token_12345';
const TRIGGER='synthetic_dispatch_trigger_secret_123456789000';
let createDispatcher;
test.before(async()=>({createDispatcher}=await import('../supabase/functions/paperworld-copilot-dispatch/index.mjs')));
async function run({ci='green',role='bot'}={}){
 const history=[];
 const fetcher=async(url,opts)=>{
  const u=new URL(url);history.push({path:u.pathname,url,method:opts.method||'GET'});
  if(u.pathname.endsWith('/paperworld_autonomous_controller_v5'))
   return {ok:true,json:async()=>[{dispatch_enabled:true,live_adapters:['copilot_agent']}]};
  if(u.pathname.endsWith('/rpc/paperworld_v5_claim_copilot_pilot'))
   return {ok:true,json:async()=>[]};
  if(u.pathname.endsWith('/paperworld_autonomous_missions_v5'))
   return {ok:true,json:async()=>[{id:MISSION,owner_id:'22222222-2222-4222-8222-222222222222',
     status:'needs_you',last_error:'independent_godot_verification_required',project_id:'pokemon'}]};
  if(u.pathname.endsWith('/paperworld_autonomous_steps_v5'))
   return {ok:true,json:async()=>[{id:'33333333-3333-4333-8333-333333333333',
    capability:'await_pr',output:{prUrl:'https://github.com/mr-tanq/pokemon-echoes/pull/'+PR,
     verification:'not_independently_verified'}}]};
  if(u.pathname.endsWith('/pulls/'+PR))return {ok:true,json:async()=>({
   number:PR,draft:true,state:'open',head:{sha:HEAD,ref:'copilot/five-battle-tests'},base:{ref:'main'},
   user:{login:role==='bot'?'copilot-swe-agent[bot]':'attacker'},
   body:'Fixes #1 <!-- paperworld-v5-effect:copilot:'+MISSION+' -->'})};
  if(u.pathname.endsWith('/actions/workflows/paperworld-verify.yml/runs'))
   return {ok:true,json:async()=>({workflow_runs:[{
    id:RUN,event:'pull_request',status:'completed',
    conclusion:ci==='failed'?'failure':'success',
    head_sha:HEAD,path:'.github/workflows/paperworld-verify.yml',
    pull_requests:[{number:PR}],
    html_url:'https://github.com/mr-tanq/pokemon-echoes/actions/runs/'+RUN
   }]})};
  if(u.pathname.endsWith('/actions/runs/'+RUN+'/jobs'))
   return {ok:true,json:async()=>({jobs:[{
    name:'headless-godot',conclusion:'success',steps:[
      {name:'Run headless smoke test (must exit 0)',status:'completed',conclusion:'success'},
      {name:'Require five deterministic battle-damage regression cases',
       status:ci==='skipped'?'skipped':'completed',
       conclusion:ci==='skipped'?'skipped':'success'}
    ]}]})};
  if(u.pathname.endsWith('/rpc/paperworld_v5_finish_verified_copilot'))
   return {ok:true,json:async()=>true};
  throw Error('unexpected network '+url);
 };
 const env=k=>({
  PAPERWORLD_DISPATCH_TRIGGER_SECRET:TRIGGER,
  GITHUB_COPILOT_USER_TOKEN:TOKEN,
  SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic_service_role'
 })[k];
 const dispatcher=createDispatcher({environment:env,fetcher});
 const response=await dispatcher.handle(new Request('https://example.invalid/',{
  method:'POST',headers:{authorization:'Bearer '+TRIGGER}
 }));
 return {response:await response.json(),history};
}
test('Real CI success completes blocked Copilot mission without launching a second session',async()=>{
 const {response,history}=await run();
 assert.equal(response.state,'completed_verified');
 assert.equal(response.prNumber,PR);
 assert.equal(history.filter(x=>x.path.endsWith('/rpc/paperworld_v5_finish_verified_copilot')).length,1);
 assert.equal(history.filter(x=>x.path.endsWith('/assignees')).length,0);
 assert.equal(history.filter(x=>x.path.includes('paperworld_v5_begin_effect')).length,0);
});
test('Failed/skipped five-case check or wrong PR author prevents completion',async()=>{
 for(const settings of [{ci:'failed'},{ci:'skipped'},{role:'attacker'}]){
  const {response,history}=await run(settings);
  assert.equal(response.state,'no_verified_pr',JSON.stringify(settings));
  assert.equal(history.filter(x=>x.path.endsWith('/rpc/paperworld_v5_finish_verified_copilot')).length,0);
 }
});
