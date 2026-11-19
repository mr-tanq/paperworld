/* PAPERWORLD Routine Loop V3: explicit owner-only schedule review & controls.
 * No AI calls, no cron writes, no auto-queue or external effects.
 * The existing V1 schema must be independently deployed before this works.
 */
'use strict';
const {randomUUID}=require('node:crypto');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {normalizeRoutine}=require('./routine-loop-policy.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PUB='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const ORIGIN='https://mr-tanq.github.io';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const AUTH=/^Bearer [A-Za-z0-9_.-]{12,4096}$/;
const answer=(status,body)=>({status,body});
function nextUtcSlot(day,hour,minute,now=new Date()){
 const today=new Date(now.getTime());
 const diff=(day-today.getUTCDay()+7)%7;
 const proposed=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),
  today.getUTCDate()+diff,hour,minute));
 if(proposed<=today)proposed.setUTCDate(proposed.getUTCDate()+7);
 return proposed.toISOString();
}
function makeRoutineOwnerApi({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY,
 identity,now=()=>new Date(),baseUrl=BASE,publicKey=PUB}={}){
 const guard=identity||createSupabaseGuard({fetcher,baseUrl,publicKey});
 const validSecret=typeof secret==='string'&&
  (secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 async function db(method,resource,payload){
  if(!validSecret)throw Error('routine_store_not_configured');
  const response=await fetcher(baseUrl+'/rest/v1/'+resource,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?
    {Authorization:'Bearer '+secret}:{}),
    Accept:'application/json','Content-Type':'application/json',
    ...(method!=='GET'?{Prefer:'return=representation'}:{})},
   ...(payload===undefined?{}:{body:JSON.stringify(payload)})
  });
  if(!response?.ok)throw Error('routine_store_unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('routine_store_invalid_response');
  return rows;
 }
 function validTime(payload){
  return Number.isInteger(payload?.dayOfWeek)&&payload.dayOfWeek>=0&&
   payload.dayOfWeek<=6&&Number.isInteger(payload.hourUtc)&&
   payload.hourUtc>=0&&payload.hourUtc<=23&&
   Number.isInteger(payload.minuteUtc)&&payload.minuteUtc>=0&&
   payload.minuteUtc<=59;
 }
 async function handle({headers={},body,action}={}){
  if(headers.origin!==ORIGIN)return answer(403,{error:'origin_denied'});
  if(!AUTH.test(headers.authorization||''))return answer(401,{error:'unauthorized'});
  if(!['preview','create','list','enable','pause'].includes(action)||
   typeof body!=='string'||Buffer.byteLength(body)>1800)
   return answer(400,{error:'invalid_request'});
  let input;
  try{input=JSON.parse(body)}catch(_){return answer(400,{error:'invalid_json'})}
  if(!input||Array.isArray(input)||typeof input!=='object'||
   !UUID.test(input.threadId||''))return answer(400,{error:'invalid_thread'});
  const token=headers.authorization.slice(7);
  let ownerId;
  try{
   const user=await guard.authenticate(token);
   ownerId=user?.ownerId;
   if(!UUID.test(ownerId||''))return answer(401,{error:'unauthorized'});
   if(!await guard.ownsThread({ownerId,threadId:input.threadId,
    agentId:'matt',token}))return answer(404,{error:'thread_not_found'});
  }catch(_){return answer(401,{error:'unauthorized'})}
  const t=now();
  if(!(t instanceof Date)||!Number.isFinite(t.getTime()))
   return answer(503,{error:'clock_unavailable'});
  if(action==='preview'||action==='create'){
   if(Object.keys(input).sort().join(',')!==
    (action==='preview'?
     'dayOfWeek,goal,hourUtc,minuteUtc,projectId,threadId':
     'confirmed,dayOfWeek,goal,hourUtc,minuteUtc,projectId,threadId'))
    return answer(400,{error:'invalid_routine_fields'});
   if(!validTime(input))return answer(400,{error:'invalid_schedule'});
   let plan;
   try{
    plan=normalizeRoutine({ownerId,threadId:input.threadId,
     routineId:randomUUID(),projectId:input.projectId,
     goal:input.goal,enabled:false,dayOfWeek:input.dayOfWeek,
     hourUtc:input.hourUtc,minuteUtc:input.minuteUtc,maxAiCalls:0});
   }catch(_){return answer(400,{error:'invalid_routine_plan'})}
   const nextReviewAt=nextUtcSlot(plan.dayOfWeek,plan.hourUtc,plan.minuteUtc,t);
   if(action==='preview')
    return answer(200,{reviewOnly:true,projectId:plan.projectId,
     goal:plan.goal,dayOfWeek:plan.dayOfWeek,hourUtc:plan.hourUtc,
     minuteUtc:plan.minuteUtc,nextReviewAt,
     enabled:false,aiCalls:0,additionalSpendUsd:0});
   if(input.confirmed!==true)return answer(400,{error:'explicit_confirmation_required'});
   try{
    const rows=await db('POST','paperworld_routines_v1?select=id,owner_id,enabled,next_review_at',
     {id:plan.routineId,owner_id:ownerId,thread_id:input.threadId,
      project_id:plan.projectId,goal:plan.goal,enabled:false,
      day_of_week:plan.dayOfWeek,hour_utc:plan.hourUtc,
      minute_utc:plan.minuteUtc,next_review_at:nextReviewAt,
      max_ai_calls:0,additional_spend_usd:0});
    if(rows.length!==1||rows[0].id!==plan.routineId||
     rows[0].owner_id!==ownerId||rows[0].enabled!==false)
     return answer(503,{error:'routine_save_unverified'});
    return answer(201,{routineId:plan.routineId,enabled:false,
     nextReviewAt,requiresActivation:true});
   }catch(_){return answer(503,{error:'routine_store_unavailable'})}
  }
  if(action==='list'){
   if(Object.keys(input).sort().join(',')!=='threadId')
    return answer(400,{error:'invalid_routine_fields'});
   try{
    const qs=new URLSearchParams({select:'id,project_id,goal,enabled,day_of_week,hour_utc,minute_utc,next_review_at',
     owner_id:'eq.'+ownerId,thread_id:'eq.'+input.threadId,
     order:'created_at.desc',limit:'30'});
    const rows=await db('GET','paperworld_routines_v1?'+qs);
    return answer(200,{routines:rows.map(r=>({
     id:r.id,projectId:r.project_id,goal:r.goal,enabled:r.enabled,
     dayOfWeek:r.day_of_week,hourUtc:r.hour_utc,minuteUtc:r.minute_utc,
     nextReviewAt:r.next_review_at}))});
   }catch(_){return answer(503,{error:'routine_store_unavailable'})}
  }
  if(Object.keys(input).sort().join(',')!=='confirmed,routineId,threadId'||
   !UUID.test(input.routineId||'')||input.confirmed!==true)
   return answer(400,{error:'explicit_confirmation_required'});
  try{
   const qs=new URLSearchParams({select:'id,owner_id,thread_id,enabled,day_of_week,hour_utc,minute_utc,max_ai_calls,additional_spend_usd',
    owner_id:'eq.'+ownerId,thread_id:'eq.'+input.threadId,
    id:'eq.'+input.routineId,limit:'1'});
   const rows=await db('GET','paperworld_routines_v1?'+qs);
   if(rows.length!==1||rows[0].id!==input.routineId||
    rows[0].owner_id!==ownerId||rows[0].thread_id!==input.threadId)
    return answer(404,{error:'routine_not_found'});
   const record=rows[0];
   if(record.max_ai_calls!==0||Number(record.additional_spend_usd)!==0)
    return answer(409,{error:'routine_budget_not_zero'});
   const enabled=action==='enable';
   if(enabled&&!validTime({dayOfWeek:record.day_of_week,
    hourUtc:record.hour_utc,minuteUtc:record.minute_utc}))
    return answer(409,{error:'routine_schedule_invalid'});
   const next=enabled?nextUtcSlot(record.day_of_week,record.hour_utc,
    record.minute_utc,t):null;
   const patchQs=new URLSearchParams({select:'id,enabled,next_review_at',
    id:'eq.'+input.routineId,owner_id:'eq.'+ownerId,
    thread_id:'eq.'+input.threadId,max_ai_calls:'eq.0',
    additional_spend_usd:'eq.0',
    enabled:'eq.'+String(!enabled)});
   const result=await db('PATCH','paperworld_routines_v1?'+patchQs,
    {enabled,next_review_at:next,updated_at:t.toISOString()});
   if(result.length!==1||result[0].id!==input.routineId||
    result[0].enabled!==enabled)
    return answer(409,{error:'routine_state_changed'});
   return answer(200,{routineId:input.routineId,enabled,
    nextReviewAt:next,execution:'review_drafts_only',aiCalls:0});
  }catch(_){return answer(503,{error:'routine_store_unavailable'})}
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeRoutineOwnerApi,nextUtcSlot});
