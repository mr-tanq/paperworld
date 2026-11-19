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
 return Object.freeze({async reserve({ownerId,threadId,idempotencyKey,brief}={}){
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
  if(!response?.ok)throw Error('suno_claim_unavailable');
  const result=await response.json();
  if(result!==true&&result!==false)throw Error('suno_claim_invalid_reply');
  return result;
 }});
}
module.exports={makeSunoClaim};
