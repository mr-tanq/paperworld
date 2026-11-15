/* PAPERWORLD Listening Mirror Draft PR publisher — disabled until explicit
 * authenticated, one-use write approval is integrated. No app route invokes it.
 * Never merges, deploys, force-pushes, or accepts a user-provided repository.
 */
'use strict';
const {validateChangeProposal}=require('./listening-change-proposal.cjs');
const {OWNER,REPO,REF}=require('./listening-repo-reader.cjs');
const COMMIT=/^[a-f0-9]{40}$/i;
const TOKEN=/^(gho_|ghu_|ghp_|github_pat_)[A-Za-z0-9_]{12,}$/;
const API='https://api.github.com/repos/'+OWNER+'/'+REPO;
function createDraftPrPublisher({fetcher=globalThis.fetch,verifyAndConsumeApproval}={}){
 if(typeof fetcher!=='function'||typeof verifyAndConsumeApproval!=='function')
  throw Error('trusted_write_approval_service_required');
 async function request(token,method,path,body){
  const response=await fetcher(API+path,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',
    'User-Agent':'paperworld-reviewed-draft-pr'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!response?.ok)throw Error('github_draft_operation_failed_'+response?.status);
  const result=await response.json();
  return result;
 }
 async function publish({job,proposal,evidence,approval,ownerId,githubToken}={}){
  // Validation happens before the first GitHub request, and before approval
  // can be consumed. The current GitHub OAuth must be separately reviewed
  // for write permissions; this function is NOT wired to the app.
  const plan=validateChangeProposal({job,proposal,evidence});
  if(!/^[a-f0-9-]{36}$/i.test(ownerId||'')||
   typeof githubToken!=='string'||!TOKEN.test(githubToken))
   throw Error('authenticated_publisher_required');
  // The trusted verifier must authenticate owner/thread and atomically
  // consume a one-use grant bound to this exact immutable proposal.
  const authorized=await verifyAndConsumeApproval({approval,ownerId,jobId:plan.jobId,
   repository:plan.repository,plan});
  if(authorized!==true)throw Error('explicit_write_approval_required');
  const base=await request(githubToken,'GET','/git/ref/heads/'+REF);
  const baseSha=base?.object?.sha;
  if(!COMMIT.test(baseSha||''))throw Error('invalid_base_commit');
  // Verify current file revisions BEFORE creating a branch. No stale writes.
  for(const edit of plan.edits){
   const file=await request(githubToken,'GET','/contents/'+
    edit.path.split('/').map(encodeURIComponent).join('/')+'?ref='+REF);
   if(file?.type!=='file'||file.sha!==edit.expectedSha)
    throw Error('stale_source_revision');
  }
  const shortId=plan.jobId.slice(0,8).toLowerCase();
  const branch='paperworld/review-'+shortId;
  await request(githubToken,'POST','/git/refs',
   {ref:'refs/heads/'+branch,sha:baseSha});
  for(const edit of plan.edits){
   await request(githubToken,'PUT','/contents/'+
    edit.path.split('/').map(encodeURIComponent).join('/'),{
     message:'Paperworld proposed change: '+plan.summary.slice(0,120),
     content:Buffer.from(edit.replacement,'utf8').toString('base64'),
     sha:edit.expectedSha,branch
    });
  }
  const pr=await request(githubToken,'POST','/pulls',{
   title:'[Paperworld draft] '+plan.summary.slice(0,120),
   head:branch,base:REF,draft:true,
   body:'Owner-approved Listening Mirror proposal for review.\\n'+
    'Job: '+plan.jobId+'\\n'+
    'No tests have been executed by PAPERWORLD. Review changes and CI before any merge.\\n'+
    'Files: '+plan.edits.map(e=>e.path).join(', ')
  });
  if(!Number.isInteger(pr.number)||pr.number<=0||
   typeof pr.html_url!=='string'||!pr.html_url.startsWith(
   'https://github.com/'+OWNER+'/'+REPO+'/pull/'))
   throw Error('draft_pr_confirmation_missing');
  return Object.freeze({repository:OWNER+'/'+REPO,number:pr.number,
   url:pr.html_url,draft:true,merged:false,testsRun:false,jobId:plan.jobId});
 }
 return Object.freeze({publish});
}
module.exports=Object.freeze({createDraftPrPublisher});
