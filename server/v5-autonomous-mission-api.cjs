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
  if(!['create','list'].includes(action)||typeof body!=='string'||
   Buffer.byteLength(body,'utf8')>2100)return deny(400,'invalid_request');
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
   if(action==='list'){
    const qs=new URLSearchParams({select:'id,project_id,goal,status,created_at,updated_at',
     owner_id:'eq.'+ownerId,thread_id:'eq.'+input.threadId,
     order:'created_at.desc',limit:'20'});
    const rows=await query('GET','paperworld_autonomous_missions_v5?'+qs);
    return {status:200,body:{missions:rows.map(r=>({
     id:r.id,projectId:r.project_id,goal:r.goal,status:r.status,
     createdAt:r.created_at,updatedAt:r.updated_at}))}};
   }
   if(!['threadId','projectId','goal'].every(k=>Object.hasOwn(input,k))||
    Object.keys(input).length!==3)return deny(400,'invalid_mission');
   let spec;try{spec=missionSpec({
    ownerId,threadId:input.threadId,projectId:input.projectId,goal:input.goal
   })}catch(_){return deny(400,'invalid_mission')}
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
