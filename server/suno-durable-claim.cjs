/* Durable preflight claim for credit-spending Suno calls.
 * A missing secret, unavailable DB or reused key must prevent submission.
 * This module never sends lyrics, credentials or provider responses to DB.
 */
'use strict';
const {createHash}=require('node:crypto');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function makeSunoClaim({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 const configured=typeof secret==='string'&&
  (secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 // Read-only readiness check for the diagnostic: does the claim table exist
 // and accept the service credential? Selects zero rows; never inserts.
 async function ready(){
  if(!configured||typeof fetcher!=='function')return {ready:false,reason:'claim_secret_missing'};
  try{
   const response=await fetcher(BASE+'/rest/v1/paperworld_suno_create_claims?select=owner_id&limit=0',{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),
    headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
     Accept:'application/json','Cache-Control':'no-store'}});
   if(response?.ok)return {ready:true,reason:'claim_storage_ready'};
   // PostgREST answers 404 when the migration has not been applied.
   if(response?.status===404)return {ready:false,reason:'claim_storage_missing'};
   if(response?.status===401||response?.status===403)
    return {ready:false,reason:'claim_secret_rejected'};
   return {ready:false,reason:'claim_storage_unavailable'};
  }catch(_){return {ready:false,reason:'claim_storage_unavailable'}}
 }
 return Object.freeze({ready,async reserve({ownerId,threadId,idempotencyKey,brief}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(threadId||'')||
   !UUID.test(idempotencyKey||'')||!brief||
   typeof brief.title!=='string'||typeof brief.style!=='string'||
   typeof brief.lyrics!=='string')throw Error('suno_claim_invalid');
  if(!configured||typeof fetcher!=='function')throw Error('suno_claim_unavailable');
  const digest=createHash('sha256').update(JSON.stringify([
   brief.title,brief.style,brief.lyrics])).digest('hex');
  const response=await fetcher(BASE+'/rest/v1/rpc/paperworld_suno_claim_create',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    Accept:'application/json','Content-Type':'application/json','Cache-Control':'no-store'},
   body:JSON.stringify({p_owner:ownerId,p_thread:threadId,
    p_key:idempotencyKey,p_digest:digest})
  });
  // 404 = migration sql/paperworld_suno_durable_claim_v1.sql not applied.
  if(response?.status===404)throw Error('suno_claim_storage_missing');
  if(!response?.ok){
   // Phase 4: the monthly cap (50 songs) is enforced inside the claim itself.
   let detail='';
   try{detail=String((await response.json())?.message||'')}catch(_){}
   if(detail.includes('suno_monthly_limit_reached'))throw Error('suno_monthly_limit_reached');
   throw Error('suno_claim_unavailable');
  }
  const result=await response.json();
  if(result!==true&&result!==false)throw Error('suno_claim_invalid_reply');
  return result;
 }});
}
module.exports={makeSunoClaim};
