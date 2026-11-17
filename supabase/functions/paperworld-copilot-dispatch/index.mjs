/* Paperworld V5 Copilot Pro Edge Dispatcher — DISABLED until secrets + budget verified.
 * A scheduled trusted invocation processes at most ONE queued step.
 * No browser CORS, model calls, external publication, merges or deployment.
 * The only billable call is an existing issue's single Copilot assignment,
 * preceded by a durable, DB-enforced effect/session reservation.
 */
import {createCopilotIssueAdapter} from './copilot-agent.mjs';
const PROJECT_URL='https://jrevhzvrgenucuozjowm.supabase.co';
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff'}});
function createDispatcher({environment,fetcher=fetch}={}){
 const env=(key)=>environment?.(key);
 async function db(path,method='POST',body){
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!key)throw Error('supabase_secret_missing');
  const r=await fetcher(PROJECT_URL+'/rest/v1/'+path,{
   method,redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{'apikey':key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),
    'Accept':'application/json','Content-Type':'application/json',
    ...(method==='POST'?{'Prefer':'return=representation'}:{})},
   ...(method==='POST'?{body:JSON.stringify(body||{})}:{})});
  if(!r?.ok)throw Error('database_action_failed');
  return r.json();
 }
 async function rpc(name,args){
  if(!/^paperworld_v5_[a-z_]+$/.test(name))
   throw Error('unsupported_rpc');
  return db('rpc/'+name,'POST',args);
 }
 async function processStep(){
  const options=await db('paperworld_autonomous_controller_v5?select=dispatch_enabled,live_adapters&singleton=eq.true&limit=1','GET');
  if(options.length!==1||options[0].dispatch_enabled!==true||
   !options[0].live_adapters?.includes('copilot_agent'))
   return {state:'disabled',sessionsStarted:0};
  const worker=crypto.randomUUID();
  const rows=await rpc('paperworld_v5_claim_copilot_pilot',{p_worker:worker,p_seconds:600});
  if(!Array.isArray(rows)||rows.length===0)return {state:'idle',sessionsStarted:0};
  if(rows.length!==1)throw Error('unexpected_claim_count');
  const step=rows[0];
  if(!uuid.test(step.step_id)||!uuid.test(step.mission_id)||
   step.issue_number!==1||step.effect_key!=='copilot:'+step.mission_id||
   !['start_agent','await_pr'].includes(step.capability))
   throw Error('unsafe_claim_reply');
  const adapter=createCopilotIssueAdapter({fetcher,token:env('GITHUB_COPILOT_USER_TOKEN')});
  const projectId='pokemon';
  const issueNumber=step.issue_number;
  const effectKey=step.effect_key;
  if(step.capability==='await_pr'){
   const found=await adapter.reconcile({projectId,issueNumber,effectKey});
   if(found.state==='pr_found'&&found.prUrl){
    const completed=await rpc('paperworld_v5_record_unverified_copilot_pr',{
     p_step:step.step_id,p_worker:worker,
     p_pr_url:found.prUrl,p_pr_number:found.prNumber});
    if(completed!==true)throw Error('completion_not_persisted');
    return {state:'pr_found_requires_independent_verification',
     missionId:step.mission_id,prUrl:found.prUrl,sessionsStarted:0};
   }
   const missionRows=await db('paperworld_autonomous_missions_v5?select=created_at&id=eq.'+
     step.mission_id+'&limit=1','GET');
   const started=missionRows.length===1?Date.parse(missionRows[0].created_at):NaN;
   if(!Number.isFinite(started)||Date.now()-started>120*60*1000){
    await rpc('paperworld_v5_fail_step',{p_step:step.step_id,p_worker:worker,
     p_reason:'copilot_pr_not_verified_before_deadline',p_retryable:false});
    return {state:'needs_you',reason:'no_confirmed_pr',sessionsStarted:0};
   }
   if(await rpc('paperworld_v5_defer_step',{p_step:step.step_id,p_worker:worker,p_seconds:300})!==true)
    throw Error('poll_defer_failed');
   return {state:'awaiting_pr',sessionsStarted:0};
  }
  const prep=await adapter.prepareIssue({projectId,issueNumber,effectKey});
  if(prep.state!=='prepared'){
   await rpc('paperworld_v5_fail_step',{p_step:step.step_id,p_worker:worker,
    p_reason:'issue_marker_preparation_uncertain',p_retryable:false});
   return {state:'needs_you',reason:'issue_preparation_uncertain',sessionsStarted:0};
  }
  const reserved=await rpc('paperworld_v5_begin_effect',{
   p_step:step.step_id,p_worker:worker,p_key:effectKey,
   p_adapter:'copilot_agent',p_kind:'start_agent'});
  if(reserved!=='reserved'){
   if(reserved!=='budget_denied')await rpc('paperworld_v5_fail_step',{
    p_step:step.step_id,p_worker:worker,p_reason:'effect_reservation_refused',p_retryable:false});
   return {state:reserved==='budget_denied'?'paused_budget':'needs_you',sessionsStarted:0};
  }
  const response=await adapter.assign({projectId,issueNumber,effectReceipt:{
   state:'reserved',adapter:'copilot_agent',kind:'start_agent',
   verifiedBudget:true,allowedByDatabase:true,sessions:1,
   effectKey,stepId:step.step_id,issueNumber,projectId
  }});
  if(response.state!=='assigned'&&response.state!=='already_assigned'){
   await rpc('paperworld_v5_mark_copilot_uncertain',{p_key:effectKey,p_worker:worker});
   return {state:'needs_you',reason:'assignment_uncertain_do_not_retry',sessionsStarted:0};
  }
  const confirmed=await rpc('paperworld_v5_confirm_effect',{
   p_key:effectKey,p_worker:worker,
   p_reference:{issueNumber,repo:response.repo,assignment:response.state},
   p_done:true});
  if(confirmed!==true)throw Error('effect_confirmation_not_persisted');
  const finished=await rpc('paperworld_v5_complete_step',{
   p_step:step.step_id,p_worker:worker,
   p_result:{issueNumber,repo:response.repo,assignment:response.state,
    sessionReserved:true,prVerified:false}});
  if(finished!==true)throw Error('step_completion_not_persisted');
  return {state:'agent_assigned',missionId:step.mission_id,issueNumber,
   sessionsStarted:response.state==='assigned'?1:0};
 }
 async function handle(request){
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  const secret=env('PAPERWORLD_DISPATCH_TRIGGER_SECRET');
  const token=env('GITHUB_COPILOT_USER_TOKEN');
  const service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!secret||secret.length<32||!service||!token)
   return json(503,{error:'credentials_not_configured'});
  if(request.headers.get('authorization')!=='Bearer '+secret)
   return json(401,{error:'unauthorized'});
  try{return json(200,await processStep())}
  catch(_){return json(503,{error:'dispatch_paused_needs_reconciliation'})}
 }
 return Object.freeze({handle,processStep});
}
export {createDispatcher};
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function'){
 Deno.serve(createDispatcher({environment:(key)=>Deno.env.get(key)}).handle);
}
