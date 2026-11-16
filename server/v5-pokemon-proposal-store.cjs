/* Server-private Pokémon proposal persistence. Neither AI output nor browser
 * can create authorization; proposals are immutable until reviewed by owner.
 */
'use strict';
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const {validateProposal,digestPlan}=require('./v5-pokemon-code-proposal.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/i;
const STATES=new Set(['pending_review','rejected','needs_reverification','draft_created']);
function makePokemonProposalStore({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 if(typeof fetcher!=='function'||typeof secret!=='string'||
  !(secret.startsWith('sb_secret_')||secret.startsWith('eyJ')))
  throw Error('pokemon_proposal_store_not_configured');
 async function query(table,method,qs='',body,prefer){
  const response=await fetcher(BASE+'/rest/v1/'+table+qs,{
   method,redirect:'error',signal:AbortSignal.timeout(9000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    'Content-Type':'application/json',Accept:'application/json',
    ...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!response?.ok)throw Error('pokemon_proposal_storage_unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('pokemon_proposal_bad_reply');
  return rows;
 }
 function clean(row,{ownerId,threadId,jobId}={}){
  if(!row||row.owner_id!==ownerId||row.thread_id!==threadId||
   (jobId&&row.job_id!==jobId)||row.project!=='pokemon'||
   !STATES.has(row.status)||!SHA.test(row.digest||''))
   throw Error('pokemon_proposal_owner_mismatch');
  const plan=validateProposal({jobId:row.job_id,proposal:{
   jobId:row.plan?.jobId,repository:row.plan?.repository,
   baseRef:row.plan?.baseRef,summary:row.plan?.summary,
   edits:row.plan?.edits},evidence:row.evidence});
  if(digestPlan(plan)!==row.digest)throw Error('pokemon_proposal_digest_mismatch');
  const url=row.draft_pr_url||null;
  if((row.status==='draft_created')!==
   /^https:\/\/github\.com\/mr-tanq\/pokemon-echoes\/pull\/[1-9][0-9]*$/.test(url||''))
   throw Error('pokemon_proposal_draft_mismatch');
  return Object.freeze({jobId:row.job_id,status:row.status,digest:row.digest,
   plan,evidence:row.evidence,draftUrl:url,createdAt:row.created_at});
 }
 const columns='job_id,owner_id,thread_id,project,status,digest,plan,evidence,draft_pr_url,created_at';
 async function save({ownerId,threadId,jobId,plan,evidence}={}){
  if(![ownerId,threadId,jobId].every(x=>UUID.test(x||'')))throw Error('invalid_owner_job');
  const validated=validateProposal({jobId,proposal:{
   jobId:plan?.jobId,repository:plan?.repository,baseRef:plan?.baseRef,
   summary:plan?.summary,edits:plan?.edits},evidence});
  const digest=digestPlan(validated);
  const rows=await query('paperworld_pokemon_proposals_v5','POST',
   '?on_conflict=job_id',{job_id:jobId,owner_id:ownerId,thread_id:threadId,
    project:'pokemon',status:'pending_review',digest,plan:validated,evidence},
   'resolution=ignore-duplicates,return=representation');
  if(rows.length>1)throw Error('pokemon_proposal_bad_reply');
  return rows.length===1?
   Object.freeze({persisted:true,digest,status:'pending_review',jobId}):
   Object.freeze({persisted:false,duplicate:true,jobId});
 }
 async function load({ownerId,threadId,jobId}={}){
  if(![ownerId,threadId,jobId].every(x=>UUID.test(x||'')))throw Error('invalid_owner_job');
  const qs=new URLSearchParams({select:columns,owner_id:'eq.'+ownerId,
   thread_id:'eq.'+threadId,job_id:'eq.'+jobId,limit:'2'});
  const rows=await query('paperworld_pokemon_proposals_v5','GET','?'+qs);
  if(rows.length>1)throw Error('pokemon_proposal_bad_reply');
  return rows.length?clean(rows[0],{ownerId,threadId,jobId}):null;
 }
 async function list({ownerId,threadId}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(threadId||''))throw Error('invalid_scope');
  const qs=new URLSearchParams({select:columns,owner_id:'eq.'+ownerId,
   thread_id:'eq.'+threadId,order:'created_at.desc',limit:'12'});
  const rows=await query('paperworld_pokemon_proposals_v5','GET','?'+qs);
  if(rows.length>12)throw Error('pokemon_proposal_bad_reply');
  return rows.map(row=>clean(row,{ownerId,threadId}));
 }
 async function transition({ownerId,threadId,jobId,digest,status,url=null}={}){
  if(![ownerId,threadId,jobId].every(x=>UUID.test(x||''))||
   !SHA.test(digest||'')||!['rejected','draft_created'].includes(status)||
   (status==='draft_created'&&!/^https:\/\/github\.com\/mr-tanq\/pokemon-echoes\/pull\/[1-9][0-9]*$/.test(url||'')))
   throw Error('invalid_pokemon_transition');
  const qs=new URLSearchParams({select:columns,owner_id:'eq.'+ownerId,
   thread_id:'eq.'+threadId,job_id:'eq.'+jobId,digest:'eq.'+digest,
   status:'eq.pending_review'});
  const rows=await query('paperworld_pokemon_proposals_v5','PATCH','?'+qs,
   {status,draft_pr_url:status==='draft_created'?url:null,
    updated_at:new Date().toISOString()},'return=representation');
  if(rows.length>1)throw Error('pokemon_proposal_bad_reply');
  return rows.length===1&&clean(rows[0],{ownerId,threadId,jobId}).status===status;
 }
 async function issue({ownerId,jobId,digest}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(jobId||'')||!SHA.test(digest||''))
   throw Error('invalid_approval');
  const id=randomUUID(),secretToken=randomBytes(32).toString('hex');
  const hash=createHash('sha256').update(secretToken).digest('hex');
  const rows=await query('paperworld_pokemon_approvals_v5','POST','',{
   id,owner_id:ownerId,job_id:jobId,digest,secret_hash:hash,
   expires_at:new Date(Date.now()+600000).toISOString()},'return=representation');
  if(rows.length!==1||rows[0].id!==id)throw Error('pokemon_approval_issue_failed');
  return Object.freeze({id,secret:secretToken});
 }
 async function consumeOnce({ownerId,jobId,digest,approval}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(jobId||'')||!SHA.test(digest||'')||
   !UUID.test(approval?.id||'')||!SHA.test(approval?.secret||''))return false;
  const hash=createHash('sha256').update(approval.secret).digest('hex');
  const now=new Date().toISOString();
  const qs=new URLSearchParams({select:'id',id:'eq.'+approval.id,
   owner_id:'eq.'+ownerId,job_id:'eq.'+jobId,digest:'eq.'+digest,
   secret_hash:'eq.'+hash,consumed_at:'is.null',expires_at:'gt.'+now});
  try{
   const rows=await query('paperworld_pokemon_approvals_v5','PATCH','?'+qs,
    {consumed_at:now},'return=representation');
   return rows.length===1&&rows[0].id===approval.id;
  }catch(_){return false}
 }
 return Object.freeze({save,load,list,transition,issue,consumeOnce});
}
module.exports=Object.freeze({makePokemonProposalStore});
