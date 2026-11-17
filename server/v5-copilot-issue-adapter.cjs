/* Copilot Pro GitHub issue-assignment adapter.
 * NO provider calls during imports. A caller MUST persist a DB effect intent
 * and atomically debit the session budget BEFORE calling assign().
 * Never automatically reassign after a timeout/uncertain result.
 */
'use strict';
const OWNER='mr-tanq';
const TARGETS=Object.freeze({pokemon:'pokemon-echoes',listening:'concerts'});
const BOT='copilot-swe-agent[bot]';
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
  if(issue.assignees.includes(BOT))
   return Object.freeze({state:'already_assigned',issueNumber,repo:issue.repo});
  // ONE attempt only. Any error after the call is uncertain, not retryable.
  try{
   const response=await call(issue.repo,'/issues/'+issueNumber+'/assignees',{
    method:'POST',body:{assignees:[BOT],agent_assignment:{
     target_repo:issue.repo,base_branch:'main',
     custom_instructions:'Follow repository instructions. Make a Draft PR; do not merge, deploy, edit workflows or expose secrets.'
    }}});
   const accepted=(response.assignees||[]).some(x=>x.login===BOT);
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
  if(!issue.assignees.includes(BOT))
   return Object.freeze({state:'uncertain',reason:'unassigned_not_proof_of_no_session',
    issueNumber,repo:issue.repo});
  const pulls=await call(issue.repo,'/pulls?state=all&per_page=100');
  const candidates=pulls.filter(pr=>pr.user?.login===BOT&&
   (pr.body||'').includes('#'+issueNumber));
  const exact=candidates.length===1?candidates[0]:null;
  return Object.freeze({state:exact?'pr_found':'assigned',
   issueNumber,repo:issue.repo,prUrl:exact?.html_url||null,
   prNumber:exact?.number||null,prDraft:exact?.draft??null});
 }
 return Object.freeze({getIssue,assign,reconcile});
}
module.exports=Object.freeze({createCopilotIssueAdapter,allowedRepo,validateIntent});
