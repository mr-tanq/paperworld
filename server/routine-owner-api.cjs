/* PAPERWORLD Routine Loop: explicit owner-only weekly schedules.
 * preview · create (disabled) · list · enable · pause · update — every write
 * needs an explicit `confirmed:true` from an owner click. Times are LOCAL
 * (default Europe/Amsterdam); the database computes next_review_at with
 * PostgreSQL time-zone rules (sql/paperworld_routine_loop_release_v1.sql).
 * No AI calls, no cron writes, no queueing or external effects.
 */
'use strict';
const {randomUUID}=require('node:crypto');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {normalizeRoutine,nextLocalSlot,validSchedule,DEFAULT_TIMEZONE}=require('./routine-loop-policy.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PUB='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const ORIGIN='https://mr-tanq.github.io';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const AUTH=/^Bearer [A-Za-z0-9_.-]{12,4096}$/;
const ACTIONS=['preview','create','list','enable','pause','update'];
const SELECT='id,owner_id,thread_id,project_id,goal,enabled,day_of_week,local_hour,local_minute,timezone,'+
 'max_ai_calls,additional_spend_usd,next_review_at';
const answer=(status,body)=>({status,body});
const keys=o=>Object.keys(o).sort().join(',');
function view(r){
 return {id:r.id,projectId:r.project_id,goal:r.goal,enabled:r.enabled,dayOfWeek:r.day_of_week,
  hour:r.local_hour,minute:r.local_minute,timezone:r.timezone,nextReviewAt:r.next_review_at};
}
function makeRoutineOwnerApi({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY,
 identity,now=()=>new Date(),baseUrl=BASE,publicKey=PUB}={}){
 const guard=identity||createSupabaseGuard({fetcher,baseUrl,publicKey});
 const validSecret=typeof secret==='string'&&(secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 async function db(method,resource,payload){
  if(!validSecret)throw Error('routine_store_not_configured');
  const response=await fetcher(baseUrl+'/rest/v1/'+resource,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    Accept:'application/json','Content-Type':'application/json',
    ...(method!=='GET'?{Prefer:'return=representation'}:{})},
   ...(payload===undefined?{}:{body:JSON.stringify(payload)})
  });
  if(!response?.ok)throw Error('routine_store_unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('routine_store_invalid_response');
  return rows;
 }
 // Owner + thread + id filters on every read/write; zero-budget guard on writes.
 function scope(ownerId,threadId,routineId,extra={}){
  return new URLSearchParams({select:SELECT,id:'eq.'+routineId,owner_id:'eq.'+ownerId,
   thread_id:'eq.'+threadId,...extra});
 }
 async function handle({headers={},body,action}={}){
  if(headers.origin!==ORIGIN)return answer(403,{error:'origin_denied'});
  if(!AUTH.test(headers.authorization||''))return answer(401,{error:'unauthorized'});
  if(!ACTIONS.includes(action)||typeof body!=='string'||Buffer.byteLength(body)>1800)
   return answer(400,{error:'invalid_request'});
  let input;
  try{input=JSON.parse(body)}catch(_){return answer(400,{error:'invalid_json'})}
  if(!input||Array.isArray(input)||typeof input!=='object'||!UUID.test(input.threadId||''))
   return answer(400,{error:'invalid_thread'});
  const token=headers.authorization.slice(7);
  let ownerId;
  try{
   const user=await guard.authenticate(token);
   ownerId=user?.ownerId;
   if(!UUID.test(ownerId||''))return answer(401,{error:'unauthorized'});
   if(!await guard.ownsThread({ownerId,threadId:input.threadId,agentId:'matt',token}))
    return answer(404,{error:'thread_not_found'});
  }catch(_){return answer(401,{error:'unauthorized'})}
  const t=now();
  if(!(t instanceof Date)||!Number.isFinite(t.getTime()))return answer(503,{error:'clock_unavailable'});
  const timezone=input.timezone===undefined?DEFAULT_TIMEZONE:input.timezone;

  if(action==='preview'||action==='create'){
   const expected=['dayOfWeek','goal','hour','minute','projectId','threadId',
    ...(input.timezone!==undefined?['timezone']:[]),...(action==='create'?['confirmed']:[])];
   if(keys(input)!==expected.sort().join(','))return answer(400,{error:'invalid_routine_fields'});
   if(!validSchedule(input.dayOfWeek,input.hour,input.minute,timezone))
    return answer(400,{error:'invalid_schedule'});
   let plan;
   try{
    plan=normalizeRoutine({ownerId,threadId:input.threadId,routineId:randomUUID(),
     projectId:input.projectId,goal:input.goal,enabled:false,dayOfWeek:input.dayOfWeek,
     hour:input.hour,minute:input.minute,timezone,maxAiCalls:0});
   }catch(_){return answer(400,{error:'invalid_routine_plan'})}
   const firstReviewAt=nextLocalSlot(plan.dayOfWeek,plan.hour,plan.minute,plan.timezone,t);
   if(action==='preview')
    return answer(200,{reviewOnly:true,projectId:plan.projectId,goal:plan.goal,
     dayOfWeek:plan.dayOfWeek,hour:plan.hour,minute:plan.minute,timezone:plan.timezone,
     nextReviewAt:firstReviewAt,enabled:false,aiCalls:0,additionalSpendUsd:0});
   if(input.confirmed!==true)return answer(400,{error:'explicit_confirmation_required'});
   try{
    const rows=await db('POST','paperworld_routines_v1?select='+SELECT,
     {id:plan.routineId,owner_id:ownerId,thread_id:input.threadId,project_id:plan.projectId,
      goal:plan.goal,enabled:false,day_of_week:plan.dayOfWeek,local_hour:plan.hour,
      local_minute:plan.minute,timezone:plan.timezone,max_ai_calls:0,additional_spend_usd:0});
    if(rows.length!==1||rows[0].id!==plan.routineId||rows[0].owner_id!==ownerId||rows[0].enabled!==false)
     return answer(503,{error:'routine_save_unverified'});
    return answer(201,{routineId:plan.routineId,enabled:false,requiresActivation:true,
     firstReviewAt});
   }catch(_){return answer(503,{error:'routine_store_unavailable'})}
  }

  if(action==='list'){
   if(keys(input)!=='threadId')return answer(400,{error:'invalid_routine_fields'});
   try{
    const qs=new URLSearchParams({select:SELECT,owner_id:'eq.'+ownerId,
     thread_id:'eq.'+input.threadId,order:'created_at.desc',limit:'30'});
    const rows=await db('GET','paperworld_routines_v1?'+qs);
    if(rows.some(r=>r.owner_id!==ownerId))return answer(503,{error:'routine_store_invalid_response'});
    return answer(200,{routines:rows.map(view)});
   }catch(_){return answer(503,{error:'routine_store_unavailable'})}
  }

  // enable · pause · update: one named routine, explicit confirmation.
  if(!UUID.test(input.routineId||'')||input.confirmed!==true)
   return answer(400,{error:'explicit_confirmation_required'});
  let patch;
  if(action==='update'){
   const allowed=new Set(['threadId','routineId','confirmed','goal','dayOfWeek','hour','minute']);
   const changes=Object.keys(input).filter(k=>!['threadId','routineId','confirmed'].includes(k));
   if(Object.keys(input).some(k=>!allowed.has(k))||!changes.length)
    return answer(400,{error:'invalid_routine_fields'});
   patch={};
   if(input.goal!==undefined){
    if(typeof input.goal!=='string'||!input.goal.trim()||input.goal.length>1200)
     return answer(400,{error:'invalid_routine_plan'});
    patch.goal=input.goal.trim();
   }
   for(const [k,col,max] of [['dayOfWeek','day_of_week',6],['hour','local_hour',23],['minute','local_minute',59]]){
    if(input[k]===undefined)continue;
    if(!Number.isInteger(input[k])||input[k]<0||input[k]>max)return answer(400,{error:'invalid_schedule'});
    patch[col]=input[k];
   }
  }else{
   if(keys(input)!=='confirmed,routineId,threadId')return answer(400,{error:'explicit_confirmation_required'});
   patch={enabled:action==='enable'};
  }
  try{
   const found=await db('GET','paperworld_routines_v1?'+scope(ownerId,input.threadId,input.routineId,{limit:'1'}));
   if(found.length!==1||found[0].id!==input.routineId||found[0].owner_id!==ownerId||
    found[0].thread_id!==input.threadId)return answer(404,{error:'routine_not_found'});
   if(found[0].max_ai_calls!==0||Number(found[0].additional_spend_usd)!==0)
    return answer(409,{error:'routine_budget_not_zero'});
   const guardState=action==='update'?{}:{enabled:'eq.'+String(!patch.enabled)};
   const result=await db('PATCH','paperworld_routines_v1?'+scope(ownerId,input.threadId,input.routineId,
    {max_ai_calls:'eq.0',additional_spend_usd:'eq.0',...guardState}),patch);
   if(result.length!==1||result[0].id!==input.routineId||result[0].owner_id!==ownerId)
    return answer(409,{error:'routine_state_changed'});
   const r=result[0];
   if(action!=='update'&&r.enabled!==patch.enabled)return answer(409,{error:'routine_state_changed'});
   // next_review_at comes from the database trigger, never from the client.
   return answer(200,{routineId:r.id,...view(r),execution:'review_drafts_only',aiCalls:0});
  }catch(_){return answer(503,{error:'routine_store_unavailable'})}
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeRoutineOwnerApi});
