/* Crow-only private Suno production previews. NO generation endpoint in this phase.
 * Preview text stays in memory on trusted Render process, never in public tables.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {makeCrowSunoGate}=require('./crow-suno-gate.cjs');
const ORIGIN='https://mr-tanq.github.io';
function createCrowSunoPreviewApi({identity,gate,fetcher=globalThis.fetch}={}){
 const auth=identity||createSupabaseGuard({
  baseUrl:'https://jrevhzvrgenucuozjowm.supabase.co',
  publicKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL',fetcher
 });
 // This adapter has no provider transport. All generation stays impossible.
 const privateGate=gate||makeCrowSunoGate({authorize:async()=>false,enabled:false});
 const deny=(status,error)=>({status,body:{error}});
 async function handle({headers={},body,action}={}){
  if(headers.origin!==ORIGIN)return deny(403,'origin_denied');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>11000)
   return deny(413,'invalid_body');
  let data;try{data=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  if(!data||typeof data!=='object'||Array.isArray(data))
   return deny(400,'invalid_request');
  const token=bearer.slice(7);
  let ownerId;
  try{({ownerId}=await auth.authenticate(token))}catch(_){return deny(401,'unauthorized')}
  if(typeof ownerId!=='string'||!ownerId)return deny(401,'unauthorized');
  if(action==='propose'){
   if(Object.keys(data).sort().join(',')!=='agentId,brief,expectedCredits,threadId')
    return deny(400,'invalid_request');
   // Only an authenticated, owner-controlled Crow conversation may propose.
   if(data.agentId!=='studio-director'||typeof data.threadId!=='string')
    return deny(400,'invalid_crow_thread');
   try{
    if(!await auth.ownsThread({ownerId,threadId:data.threadId,agentId:'studio-director',token}))
     return deny(404,'director_thread_not_found');
   }catch(_){return deny(401,'unauthorized')}
   // expectedCredits=null denotes unknown provider pricing. Caller cannot
   // manufacture a trusted estimate; no submitted job can use this field yet.
   if(data.expectedCredits!==null)return deny(400,'provider_credit_estimate_not_verified');
   return privateGate.propose({ownerId,agentId:data.agentId,brief:data.brief,expectedCredits:null});
  }
  if(action==='cancel'){
   if(Object.keys(data).sort().join(',')!=='proposalId')
    return deny(400,'invalid_request');
   return privateGate.cancel({ownerId,proposalId:data.proposalId});
  }
  return deny(404,'unknown_action');
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({createCrowSunoPreviewApi});
