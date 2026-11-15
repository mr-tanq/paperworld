/* PAPERWORLD Auto Fix - untrusted-code sandbox execution contract.
 * A deterministic execution PLAN only. Does not invoke Docker or run code.
 * Future runner MUST be separately isolated from credentials and publication.
 */
'use strict';
const {REPOSITORY,SOURCE_FILES}=require('./autofix-candidate-policy.cjs');
const {digest}=require('./autofix-github-draft-publisher.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const IMAGE=/^node:22(?:\.[0-9]{1,3})?(?:\.[0-9]{1,3})?-alpine@sha256:[a-f0-9]{64}$/;
const TEST=/^tests\/autofix\/ticketswap-[a-z0-9-]{1,40}\.test\.mjs$/;
function reject(code){const e=new Error(code);e.code=code;throw e}
function makeSandboxPlan({candidate,image,workspace,expectedBaseSha,approvedImageDigest}={}){
 if(!candidate||candidate.repository!==REPOSITORY||!UUID.test(candidate.taskId||'')||
   !SHA.test(candidate.baseCommitSha||'')||candidate.baseCommitSha!==expectedBaseSha||
   !Array.isArray(candidate.files)||candidate.files.length<2||candidate.files.length>3||
   candidate.merge!=='blocked'||candidate.deployment!=='blocked')
  reject('invalid_candidate');
 if(typeof workspace!=='string'||!/^\/var\/lib\/paperworld-autofix\/jobs\/[a-f0-9-]{36}\/work$/.test(workspace)||
   workspace!==('/var/lib/paperworld-autofix/jobs/'+candidate.taskId+'/work'))
  reject('untrusted_workspace');
 if(typeof image!=='string'||!IMAGE.test(image)||
   !DIGEST.test(approvedImageDigest||'')||image.split('@sha256:')[1]!==approvedImageDigest)
  reject('unapproved_container_image');
 let tests=0,source=0;
 for(const f of candidate.files){
  if(f?.kind==='modify'&&SOURCE_FILES.includes(f.path))source++;
  else if(f?.kind==='new-test'&&TEST.test(f.path))tests++;
  else reject('candidate_path_denied');
  if(typeof f.content!=='string'||Buffer.byteLength(f.content)>20000)
   reject('candidate_content_denied');
 }
 if(source<1||tests!==1)reject('regression_test_missing');
 const testPath=candidate.files.find(f=>f.kind==='new-test').path;
 // No shell; no download/pull; no host environment; no Docker socket mount.
 // Output must be bounded by the executor, which cannot run on Render.
 const flags=Object.freeze([
  'run','--rm','--pull=never','--network=none',
  '--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
  '--pids-limit=64','--memory=256m','--cpus=1',
  '--user=65534:65534','--ulimit=nofile=64:64',
  '--tmpfs=/tmp:rw,noexec,nosuid,size=32m',
  '--mount=type=bind,src='+workspace+',dst=/work,readonly',
  '--workdir=/work','--env=HOME=/tmp','--env=NODE_OPTIONS=',
  image
 ]);
 const checks=Object.freeze([
  ...candidate.files.filter(f=>f.kind==='modify').map(f=>Object.freeze({
   id:'syntax:'+f.path,command:Object.freeze(['node','--check',f.path])})),
  Object.freeze({id:'regression',command:Object.freeze(['node','--test',testPath])})
 ]);
 return Object.freeze({version:1,repository:REPOSITORY,taskId:candidate.taskId,
  baseCommitSha:candidate.baseCommitSha,candidateDigest:digest(candidate),
  image,workspace,network:'disabled',secrets:'none',
  containerOptions:flags,checks,timeoutMsPerCheck:15000,
  maxOutputBytesPerCheck:16000,maxTotalChecks:4,
  // This is NOT an attestation. Only an independent trusted executor may sign one.
  attestation:'not_issued',approvedForPublish:false});
}
module.exports=Object.freeze({makeSandboxPlan});
