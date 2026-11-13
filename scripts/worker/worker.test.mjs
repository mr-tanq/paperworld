import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const runner=resolve(fileURLToPath(new URL('./worker.mjs',import.meta.url)));
function execute(cmd,args,cwd){
 const result=spawnSync(cmd,args,{cwd,encoding:'utf8'});
 return {status:result.status,stdout:result.stdout,stderr:result.stderr};
}
async function fixture(){
 const cwd=await mkdtemp(join(tmpdir(),'paperworld-worker-'));
 const target=join(cwd,'target');
 await mkdir(join(target,'js'),{recursive:true});
 assert.equal(execute('git',['init','-q'],target).status,0);
 await writeFile(join(target,'js','concert-ticketswap.js'),'// baseline\n');
 assert.equal(execute('git',['add','js/concert-ticketswap.js'],target).status,0);
 assert.equal(execute('git',['-c','user.email=test@example.invalid','-c','user.name=Worker Test','commit','-qm','baseline'],target).status,0);
 return {cwd,target};
}
test('Worker prepares a narrowly scoped mission without network or inference',async()=>{
 const {cwd}=await fixture();
 try{
  const result=execute(process.execPath,[runner,'ticketswap-diagnostics','prepare'],cwd);
  assert.equal(result.status,0,result.stderr);
  const scope=JSON.parse(await readFile(join(cwd,'worker-output','scope.json'),'utf8'));
  assert.equal(scope.repository,'mr-tanq/concerts');
  assert.equal(scope.mode,'review-only');
  assert.equal(scope.remoteWrites,false);
  const prompt=await readFile(join(cwd,'worker-output','prompt.txt'),'utf8');
  assert.match(prompt,/No authorization to commit|no authorization to commit/i);
 }finally{await rm(cwd,{recursive:true,force:true})}
});
test('Worker captures an allowed change as an offline patch, never commits',async()=>{
 const {cwd,target}=await fixture();
 try{
  await writeFile(join(target,'js/concert-ticketswap.js'),'// improved\n');
  const result=execute(process.execPath,[runner,'ticketswap-diagnostics','collect'],cwd);
  assert.equal(result.status,0,result.stderr);
  const audit=JSON.parse(await readFile(join(cwd,'worker-output','audit.json'),'utf8'));
  assert.deepEqual(audit.changedPaths,['js/concert-ticketswap.js']);
  assert.equal(audit.pushPerformed,false);
  const patch=await readFile(join(cwd,'worker-output','worker.patch'),'utf8');
  assert.match(patch,/\+\/\/ improved/);
  assert.equal(execute('git',['log','-1','--format=%s'],target).stdout.trim(),'baseline');
 }finally{await rm(cwd,{recursive:true,force:true})}
});
test('Worker refuses unexpected paths and does not publish an unsafe patch',async()=>{
 const {cwd,target}=await fixture();
 try{
  await writeFile(join(target,'forbidden.txt'),'unexpected modification');
  const result=execute(process.execPath,[runner,'ticketswap-diagnostics','collect'],cwd);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/forbidden path/);
 }finally{await rm(cwd,{recursive:true,force:true})}
});
test('Unknown missions fail closed',async()=>{
 const {cwd}=await fixture();
 try{assert.notEqual(execute(process.execPath,[runner,'unapproved','prepare'],cwd).status,0)}
 finally{await rm(cwd,{recursive:true,force:true})}
});
