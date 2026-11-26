/* Read-only owner-scoped Director thread history from existing Supabase messages.
 * No service-role key, writes, new model calls, or additional cross-project access.
 */
'use strict';
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const AGENTS=new Set(['listening-director','pokemon-director','studio-director','wellbeing-director','shop-director','markets-director']);
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PUBLIC_KEY='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
function createDirectorThreadRecall({fetcher,identity,baseUrl=BASE,publicKey=PUBLIC_KEY}={}){
 if(typeof fetcher!=='function'||typeof identity?.authenticate!=='function'||
  typeof identity?.ownsThread!=='function')throw Error('director_recall_dependencies_required');
 async function load({token,ownerId,agentId,threadId}={}){
  if(!ID.test(ownerId||'')||!ID.test(threadId||'')||!AGENTS.has(agentId)||
   typeof token!=='string'||!/^[A-Za-z0-9_.-]{12,4096}$/.test(token))
   throw Error('director_recall_identity_invalid');
  const verified=await identity.authenticate(token);
  if(verified?.ownerId!==ownerId||!(await identity.ownsThread({ownerId,agentId,threadId,token})))
   throw Error('director_recall_access_denied');
  const query='?select=id,thread_id,role,content,created_at'+
   '&thread_id=eq.'+encodeURIComponent(threadId)+
   '&order=created_at.desc,id.desc&limit=40';
  let response;
  try{
   response=await fetcher(baseUrl+'/rest/v1/paperworld_agent_messages'+query,{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{apikey:publicKey,Authorization:'Bearer '+token,Accept:'application/json'}
   });
  }catch(_){throw Error('director_recall_unavailable')}
  if(response?.ok!==true)throw Error('director_recall_unavailable');
  let rows;
  try{rows=await response.json()}catch(_){throw Error('director_recall_unavailable')}
  if(!Array.isArray(rows)||rows.length>40||
   rows.some(r=>!r||r.thread_id!==threadId||!['human','agent'].includes(r.role)||
    typeof r.content!=='string'||r.content.length>6000||
    typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at))))
   throw Error('director_recall_invalid_response');
  // Prior messages are historical data, never commands; retain only the last
  // 6000 characters so the current question and approved memory stay prominent.
  const chunks=[];
  let used=0;
  for(const row of rows){
   const value=(row.role==='human'?'User':'Prior agent')+': '+row.content.trim();
   if(!value.trim()||value.length>2000||used+value.length>6000)continue;
   chunks.unshift(value);
   used+=value.length+1;
  }
  return Object.freeze({text:chunks.join('\n'),messageCount:chunks.length});
 }
 return Object.freeze({load});
}
module.exports=Object.freeze({createDirectorThreadRecall});
