'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createProposalMemory}=require('../server/listening-proposal-memory.cjs');
const id='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
const thread='33333333-3333-4333-8333-333333333333',sha='a'.repeat(40);
const plan={kind:'paperworld-listening-change-proposal-v1',jobId:id,
 repository:'mr-tanq/concerts',baseRef:'main',summary:'Fix artwork',
 edits:[{path:'js/concert-image-quality.js',expectedSha:sha,
 replacement:'export const image = true;'}],
 execution:'none',approvalRequired:true,canWrite:false,canDeploy:false};
const evidence={repository:'mr-tanq/concerts',ref:'main',readOnly:true,
 files:[{path:'js/concert-image-quality.js',sha,lines:'L1 export const image = false;'}]};
const args={ownerId:owner,threadId:thread,jobId:id,reviewProposal:{plan,evidence}};
const crypto=require('node:crypto');
const digest=crypto.createHash('sha256').update(JSON.stringify({version:1,jobId:id,
 repository:plan.repository,baseRef:'main',summary:plan.summary,
 edits:plan.edits.map(e=>({path:e.path,expectedSha:e.expectedSha,replacement:e.replacement}))})).digest('hex');
const row=(status='pending_review')=>({job_id:id,owner_id:owner,thread_id:thread,
 status,digest,plan,evidence,created_at:'2026-11-15T00:00:00Z',
 updated_at:'2026-11-15T00:00:00Z'});
const secret='sb_secret_TEST_NOT_REAL';
function mock(run){
 const calls=[];
 return {calls,memory:createProposalMemory({secret,fetcher:async(url,opts)=>{
  calls.push({url,opts});
  return {ok:true,json:async()=>run(url,opts)};
 }})};
}
test('Saves only a validated, immutable exact job proposal using insert-ignore',async()=>{
 const x=mock(()=>[row()]),out=await x.memory.save(args);
 assert.equal(out.persisted,true);
 assert.equal(out.duplicate,false);
 assert.equal(out.digest,digest);
 assert.equal(x.calls.length,1);
 const {url,opts}=x.calls[0];
 assert.equal(opts.method,'POST');
 assert.equal(new URL(url).pathname,'/rest/v1/paperworld_worker_proposals');
 assert.equal(new URL(url).searchParams.get('on_conflict'),'job_id');
 assert.match(opts.headers.Prefer,/resolution=ignore-duplicates/);
 assert.equal(opts.headers.apikey,secret);
 const payload=JSON.parse(opts.body);
 assert.equal(payload.owner_id,owner);
 assert.equal(payload.thread_id,thread);
 assert.equal(payload.job_id,id);
 assert.equal(payload.status,'pending_review');
 assert.equal(payload.digest,digest);
 assert.equal(payload.plan.canWrite,false);
});
test('Duplicate job ID never updates the AI proposal',async()=>{
 const x=mock(()=>[]);
 const saved=await x.memory.save(args);
 assert.deepEqual(saved,{persisted:false,duplicate:true,jobId:id});
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0].opts.method,'POST');
});
test('Read and list are scoped simultaneously to owner AND thread',async()=>{
 const x=mock(()=>[row()]);
 const item=await x.memory.load({ownerId:owner,threadId:thread,jobId:id});
 assert.equal(item.plan.edits[0].replacement,plan.edits[0].replacement);
 const list=await x.memory.list({ownerId:owner,threadId:thread});
 assert.equal(list.length,1);
 for(const call of x.calls){
  const params=new URL(call.url).searchParams;
  assert.equal(params.get('owner_id'),'eq.'+owner);
  assert.equal(params.get('thread_id'),'eq.'+thread);
  assert.equal(call.opts.method,'GET');
 }
});
test('Rejects forged owner, changed digest, or wrong proposal state',async()=>{
 const x=mock(()=>[{...row(),owner_id:'44444444-4444-4444-8444-444444444444'}]);
 await assert.rejects(x.memory.load({ownerId:owner,threadId:thread,jobId:id}));
 const y=mock(()=>[{...row(),digest:'b'.repeat(64)}]);
 await assert.rejects(y.memory.load({ownerId:owner,threadId:thread,jobId:id}),/digest/);
 const z=mock(()=>[{...row(),status:'approved'}]);
 await assert.rejects(z.memory.list({ownerId:owner,threadId:thread}));
});
test('Reject is an exact conditional pending-to-rejected transition',async()=>{
 const x=mock(()=>[row('rejected')]);
 assert.equal(await x.memory.reject({ownerId:owner,threadId:thread,jobId:id,digest}),true);
 const call=x.calls[0],params=new URL(call.url).searchParams;
 assert.equal(call.opts.method,'PATCH');
 assert.equal(params.get('owner_id'),'eq.'+owner);
 assert.equal(params.get('thread_id'),'eq.'+thread);
 assert.equal(params.get('status'),'eq.pending_review');
 assert.equal(params.get('digest'),'eq.'+digest);
 assert.deepEqual(JSON.parse(call.opts.body),{status:'rejected'});
 const noMatch=mock(()=>[]);
 assert.equal(await noMatch.memory.reject({ownerId:owner,threadId:thread,jobId:id,digest}),false);
});
test('Missing backend secret, unverified input, and network failures fail closed',async()=>{
 assert.throws(()=>createProposalMemory({secret:''}));
 const x=mock(()=>[row()]);
 await assert.rejects(x.memory.save({...args,reviewProposal:{...args.reviewProposal,
  plan:{...plan,repository:'attacker/repo'}}}));
 await assert.rejects(x.memory.save({...args,ownerId:'bad'}));
 assert.equal(x.calls.length,0);
 const dead=createProposalMemory({secret,fetcher:async()=>({ok:false})});
 await assert.rejects(dead.save(args),/storage_unavailable/);
});
test('Integration stays optional and disabled on Render; no write/grant path',()=>{
 const worker=fs.readFileSync('server/matt-worker-delegation.cjs','utf8');
 const gateway=fs.readFileSync('server/render-matt.cjs','utf8');
 assert.match(worker,/proposalMemory=null/);
 assert.match(worker,/if\(reviewProposal&&proposalMemory\)/);
 assert.match(worker,/proposalPersisted=stored\?\.persisted===true/);
 assert.doesNotMatch(gateway,/listening-proposal-memory|\/proposals\/approve|\/draft\/publish/);
});
