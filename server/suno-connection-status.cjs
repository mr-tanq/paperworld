/* Authenticated, owner-scoped, read-only Suno OAuth discovery status.
 * This endpoint never starts OAuth nor calls a music creation tool.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {createSunoOAuthDiscovery}=require('./suno-oauth-discovery.cjs');
const ORIGIN='https://mr-tanq.github.io';
function createSunoConnectionStatus({identity,discovery,fetcher=globalThis.fetch}={}){
 const auth=identity||createSupabaseGuard({
  baseUrl:'https://jrevhzvrgenucuozjowm.supabase.co',
  publicKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL',fetcher
 });
 const probe=discovery||createSunoOAuthDiscovery({fetcher});
 const deny=(status,error)=>({status,body:{error}});
 async function handle({headers={},body}={}){
  if(headers.origin!==ORIGIN)return deny(403,'origin_denied');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>256)
   return deny(413,'invalid_body');
  let data;try{data=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  if(!data||Object.keys(data).sort().join(',')!=='agentId,threadId'||
     data.agentId!=='studio-director'||typeof data.threadId!=='string')
   return deny(400,'invalid_request');
  const token=bearer.slice(7);
  let ownerId;
  try{
   ({ownerId}=await auth.authenticate(token));
   if(!ownerId||!await auth.ownsThread({ownerId,threadId:data.threadId,
    agentId:'studio-director',token}))
    return deny(404,'crow_thread_not_found');
  }catch(_){return deny(401,'unauthorized')}
  try{
   const result=await probe.inspect();
   // The probe's output is bounded data, never an OAuth connection.
   return {status:200,body:{
    service:'suno_mcp',metadataAvailable:result.metadataAvailable===true,
    oauthConnected:false,canGenerate:false,
    nextStep:'owner_authorized_oauth_not_implemented'}};
  }catch(_){return deny(503,'suno_discovery_unavailable')}
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({createSunoConnectionStatus});
