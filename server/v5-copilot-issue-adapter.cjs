/* Copilot Pro GitHub issue-assignment adapter.
 * NO provider calls during imports. A caller MUST persist a DB effect intent
 * and atomically debit the session budget BEFORE calling assign().
 * Never automatically reassign after a timeout/uncertain result.
 */
'use strict';
const OWNER='mr-tanq';
const TARGETS=Object.freeze({pokemon:'pokemon-echoes',listening:'concerts'});
const BOT='copilot-swe-agent[bot]';
// GitHub currently returns 'Copilot' for the same cloud-agent assignment.
const isCopilot=(login)=>login===BOT||login==='Copilot';
const copilotBranch=(pr)=>typeof pr?.head?.ref==='string'&&
 /^copilot\/[a-zA-Z0-9._-]{1,120}$/.test(pr.head.ref);
const trustedAgentPr=(pr,issueNumber,effectKey)=>
 pr?.draft===true&&pr?.base?.ref==='main'&&copilotBranch(pr)&&
 (isCopilot(pr?.user?.login)||pr?.user?.login===OWNER)&&
 typeof pr?.body==='string'&&
 pr.body.includes('#'+issueNumber); // effect marker verified on trusted GitHub issue
const MARKER=/<!-- paperworld-v5-effect:([a-zA-Z0-9:_-]{8,160}) -->/;
const API='https://api.github.com';
function allowedRepo(projectId){
 if(!Object.hasOwn(TARGETS,projectId))throw Error('unsupported_project_adapter');
 return OWNER+'/'+TARGETS[projectId];
}
function validateIntent(receipt){
 if(!receipt||receipt.state!=='reserved'||receipt.adapter!=='copilot_agent'||
  receipt.kind!=='start_agent'||receipt.verifiedBudget!==true||
  receipt.allowedByDatabase!==true||receipt.sessions!==1||
  typeof receipt.effectKey!=='string'||
  !/^[a-zA-Z0-9:_-]{8,160}$/.test(receipt.effectKey)||
  typeof receipt.stepId!=='string'||
  !/^[0-9a-f-]{36}$/i.test(receipt.stepId)||
  !Number.isSafeInteger(receipt.issueNumber)||receipt.issueNumber<1)
  throw Error('verified_effect_intent_required');
 return receipt;
}
function createCopilotIssueAdapter({fetcher=globalThis.fetch,token}={}){
 if(typeof token!=='string'||token.length<20||typeof fetcher!=='function')
  throw Error('github_user_token_unavailable');
 const headers=Object.freeze({'Accept':'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28',
  'Authorization':'Bearer '+token,'User-Agent':'paperworld-v5-dispatch'});
 async function call(repo,path,{method='GET',body}={}){
  if(!Object.values(TARGETS).some(x=>repo===OWNER+'/'+x))
   throw Error('repository_outside_allowlist');
  const result=await fetcher(API+'/repos/'+repo+path,{
   method,headers:body?{...headers,'Content-Type':'application/json'}:headers,
   redirect:'error',signal:AbortSignal.timeout(12000),
   ...(body?{body:JSON.stringify(body)}:{})});
  if(!result?.ok){
   const code=result?.status||0;
   if(code===401)throw Error('github_reconnect_required');
   if(code===403||code===429)throw Error('github_access_or_rate_limit');
   if(code===404)throw Error('github_resource_not_found');
   throw Error('github_unexpected_status_'+code);
  }
  return result.json();
 }
 async function getIssue(projectId,issueNumber){
  const repo=allowedRepo(projectId);
  if(!Number.isSafeInteger(issueNumber)||issueNumber<1)
   throw Error('invalid_issue_number');
  const issue=await call(repo,'/issues/'+issueNumber);
  if(issue.pull_request||issue.state!=='open'||!Number.isInteger(issue.number))
   throw Error('not_assignable_open_issue');
  return Object.freeze({repo,number:issue.number,
   assignees:(issue.assignees||[]).map(x=>x.login),
   title:issue.title||'',body:issue.body||''});
 }
 async function prepareIssue({projectId,issueNumber,effectKey}={}){
  if(typeof effectKey!=='string'||!/^[a-zA-Z0-9:_-]{8,160}$/.test(effectKey))
   throw Error('invalid_effect_key');
  const issue=await getIssue(projectId,issueNumber);
  const marker='<!-- paperworld-v5-effect:'+effectKey+' -->';
  const matches=[...issue.body.matchAll(new RegExp(MARKER.source,'g'))];
  if(matches.length>1||matches.length===1&&matches[0][1]!==effectKey)
   throw Error('issue_already_reserved_for_different_effect');
  if(issue.assignees.some(isCopilot))
   throw Error('agent_already_assigned_before_reservation');
  if(matches.length===1)return Object.freeze({state:'prepared',repo:issue.repo,
   issueNumber,effectKey});
  // May create marker in existing issue but NEVER creates another issue
  // or assigns an agent; uncertain PATCH errors must be inspected manually.
  try{
   await call(issue.repo,'/issues/'+issueNumber,{method:'PATCH',
    body:{body:(issue.body?issue.body.trim()+'\n\n':'')+marker}});
  }catch(_){return Object.freeze({state:'uncertain',repo:issue.repo,issueNumber,effectKey})}
  return Object.freeze({state:'prepared',repo:issue.repo,issueNumber,effectKey});
 }
 async function assign({projectId,issueNumber,effectReceipt}={}){
  const verified=validateIntent(effectReceipt);
  if(verified.issueNumber!==issueNumber||verified.projectId!==projectId)
   throw Error('effect_scope_mismatch');
  const issue=await getIssue(projectId,issueNumber);
  // The existing issue must carry the SAME effect marker. Only the
  // server-side preparer can add this marker before reserving the effect.
  const matches=[...issue.body.matchAll(new RegExp(MARKER.source,'g'))];
  if(matches.length!==1||matches[0][1]!==verified.effectKey)
   throw Error('issue_effect_marker_mismatch');
  if(issue.assignees.some(isCopilot))
   return Object.freeze({state:'already_assigned',issueNumber,repo:issue.repo});
  // ONE attempt only. Any error after the call is uncertain, not retryable.
  try{
   const response=await call(issue.repo,'/issues/'+issueNumber+'/assignees',{
    method:'POST',body:{assignees:[BOT],agent_assignment:{
     target_repo:issue.repo,base_branch:'main',
     custom_instructions:'Follow repository instructions. Make a Draft PR; do not merge, deploy, edit workflows or expose secrets.'
    }}});
   const accepted=(response.assignees||[]).some(x=>isCopilot(x.login));
   if(!accepted)return Object.freeze({state:'uncertain',issueNumber,repo:issue.repo});
   return Object.freeze({state:'assigned',issueNumber,repo:issue.repo});
  }catch(_){
   // Do not propagate a retryable network error to the caller.
   return Object.freeze({state:'uncertain',issueNumber,repo:issue.repo});
  }
 }
 async function reconcile({projectId,issueNumber,effectKey}={}){
  if(typeof effectKey!=='string'||!/^[a-zA-Z0-9:_-]{8,160}$/.test(effectKey))
   throw Error('invalid_effect_key');
  const issue=await getIssue(projectId,issueNumber);
  if(!issue.body.includes('<!-- paperworld-v5-effect:'+effectKey+' -->'))
   throw Error('issue_effect_marker_mismatch');
  if(!issue.assignees.some(isCopilot))
   return Object.freeze({state:'uncertain',reason:'unassigned_not_proof_of_no_session',
    issueNumber,repo:issue.repo});
  const pulls=await call(issue.repo,'/pulls?state=all&per_page=100');
  const candidates=pulls.filter(pr=>trustedAgentPr(pr,issueNumber,effectKey));
  const exact=candidates.length===1?candidates[0]:null;
  return Object.freeze({state:exact?'pr_found':'assigned',
   issueNumber,repo:issue.repo,prUrl:exact?.html_url||null,
   prNumber:exact?.number||null,prDraft:exact?.draft??null});
 }
 async function verifyIndependentGodot({projectId,prNumber,issueNumber}={}){
  const repo=allowedRepo(projectId);
  if(projectId!=='pokemon'||!Number.isSafeInteger(prNumber)||prNumber<1||
   issueNumber!==1)throw Error('unsupported_independent_verification');
  // The assignment marker is persistent on the GitHub issue, not on the
  // agent-editable PR description. Never require it to survive in PR body.
  const issue=await getIssue(projectId,issueNumber);
  const markers=[...issue.body.matchAll(new RegExp(MARKER.source,'g'))];
  if(markers.length!==1||!markers[0][1].startsWith('copilot:')||
   !issue.assignees.some(isCopilot))
   return Object.freeze({state:'unverified',reason:'issue_assignment_evidence_missing'});
  const pr=await call(repo,'/pulls/'+prNumber);
  const sha=pr.head?.sha;
  if(!pr.draft||pr.state!=='open'||pr.number!==prNumber||
   !/^[0-9a-f]{40}$/.test(sha||'')||
   !(isCopilot(pr.user?.login)||pr.user?.login===OWNER)||
   pr.base?.ref!=='main'||!copilotBranch(pr)||
   !(pr.body||'').includes('#'+issueNumber))
   return Object.freeze({state:'unverified',reason:'pr_identity_mismatch'});
  const workflow=await call(repo,
   '/actions/workflows/paperworld-verify.yml/runs?event=pull_request&head_sha='+sha+'&per_page=30');
  const runs=(workflow.workflow_runs||[]).filter(run=>
   run.head_sha===sha&&run.event==='pull_request'&&
   run.path==='.github/workflows/paperworld-verify.yml'&&
   run.status==='completed'&&run.conclusion==='success'&&
   (run.pull_requests||[]).some(x=>x.number===prNumber));
  // Multiple completed runs are okay: only trust one whose own jobs and
  // required FIVE-CASE assertion step really succeeded, never a skipped check.
  for(const run of runs){
   if(!Number.isSafeInteger(run.id)||run.id<1||
    run.html_url!=='https://github.com/'+repo+'/actions/runs/'+run.id)continue;
   const jobData=await call(repo,'/actions/runs/'+run.id+'/jobs?per_page=100');
   const approved=(jobData.jobs||[]).some(job=>
    job.name==='headless-godot'&&job.conclusion==='success'&&
    (job.steps||[]).some(st=>
     st.name==='Require five deterministic battle-damage regression cases'&&
     st.status==='completed'&&st.conclusion==='success')&&
    (job.steps||[]).some(st=>
     st.name==='Run headless smoke test (must exit 0)'&&
     st.status==='completed'&&st.conclusion==='success'));
   if(approved)return Object.freeze({state:'verified',projectId,prNumber,
    headSha:sha,runId:run.id,runUrl:run.html_url});
  }
  return Object.freeze({state:'pending',reason:'trusted_five_case_ci_not_green'});
 }
 return Object.freeze({getIssue,prepareIssue,assign,reconcile,verifyIndependentGodot});
}
module.exports=Object.freeze({createCopilotIssueAdapter,allowedRepo,validateIntent});
