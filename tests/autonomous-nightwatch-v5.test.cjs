'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {MISSIONS,summarizeTests,githubApi,getPublicCommit,reportText,
 execute}=require('../scripts/autonomous-nightwatch-v5.cjs');
function mockGithub(){
 const issues=[],comments=new Map(),calls=[];
 const api=async(path,{method='GET',body}={})=>{
  calls.push({path,method,body});
  if(path.endsWith('/issues?state=open&per_page=100'))return issues;
  if(path.endsWith('/issues')&&method==='POST'){
   const item={number:issues.length+1,title:body.title,body:body.body,comments:0};
   issues.push(item);comments.set(item.number,[]);return item;
  }
  const commentRequest=/\/issues\/(\d+)\/comments\?per_page=100&page=\d+$/.exec(path);
  if(commentRequest)return comments.get(Number(commentRequest[1]))||[];
  const posting=/\/issues\/(\d+)\/comments$/.exec(path);
  if(posting&&method==='POST'){
   const id=Number(posting[1]),value={body:body.body};
   comments.get(id).push(value);
   issues.find(x=>x.number===id).comments++;
   return value;
  }
  throw Error('unexpected mocked GitHub API');
 };
 return {api,calls,issues,comments};
}
const commit=(repo,hash)=>({repository:'mr-tanq/'+repo,sha:hash.repeat(40)});
function checks(sha='a',passing=true){
 return {
  paperworld:async()=>({commit:commit('paperworld',sha),
   testing:{ok:passing,tests:484,failures:passing?0:1,
    reason:passing?'tests_passed':'tests_failed_or_interrupted'}}),
  concerts:async()=>({commit:commit('concerts',sha)})
 };
}
test('Unattended queue creates two public-source issues and reports without AI, private data or writes',async()=>{
 const state=mockGithub();
 const result=await execute({api:state.api,checks:checks()});
 assert.deepEqual(result.map(x=>x.status),['reported','reported']);
 assert.equal(state.issues.length,2);
 assert.equal(state.comments.get(1).length,1);
 assert.equal(state.comments.get(2).length,1);
 assert.ok(state.calls.every(x=>x.path.startsWith('/repos/mr-tanq/paperworld/')));
 assert.ok(state.calls.every(x=>!['PUT','PATCH','DELETE'].includes(x.method)));
 const issueBody=state.issues[0].body;
 assert.match(issueBody,/no AI/i);
 assert.match(issueBody,/private Pokémon/);
 assert.doesNotMatch(issueBody,/token|secret value|authorization:/i);
});
test('Same audit runs forever without duplicate comments or repeated side effects',async()=>{
 const state=mockGithub();
 await execute({api:state.api,checks:checks()});
 const again=await execute({api:state.api,checks:checks()});
 assert.deepEqual(again.map(x=>x.status),['unchanged','unchanged']);
 assert.equal(state.issues.length,2);
 assert.equal(state.comments.get(1).length,1);
 assert.equal(state.comments.get(2).length,1);
});
test('When tests fail or public commit changes the exact Director report is updated',async()=>{
 const state=mockGithub();
 await execute({api:state.api,checks:checks()});
 const failed=await execute({api:state.api,checks:checks('a',false)});
 assert.equal(failed[0].status,'failed_tests');
 assert.equal(failed[1].status,'unchanged');
 assert.equal(state.comments.get(1).length,2);
 const changed=await execute({api:state.api,checks:checks('b')});
 assert.equal(changed[0].status,'reported');
 assert.equal(changed[1].status,'reported');
 assert.equal(state.comments.get(2).length,2);
});
test('One Director failure does not block the other Director',async()=>{
 const state=mockGithub();
 const checksWithFault={...checks(),paperworld:async()=>{throw Error('simulated failure')}};
 const result=await execute({api:state.api,checks:checksWithFault});
 assert.deepEqual(result.map(x=>x.status),['monitor_unavailable','reported']);
 assert.equal(state.issues.length,1);
 assert.match(state.issues[0].title,/Listening Mirror/);
});
test('Test results require an actual successful Node test suite and no failures',()=>{
 assert.deepEqual(summarizeTests({status:0,stdout:'# tests 40\n# fail 0'}),{
  ok:true,tests:40,failures:0,reason:'tests_passed'
 });
 assert.equal(summarizeTests({status:1,stdout:'# tests 40\n# fail 1'}).ok,false);
 assert.equal(summarizeTests({status:null,signal:'SIGTERM'}).ok,false);
});
test('Typed fixed repository allowlist prevents private project or arbitrary GitHub URLs',async()=>{
 await assert.rejects(()=>getPublicCommit('pokemon-echoes',async()=>{}),
  /private_or_unknown_repository/);
 const api=githubApi('ghs_synthetic_testing_tokenxxxx',async()=>{throw Error('do not call')});
 await assert.rejects(()=>api('/repos/mr-tanq/pokemon-echoes/commits/main'),
  /github_api_path_rejected/);
 await assert.rejects(()=>api('/repos/another-user/paperworld/commits/main'),
  /github_api_path_rejected/);
 await assert.rejects(()=>api('https://evil.example'),
  /github_api_path_rejected/);
 assert.equal(MISSIONS.length,2);
 const data=reportText(MISSIONS[0],commit('paperworld','b'),
  {ok:false,tests:12,failures:2,reason:'tests_failed_or_interrupted'});
 assert.match(data.body,/needs attention/);
 assert.doesNotMatch(data.body,/change the source automatically/i);
});
test('Workflow runs without user presence, paid runner, AI credentials or source write rights',()=>{
 const workflow=fs.readFileSync('.github/workflows/paperworld-v5-unattended.yml','utf8');
 assert.match(workflow,/schedule:/);
 assert.match(workflow,/cron: '17 \*\/6 \* \* \*'/);
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/runs-on: ubuntu-latest/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/issues: write/);
 assert.match(workflow,/PAPERWORLD_AUTONOMY_DISABLE_AI: '1'/);
 assert.doesNotMatch(workflow,/COPILOT_GITHUB_TOKEN|supabase_service|pull-requests: write/);
});
