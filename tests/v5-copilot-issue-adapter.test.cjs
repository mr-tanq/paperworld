'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCopilotIssueAdapter,allowedRepo,validateIntent}=require('../server/v5-copilot-issue-adapter.cjs');
const issueNumber=1,projectId='pokemon',effectKey='mission:step:pilot1';
const token='github_test_user_token_never_real';
const marker='<!-- paperworld-v5-effect:'+effectKey+' -->';
const receipt={state:'reserved',adapter:'copilot_agent',kind:'start_agent',
 verifiedBudget:true,allowedByDatabase:true,sessions:1,effectKey,
 stepId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',issueNumber,projectId};
function fixture({assigned=false,onAssign=()=>{}}={}){
 let issueBody='Synthetic instruction',assignees=assigned?['Copilot']:[];
 const requests=[];
 const fetcher=async(url,opts)=>{
  requests.push({url,method:opts.method||'GET',body:opts.body});
  const path=new URL(url).pathname;
  if(path.endsWith('/issues/1')&&opts.method==='PATCH'){
   issueBody=JSON.parse(opts.body).body;return {ok:true,json:async()=>({number:1})};
  }
  if(path.endsWith('/issues/1/assignees')){
   const assignedResponse=onAssign();
   if(assignedResponse==='timeout')throw Error('timeout after GitHub may have accepted');
   assignees=['Copilot'];
   return {ok:true,json:async()=>({assignees:assignees.map(login=>({login}))})};
  }
  if(path.endsWith('/issues/1'))return {ok:true,json:async()=>({
   number:1,state:'open',title:'Pilot',body:issueBody,
   assignees:assignees.map(login=>({login}))})};
  if(path.endsWith('/pulls'))return {ok:true,json:async()=>[]};
  throw Error('unexpected '+url);
 };
 return {adapter:createCopilotIssueAdapter({fetcher,token}),requests,
  assigned:()=>assignees.includes('Copilot')};
}
test('Explicit repo allowlist excludes Crow, Dave, arbitrary repo and private owner swaps',()=>{
 assert.equal(allowedRepo('pokemon'),'mr-tanq/pokemon-echoes');
 assert.equal(allowedRepo('listening'),'mr-tanq/concerts');
 for(const x of ['studio','wellbeing','paperworld','__proto__'])
  assert.throws(()=>allowedRepo(x),/unsupported_project_adapter/);
});
test('Must have DB reserved effect, session budget and a matching exact existing issue marker',async()=>{
 const f=fixture();
 for(const alteration of [{},{verifiedBudget:false},{allowedByDatabase:false},
  {sessions:0},{stepId:'bad'},{issueNumber:2},{state:'started'}]){
  const forged={...receipt,...alteration};
  if(!Object.keys(alteration).length)continue;
  await assert.rejects(f.adapter.assign({projectId,issueNumber,
   effectReceipt:forged}));
 }
 await assert.rejects(f.adapter.assign({projectId,issueNumber,effectReceipt:receipt}),
  /issue_effect_marker_mismatch/);
 assert.equal(f.requests.filter(r=>r.method==='POST').length,0);
});
test('Prepare existing issue once; an AI assignment uses one POST only',async()=>{
 const f=fixture();
 const prepared=await f.adapter.prepareIssue({projectId,issueNumber,effectKey});
 assert.equal(prepared.state,'prepared');
 assert.equal((await f.adapter.prepareIssue({projectId,issueNumber,effectKey})).state,'prepared');
 const result=await f.adapter.assign({projectId,issueNumber,effectReceipt:receipt});
 assert.equal(result.state,'assigned');
 assert.equal(f.requests.filter(x=>x.method==='PATCH').length,1);
 const posts=f.requests.filter(x=>x.method==='POST');
 assert.equal(posts.length,1);
 assert.equal(JSON.parse(posts[0].body).assignees[0],'copilot-swe-agent[bot]');
 assert.equal(JSON.parse(posts[0].body).agent_assignment.target_repo,'mr-tanq/pokemon-echoes');
 assert.equal((await f.adapter.reconcile({projectId,issueNumber,effectKey})).state,'assigned');
 // No second session is started when already assigned.
 assert.equal((await f.adapter.assign({projectId,issueNumber,effectReceipt:receipt})).state,'already_assigned');
 assert.equal(f.requests.filter(x=>x.method==='POST').length,1);
});
test('Uncertain POST response never retries paid assignment',async()=>{
 const f=fixture({onAssign:()=> 'timeout'});
 await f.adapter.prepareIssue({projectId,issueNumber,effectKey});
 assert.equal((await f.adapter.assign({projectId,issueNumber,effectReceipt:receipt})).state,'uncertain');
 assert.equal(f.requests.filter(x=>x.method==='POST').length,1);
 const status=await f.adapter.reconcile({projectId,issueNumber,effectKey});
 assert.equal(status.state,'uncertain');
 assert.equal(status.reason,'unassigned_not_proof_of_no_session');
 assert.equal(f.requests.filter(x=>x.method==='POST').length,1);
});
test('Refuse another mission effect marker on existing issue',async()=>{
 const f=fixture();
 await f.adapter.prepareIssue({projectId,issueNumber,effectKey});
 await assert.rejects(f.adapter.prepareIssue({
  projectId,issueNumber,effectKey:'another-mission-key'}),/issue_already_reserved/);
 assert.equal(f.requests.filter(x=>x.method==='POST').length,0);
});
