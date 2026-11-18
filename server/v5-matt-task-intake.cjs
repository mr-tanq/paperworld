/* Authenticated Matt -> Task Engine v1 intake.
 * Called ONLY after Matt's existing owner authentication, AI route and
 * project-isolated Director memory have completed. Render has no GitHub write
 * token: this module writes only owner-scoped drafts + trusted SQL RPCs.
 */
'use strict';
const {missionSpec}=require('./v5-autonomous-policy.cjs');
const {parseModelSpec}=require('./v5-task-planner.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const CODING=new Set(['listening-director','pokemon-director']);
function makeMattTaskIntake({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY,
 enabled=()=>process.env.PAPERWORLD_V1_INTAKE_ENABLED==='yes'}={}){
 const configured=typeof secret==='string'&&
  (secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 async function query(resource,method='GET',body){
  if(!configured||typeof fetcher!=='function')throw Error('task_intake_unavailable');
  const response=await fetcher(BASE+'/rest/v1/'+resource,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?
    {Authorization:'Bearer '+secret}:{}),
    Accept:'application/json','Content-Type':'application/json',
    ...(method==='POST'?{Prefer:'return=representation'}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!response?.ok)throw Error('task_store_unavailable');
  return response.json();
 }
 async function available(){
  if(enabled()!==true||!configured)return false;
  const rows=await query('paperworld_autonomous_controller_v5?'+
   'select=engine,dispatch_enabled,live_adapters&singleton=eq.true&limit=1');
  return Array.isArray(rows)&&rows.length===1&&rows[0].engine==='v1'&&
   rows[0].dispatch_enabled===true&&
   Array.isArray(rows[0].live_adapters)&&
   rows[0].live_adapters.includes('copilot_agent');
 }
 async function submit({ownerId,threadId,requestId,directorId,message,modelOutput}={}){
  if(![ownerId,threadId,requestId].every(x=>UUID.test(x||''))||
    !CODING.has(directorId)||typeof message!=='string'||
    !message.trim()||message.length>1200)throw Error('task_identity_invalid');
  if(!await available())return Object.freeze({state:'disabled'});
  const projectId=directorId==='listening-director'?'listening':'pokemon';
  // Never take a project ID, owner, repository, roles or permissions from AI.
  const spec=parseModelSpec(modelOutput,{projectId,directorId});
  const mission=missionSpec({id:requestId,ownerId,threadId,projectId,
   goal:message,limit:{maxSteps:5,maxAiCalls:0,maxAttempts:2}});
  // requestId becomes a durable unique mission ID; a replay cannot spend twice.
  const created=await query('paperworld_autonomous_missions_v5','POST',{
   id:mission.id,owner_id:ownerId,thread_id:threadId,
   project_id:mission.projectId,goal:mission.goal,status:'draft',
   policy:mission.policy});
  if(!Array.isArray(created)||created.length!==1||
    created[0].id!==requestId||created[0].owner_id!==ownerId||
    created[0].thread_id!==threadId||created[0].status!=='draft')
   throw Error('task_draft_not_confirmed');
  const plan=await query('rpc/paperworld_v5_plan_task','POST',{
   p_mission:requestId,p_spec:spec});
  if(plan!==true)throw Error('task_plan_refused');
  const queue=await query('rpc/paperworld_v5_queue_task','POST',{
   p_mission:requestId});
  if(queue!==true)return Object.freeze({
   state:'planned',missionId:requestId,projectId,title:spec.title,
   message:'The task is planned but not queued. No Worker started.',
   autoMerge:false,autoDeploy:false});
  return Object.freeze({state:'queued',missionId:requestId,projectId,
   directorId,title:spec.title,acceptance:spec.acceptance,
   requiredTests:spec.requiredTests,repository:spec.repository,
   autoMerge:false,autoDeploy:false});
 }
 return Object.freeze({available,submit});
}
module.exports=Object.freeze({makeMattTaskIntake});
