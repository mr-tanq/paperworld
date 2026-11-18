/* Persistent chat-only Copilot credential, never a GitHub write credential.
 * Owner auth happens in existing route handlers BEFORE calling getLinkedToken.
 * Do not reuse this adapter for proposal publishing, issues or workers.
 */
'use strict';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const PAT=/^github_pat_[A-Za-z0-9_]{20,300}$/;
function makeChatCredential({oauth,ownerId=process.env.PAPERWORLD_OWNER_ID,
 token=process.env.PAPERWORLD_MATT_COPILOT_TOKEN}={}){
 if(!oauth||typeof oauth.getLinkedToken!=='function')throw Error('oauth_required');
 const enabled=typeof ownerId==='string'&&UUID.test(ownerId)&&
  typeof token==='string'&&PAT.test(token);
 const normalized=enabled?ownerId.toLowerCase():null;
 return Object.freeze({
  enabled,
  getLinkedToken:({ownerId:requested}={})=>{
   if(enabled&&typeof requested==='string'&&
    requested.toLowerCase()===normalized)return token;
   return oauth.getLinkedToken({ownerId:requested});
  },
  // Status reports only chat readiness. A Copilot-only PAT is never interpreted
  // as GitHub repository authorization or a successful OAuth link.
  async chatStatus({headers={},authenticate}={}){
   if(!enabled||typeof authenticate!=='function')return false;
   try{
    const owner=await authenticate(headers);
    return typeof owner==='string'&&owner.toLowerCase()===normalized;
   }catch(_){return false;}
  }
 });
}
module.exports=Object.freeze({makeChatCredential});
