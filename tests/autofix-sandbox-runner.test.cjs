'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const path=require('node:path');
const {createSandboxRunner,execute,verifyStagedWorkspace}=
 require('../server/autofix-sandbox-runner.cjs');
const {prepareCandidate}=require('../server/autofix-candidate-policy.cjs');
const {digest}=require('../server/autofix-github-draft-publisher.cjs');
const taskId='11111111-1111-4111-8111-111111111111';
const base='a'.repeat(40),sha='b'.repeat(40);
const image='node:22-alpine@sha256:'+'c'.repeat(64);
const original="import {check} from './helper.js';\nexport const healthy=()=>true;\n";
const updated="import {check} from './helper.js';\nexport const healthy=()=>false;\n";
const regression="import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('TicketSwap regression',()=>assert.equal(2,2));\n";
const candidate=()=>prepareCandidate({repository:'mr-tanq/concerts',taskId,
 baseCommitSha:base,trustedSources:{'js/ticketswap-check.js':{sha,content:original}},
 proposedFiles:[{path:'js/ticketswap-check.js',content:updated},
  {path:'tests/autofix/ticketswap-regression.test.mjs',content:regression}]});
const workspace='/var/lib/paperworld-autofix/jobs/'+taskId+'/work';
function mockFilesystem(c,{mismatch=false,symlink=false}={}){
 const files=new Map(c.files.map(f=>[path.join(workspace,f.path),f.content]));
 return {
  realpath:async name=>name,
  lstat:async name=>{
   const isFile=files.has(name),isSymlink=symlink&&isFile;
   if(name!==workspace&&!isFile&&![...files.keys()].some(f=>f.startsWith(name+'/')))
    throw Error('unknown path');
   return {isDirectory:()=>!isFile,isFile:()=>isFile,
    isSymbolicLink:()=>isSymlink,nlink:1};
  },
  readFile:async name=>Buffer.from(mismatch&&name.endsWith('ticketswap-check.js')?
   'malicious change':files.get(name))
 };
}
function fakeSpawn(calls,{badCheck=false,badCleanup=false,largeOutput=false}={}){
 return (binary,args,opts)=>{
  calls.push({binary,args,opts});
  const child=new EventEmitter();
  child.stdout=new EventEmitter();child.stderr=new EventEmitter();
  child.kill=()=>{process.nextTick(()=>child.emit('close',null,'SIGKILL'));return true};
  process.nextTick(()=>{
   if(largeOutput&&args[0]==='run')child.stdout.emit('data',Buffer.alloc(17000,65));
   const isCleanup=args[0]==='rm';
   child.emit('close',isCleanup?(badCleanup?1:0):(badCheck?1:0),null);
  });
  return child;
 };
}
function harness({authorized=true,badCheck=false,badCleanup=false,badStage=false,
 badImage=false,badHost=false,largeOutput=false,mismatch=false,symlink=false}={}){
 const c=candidate(),calls=[],stats={staged:0};
 const runner=createSandboxRunner({
  launchBinary:'/usr/bin/docker',
  spawnProcess:fakeSpawn(calls,{badCheck,badCleanup,largeOutput}),
  filesystem:mockFilesystem(c,{mismatch,symlink}),
  imageApproved:async()=>!badImage,
  hostReady:async()=>!badHost,
  stageWorkspace:async()=>{stats.staged++;
   return {pinnedBaseSha:base,candidateDigest:digest(c),
    credentialFree:!badStage,noSymlinks:true}}
 });
 return {runner,calls,stats,input:{candidate:c,image,
   approvedImageDigest:'c'.repeat(64),expectedBaseSha:base}};
}
test('Runner issues only fixed docker run and cleanup commands with no shell',async()=>{
 const h=harness();const report=await h.runner.run(h.input);
 assert.equal(report.checksPassed,true);
 assert.equal(report.approvedForPublish,false);
 assert.equal(report.attestation,'not_issued');
 assert.equal(report.records.length,2);
 assert.deepEqual(h.calls.map(x=>x.args[0]),['run','rm','run','rm']);
 for(const call of h.calls){
  assert.equal(call.binary,'/usr/bin/docker');
  assert.equal(call.opts.shell,false);
  assert.deepEqual(call.opts.env,{PATH:'/usr/bin:/bin'});
  if(call.args[0]==='run'){
   assert.ok(call.args.includes('--network=none'));
   assert.ok(call.args.includes('--read-only'));
   assert.ok(call.args.includes('--cap-drop=ALL'));
   assert.ok(call.args.includes('--pull=never'));
   assert.ok(!call.args.includes('--rm'));
   assert.ok(call.args.includes('--security-opt=no-new-privileges'));
   assert.equal(call.args.includes('sh'),false);
  }else assert.deepEqual(call.args.slice(0,2),['rm','-f']);
 }
});
test('Fail closed if host, image or staging are unverified before running commands',async()=>{
 for(const opts of [{badHost:true},{badImage:true},{badStage:true},
  {mismatch:true},{symlink:true}]){
  const h=harness(opts);
  await assert.rejects(h.runner.run(h.input));
  assert.equal(h.calls.length,0);
 }
});
test('Nonzero test exit, unverified cleanup or oversized output blocks completion',async()=>{
 for(const opts of [{badCheck:true},{badCleanup:true},{largeOutput:true}]){
  const h=harness(opts);
  const report=await h.runner.run(h.input);
  assert.equal(report.checksPassed,false);
  assert.equal(report.records.length,1);
  assert.equal(report.approvedForPublish,false);
  assert.equal(h.calls.filter(x=>x.args[0]==='run').length,1);
  assert.equal(h.calls.filter(x=>x.args[0]==='rm').length,1);
 }
});
test('Runner has no privileged default adapters or production side effects',()=>{
 assert.throws(()=>createSandboxRunner(),/trusted_runner_dependencies_missing/);
 assert.throws(()=>createSandboxRunner({stageWorkspace:()=>{},imageApproved:()=>true,
  hostReady:()=>true,launchBinary:'/bin/sh'}),/trusted_runner_dependencies_missing/);
});
test('Executor startup error returns bounded diagnostic, not runtime exception text',async()=>{
 const result=await execute('/usr/bin/docker',['run','--network=none'],{
  spawnProcess:()=>{throw Error('SECRET_HOST_PATH_AND_TOKEN')},
  timeoutMs:100,maxOutputBytes:1000
 });
 assert.equal(result.ok,false);
 assert.equal(result.reason,'spawn_failed');
 assert.doesNotMatch(JSON.stringify(result),/SECRET_HOST_PATH/);
});
