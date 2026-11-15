/* PAPERWORLD: owner-authenticated Listening proposal review and Draft PR actions.
 * Stored proposal is authoritative; request bodies never supply source text.
 * No AI calls. Only the exact repository mr-tanq/concerts may receive Draft PRs.
 */
'use strict';
const {randomBytes,randomUUID}=require('node:crypto');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {createOneUseApprovalVerifier}=require('./listening-write-approval.cjs');
const {createDraftPrPublisher}=require('./listening-draft-pr-publisher.cjs');
const {previewPayload}=require('./listening-proposal-intake.cjs');
const ORIGIN='https://mr-tanq.github.io';
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const KEY='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
function createListeningProposalApi({oauth,memory,store,
 guard=createSupabaseGuard({baseUrl:BASE,publicKey:KEY,fetcher:globalThis.fetch}),
 publisherFactory=createDraftPrPublisher}={}){
 if(!guard?.authenticate||!guard?.ownsThread)throw Error('identity_guard_required');
 async function handle({headers={},body,action}={}){
  if(headers.origin!==ORIGIN)return {status:403,body:{error:'origin_denied'}};
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))
   return {status:401,body:{error:'unauthorized'}};
  if(typeof body!=='string'||Buffer.byteLength(body)>1600)
   return {status:400,body:{error:'invalid_request'}};
  let data;
  try{data=JSON.parse(body)}catch(_){return {status:400,body:{error:'invalid_json'}}}
  if(!UUID.test(data?.threadId||'')||!['list','reject','publish'].includes(action))
   return {status:400,body:{error:'invalid_request'}};
  if(action!=='list'&&(!UUID.test(data.jobId||'')||!DIGEST.test(data.digest||'')))
   return {status:400,body:{error:'invalid_proposal_identity'}};
  if(action==='publish'&&data.confirm!=='CREATE_LISTENING_DRAFT_PR')
   return {status:403,body:{error:'explicit_confirmation_required'}};
  const token=bearer.slice(7);
  try{
   const {ownerId}=await guard.authenticate(token);
   if(!await guard.ownsThread({threadId:data.threadId,ownerId,agentId:'matt',token}))
    return {status:404,body:{error:'thread_not_found'}};
   if(!memory)return {status:503,body:{error:'proposal_storage_unavailable'}};
   if(action==='list'){
    const proposals=await memory.list({ownerId,threadId:data.threadId});
    return {status:200,body:{proposals,authority:'owner_scoped_read_only_review'}};
   }
   const saved=await memory.load({ownerId,threadId:data.threadId,jobId:data.jobId});
   if(!saved||saved.digest!==data.digest)
    return {status:404,body:{error:'proposal_not_found'}};
   if(saved.status!=='pending_review')
    return {status:409,body:{error:'proposal_not_pending'}};
   if(action==='reject'){
    const rejected=await memory.reject({ownerId,threadId:data.threadId,
     jobId:data.jobId,digest:data.digest});
    return rejected?{status:200,body:{rejected:true}}:
     {status:409,body:{error:'proposal_already_reviewed'}};
   }
   // No GitHub OAuth WRITE permission => no grant creation or external call.
   const githubToken=oauth?.getLinkedWriteToken?.({ownerId});
   if(!githubToken)return {status:403,body:{error:'github_write_reconnect_required'}};
   if(!store?.issue||!store?.consumeOnce)
    return {status:503,body:{error:'approval_store_unavailable'}};
   const {plan,evidence}=previewPayload(saved.plan,saved.evidence);
   const oneUse=await store.issue({ownerId,jobId:data.jobId,digest:saved.digest});
   const verifier=createOneUseApprovalVerifier({store});
   const publisher=publisherFactory({verifyAndConsumeApproval:verifier.verifyAndConsumeApproval});
   const result=await publisher.publish({
    ownerId,githubToken,approval:oneUse,job:{
     id:data.jobId,project:'Listening Mirror',directorId:'listening-director',
     workerId:'listening-developer',approvedForProposal:true
    },proposal:{jobId:plan.jobId,repository:plan.repository,baseRef:plan.baseRef,
     summary:plan.summary,edits:plan.edits},evidence
   });
   return {status:200,body:{created:true,url:result.url,number:result.number,
    draft:true,merged:false,testsRun:false}};
  }catch(_){
   // Avoid disclosing credentials, GitHub error bodies, or source text.
   return {status:503,body:{error:'proposal_action_unavailable'}};
  }
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({createListeningProposalApi});
