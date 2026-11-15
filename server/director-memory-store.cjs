/* Owner-scoped Supabase Director Memory persistence adapter.
 * Disabled until separate schema approval. Uses user JWT, publishable key,
 * PostgreSQL RLS; no service_role, model calls, or privileged actions.
 */
'use strict';
const {validateEntry,PROJECT_IDS}=require('./director-memory-policy.cjs');
const TOKEN=/^[A-Za-z0-9_.-]{12,4096}$/;
const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function deny(code){const e=new Error(code);e.code=code;throw e}
function createDirectorMemoryStore({fetcher,baseUrl,publicKey,authenticate,verifyOwnerReview}={}){
 if(typeof fetcher!=='function'||typeof authenticate!=='function'||
  typeof baseUrl!=='string'||!/^https:\/\/[a-z0-9.-]+$/.test(baseUrl)||
  typeof publicKey!=='string'||publicKey.length<5||publicKey.length>250)
  deny('trusted_memory_store_config_required');
 async function call({token,ownerId,projectId,method='GET',body,query=''}) {
  if(!TOKEN.test(token||'')||!ID.test(ownerId||'')||
   !PROJECT_IDS.includes(projectId))deny('memory_identity_invalid');
  const verified=await authenticate(token);
  if(verified?.ownerId!==ownerId)deny('memory_owner_mismatch');
  const url=baseUrl+'/rest/v1/paperworld_director_memory'+query;
  let result;
  try{result=await fetcher(url,{method,redirect:'error',
   signal:AbortSignal.timeout(8000),
   headers:{apikey:publicKey,Authorization:'Bearer '+token,
    Accept:'application/json',...(method==='POST'?{
     'Content-Type':'application/json',Prefer:'return=minimal'}:{})},
   ...(method==='POST'?{body:JSON.stringify(body)}:{})
  })}catch(_){deny('memory_storage_unavailable')}
  if(!result?.ok)deny('memory_storage_unavailable');
  if(method==='POST')return true;
  let data;
  try{data=await result.json()}catch(_){deny('memory_storage_unavailable')}
  if(!Array.isArray(data)||data.length>100)deny('memory_storage_response_invalid');
  return data;
 }
 async function propose({token,ownerId,entry}={}){
  const x=validateEntry(entry);
  if(x.status!=='proposed')deny('memory_proposal_required');
  await call({token,ownerId,projectId:x.projectId,method:'POST',
   body:{id:x.id,project_id:x.projectId,kind:x.kind,status:'proposed',
    title:x.title,body:x.body,source_type:x.sourceType,
    source_ref:x.sourceRef,observed_at:x.observedAt,
    version:x.version,sensitivity:x.sensitivity}});
  return Object.freeze({id:x.id,status:'proposed',projectId:x.projectId});
 }
 async function list({token,ownerId,projectId}={}){
  const query='?select=id,project_id,kind,status,title,body,source_type,source_ref,'+
   'observed_at,version,sensitivity'+
   '&project_id=eq.'+encodeURIComponent(projectId||'')+
   '&order=observed_at.desc,id.asc&limit=100';
  const rows=await call({token,ownerId,projectId,query});
  return Object.freeze(rows.map(row=>{
   if(row?.project_id!==projectId)deny('memory_project_response_mismatch');
   return validateEntry({id:row.id,projectId:row.project_id,kind:row.kind,
    status:row.status,title:row.title,body:row.body,
    sourceType:row.source_type,sourceRef:row.source_ref,
    observedAt:row.observed_at,version:row.version,
    sensitivity:row.sensitivity});
  }));
 }
 async function review({token,ownerId,entryId,decision,approvalId}={}){
  if(typeof verifyOwnerReview!=='function')deny('owner_review_not_configured');
  if(!TOKEN.test(token||'')||!ID.test(ownerId||'')||
   !ID.test(entryId||'')||!ID.test(approvalId||'')||
   !['approved','rejected'].includes(decision))deny('review_invalid');
  const user=await authenticate(token);
  if(user?.ownerId!==ownerId)deny('memory_owner_mismatch');
  const approved=await verifyOwnerReview({ownerId,entryId,decision,approvalId});
  if(approved!==true)deny('explicit_owner_approval_required');
  let result;
  try{result=await fetcher(baseUrl+'/rest/v1/rpc/paperworld_review_director_memory',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:publicKey,Authorization:'Bearer '+token,
    Accept:'application/json','Content-Type':'application/json'},
   body:JSON.stringify({p_id:entryId,p_decision:decision})
  })}catch(_){deny('memory_storage_unavailable')}
  if(!result?.ok)deny('memory_storage_unavailable');
  let done;
  try{done=await result.json()}catch(_){deny('memory_storage_unavailable')}
  if(done!==true)deny('memory_review_not_applied');
  return Object.freeze({id:entryId,status:decision});
 }
 return Object.freeze({propose,list,review});
}
module.exports=Object.freeze({createDirectorMemoryStore});
