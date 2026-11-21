/* Paperworld owner-authenticated autonomous mission intake and read-only status.
 * No unattended work, scheduling, AI calls, billing, or GitHub writes here.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {missionSpec}=require('./v5-autonomous-policy.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PUB='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const ORIGIN='https://mr-tanq.github.io';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function makeAutonomousMissionApi({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY,
 guard=createSupabaseGuard({baseUrl:BASE,publicKey:PUB,fetcher})}={}){
 const configured=typeof secret==='string'&&
  (secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 async function query(method,resource,body){
  if(!configured)throw Error('autonomous_store_not_configured');
  const response=await fetcher(BASE+'/rest/v1/'+resource,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    Accept:'application/json','Content-Type':'application/json',
    ...(method==='POST'?{Prefer:'return=representation'}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response?.ok)throw Error('autonomous_store_unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('autonomous_store_invalid_reply');
  return rows;
 }
 async function handle({headers={},body,action}={}){
  const deny=(status,error)=>({status,body:{error}});
  if(headers.origin!==ORIGIN)return deny(403,'origin_denied');
  if(!['create','list','status','simulate','pilot'].includes(action)||typeof body!=='string'||
   Buffer.byteLength(body,'utf8')>5500)return deny(400,'invalid_request');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  let input;try{input=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  if(!UUID.test(input?.threadId||''))return deny(400,'invalid_thread');
  let ownerId;try{
   const token=bearer.slice(7);
   ({ownerId}=await guard.authenticate(token));
   if(!await guard.ownsThread({token,ownerId,threadId:input.threadId,agentId:'matt'}))
    return deny(404,'thread_not_found');
  }catch(_){return deny(401,'unauthorized')}
  if(!configured)return deny(503,'autonomous_store_not_configured');
  try{
   if(action==='status'){
    const rows=await query('GET',
     'paperworld_autonomous_controller_v5?select=last_tick_at,tick_count,dispatch_enabled,live_adapters,credit_snapshot,credit_snapshot_at,credit_stop_at,allow_unmetered_copilot&singleton=eq.true&limit=1');
    const last=rows.length===1?rows[0].last_tick_at:null;
    const millis=typeof last==='string'?Date.parse(last):NaN;
    const healthy=Number.isFinite(millis)&&
     millis<=Date.now()+60000&&Date.now()-millis<15*60*1000;
    const conf=rows.length===1?rows[0]:null;
    const lastCredit=conf?.credit_snapshot_at?Date.parse(conf.credit_snapshot_at):NaN;
    const pilotQueueEnabled=conf?.dispatch_enabled===true&&
      Array.isArray(conf?.live_adapters)&&conf.live_adapters.includes('copilot_agent')&&
      (conf?.allow_unmetered_copilot===true||
       (Number.isFinite(conf?.credit_snapshot)&&
        Number.isFinite(conf?.credit_stop_at)&&
        conf.credit_snapshot<conf.credit_stop_at&&
        Number.isFinite(lastCredit)&&Date.now()-lastCredit<24*60*60*1000));
    return {status:200,body:{controller:{
     supervisor:healthy?'active':'not_verified',
     lastTickAt:Number.isFinite(millis)?last:null,
     autonomousExecution:false,modelCallsEnabled:false,pilotQueueEnabled,
     nextPhase:'verified_worker_dispatch'
    }}};
   }
   if(action==='list'){
    const qs=new URLSearchParams({select:'id,project_id,goal,status,policy,spec,report,last_error,created_at,updated_at',
     owner_id:'eq.'+ownerId,thread_id:'eq.'+input.threadId,
     order:'created_at.desc',limit:'20'});
    const rows=await query('GET','paperworld_autonomous_missions_v5?'+qs);
    return {status:200,body:{missions:rows.map(r=>({
     id:r.id,projectId:r.project_id,goal:r.goal,status:r.status,
     title:typeof r.spec?.title==='string'?r.spec.title.slice(0,120):null,
     simulation:r.policy?.executionMode==='simulation',
     // Who started it: the owner, a Director's own initiative, or the automatic retry.
     source:r.policy?.initiative===true?'initiative':r.policy?.retryOf?'retry':'owner',
     report:r.status==='completed'?r.report:null,
     // Stop reason code only (never free text), so the card can explain it.
     lastError:['needs_you','failed'].includes(r.status)&&/^[a-z_]{1,60}$/.test(r.last_error||'')?r.last_error:null,
     createdAt:r.created_at,updatedAt:r.updated_at}))}};
   }
   if(action==='pilot'){
    if(Object.keys(input).sort().join(',')!=='consent,missionId,threadId'||
     input.consent!==true||!UUID.test(input.missionId||''))
     return deny(400,'explicit_pilot_consent_required');
    const qs=new URLSearchParams({
     select:'id,project_id,status,policy',id:'eq.'+input.missionId,
     owner_id:'eq.'+ownerId,thread_id:'eq.'+input.threadId,limit:'1'});
    const found=await query('GET','paperworld_autonomous_missions_v5?'+qs);
    if(found.length!==1||found[0].project_id!=='pokemon'||
     found[0].status!=='draft'||
     found[0].policy?.maxAiCalls!==0||
     found[0].policy?.additionalSpendUsd!==0)
     return deny(409,'copilot_pilot_not_ready');
    const res=await fetcher(BASE+'/rest/v1/rpc/paperworld_v5_queue_copilot_pilot',{
     method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
     headers:{apikey:secret,...(secret.startsWith('eyJ')?
      {Authorization:'Bearer '+secret}:{}),
      Accept:'application/json','Content-Type':'application/json'},
     body:JSON.stringify({p_mission:input.missionId,p_issue:1})});
    if(!res?.ok)throw Error('copilot_pilot_queue_unavailable');
    if(await res.json()!==true)return deny(409,'copilot_pilot_disabled_or_unavailable');
    return {status:200,body:{
     queued:true,missionId:input.missionId,
     repository:'mr-tanq/pokemon-echoes',issueNumber:1,
     execution:'real_copilot_pilot',autoMerge:false,autoDeploy:false,
     sessionBudget:1}};
   }
   if(action==='simulate'){
    if(Object.keys(input).sort().join(',')!=='missionId,threadId'||
     !UUID.test(input.missionId||''))return deny(400,'invalid_mission');
    const qs=new URLSearchParams({select:'id,owner_id,thread_id,status,project_id,policy',
     id:'eq.'+input.missionId,owner_id:'eq.'+ownerId,
     thread_id:'eq.'+input.threadId,limit:'1'});
    const found=await query('GET','paperworld_autonomous_missions_v5?'+qs);
    if(found.length!==1||found[0].status!=='draft'||
     found[0].policy?.maxAiCalls!==0||found[0].policy?.additionalSpendUsd!==0)
     return deny(409,'simulation_mission_not_ready');
    const response=await fetcher(BASE+'/rest/v1/rpc/paperworld_v5_queue_mission',{
     method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
     headers:{apikey:secret,...(secret.startsWith('eyJ')?
      {Authorization:'Bearer '+secret}:{}),
      Accept:'application/json','Content-Type':'application/json'},
     body:JSON.stringify({p_mission:input.missionId,p_mode:'simulation'})});
    if(!response?.ok)throw Error('simulation_queue_rpc_unavailable');
    const started=await response.json();
    if(started!==true)return deny(409,'simulation_already_queued');
    return {status:200,body:{queued:true,missionId:input.missionId,
     execution:'simulation_only',aiCalls:0,realWork:false}};
   }
   if(!['threadId','projectId','goal'].every(k=>Object.hasOwn(input,k))||
    Object.keys(input).length!==3)return deny(400,'invalid_mission');
   let spec;try{spec=missionSpec({
    ownerId,threadId:input.threadId,projectId:input.projectId,goal:input.goal
   })}catch(_){return deny(400,'invalid_mission')}
   // Cap owner draft accumulation; no browser can raise caps or grant AI.
   const capQuery=new URLSearchParams({select:'id',owner_id:'eq.'+ownerId,
    status:'eq.draft',limit:'21'});
   const existing=await query('GET','paperworld_autonomous_missions_v5?'+capQuery);
   if(existing.length>=20)return deny(409,'too_many_unstarted_missions');
   const payload={id:spec.id,owner_id:ownerId,thread_id:input.threadId,
    project_id:spec.projectId,goal:spec.goal,status:'draft',policy:spec.policy};
   const rows=await query('POST','paperworld_autonomous_missions_v5',payload);
   if(rows.length!==1||rows[0].owner_id!==ownerId||rows[0].status!=='draft'||
    rows[0].id!==spec.id)throw Error('invalid_created_mission');
   return {status:201,body:{mission:{id:spec.id,projectId:spec.projectId,
    director:spec.director,goal:spec.goal,status:'draft',
    execution:'not_started',spendingAllowed:false}}};
  }catch(_){return deny(503,'autonomous_store_unavailable')}
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeAutonomousMissionApi});
