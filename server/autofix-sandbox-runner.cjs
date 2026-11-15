/* Auto Fix Phase 1D: guarded Docker sandbox runner, OFF by default.
 * Must run only on a separately reviewed, credential-free, dedicated host.
 * This module does not expose an HTTP handler or enable itself.
 */
'use strict';
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {makeSandboxPlan}=require('./autofix-sandbox-plan.cjs');
const {digest}=require('./autofix-github-draft-publisher.cjs');
const BIN='/usr/bin/docker';
const BASE='/var/lib/paperworld-autofix/jobs';
function reject(code){const error=new Error(code);error.code=code;throw error}
function execute(binary,args,{timeoutMs=15000,maxOutputBytes=16000,spawnProcess=spawn}={}){
 return new Promise(resolve=>{
  let child,done=false,output='',outputBytes=0,timer;
  const finish=(status)=>{if(done)return;done=true;clearTimeout(timer);resolve(Object.freeze({
   ...status,output:output.slice(0,maxOutputBytes),bytes:outputBytes
  }))};
  try{child=spawnProcess(binary,args,{shell:false,env:{PATH:'/usr/bin:/bin'},
   stdio:['ignore','pipe','pipe'],windowsHide:true})}
  catch(_){finish({ok:false,reason:'spawn_failed'});return}
  if(!child||typeof child.once!=='function'||!child.stdout||!child.stderr){
   finish({ok:false,reason:'spawn_invalid'});return
  }
  const collect=(buf)=>{
   const chunk=Buffer.isBuffer(buf)?buf:Buffer.from(String(buf));
   outputBytes+=chunk.length;
   if(outputBytes<=maxOutputBytes)output+=chunk.toString('utf8');
   else{try{child.kill('SIGKILL')}catch(_){}}
  };
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.once('error',()=>finish({ok:false,reason:'spawn_error'}));
  child.once('close',(code,signal)=>{
   finish({ok:code===0&&outputBytes<=maxOutputBytes,
    reason:outputBytes>maxOutputBytes?'output_limit':
      (code===0?'completed':signal?'terminated':'exit_nonzero'),
    exitCode:Number.isInteger(code)?code:null});
  });
  timer=setTimeout(()=>{try{child.kill('SIGKILL')}catch(_){};finish({
   ok:false,reason:'timeout',exitCode:null})},timeoutMs);
  timer.unref?.();
 });
}
async function verifyStagedWorkspace({plan,candidate,filesystem=fs}){
 // A staging service must create a full pinned repository checkout without
 // credentials or symlinks. File comparisons alone cannot prove base provenance.
 const target=path.join(BASE,plan.taskId,'work');
 if(plan.workspace!==target)reject('workspace_path_invalid');
 const dir=await filesystem.lstat(target);
 if(!dir.isDirectory()||dir.isSymbolicLink()||
   await filesystem.realpath(target)!==target)reject('workspace_not_regular');
 for(const file of candidate.files){
  const pieces=file.path.split('/');
  if(pieces.some(p=>!p||p==='.'||p==='..'))reject('invalid_candidate_path');
  let parent=target;
  for(const piece of pieces.slice(0,-1)){
   parent=path.join(parent,piece);
   const info=await filesystem.lstat(parent);
   if(!info.isDirectory()||info.isSymbolicLink())reject('workspace_symlink');
  }
  const full=path.join(target,...pieces);
  const info=await filesystem.lstat(full);
  if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1)
   reject('workspace_file_not_regular');
  const actual=await filesystem.readFile(full);
  if(!Buffer.isBuffer(actual)||!actual.equals(Buffer.from(file.content,'utf8')))
   reject('staged_content_mismatch');
 }
 return true;
}
function createSandboxRunner({spawnProcess=spawn,filesystem=fs,stageWorkspace,
 imageApproved,hostReady,launchBinary=BIN}={}){
 if(typeof stageWorkspace!=='function'||typeof imageApproved!=='function'||
  typeof hostReady!=='function'||typeof spawnProcess!=='function'||
  launchBinary!==BIN)reject('trusted_runner_dependencies_missing');
 async function run({candidate,image,approvedImageDigest,expectedBaseSha}={}){
  // Host readiness must be asserted by a trusted out-of-process system;
  // never allow model-supplied attestation or a user parameter to bypass it.
  if(await hostReady()!==true)reject('dedicated_host_not_verified');
  if(await imageApproved({image,digest:approvedImageDigest})!==true)
   reject('image_approval_missing');
  const workspace=path.join(BASE,candidate?.taskId||'invalid','work');
  const plan=makeSandboxPlan({candidate,image,workspace,
   approvedImageDigest,expectedBaseSha});
  const receipt=await stageWorkspace({candidate,plan,workspace});
  if(!receipt||receipt.pinnedBaseSha!==plan.baseCommitSha||
    receipt.candidateDigest!==plan.candidateDigest||
    receipt.credentialFree!==true||receipt.noSymlinks!==true)
   reject('staging_unverified');
  await verifyStagedWorkspace({plan,candidate,filesystem});
  const records=[];
  for(let i=0;i<plan.checks.length;i++){
   const check=plan.checks[i];
   const name='pw-autofix-'+plan.taskId+'-'+i;
   // Omit --rm here: the supervisor must verify explicit container cleanup.
   const args=[...plan.containerOptions.slice(0,1),'--name',name,
    ...plan.containerOptions.slice(1).filter(flag=>flag!=='--rm'),
    ...check.command];
   const result=await execute(BIN,args,{timeoutMs:plan.timeoutMsPerCheck,
    maxOutputBytes:plan.maxOutputBytesPerCheck,spawnProcess});
   // Always attempt force removal to handle CLI termination while container
   // continues running; cleanup failure blocks success.
   const cleanup=await execute(BIN,['rm','-f',name],{
    timeoutMs:5000,maxOutputBytes:1024,spawnProcess});
   // Container was created without --rm so a successful explicit rm -f
   // is required. A failed cleanup always blocks completion.
   const passed=result.ok&&cleanup.ok;
   records.push(Object.freeze({id:check.id,ok:passed,
    reason:passed?'passed':!result.ok?result.reason:'cleanup_unverified',
    exitCode:result.exitCode,outputBytes:result.bytes}));
   if(!passed)break;
  }
  const checksPassed=records.length===plan.checks.length&&records.every(r=>r.ok);
  return Object.freeze({version:1,repository:plan.repository,
   taskId:plan.taskId,baseCommitSha:plan.baseCommitSha,
   candidateDigest:plan.candidateDigest,checksPassed,records,
   network:'disabled',secrets:'none',
   attestation:'not_issued',approvedForPublish:false});
 }
 return Object.freeze({run});
}
module.exports=Object.freeze({createSandboxRunner,verifyStagedWorkspace,execute});
