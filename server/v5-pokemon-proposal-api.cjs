/* Authenticated owner-only Pokémon proposal review and Draft PR endpoint.
 * Proposed AI text is never a credential, grant, or direct write instruction.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {makePokemonDraftPublisher}=require('./v5-pokemon-draft-publisher.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const KEY='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const ORIGIN='https://mr-tanq.github.io';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/i;
function makePokemonProposalApi({oauth,store,fetcher=globalThis.fetch,
 guard=createSupabaseGuard({baseUrl:BASE,publicKey:KEY,fetcher}),
 publisherFactory=makePokemonDraftPublisher}={}){
 if(typeof guard?.authenticate!=='function'||typeof guard?.ownsThread!=='function')
  throw Error('pokemon_proposal_identity_required');
 async function handle({headers={},body,action}={}){
  const deny=(status,error)=>({status,body:{error}});
  if(headers.origin!==ORIGIN)return deny(403,'origin_denied');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))
   return deny(401,'unauthorized');
  if(typeof body!=='string'||Buffer.byteLength(body)>2200)
   return deny(400,'invalid_request');
  let input;try{input=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  if(!['list','reject','publish'].includes(action)||
   !UUID.test(input?.threadId||'')||
   (action!=='list'&&(!UUID.test(input.jobId||'')||
    !DIGEST.test(input.digest||''))))
   return deny(400,'invalid_pokemon_proposal_request');
  if(action==='publish'&&input.confirm!=='CREATE_POKEMON_DRAFT_PR')
   return deny(403,'explicit_pokemon_draft_confirmation_required');
  let ownerId;
  try{
   const token=bearer.slice(7);
   ({ownerId}=await guard.authenticate(token));
   if(!await guard.ownsThread({ownerId,threadId:input.threadId,agentId:'matt',token}))
    return deny(404,'thread_not_found');
  }catch(_){return deny(401,'unauthorized')}
  if(!store?.list||!store?.load||!store?.transition||
   !store?.issue||!store?.consumeOnce)
   return deny(503,'pokemon_proposal_storage_unavailable');
  try{
   if(action==='list'){
    const proposals=await store.list({ownerId,threadId:input.threadId});
    return {status:200,body:{proposals,authority:'owner_review_only'}};
   }
   const item=await store.load({ownerId,threadId:input.threadId,jobId:input.jobId});
   if(!item||item.digest!==input.digest)return deny(404,'pokemon_proposal_not_found');
   if(item.status!=='pending_review')return deny(409,'pokemon_proposal_not_pending');
   if(action==='reject'){
    const done=await store.transition({ownerId,threadId:input.threadId,
     jobId:input.jobId,digest:item.digest,status:'rejected'});
    return done?{status:200,body:{rejected:true}}:
     deny(409,'pokemon_proposal_already_reviewed');
   }
   const githubToken=oauth?.getLinkedPrivateWriteToken?.({ownerId});
   if(!githubToken)return deny(409,'github_private_repo_write_reconnect_required');
   // The stored, exact reviewed patch is the ONLY payload supplied to GitHub.
   // A browser-supplied replacement, repository or path is never accepted.
   const grant=await store.issue({ownerId,jobId:item.jobId,digest:item.digest});
   const publisher=publisherFactory({approvals:store});
   const result=await publisher.publish({ownerId,githubToken,
    plan:item.plan,evidence:item.evidence,approval:grant});
   let tracked=false;
   try{tracked=await store.transition({ownerId,threadId:input.threadId,
    jobId:input.jobId,digest:item.digest,status:'draft_created',url:result.url})}
   catch(_){/* The real GitHub PR remains created, do not falsely fail it. */}
   return {status:200,body:{...result,tracked}};
  }catch(_){
   // Never return source text, grant tokens or provider responses.
   return deny(503,'pokemon_proposal_action_unavailable');
  }
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makePokemonProposalApi});
