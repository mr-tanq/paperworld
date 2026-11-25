/* Durable trusted-server Director replies. No AI calls and no browser write privilege.
 * Replies belong to already verified owner + agent threads.
 */
'use strict';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const AGENTS=new Set(['listening-director','pokemon-director','studio-director','wellbeing-director','shop-director']);
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
function createDirectorReplyPersistence({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY,
 identity,baseUrl=BASE}={}){
 if(typeof fetcher!=='function'||typeof identity?.authenticate!=='function'||
  typeof identity?.ownsThread!=='function')throw Error('director_persistence_dependencies_required');
 async function save({token,ownerId,threadId,agentId,requestId,content}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(threadId||'')||
   !UUID.test(requestId||'')||!AGENTS.has(agentId)||
   typeof token!=='string'||!/^[A-Za-z0-9_.-]{12,4096}$/.test(token)||
   typeof content!=='string'||!content.trim())return false;
  // Never treat a caller-supplied owner or thread as sufficient authority.
  const user=await identity.authenticate(token);
  if(user?.ownerId!==ownerId||!(await identity.ownsThread({ownerId,threadId,agentId,token})))
   return false;
  if(typeof secret!=='string'||!(secret.startsWith('sb_secret_')||secret.startsWith('eyJ')))
   return false;
  // Only the Crow owner-scoped song replies may use the larger approved
  // DB limit. Human messages and other Directors remain capped at 2000.
  const limit=agentId==='studio-director'?6000:2000;
  // Do not store an incomplete song by silently clipping its final [End].
  if(content.trim().length>limit)return false;
  const excerpt=content.trim();
  const body={id:requestId,thread_id:threadId,owner_id:ownerId,role:'agent',content:excerpt};
  try{
   const response=await fetcher(baseUrl+'/rest/v1/paperworld_agent_messages',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{apikey:secret,
     ...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
     'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify(body)
   });
   return response?.ok===true;
  }catch(_){return false}
 }
 return Object.freeze({save});
}
module.exports=Object.freeze({createDirectorReplyPersistence});
