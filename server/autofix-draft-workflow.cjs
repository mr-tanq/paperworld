/* Draft-PR-only Auto Fix coordinator. NOT mounted in the HTTP server.
 * Requires explicitly installed trusted adapters; no default GitHub writes,
 * Copilot calls, CLI commands, process execution, merge or deployment.
 */
'use strict';
const {prepareCandidate,REPOSITORY}=require('./autofix-candidate-policy.cjs');
const MAX_AI_TURNS=5,MAX_JOBS_PER_DAY=2;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function fail(code){const e=new Error(code);e.code=code;throw e}
function createDraftAutofix({authorize,quota,readSources,analyze,
 sandboxVerify,publisher,audit}={}){
 if([authorize,quota?.claim,readSources,analyze,sandboxVerify,
   publisher?.createDraftPullRequest,audit].some(x=>typeof x!=='function'))
  fail('trusted_adapters_required');
 async function run({taskId,ownerId,request}={}){
  if(!UUID.test(taskId||'')||!UUID.test(ownerId||'')||
    typeof request!=='string'||!request.trim()||request.length>1200)
   fail('invalid_request');
  const owner=Object.freeze({taskId,ownerId,repository:REPOSITORY});
  // Authorization and budget are backend-sourced, NEVER model-supplied.
  const allow=await authorize(owner);
  if(!allow||allow.ownerId!==ownerId||allow.scope!=='ticketing'||
     allow.allowDraftPR!==true||allow.zeroOverageVerified!==true)
   fail('autofix_not_authorized');
  // Atomic durable reservation must be in the caller's trusted adapter.
  if(await quota.claim({...owner,limit:MAX_JOBS_PER_DAY})!==true)
   fail('daily_limit_reached');
  await audit({...owner,event:'reserved'});
  const snapshot=await readSources(owner);
  if(!snapshot||snapshot.repository!==REPOSITORY||
    !/^[a-f0-9]{40}$/.test(snapshot.baseCommitSha||'')||
    !snapshot.trustedSources||typeof snapshot.trustedSources!=='object')
   fail('trusted_snapshot_unavailable');
  // This adapter must itself enforce the max token/turn budget; a returned
  // count alone CANNOT prove inference cost or constrain future billing.
  const proposed=await analyze({taskId,request:request.trim(),
   repository:REPOSITORY,allowance:MAX_AI_TURNS,
   sourcePaths:Object.freeze(Object.keys(snapshot.trustedSources))});
  if(!proposed||!Number.isInteger(proposed.turnsUsed)||
    proposed.turnsUsed<0||proposed.turnsUsed>MAX_AI_TURNS)
   fail('turn_limit_unverified');
  const candidate=prepareCandidate({repository:REPOSITORY,taskId,
   baseCommitSha:snapshot.baseCommitSha,trustedSources:snapshot.trustedSources,
   proposedFiles:proposed.files});
  // Never run generated code on the Render host or GitHub Actions with secrets.
  // The trusted sandbox must attest no network, no secrets and real test results.
  const checks=await sandboxVerify({candidate,network:'disabled',secrets:'none'});
  if(!checks||checks.passed!==true||checks.networkDisabled!==true||
   checks.secretsMounted!==false||checks.baseCommitSha!==candidate.baseCommitSha||
   !Array.isArray(checks.testNames)||checks.testNames.length<1||
   !checks.testNames.every(x=>typeof x==='string'&&x.length<=100))
   fail('sandbox_verification_required');
  // Fresh, immutable base protection is owned by the trusted publisher.
  // Only a DRAFT PR may be created, with no merge/deploy capability.
  const stillAllowed=await authorize(owner);
  if(!stillAllowed||stillAllowed.ownerId!==ownerId||
   stillAllowed.allowDraftPR!==true||stillAllowed.zeroOverageVerified!==true)
   fail('approval_revoked');
  const publish=await publisher.createDraftPullRequest({
   taskId,repository:REPOSITORY,baseCommitSha:candidate.baseCommitSha,
   branchPrefix:'paperworld/autofix/',draft:true,
   title:'TicketSwap: proposed guarded bug fix',candidate,
   verification:checks
  });
  if(!publish||publish.draft!==true||publish.repository!==REPOSITORY||
   !/^https:\/\/github\.com\/mr-tanq\/concerts\/pull\/[1-9][0-9]*$/.test(publish.url||''))
   fail('draft_pr_not_verified');
  await audit({...owner,event:'draft_pr_created',pullRequestUrl:publish.url});
  return Object.freeze({state:'draft_pr_created',draft:true,taskId,
   prUrl:publish.url,files:candidate.files.map(f=>f.path),
   sourceChangedLines:candidate.sourceChangedLines,
   merge:'blocked',deployment:'blocked',turnsUsed:proposed.turnsUsed});
 }
 return Object.freeze({run});
}
module.exports=Object.freeze({createDraftAutofix,MAX_AI_TURNS,MAX_JOBS_PER_DAY});
