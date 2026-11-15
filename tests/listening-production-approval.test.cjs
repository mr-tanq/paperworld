'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createListeningProposalApi}=require('../server/listening-proposal-api.cjs');
const {validateChangeProposal}=require('../server/listening-change-proposal.cjs');
const {digestPlan}=require('../server/listening-write-approval.cjs');
const {createDurableApprovalStore}=require('../server/listening-approval-store.cjs');
const ownerId='22222222-2222-4222-8222-222222222222';
const threadId='33333333-3333-4333-8333-333333333333';
const jobId='11111111-1111-4111-8111-111111111111';
const sha='a'.repeat(40),secret='b'.repeat(64),grantId='44444444-4444-4444-8444-444444444444';
const job={id:jobId,project:'Listening Mirror',directorId:'listening-director',
 workerId:'listening-developer',approvedForProposal:true};
const proposal={jobId,repository:'mr-tanq/concerts',baseRef:'main',summary:'Improve artwork',
 edits:[{path:'js/concert-image-quality.js',expectedSha:sha,replacement:'const fixed=true;'}]};
const evidence={repository:'mr-tanq/concerts',ref:'main',readOnly:true,
 files:[{path:'js/concert-image-quality.js',sha,lines:'L1 const fixed=false;'}]};
const plan=validateChangeProposal({job,proposal,evidence}),digest=digestPlan(plan);
const auth={origin:'https://mr-tanq.github.io',authorization:'Bearer fake.jwt.token123456789'};
function setup({owned=true,write=true,stage='pending_review'}={}){
 const calls=[],issued=[],consumed=[];
 const guard={
  authenticate:async token=>{calls.push('auth');assert.ok(token.startsWith('fake.jwt'));return {ownerId}},
  ownsThread:async args=>{calls.push('thread');return owned&&args.ownerId===ownerId&&args.threadId===threadId}
 };
 const memory={
  list:async ()=>{calls.push('list');return [{jobId,status:stage,digest,plan,evidence}]},
  load:async ()=>{calls.push('load');return {jobId,status:stage,digest,plan,evidence}},
  reject:async()=>{calls.push('reject');return true},
  markDraftCreated:async ()=>{calls.push('tracked');return true}
 };
 const store={
  issue:async args=>{calls.push('issue');issued.push(args);return {id:grantId,secret}},
  consumeOnce:async args=>{calls.push('consume');consumed.push(args);return true}
 };
 const oauth={getLinkedWriteToken:()=>{calls.push('scope');return write?'gho_fakeWithPermission123456789':null}};
 const publisherFactory=({verifyAndConsumeApproval})=>({publish:async args=>{
  calls.push('publish');
  assert.equal(args.ownerId,ownerId);
  assert.equal(args.job.id,jobId);
  assert.equal(args.proposal.repository,'mr-tanq/concerts');
  const expected=validateChangeProposal({job:args.job,proposal:args.proposal,evidence:args.evidence});
  assert.equal(await verifyAndConsumeApproval({approval:args.approval,ownerId,
   jobId,repository:'mr-tanq/concerts',plan:expected}),true);
  return {url:'https://github.com/mr-tanq/concerts/pull/78',number:78,draft:true};
 }});
 return {api:createListeningProposalApi({guard,memory,store,oauth,publisherFactory}),calls,issued,consumed};
}
const req=(data,headers=auth,action='publish')=>({headers,action,body:JSON.stringify(data)});
const data={threadId,jobId,digest,confirm:'CREATE_LISTENING_DRAFT_PR'};
test('Requires correct origin, owner, thread and confirmation before issuance',async()=>{
 const x=setup({owned:false});
 assert.equal((await x.api.handle(req(data,{...auth,origin:'https://evil.example'}))).status,403);
 assert.equal((await x.api.handle(req(data,{origin:auth.origin}))).status,401);
 assert.equal((await x.api.handle(req({...data,confirm:'yes'}))).status,403);
 assert.equal((await x.api.handle(req(data))).status,404);
 assert.ok(!x.calls.includes('issue'));
});
test('Missing verified GitHub write scope never issues approval',async()=>{
 const x=setup({write:false});
 const result=await x.api.handle(req(data));
 assert.equal(result.status,403);
 assert.equal(result.body.error,'github_write_reconnect_required');
 assert.ok(!x.calls.includes('issue'));
});
test('Only exact stored digest and pending status can be published',async()=>{
 const x=setup();
 assert.equal((await x.api.handle(req({...data,digest:'c'.repeat(64)}))).status,404);
 assert.ok(!x.calls.includes('issue'));
 const y=setup({stage:'rejected'});
 assert.equal((await y.api.handle(req(data))).status,409);
 assert.ok(!y.calls.includes('issue'));
});
test('Confirmed proposal uses one-use grant bound to original immutable bytes',async()=>{
 const x=setup();
 const result=await x.api.handle(req(data));
 assert.deepEqual(result,{status:200,body:{created:true,
  url:'https://github.com/mr-tanq/concerts/pull/78',
  number:78,draft:true,merged:false,testsRun:false,tracked:true}});
 assert.deepEqual(x.issued,[{ownerId,jobId,digest}]);
 assert.equal(x.consumed.length,1);
 assert.equal(x.consumed[0].digest,digest);
 assert.equal(x.consumed[0].ownerId,ownerId);
 assert.notEqual(x.consumed[0].secretHash,secret);
 assert.ok(x.calls.indexOf('consume')>x.calls.indexOf('issue'));
 assert.ok(x.calls.includes('tracked'));
 assert.doesNotMatch(JSON.stringify(result),new RegExp(secret));
});
test('Owner-scoped listing and rejection stay entirely free of GitHub writes',async()=>{
 const x=setup();
 const list=await x.api.handle(req({threadId},auth,'list'));
 assert.equal(list.status,200);
 assert.equal(list.body.proposals[0].digest,digest);
 const rejection=await x.api.handle(req({threadId,jobId,digest},auth,'reject'));
 assert.equal(rejection.status,200);
 assert.equal(rejection.body.rejected,true);
 assert.ok(!x.calls.includes('issue'));
 assert.ok(!x.calls.includes('publish'));
});
test('Approval issuance is server-only, randomly minted and never returned via API',async()=>{
 const ops=[];
 const store=createDurableApprovalStore({secret:'sb_secret_MOCK_NO_REAL_ACCESS',
  fetcher:async(url,opts)=>{
   ops.push({url,opts});
   const row=JSON.parse(opts.body);
   return {ok:true,json:async()=>[{id:row.id}]};
  }});
 const result=await store.issue({ownerId,jobId,digest});
 assert.match(result.id,/^[a-f0-9-]{36}$/);
 assert.match(result.secret,/^[a-f0-9]{64}$/);
 assert.equal(ops.length,1);
 assert.equal(ops[0].opts.method,'POST');
 const body=JSON.parse(ops[0].opts.body);
 assert.equal(body.repository,'mr-tanq/concerts');
 assert.equal(body.plan_digest,digest);
 assert.notEqual(body.secret_hash,result.secret);
 assert.equal(body.secret_hash.length,64);
 assert.equal(new URL(ops[0].url).pathname,'/rest/v1/paperworld_write_approvals');
});
