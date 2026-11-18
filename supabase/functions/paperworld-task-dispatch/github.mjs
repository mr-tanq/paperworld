/* GitHub operations for Paperworld Task Engine v1.
 * Pure dependency-injected adapter. No IO at import, no implicit retries.
 * The dispatcher MUST reserve a DB effect before createIssue/assign/dispatchVerify.
 */
const HOST='https://api.github.com';
const PROJECTS=Object.freeze({
 pokemon:Object.freeze({repo:'mr-tanq/pokemon-echoes'}),
 listening:Object.freeze({repo:'mr-tanq/concerts'})
});
const SHA=/^[a-f0-9]{40}$/i;
const ISSUE_MARKER=/<!-- paperworld:([a-zA-Z0-9:_-]{8,160}) -->/;
const COPILOT=new Set(['Copilot','copilot-swe-agent[bot]']);
function getProject(id){if(!Object.hasOwn(PROJECTS,id))throw Error('project_not_allowed');return PROJECTS[id]}
function repoPath(projectId,resource){const repo=getProject(projectId).repo;
 if(typeof resource!=='string'||!resource.startsWith('/')||resource.includes('..')||
  resource.includes('://')||resource.includes('#')||resource.includes('\\'))
  throw Error('invalid_repo_resource');
 return '/repos/'+repo+resource;
}
function markerFor(effectKey){
 if(typeof effectKey!=='string'||!/^[a-zA-Z0-9:_-]{8,160}$/.test(effectKey))
  throw Error('invalid_effect_key');
 return '<!-- paperworld:'+effectKey+' -->';
}
function isCopilotAssigned(issue){return (issue?.assignees||[]).some(x=>COPILOT.has(x?.login))}
function linkedIssue(body,number){
 if(typeof body!=='string'||!Number.isSafeInteger(number)||number<1)return false;
 // '#1' must not match '#10', and only the exact repository is allowed.
 return new RegExp('(?:^|[^0-9])#'+number+'\\b').test(body)||
  new RegExp('mr-tanq/(?:pokemon-echoes|concerts)#'+number+'\\b').test(body);
}
function makeTaskGithub({fetcher=fetch,token}={}){
 if(typeof token!=='string'||token.length<20||typeof fetcher!=='function')
  throw Error('github_credential_unavailable');
 async function api(project,resource,{method='GET',body}={}){
  const path=repoPath(project,resource);
  const res=await fetcher(HOST+path,{
   method,redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',
    'Authorization':'Bearer '+token,'User-Agent':'paperworld-v1',
    ...(body===undefined?{}:{'Content-Type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!res?.ok)throw Error('github_http_'+(res?.status||0));
  if(res.status===204)return null;
  return res.json();
 }
 async function getIssue(project,issueNumber,effectKey){
  if(!Number.isSafeInteger(issueNumber)||issueNumber<1)throw Error('bad_issue_number');
  const issue=await api(project,'/issues/'+issueNumber);
  if(issue?.state!=='open'||typeof issue?.body!=='string'||issue.pull_request||
   !issue.body.includes(markerFor(effectKey)))throw Error('issue_effect_not_verified');
  return issue;
 }
 async function findExistingIssue(project,effectKey){
  const marker=markerFor(effectKey),found=[];
  // Never trust search hits alone. Each candidate is independently fetched.
  const issues=await api(project,'/issues?state=all&per_page=100');
  if(!Array.isArray(issues))throw Error('invalid_issue_list');
  for(const issue of issues){
   if(issue?.pull_request||!issue?.body?.includes(marker))continue;
   const n=issue.number;
   if(!Number.isSafeInteger(n)||n<1)continue;
   const exact=await api(project,'/issues/'+n);
   if(exact?.body?.includes(marker))found.push(exact);
  }
  if(found.length>1)throw Error('ambiguous_issue_identity');
  return found[0]||null;
 }
 async function createIssue(project,{effectKey,title,body}){
  const marker=markerFor(effectKey);
  if(typeof title!=='string'||title.length<1||title.length>120||
   typeof body!=='string'||body.length<1||body.length>5000)
   throw Error('invalid_task_brief');
  const existing=await findExistingIssue(project,effectKey);
  if(existing)return {state:'existing',issueNumber:existing.number,
   issueUrl:existing.html_url};
  // External POST is once only; caller tracks intent and uncertain response.
  try{
   const created=await api(project,'/issues',{method:'POST',body:{
    title,body:body+'\n\n'+marker
   }});
   if(!created?.number||!created?.html_url)throw Error('created_issue_response_missing');
   return {state:'created',issueNumber:created.number,issueUrl:created.html_url};
  }catch(_){return {state:'uncertain',reconcile:true};}
 }
 async function assignCopilot(project,{issueNumber,effectKey,base='main'}){
  const issue=await getIssue(project,issueNumber,effectKey);
  if(isCopilotAssigned(issue))return {state:'already_assigned',issueNumber};
  if(base!=='main')throw Error('untrusted_base_branch');
  try{
   const result=await api(project,'/issues/'+issueNumber+'/assignees',{
    method:'POST',body:{assignees:['copilot-swe-agent[bot]'],
     agent_assignment:{target_repo:getProject(project).repo,base_branch:'main'}}
   });
   if(isCopilotAssigned(result))return {state:'assigned',issueNumber};
   return {state:'uncertain',reconcile:true};
  }catch(_){return {state:'uncertain',reconcile:true};}
 }
 async function reconcileAssignment(project,{issueNumber,effectKey}){
  const issue=await getIssue(project,issueNumber,effectKey);
  return isCopilotAssigned(issue)?{state:'confirmed',issueNumber}:{state:'uncertain'};
 }
 async function findLinkedPr(project,{issueNumber,effectKey}){
  const issue=await getIssue(project,issueNumber,effectKey);
  if(!isCopilotAssigned(issue))throw Error('agent_assignment_unverified');
  // Link metadata is supporting evidence, not sufficient by itself.
  const timeline=await api(project,'/issues/'+issueNumber+'/timeline?per_page=100');
  if(!Array.isArray(timeline))throw Error('issue_timeline_unavailable');
  const candidates=new Set();
  for(const e of timeline){
   const n=e?.source?.issue?.number;
   if(e?.event==='cross-referenced'&&e.source?.issue?.pull_request&&
      Number.isSafeInteger(n))candidates.add(n);
  }
  const prs=[];
  for(const n of candidates){
   const p=await api(project,'/pulls/'+n);
   if(p?.state==='open'&&p?.draft===true&&p.base?.ref==='main'&&
      /^copilot\/[A-Za-z0-9._-]{1,120}$/.test(p.head?.ref||'')&&
      linkedIssue(p.body,issueNumber))prs.push(p);
  }
  if(prs.length>1)return {state:'ambiguous'};
  if(prs.length===0)return {state:'waiting'};
  return {state:'found',pr:prs[0]};
 }
 async function assertScopedChanges(project,prNumber,allowedPaths,maxFiles){
  const rows=await api(project,'/pulls/'+prNumber+'/files?per_page=100');
  if(!Array.isArray(rows)||rows.length<1||rows.length>maxFiles)
   throw Error('file_count_denied');
  const allowed=Array.isArray(allowedPaths)?allowedPaths:[];
  if(rows.some(f=>typeof f.filename!=='string'||f.filename.startsWith('.github/')||
    f.filename.startsWith('.paperworld/')||f.filename.startsWith('assets/')||
    f.filename.startsWith('addons/')||
    !allowed.some(p=>f.filename.startsWith(p))||
    !['added','modified'].includes(f.status)))
    throw Error('file_policy_denied');
  return rows.map(f=>f.filename);
 }
 async function dispatchVerify(project,{missionId,headSha,requiredTests,workflow='paperworld-verify.yml'}){
  if(!/^[a-f0-9-]{36}$/i.test(missionId)||!SHA.test(headSha)||
   !Array.isArray(requiredTests)||requiredTests.length<1||requiredTests.length>10||
   workflow!=='paperworld-verify.yml')throw Error('unsafe_verification_request');
  try{
   const result=await api(project,'/actions/workflows/'+workflow+'/dispatches',{
    method:'POST',body:{ref:'main',return_run_details:true,
     inputs:{commit_sha:headSha,mission:missionId,
      required_tests:JSON.stringify(requiredTests)}}
   });
   const runId=result?.workflow_run_id||result?.id;
   if(!Number.isSafeInteger(runId)||runId<1)
    return {state:'uncertain',reconcile:true};
   return {state:'submitted',runId,headSha};
  }catch(_){return {state:'uncertain',reconcile:true};}
 }
 async function getVerifiedRun(project,{runId,headSha,mainSha,workflow='paperworld-verify.yml'}){
  if(!Number.isSafeInteger(runId)||runId<1||!SHA.test(headSha)||!SHA.test(mainSha)||
   workflow!=='paperworld-verify.yml')throw Error('invalid_run_provenance');
  const run=await api(project,'/actions/runs/'+runId);
  if(run?.event!=='workflow_dispatch'||run?.head_branch!=='main'||
    run?.head_sha!==mainSha||run?.run_attempt!==1||
    run?.path!=='.github/workflows/'+workflow||
    run?.status!=='completed'||run?.conclusion!=='success')
    throw Error('untrusted_workflow_run');
  return run;
 }
 return Object.freeze({getIssue,findExistingIssue,createIssue,
  assignCopilot,reconcileAssignment,findLinkedPr,assertScopedChanges,
  dispatchVerify,getVerifiedRun});
}
export {makeTaskGithub,repoPath,linkedIssue,markerFor,PROJECTS};
