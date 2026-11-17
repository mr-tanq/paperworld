'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCopilotIssueAdapter}=require('../server/v5-copilot-issue-adapter.cjs');
const token='synthetic_token_for_ci_only_long_enough';
const SHA='a'.repeat(40),PR=17,RUN=1234;
const repo='mr-tanq/pokemon-echoes';
function fixture({good=true,bot=true,caseStep=true,shaMatches=true,draft=true}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push(url);
  const u=new URL(url);
  const endpoint=u.pathname;
  if(endpoint.endsWith('/issues/1'))return {ok:true,json:async()=>({number:1,state:'open',body:'Synthetic task <!-- paperworld-v5-effect:copilot:11111111-1111-4111-8111-111111111111 -->',assignees:[{login:'Copilot'}]})};
  if(endpoint.endsWith('/pulls/'+PR))
   return {ok:true,json:async()=>({number:PR,state:'open',draft,
    head:{sha:SHA,ref:'copilot/five-battle-tests'},base:{ref:'main'},
    user:{login:bot?'copilot-swe-agent[bot]':'random-user'},
    body:'Fixes #1'})};
  if(endpoint.endsWith('/actions/workflows/paperworld-verify.yml/runs'))
   return {ok:true,json:async()=>({workflow_runs:[{
    id:RUN,event:'pull_request',status:'completed',
    conclusion:good?'success':'failure',
    head_sha:shaMatches?SHA:'b'.repeat(40),
    path:'.github/workflows/paperworld-verify.yml',
    html_url:'https://github.com/'+repo+'/actions/runs/'+RUN,
    pull_requests:[{number:PR}]
   }]})};
  if(endpoint.endsWith('/actions/runs/'+RUN+'/jobs'))
   return {ok:true,json:async()=>({jobs:[{name:'headless-godot',
    conclusion:'success',steps:[
    {name:'Run headless smoke test (must exit 0)',
     status:'completed',conclusion:'success'},
    {name:'Require five deterministic battle-damage regression cases',
     status:caseStep?'completed':'skipped',
     conclusion:caseStep?'success':'skipped'}
   ]}]})};
  throw Error('unexpected URL '+url);
 };
 return {adapter:createCopilotIssueAdapter({fetcher,token}),calls};
}
test('verified requires exact source SHA, bot, draft and successful five-case CI',async()=>{
 const f=fixture();const p=await f.adapter.verifyIndependentGodot({
  projectId:'pokemon',prNumber:PR,issueNumber:1});
 assert.deepEqual(p,{state:'verified',projectId:'pokemon',prNumber:PR,
  headSha:SHA,runId:RUN,runUrl:'https://github.com/'+repo+'/actions/runs/'+RUN});
 assert.ok(f.calls.some(x=>x.includes('head_sha='+SHA)));
});
test('PR creation, green smoke alone, wrong author and stale SHA never verify',async()=>{
 for(const setting of [{good:false},{bot:false},{caseStep:false},
  {shaMatches:false},{draft:false}]){
  const f=fixture(setting);
  const p=await f.adapter.verifyIndependentGodot({
   projectId:'pokemon',prNumber:PR,issueNumber:1});
  assert.notEqual(p.state,'verified',JSON.stringify(setting));
 }
});
test('Dave, Crow and wrong Issue cannot use the verifier',async()=>{
 const f=fixture();
 for(const x of [
  {projectId:'wellbeing',prNumber:PR,issueNumber:1},
  {projectId:'studio',prNumber:PR,issueNumber:1},
  {projectId:'pokemon',prNumber:PR,issueNumber:2}
 ])await assert.rejects(f.adapter.verifyIndependentGodot(x));
 assert.equal(f.calls.length,0);
});
