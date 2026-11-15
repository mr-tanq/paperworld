'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makePublisher,digest}=require('../server/autofix-github-draft-publisher.cjs');
const {prepareCandidate}=require('../server/autofix-candidate-policy.cjs');
const taskId='11111111-1111-4111-8111-111111111111';
const base='a'.repeat(40),treeSha='b'.repeat(40),newTree='c'.repeat(40);
const commitSha='d'.repeat(40),sourceSha='e'.repeat(40),repo='mr-tanq/concerts';
const original="import {check} from './helpers.js';\nexport const ok=()=>true;\n";
const next="import {check} from './helpers.js';\nexport const ok=()=>false;\n";
const regression="import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('TicketSwap check',()=>assert.equal(1,1));\n";
const trustedSources={'js/ticketswap-check.js':{sha:sourceSha,content:original}};
const candidate=()=>prepareCandidate({repository:repo,taskId,baseCommitSha:base,trustedSources,proposedFiles:[
 {path:'js/ticketswap-check.js',content:next},
 {path:'tests/autofix/ticketswap-check-regression.test.mjs',content:regression}
]});
const response=(status,data)=>({status,text:async()=>JSON.stringify(data)});
function fake({baseMoved=false,testExists=false,badToken=false,badAttestation=false,
 invalidDraft=false,sourceChanged=false,networkError=false}={}){
 const calls=[],c=candidate();
 const verification={passed:true,baseCommitSha:base,candidateDigest:digest(c),testNames:['TicketSwap test']};
 let refs=0;
 const fetcher=async(url,opts)=>{
  const path=new URL(url).pathname;calls.push({path,method:opts.method,body:opts.body?JSON.parse(opts.body):undefined,headers:opts.headers});
  if(networkError)throw Error('private upstream header');
  if(path.endsWith('/git/ref/heads/main')){
   refs++;return response(200,{object:{sha:baseMoved&&refs>1?'f'.repeat(40):base}});
  }
  if(path.endsWith('/git/commits/'+base))return response(200,{tree:{sha:treeSha}});
  if(path.includes('/contents/tests/autofix/'))
   return testExists?response(200,{type:'file'}):response(404,{message:'Not Found'});
  if(path.includes('/contents/js/ticketswap-check.js'))
   return response(200,{type:'file',encoding:'base64',sha:sourceChanged?'0'.repeat(40):sourceSha,
    size:Buffer.byteLength(original),content:Buffer.from(original).toString('base64')});
  if(path.endsWith('/git/trees'))return response(201,{sha:newTree});
  if(path.endsWith('/git/commits'))return response(201,{sha:commitSha});
  if(path.endsWith('/git/refs'))return response(201,{ref:'refs/heads/paperworld/autofix/'+taskId,object:{sha:commitSha}});
  if(path.endsWith('/pulls'))return response(201,{draft:!invalidDraft,number:19,
   head:{ref:'paperworld/autofix/'+taskId,sha:commitSha},base:{ref:'main'},
   html_url:'https://github.com/mr-tanq/concerts/pull/19'});
  throw Error('unexpected URL '+path);
 };
 const publisher=makePublisher({fetcher,
  installationCredential:async()=>badToken?{token:'gho_untrusted',kind:'oauth',repository:repo}:
   {token:'ghs_'+'x'.repeat(30),kind:'github_app_installation',repository:repo,
    expiresAt:new Date(Date.now()+3600000).toISOString(),
    permissions:{contents:'write',pull_requests:'write'}},
  attestationVerifier:async()=>!badAttestation
 });
 const input={taskId,repository:repo,baseCommitSha:base,branchPrefix:'paperworld/autofix/',
  draft:true,title:'TicketSwap: guarded fix',candidate:c,verification};
 return {publisher,input,calls};
}
test('Publisher creates exactly one isolated commit, new branch and DRAFT PR',async()=>{
 const {publisher,input,calls}=fake();
 const result=await publisher.createDraftPullRequest(input);
 assert.equal(result.draft,true);
 assert.equal(result.url,'https://github.com/mr-tanq/concerts/pull/19');
 assert.equal(result.commitSha,commitSha);
 assert.deepEqual(calls.filter(x=>x.method==='POST').map(x=>x.path.split('/').slice(-2).join('/')),
  ['git/trees','git/commits','git/refs','concerts/pulls']);
 assert.ok(calls.every(x=>x.path.startsWith('/repos/mr-tanq/concerts/')));
 assert.ok(calls.every(x=>!['PUT','PATCH','DELETE'].includes(x.method)));
 const posts=calls.filter(x=>x.method==='POST');
 assert.equal(posts[0].body.base_tree,treeSha);
 assert.equal(posts[0].body.tree.length,2);
 assert.deepEqual(posts[1].body.parents,[base]);
 assert.equal(posts[2].body.sha,commitSha);
 assert.equal(posts[3].body.draft,true);
 assert.equal(posts[3].body.base,'main');
 assert.equal(calls.filter(x=>x.path.endsWith('/git/ref/heads/main')).length,2);
});
test('Missing independent sandbox attestation blocks all GitHub requests',async()=>{
 for(const mutate of [x=>x.verification.candidateDigest='bad',
  x=>x.candidate.files.push({path:'package.json',content:'x'}),
  x=>x.draft=false,x=>x.branchPrefix='refs/heads/main']){
  const {publisher,input,calls}=fake();
  mutate(input);
  await assert.rejects(publisher.createDraftPullRequest(input));
  assert.equal(calls.length,0);
 }
 const {publisher,input,calls}=fake({badAttestation:true});
 await assert.rejects(publisher.createDraftPullRequest(input),/independent_attestation_required/);
 assert.equal(calls.length,0);
});
test('Reject existing regression test, changed trusted source, or moved main without creating PR',async()=>{
 for(const config of [{testExists:true},{sourceChanged:true},{baseMoved:true}]){
  const {publisher,input,calls}=fake(config);
  await assert.rejects(publisher.createDraftPullRequest(input),
   /regression_test_exists|source_snapshot_changed|base_branch_moved/);
  assert.equal(calls.some(x=>x.path.endsWith('/pulls')),false);
 }
});
test('Refuse OAuth user credential and malicious draft result',async()=>{
 const {publisher,input,calls}=fake({badToken:true});
 await assert.rejects(publisher.createDraftPullRequest(input),/scoped_installation_required/);
 assert.equal(calls.length,0);
 const other=fake({invalidDraft:true});
 await assert.rejects(other.publisher.createDraftPullRequest(other.input),/draft_pr_not_verified/);
});
test('Network failures do not echo upstream errors or credentials',async()=>{
 const {publisher,input}=fake({networkError:true});
 await assert.rejects(publisher.createDraftPullRequest(input),error=>{
  assert.equal(error.code,'github_connection_failed');
  assert.doesNotMatch(error.message,/private|ghs_/);return true;
 });
});
