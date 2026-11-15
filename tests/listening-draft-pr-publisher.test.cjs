'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createDraftPrPublisher}=require('../server/listening-draft-pr-publisher.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const jobId='22222222-2222-4222-8222-222222222222';
const expectedSha='a'.repeat(40),baseSha='b'.repeat(40);
const token='gho_TEST_TOKEN_NOT_REAL_123456789';
const job={id:jobId,project:'Listening Mirror',directorId:'listening-director',
 workerId:'listening-developer',approvedForProposal:true};
const filename='js/concert-image-quality.js';
const evidence={repository:'mr-tanq/concerts',ref:'main',readOnly:true,
 files:[{path:filename,sha:expectedSha,lines:'L1 current content'}]};
const proposal={jobId,repository:'mr-tanq/concerts',baseRef:'main',summary:'Repair artwork',
 edits:[{path:filename,expectedSha,replacement:'export const valid = true;'}]};
function harness({allow=true,stale=false,errorAt=null}={}){
 const calls=[],approved=[];
 const fetcher=async(url,opts)=>{
  const pathname=new URL(url).pathname;
  calls.push({url,method:opts.method,body:opts.body?JSON.parse(opts.body):null});
  assert.equal(new URL(url).hostname,'api.github.com');
  assert.ok(pathname.startsWith('/repos/mr-tanq/concerts/'));
  if(errorAt&&pathname.endsWith(errorAt))return {ok:false,status:403};
  let body={};
  if(pathname.endsWith('/git/ref/heads/main'))body={object:{sha:baseSha}};
  if(pathname.includes('/contents/')){
   body=opts.method==='GET'?{type:'file',sha:stale?'c'.repeat(40):expectedSha}:{content:{sha:'d'.repeat(40)}};
  }
  if(pathname.endsWith('/pulls'))body={number:77,
   html_url:'https://github.com/mr-tanq/concerts/pull/77'};
  return {ok:true,status:200,json:async()=>body};
 };
 const publisher=createDraftPrPublisher({fetcher,
  verifyAndConsumeApproval:async grant=>{approved.push(grant);return allow}});
 return {publisher,calls,approved};
}
const args={job,proposal,evidence,approval:{oneTimeGrant:'mock'},
 ownerId:owner,githubToken:token};
test('Never accesses GitHub without a trusted, consumed one-use approval',async()=>{
 const h=harness({allow:false});
 await assert.rejects(h.publisher.publish(args),/explicit_write_approval_required/);
 assert.equal(h.calls.length,0);
 assert.equal(h.approved.length,1);
});
test('An approved immutable proposal creates a branch, edits exact SHAs and only DRAFT PR',async()=>{
 const h=harness(),result=await h.publisher.publish(args);
 assert.equal(result.draft,true);
 assert.equal(result.testsRun,false);
 assert.equal(result.url,'https://github.com/mr-tanq/concerts/pull/77');
 assert.deepEqual(h.calls.map(x=>x.method),['GET','GET','POST','PUT','POST']);
 assert.match(h.calls[2].body.ref,/^refs\/heads\/paperworld\/review-/);
 assert.equal(h.calls[2].body.sha,baseSha);
 assert.equal(h.calls[3].body.sha,expectedSha);
 assert.equal(h.calls[3].body.branch,'paperworld/review-'+jobId.slice(0,8));
 assert.equal(h.calls[4].body.draft,true);
 assert.equal(h.calls[4].body.base,'main');
 assert.ok(!h.calls.some(x=>/merge|deploy/.test(x.url)));
 assert.ok(h.calls.every(x=>!x.url.includes(token)));
});
test('A source SHA mismatch refuses a branch or any edits',async()=>{
 const h=harness({stale:true});
 await assert.rejects(h.publisher.publish(args),/stale_source_revision/);
 assert.deepEqual(h.calls.map(x=>x.method),['GET','GET']);
});
test('Wrong project, wrong repo, or missing credentials fail without GitHub calls',async()=>{
 const h=harness();
 await assert.rejects(h.publisher.publish({...args,githubToken:'bad'}));
 await assert.rejects(h.publisher.publish({...args,job:{...job,workerId:'other'}}));
 await assert.rejects(h.publisher.publish({...args,proposal:{...proposal,repository:'other/repo'}}));
 assert.equal(h.calls.length,0);
});
test('Provider errors are fail-closed; no fake success response',async()=>{
 const h=harness({errorAt:'/git/refs'});
 await assert.rejects(h.publisher.publish(args),/github_draft_operation_failed/);
 assert.ok(!h.calls.some(x=>x.url.endsWith('/pulls')));
});
test('Publisher is not wired to any HTTP route or user-facing UI',()=>{
 const fs=require('node:fs');
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 const browser=fs.readFileSync('js/cloud.js','utf8');
 assert.doesNotMatch(server,/listening-draft-pr-publisher|\/draft\/publish/);
 assert.doesNotMatch(browser,/\/draft\/publish/);
});
