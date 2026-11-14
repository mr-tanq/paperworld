/* PAPERWORLD: server-only, single-use approval claim adapter.
 * The DB executor must use a private, parameterized PostgreSQL connection,
 * authorized to update paperworld_private.matt_ai_approvals.
 * DOES NOT create approvals or automatically approve requests.
 */
'use strict';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const CLAIM_SQL=`
UPDATE paperworld_private.matt_ai_approvals
   SET state='claimed', claimed_at=now()
 WHERE id=$1::uuid AND request_id=$2::uuid AND thread_id=$3::uuid
   AND owner_id=$4::uuid AND agent_id='matt'
   AND state='approved' AND expires_at > now()
RETURNING id`;
function createApprovalClaimer({execute,checkBudget}={}){
 if(typeof execute!=='function'||typeof checkBudget!=='function')
  throw Error('Trusted database executor and billing guard required');
 async function claimApproval({approvalId,requestId,threadId,ownerId,agentId}={}){
  if([approvalId,requestId,threadId,ownerId].some(v=>typeof v!=='string'||!UUID.test(v))||agentId!=='matt')
   return {allowed:false,budgetConfigured:false};
  // A TRUE billing check is independently required; no automatic overage.
  if((await checkBudget({ownerId,agentId,requestId}))!==true)
   return {allowed:false,budgetConfigured:false};
  const result=await execute(CLAIM_SQL,[approvalId,requestId,threadId,ownerId]);
  const rows=Array.isArray(result)?result:result?.rows;
  // Fail closed on unexpected result, including duplicate claims.
  return {allowed:Array.isArray(rows)&&rows.length===1&&rows[0]?.id===approvalId,
          budgetConfigured:true};
 }
 return Object.freeze({claimApproval});
}
module.exports=Object.freeze({createApprovalClaimer,CLAIM_SQL});
