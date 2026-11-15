/* PAPERWORLD server-only durable approval adapter.
 * Inactive until the separately reviewed owner-authenticated issuance flow
 * and private RLS-protected table are activated. NEVER browser accessible.
 * Uses one atomic PostgREST PATCH with exact filters, no read-then-write race.
 */
'use strict';
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HEX=/^[a-f0-9]{64}$/i;
const URL='https://jrevhzvrgenucuozjowm.supabase.co';
function createDurableApprovalStore({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 if(typeof fetcher!=='function'||typeof secret!=='string'||
  !(secret.startsWith('sb_secret_')||secret.startsWith('eyJ')))
  throw Error('approval_backend_secret_required');
 async function issue({ownerId,jobId,digest}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(jobId||'')||!HEX.test(digest||''))
   throw Error('invalid_approval_issuance');
  const id=randomUUID(),secretToken=randomBytes(32).toString('hex');
  const expires=new Date(Date.now()+10*60*1000).toISOString();
  const secretHash=createHash('sha256').update(secretToken).digest('hex');
  const response=await fetcher(URL+'/rest/v1/paperworld_write_approvals',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,
    ...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    'Content-Type':'application/json',Accept:'application/json',
    Prefer:'return=representation'},
   body:JSON.stringify({id,owner_id:ownerId,job_id:jobId,
    repository:'mr-tanq/concerts',plan_digest:digest,secret_hash:secretHash,
    expires_at:expires})
  });
  if(!response?.ok)throw Error('approval_issue_unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==id)
   throw Error('approval_issue_unverified');
  // Only the backend sees the one-use secret; never send it to the browser.
  return Object.freeze({id,secret:secretToken});
 }
 async function consumeOnce({id,ownerId,jobId,repository,digest,secretHash,now}={}){
  if(!UUID.test(id||'')||!UUID.test(ownerId||'')||!UUID.test(jobId||'')||
   repository!=='mr-tanq/concerts'||!HEX.test(digest||'')||
   !HEX.test(secretHash||'')||!Number.isFinite(now))return false;
  const expires=new Date(now).toISOString();
  if(expires==='Invalid Date')return false;
  const filters=new URLSearchParams({
   select:'id',
   id:'eq.'+id,owner_id:'eq.'+ownerId,job_id:'eq.'+jobId,
   repository:'eq.mr-tanq/concerts',
   plan_digest:'eq.'+digest,
   secret_hash:'eq.'+secretHash,
   consumed_at:'is.null',
   expires_at:'gt.'+expires
  });
  // Service credentials remain on Render only. No token in URL/body/logs.
  try{
   const response=await fetcher(URL+'/rest/v1/paperworld_write_approvals?'+filters,{
    method:'PATCH',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{apikey:secret,
     ...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
     'Content-Type':'application/json',
     Prefer:'return=representation'},
    body:JSON.stringify({consumed_at:expires})
   });
   if(!response?.ok)return false;
   const rows=await response.json();
   return Array.isArray(rows)&&rows.length===1&&rows[0].id===id;
  }catch(_){return false}
 }
 return Object.freeze({issue,consumeOnce});
}
module.exports=Object.freeze({createDurableApprovalStore});
