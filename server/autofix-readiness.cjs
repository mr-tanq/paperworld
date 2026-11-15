/* Stage 1F operational readiness report. Informational only: this code
 * does NOT authorize execution, GitHub writes, budgets or deployment.
 * Every probe is a trusted backend function, never a model assertion.
 */
'use strict';
const {REPOSITORY}=require('./autofix-candidate-policy.cjs');
const REQUIREMENTS=Object.freeze([
 'dedicatedSandboxHost','pinnedImage','isolatedStaging','baselineTests',
 'independentSigner','atomicNonceStore','scopedGithubApp',
 'atomicDailyQuota','zeroOverageEnforcement','ownerApproval'
]);
function fail(code){const e=new Error(code);e.code=code;throw e}
function createAutofixReadiness({readSources,probes}={}){
 if(typeof readSources!=='function'||!probes||
    REQUIREMENTS.some(name=>typeof probes[name]!=='function'))
  fail('trusted_readiness_probes_required');
 async function inspect({ownerId}={}){
  const results=Object.create(null);
  try{
   const data=await readSources({ownerId,repository:REPOSITORY});
   results.pinnedGitHubSource=data?.repository===REPOSITORY&&
    /^[a-f0-9]{40}$/.test(data.baseCommitSha||'')&&data.readOnly===true&&
    Object.keys(data.trustedSources||{}).length===2;
  }catch(_){results.pinnedGitHubSource=false}
  for(const key of REQUIREMENTS){
   try{results[key]=await probes[key]({ownerId,repository:REPOSITORY})===true}
   catch(_){results[key]=false}
  }
  const missing=Object.freeze(Object.entries(results)
   .filter(([,ready])=>!ready).map(([name])=>name));
  return Object.freeze({
   repository:REPOSITORY,sourceReadReady:results.pinnedGitHubSource===true,
   // No production write permission is granted by this diagnostic tool,
   // even if every check is true. Separate audited activation is required.
   autonomousWritesEnabled:false,
   canPublishDraftPR:false,
   missing,checks:Object.freeze(results)
  });
 }
 return Object.freeze({inspect});
}
module.exports=Object.freeze({createAutofixReadiness,REQUIREMENTS});
