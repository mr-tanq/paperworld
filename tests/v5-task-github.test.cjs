'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let makeTaskGithub,linkedIssue,markerFor;
const TOKEN='synthetic_github_token_for_tests_only';
const KEY='v1:mission:11111111-1111-4111-8111-111111111111';
const issue=(assignees=[])=>({number:7,state:'open',title:'Fixture',
 body:'Task '+markerFor(KEY),assignees:assignees.map(login=>({login})),
 html_url:'https://github.com/mr-tanq/concerts/issues/7'});
test.before(async()=>({makeTaskGithub,linkedIssue,markerFor}=
 await import('../supabase/functions/paperworld-task-dispatch/github.mjs')));
test('issue number matching cannot mistake #1 for #10 or #100',()=>{
 assert.equal(linkedIssue('Fixes #10',1),false);
 assert.equal(linkedIssue('Fixes #100',1),false);
 assert.equal(linkedIssue('Fixes mr-tanq/concerts#1',1),true);
 assert.equal(linkedIssue('Fixes #1',1),true);
});
test('one GitHub POST after durable effect; unknown reply never retries automatically',async()=>{
 let count=0;const requests=[];
 const fetcher=async(url,opts)=>{
  requests.push({url,opts});const u=new URL(url);
  if(u.pathname.endsWith('/issues/7'))return {ok:true,status:200,json:async()=>issue()};
  if(u.pathname.endsWith('/issues/7/assignees')){count++;return {ok:true,status:200,json:async()=>({assignees:[{login:'UnexpectedAgentAlias'}]})};}
  throw Error('unexpected '+url);
 };
 const gh=makeTaskGithub({token:TOKEN,fetcher});
 const r=await gh.assignCopilot('listening',{issueNumber:7,effectKey:KEY});
 assert.equal(r.state,'uncertain');assert.equal(count,1);
 assert.equal(requests.filter(x=>x.opts.method==='POST').length,1);
});
test('confirmed existing Copilot identity needs no new POST',async()=>{
 let posts=0;
 const fetcher=async(url,opts)=>{
  if(opts.method==='POST')posts++;
  return {ok:true,status:200,json:async()=>issue(['Copilot'])};
 };
 const gh=makeTaskGithub({token:TOKEN,fetcher});
 assert.equal((await gh.assignCopilot('listening',{issueNumber:7,effectKey:KEY})).state,'already_assigned');
 assert.equal(posts,0);
});
test('protected files denied before verification dispatch',async()=>{
 const fetcher=async()=>({ok:true,status:200,json:async()=>[
  {filename:'.github/workflows/paperworld-verify.yml',status:'modified'}]});
 const gh=makeTaskGithub({token:TOKEN,fetcher});
 await assert.rejects(gh.assertScopedChanges('pokemon',5,['tests/'],10),/file_policy_denied/);
});
test('untrusted run events and source SHAs can never verify',async()=>{
 const sha='a'.repeat(40),main='b'.repeat(40);
 for(const event of ['pull_request','workflow_dispatch']){
  const gh=makeTaskGithub({token:TOKEN,fetcher:async()=>({
   ok:true,status:200,json:async()=>({event,head_branch:'main',
     head_sha:event==='pull_request'?main:'c'.repeat(40),run_attempt:1,
     path:'.github/workflows/paperworld-verify.yml',status:'completed',conclusion:'success'})
  })});
  await assert.rejects(gh.getVerifiedRun('pokemon',{runId:77,headSha:sha,mainSha:main}));
 }
});
test('no unsafe repo, path, workflow or identity is accepted',async()=>{
 const gh=makeTaskGithub({token:TOKEN,fetcher:async()=>{throw Error('network should be unreachable')}});
 await assert.rejects(gh.getIssue('wellbeing',1,KEY));
 await assert.rejects(gh.dispatchVerify('pokemon',{missionId:'bad',headSha:'a'.repeat(40),requiredTests:['smoke']}));
 await assert.rejects(gh.dispatchVerify('pokemon',{missionId:'11111111-1111-4111-8111-111111111111',headSha:'a'.repeat(40),requiredTests:['smoke'],workflow:'evil.yml'}));
});
