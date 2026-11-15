/* PAPERWORLD draft-write approval boundary.
 * This module has NO credentials, HTTP endpoint, DB writes or token issuance.
 * Requires a trusted persistent store with atomic consume-if-unspent semantics.
 * The owner must separately authenticate and approve exact proposed contents.
 */
'use strict';
const {createHash,timingSafeEqual}=require('node:crypto');
const {validateChangeProposal}=require('./listening-change-proposal.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const GRANT=/^[a-f0-9]{64}$/i;
function digestPlan(plan){
 if(!plan||plan.kind!=='paperworld-listening-change-proposal-v1'||
  !UUID.test(plan.jobId||'')||plan.repository!=='mr-tanq/concerts'||
  plan.baseRef!=='main'||plan.execution!=='none'||
  !Array.isArray(plan.edits)||plan.edits.length<1||plan.edits.length>3||
  typeof plan.summary!=='string')throw Error('invalid_approval_plan');
 const canonical=JSON.stringify({version:1,jobId:plan.jobId,
  repository:plan.repository,baseRef:plan.baseRef,summary:plan.summary,
  edits:plan.edits.map(e=>({path:e.path,expectedSha:e.expectedSha,
   replacement:e.replacement}))});
 return createHash('sha256').update(canonical,'utf8').digest('hex');
}
function createOneUseApprovalVerifier({store,clock=Date.now}={}){
 if(!store||typeof store.consumeOnce!=='function'||typeof clock!=='function')
  throw Error('atomic_persistent_approval_store_required');
 async function verifyAndConsumeApproval({approval,ownerId,jobId,repository,plan}={}){
  // This verifies an ALREADY authenticated and explicitly approved grant.
  // A browser-supplied boolean or preview payload cannot create approval.
  if(!UUID.test(ownerId||'')||!UUID.test(jobId||'')||
   !approval||typeof approval!=='object'||Array.isArray(approval)||
   !UUID.test(approval.id||'')||!GRANT.test(approval.secret||'')||
   plan?.jobId!==jobId||repository!=='mr-tanq/concerts')return false;
  let digest;
  try{digest=digestPlan(plan)}catch(_){return false}
  // Consume MUST be one single durable conditional write: owner+job+digest,
  // active deadline and exact secret digest; 1 concurrent caller succeeds.
  const secretHash=createHash('sha256').update(approval.secret).digest('hex');
  const outcome=await store.consumeOnce({
   id:approval.id,ownerId,jobId,repository,digest,secretHash,now:clock()
  });
  return outcome===true;
 }
 return Object.freeze({verifyAndConsumeApproval});
}
module.exports=Object.freeze({digestPlan,createOneUseApprovalVerifier});
