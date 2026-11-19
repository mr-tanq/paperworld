/* Authenticated Learning Loop: owner-selected saved HUMAN message -> proposed memory.
 * No AI, no approval, no implicit learning. All data reads/writes use owner JWT + RLS.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {createDirectorMemoryStore}=require('./director-memory-store.cjs');
const {ownerCorrectionProposal}=require('./director-learning-loop.cjs');
const {DIRECTORS}=require('./director-memory-policy.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PUBLIC_KEY='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const ORIGIN='https://mr-tanq.github.io';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const TOKEN=/^Bearer [A-Za-z0-9_.-]{12,4096}$/;
const answer=(status,body)=>({status,body});
function makeLearningProposalApi({fetcher=globalThis.fetch,identity,
 store,baseUrl=BASE,publicKey=PUBLIC_KEY}={}){
 const guard=identity||createSupabaseGuard({baseUrl,publicKey,fetcher});
 const memories=store||createDirectorMemoryStore({
  fetcher,baseUrl,publicKey,authenticate:token=>guard.authenticate(token)});
 async function handle({headers={},body}={}){
  if(headers.origin!==ORIGIN)return answer(403,{error:'origin_denied'});
  if(!TOKEN.test(headers.authorization||''))return answer(401,{error:'unauthorized'});
  if(typeof body!=='string'||Buffer.byteLength(body)>1200)
   return answer(413,{error:'invalid_body'});
  let data;try{data=JSON.parse(body)}catch(_){return answer(400,{error:'invalid_json'})}
  if(!data||Array.isArray(data)||typeof data!=='object'||
   Object.keys(data).sort().join(',')!==
    'actor,kind,messageId,sensitivity,threadId,title'||
   !Object.hasOwn(DIRECTORS,data.actor)||!UUID.test(data.threadId||'')||
   !UUID.test(data.messageId||'')||typeof data.title!=='string'||
   data.title.length>140||!['preference','decision'].includes(data.kind)||
   !['private','standard'].includes(data.sensitivity))
   return answer(400,{error:'invalid_learning_request'});
  const token=headers.authorization.slice(7);
  let ownerId;
  try{
   const verified=await guard.authenticate(token);ownerId=verified?.ownerId;
   if(!UUID.test(ownerId||'')||
     !await guard.ownsThread({ownerId,threadId:data.threadId,
      agentId:data.actor,token}))
    return answer(403,{error:'learning_thread_denied'});
  }catch(_){return answer(401,{error:'unauthorized'})}
  // Read exactly the referenced owner's human message, not client-supplied text.
  let saved;
  try{
   const params=new URLSearchParams({
    select:'id,thread_id,role,content,created_at',
    id:'eq.'+data.messageId,thread_id:'eq.'+data.threadId,
    role:'eq.human',limit:'1'});
   const result=await fetcher(baseUrl+'/rest/v1/paperworld_agent_messages?'+params,{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{apikey:publicKey,Authorization:'Bearer '+token,Accept:'application/json'}
   });
   if(!result?.ok)return answer(503,{error:'learning_history_unavailable'});
   const rows=await result.json();
   if(!Array.isArray(rows)||rows.length>1)return answer(503,{error:'learning_history_invalid'});
   saved=rows[0];
  }catch(_){return answer(503,{error:'learning_history_unavailable'})}
  if(!saved||saved.id!==data.messageId||saved.thread_id!==data.threadId||
   saved.role!=='human'||typeof saved.content!=='string'||
   saved.content.length>2000||!saved.content.trim()||
   typeof saved.created_at!=='string'||!Number.isFinite(Date.parse(saved.created_at)))
   return answer(404,{error:'learning_human_message_not_found'});
  let proposal;
  try{
   proposal=ownerCorrectionProposal({actor:data.actor,ownerConfirmed:true,
    threadId:data.threadId,messageId:data.messageId,entryId:data.messageId,
    title:data.title,correction:saved.content,
    kind:data.kind,sensitivity:data.sensitivity,
    observedAt:saved.created_at});
  }catch(_){return answer(400,{error:'invalid_learning_correction'})}
  try{
   const persisted=await memories.propose({token,ownerId,entry:proposal});
   if(persisted?.id!==data.messageId||persisted?.status!=='proposed')
    return answer(503,{error:'learning_proposal_unverified'});
   return answer(201,{id:persisted.id,status:'proposed',
    projectId:persisted.projectId,approved:false});
  }catch(_){
   // Conflict or unavailable storage: never pretend it was saved/approved.
   return answer(409,{error:'learning_proposal_not_saved'});
  }
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeLearningProposalApi});
