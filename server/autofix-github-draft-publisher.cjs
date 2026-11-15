/* PAPERWORLD Auto Fix — GitHub DRAFT PR publisher prototype.
 * NOT connected to Render, requests or a GitHub App installation.
 * No merge, branch update, deploy, delete or workflow dispatch endpoints.
 * Requires scoped GitHub App installation credential + independent attestation.
 */
'use strict';
const {prepareCandidate,REPOSITORY,SOURCE_FILES}=require('./autofix-candidate-policy.cjs');
const TEST_PATH=/^tests\/autofix\/ticketswap-[a-z0-9-]{1,40}\.test\.mjs$/;
const {createHash}=require('node:crypto');
const SHA=/^[a-f0-9]{40}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const API='https://api.github.com/repos/mr-tanq/concerts';
const MAX_RESPONSE_BYTES=90000;
function deny(code){const e=new Error(code);e.code=code;throw e}
function digest(candidate){
 const h=createHash('sha256');
 h.update(JSON.stringify({repository:candidate.repository,taskId:candidate.taskId,
  baseCommitSha:candidate.baseCommitSha,files:candidate.files.map(f=>({
   path:f.path,kind:f.kind,content:f.content,baseSha:f.baseSha||null}))}));
 return h.digest('hex');
}
function makePublisher({fetcher=globalThis.fetch,installationCredential,attestationVerifier}={}){
 if(typeof fetcher!=='function'||typeof installationCredential!=='function'||
    typeof attestationVerifier!=='function')deny('publisher_dependencies_missing');
 async function createDraftPullRequest(input={}){
  const {taskId,repository,baseCommitSha,branchPrefix,draft,title,candidate,verification}=input;
  if(repository!==REPOSITORY||draft!==true||branchPrefix!=='paperworld/autofix/'||
   !UUID.test(taskId||'')||!SHA.test(baseCommitSha||'')||
   candidate?.repository!==REPOSITORY||candidate.taskId!==taskId||
   candidate.baseCommitSha!==baseCommitSha||
   typeof title!=='string'||title.length>100||!title.startsWith('TicketSwap:'))
   deny('publisher_scope_denied');
  if(candidate.merge!=='blocked'||candidate.deployment!=='blocked'||
   !Array.isArray(candidate.files)||candidate.files.length<2||candidate.files.length>3||
   verification?.passed!==true||verification?.baseCommitSha!==baseCommitSha)
   deny('unverified_candidate');
  const expectedDigest=digest(candidate);
  if(verification.candidateDigest!==expectedDigest||
    await attestationVerifier({taskId,repository:REPOSITORY,
     baseCommitSha,candidateDigest:expectedDigest,candidate,verification})!==true)
   deny('independent_attestation_required');
  // Token must be minted by a trusted GitHub App installation provider. The
  // existing user OAuth credential is never accepted as a publisher token.
  const permit=await installationCredential({repository:REPOSITORY,taskId});
  if(!permit||permit.kind!=='github_app_installation'||
   permit.repository!==REPOSITORY||permit.permissions?.contents!=='write'||
   permit.permissions?.pull_requests!=='write'||typeof permit.token!=='string'||
   !/^(ghs_|github_pat_)[A-Za-z0-9_]{16,500}$/.test(permit.token)||
   !(Date.parse(permit.expiresAt)>Date.now()+30000))
   deny('scoped_installation_required');
  const headers={Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28',
   'User-Agent':'paperworld-autofix-draft-publisher',
   Authorization:'Bearer '+permit.token};
  // The request path is built by the publisher only, never from model text.
  async function call(method,suffix,body,allowed=[200]){
   const url=API+suffix;
   let res;
   try{
    res=await fetcher(url,{method,redirect:'error',headers,
     ...(body===undefined?{}:{body:JSON.stringify(body),
      headers:{...headers,'Content-Type':'application/json'}}),
     signal:AbortSignal.timeout(8000)});
   }catch(_){deny('github_connection_failed')}
   if(!allowed.includes(res?.status))deny('github_unexpected_status');
   let data;
   try{
    const raw=await res.text();
    if(Buffer.byteLength(raw)>MAX_RESPONSE_BYTES)deny('github_response_too_large');
    data=JSON.parse(raw);
   }catch(_){deny('github_unreadable_response')}
   if(res.status===404)return Object.freeze({__notFound:true});
   return data;
  }
  const ref=await call('GET','/git/ref/heads/main');
  if(ref?.object?.sha!==baseCommitSha)deny('base_branch_moved');
  const commit=await call('GET','/git/commits/'+baseCommitSha);
  if(!SHA.test(commit?.tree?.sha||''))deny('base_tree_unavailable');
  const trustedSources={};
  for(const file of candidate.files){
   if(typeof file?.path!=='string'||
      !(SOURCE_FILES.includes(file.path)||TEST_PATH.test(file.path)))
    deny('invalid_path');
   if(file.kind==='new-test'){
    // Ensure no current file is overwritten by a model-generated test.
    const url='/contents/'+file.path+'?ref='+baseCommitSha;
    const resp=await call('GET',url,undefined,[200,404]);
    // Absence is confirmed from HTTP 404, never a user-controlled JSON string.
    if(resp?.__notFound!==true)deny('regression_test_exists');
   }else if(file.kind==='modify'){
    const existing=await call('GET','/contents/'+file.path+'?ref='+baseCommitSha);
    if(existing?.type!=='file'||existing.encoding!=='base64'||
       existing.sha!==file.baseSha||typeof existing.content!=='string'||
       !Number.isInteger(existing.size)||existing.size>20000)
     deny('source_snapshot_changed');
    const content=Buffer.from(existing.content.replace(/\s/g,''),'base64');
    if(content.length!==existing.size)deny('invalid_source_blob');
    trustedSources[file.path]={sha:existing.sha,content:content.toString('utf8')};
   }else deny('invalid_file_operation');
  }
  // Re-run exact deterministic policy against independently fetched sources.
  const validated=prepareCandidate({repository:REPOSITORY,taskId,baseCommitSha,
   trustedSources,proposedFiles:candidate.files.map(f=>({path:f.path,content:f.content}))});
  if(digest(validated)!==expectedDigest)deny('candidate_revalidation_failed');
  // One tree -> one commit, never sequential writes to protected main.
  const tree=await call('POST','/git/trees',{base_tree:commit.tree.sha,
   tree:validated.files.map(f=>({path:f.path,mode:'100644',type:'blob',
    content:f.content}))},[201]);
  if(!SHA.test(tree?.sha||''))deny('tree_unverified');
  const patchCommit=await call('POST','/git/commits',{
   message:'TicketSwap: guarded proposed fix (draft only)',
   tree:tree.sha,parents:[baseCommitSha]},[201]);
  if(!SHA.test(patchCommit?.sha||''))deny('commit_unverified');
  // No overwrites. Branch is deterministically unique for this single task.
  const branch='paperworld/autofix/'+taskId;
  const branchRef='refs/heads/'+branch;
  const created=await call('POST','/git/refs',{ref:branchRef,sha:patchCommit.sha},[201]);
  if(created?.ref!==branchRef||created?.object?.sha!==patchCommit.sha)
   deny('branch_verification_failed');
  // Fail closed if protected main moved while building the draft.
  const latest=await call('GET','/git/ref/heads/main');
  if(latest?.object?.sha!==baseCommitSha)deny('base_branch_moved');
  const pr=await call('POST','/pulls',{
   title,head:branch,base:'main',draft:true,
   body:'Guarded TicketSwap proposal. Offline sandbox attestation required; '+
    'human review and approval mandatory before merge/deployment.\n\nTask: '+taskId+
    '\nCandidate SHA-256: '+expectedDigest},[201]);
  if(pr?.draft!==true||pr?.head?.ref!==branch||
    pr?.head?.sha!==patchCommit.sha||pr?.base?.ref!=='main'||
    pr?.html_url!=='https://github.com/mr-tanq/concerts/pull/'+pr?.number)
   deny('draft_pr_not_verified');
  return Object.freeze({repository:REPOSITORY,draft:true,url:pr.html_url,
   number:pr.number,branch,commitSha:patchCommit.sha});
 }
 return Object.freeze({createDraftPullRequest});
}
module.exports=Object.freeze({makePublisher,digest});
