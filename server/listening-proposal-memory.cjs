/* PAPERWORLD: server-only persisted Listening Mirror review proposals.
 * NOT wired to HTTP until private table, identity-checked endpoints and
 * isolated RLS / concurrency tests are separately approved.
 * No AI calls, no GitHub write permission and no authority to execute.
 */
'use strict';
const {previewPayload}=require('./listening-proposal-intake.cjs');
const {digestPlan}=require('./listening-write-approval.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const STATES=new Set(['pending_review','rejected','needs_reverification']);
function validateOwner(x){if(!UUID.test(x||''))throw Error('invalid_owner_identity')}
function createProposalMemory({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 if(typeof fetcher!=='function'||typeof secret!=='string'||
  !(secret.startsWith('sb_secret_')||secret.startsWith('eyJ')))
  throw Error('server_credentials_required');
 async function query(method,path,body,{prefer}={}){
  const res=await fetcher(BASE+'/rest/v1/'+path,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,
    ...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    Accept:'application/json',
    ...(body===undefined?{}:{'Content-Type':'application/json'}),
    ...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!res?.ok)throw Error('proposal_storage_unavailable');
  if(method==='GET'||prefer==='return=representation'){
   const data=await res.json();
   if(!Array.isArray(data))throw Error('proposal_storage_invalid');
   return data;
  }
  return true;
 }
 function cleanRow(row,{ownerId,threadId,jobId}){
  if(!row||row.owner_id!==ownerId||row.thread_id!==threadId||
   (jobId&&row.job_id!==jobId)||!STATES.has(row.status)||
   typeof row.digest!=='string'||!/^[a-f0-9]{64}$/.test(row.digest))
   throw Error('proposal_owner_or_state_mismatch');
  const {plan,evidence}=previewPayload(row.plan,row.evidence);
  if(plan.jobId!==row.job_id||digestPlan(plan)!==row.digest)
   throw Error('proposal_digest_mismatch');
  return Object.freeze({jobId:row.job_id,status:row.status,
   digest:row.digest,plan,evidence,createdAt:row.created_at,
   updatedAt:row.updated_at});
 }
 async function save({ownerId,threadId,jobId,reviewProposal}={}){
  validateOwner(ownerId);
  if(!UUID.test(threadId||'')||!UUID.test(jobId||''))
   throw Error('invalid_job_reference');
  const {plan,evidence}=previewPayload(reviewProposal?.plan,reviewProposal?.evidence);
  if(plan.jobId!==jobId)throw Error('job_plan_mismatch');
  const digest=digestPlan(plan);
  // Strictly insert-only. Duplicate/replayed jobIds MUST NOT mutate proposals.
  // One job, one immutable proposal; never UPSERT a changed AI suggestion.
  const rows=await query('POST',
   'paperworld_worker_proposals?on_conflict=job_id',{
    job_id:jobId,owner_id:ownerId,thread_id:threadId,
    project:'Listening Mirror',status:'pending_review',digest,plan,evidence
   },{prefer:'resolution=ignore-duplicates,return=representation'});
  if(rows.length>1)throw Error('proposal_storage_invalid');
  // A duplicate returns no inserted row; report as such, never claim saved.
  if(!rows.length)return Object.freeze({persisted:false,duplicate:true,jobId});
  const item=cleanRow(rows[0],{ownerId,threadId,jobId});
  return Object.freeze({persisted:true,duplicate:false,jobId,
   status:item.status,digest:item.digest});
 }
 async function load({ownerId,threadId,jobId}={}){
  validateOwner(ownerId);
  if(!UUID.test(threadId||'')||!UUID.test(jobId||''))
   throw Error('invalid_job_reference');
  const params=new URLSearchParams({select:'job_id,owner_id,thread_id,status,digest,plan,evidence,created_at,updated_at',
   owner_id:'eq.'+ownerId,thread_id:'eq.'+threadId,job_id:'eq.'+jobId,limit:'1'});
  const rows=await query('GET','paperworld_worker_proposals?'+params);
  if(rows.length>1)throw Error('proposal_storage_invalid');
  return rows.length?cleanRow(rows[0],{ownerId,threadId,jobId}):null;
 }
 async function list({ownerId,threadId}={}){
  validateOwner(ownerId);
  if(!UUID.test(threadId||''))throw Error('invalid_thread');
  const params=new URLSearchParams({select:'job_id,owner_id,thread_id,status,digest,plan,evidence,created_at,updated_at',
   owner_id:'eq.'+ownerId,thread_id:'eq.'+threadId,
   order:'created_at.desc',limit:'20'});
  const rows=await query('GET','paperworld_worker_proposals?'+params);
  if(rows.length>20)throw Error('proposal_storage_invalid');
  return Object.freeze(rows.map(row=>cleanRow(row,{ownerId,threadId})));
 }
 async function reject({ownerId,threadId,jobId,digest}={}){
  validateOwner(ownerId);
  if(!UUID.test(threadId||'')||!UUID.test(jobId||'')||
   !/^[a-f0-9]{64}$/.test(digest||''))throw Error('invalid_rejection');
  const params=new URLSearchParams({select:'job_id,owner_id,thread_id,status,digest,plan,evidence,created_at,updated_at',
   owner_id:'eq.'+ownerId,thread_id:'eq.'+threadId,job_id:'eq.'+jobId,
   digest:'eq.'+digest,status:'eq.pending_review'});
  // Only an already trusted owner-verified call may invoke this adapter.
  const rows=await query('PATCH','paperworld_worker_proposals?'+params,
   {status:'rejected'},{prefer:'return=representation'});
  if(rows.length!==1)return false;
  return cleanRow(rows[0],{ownerId,threadId,jobId}).status==='rejected';
 }
 return Object.freeze({save,load,list,reject});
}
module.exports=Object.freeze({createProposalMemory});
