/* PAPERWORLD trusted Supabase identity + thread ownership lookups.
 * Pure dependency-injected server helper. NO server launch, Copilot, token persistence.
 * Inject server-held Supabase URL and publishable key, never a service_role key.
 */
'use strict';
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function createSupabaseGuard({baseUrl,publicKey,fetcher}={}){
 if(typeof baseUrl!=='string'||!/^https:\/\/[a-z0-9.-]+$/i.test(baseUrl)||
    typeof publicKey!=='string'||!publicKey||typeof fetcher!=='function')
  throw Error('Trusted Supabase guard configuration required');
 const origin=baseUrl.replace(/\/$/,'');
 function abortAfter(ms){
  if(typeof AbortSignal==='undefined'||typeof AbortSignal.timeout!=='function')throw Error('Abort timeout unavailable');
  return AbortSignal.timeout(ms);
 }
 function tokenOk(token){
  return typeof token==='string'&&token.length>=12&&token.length<=4096&&/^[A-Za-z0-9_.-]+$/.test(token);
 }
 async function call(path,token){
  if(!tokenOk(token))throw Error('Invalid authentication');
  const response=await fetcher(origin+path,{method:'GET',headers:{
   apikey:publicKey,Authorization:'Bearer '+token,Accept:'application/json'
  },redirect:'error',signal:abortAfter(8000)});
  if(!response||response.ok!==true)throw Error('Authorization unavailable');
  const body=await response.json();
  return body;
 }
 async function authenticate(token){
  const person=await call('/auth/v1/user',token);
  if(!person||typeof person.id!=='string'||!ID.test(person.id)||
     person.aud!=='authenticated')throw Error('Invalid authentication');
  return Object.freeze({ownerId:person.id});
 }
 async function ownsThread({threadId,ownerId,agentId,token}={}){
  if(!ID.test(threadId||'')||!ID.test(ownerId||'')||
   !['matt','listening-director','pokemon-director','studio-director','wellbeing-director'].includes(agentId))return false;
  // The same user's Supabase JWT is used. PostgreSQL RLS is still authoritative.
  const auth=await authenticate(token);
  if(auth.ownerId!==ownerId)return false;
  const query='/rest/v1/paperworld_agent_threads?select=id,owner_id,agent_id&id=eq.'+
    encodeURIComponent(threadId)+'&limit=1';
  const rows=await call(query,token);
  if(!Array.isArray(rows)||rows.length!==1)return false;
  const thread=rows[0];
  return thread.id===threadId&&thread.owner_id===ownerId&&thread.agent_id===agentId;
 }
 return Object.freeze({authenticate,ownsThread});
}
module.exports=Object.freeze({createSupabaseGuard});
