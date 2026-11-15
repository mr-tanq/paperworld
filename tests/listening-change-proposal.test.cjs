'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateChangeProposal}=require('../server/listening-change-proposal.cjs');
const id='11111111-1111-4111-8111-111111111111';
const sha='a'.repeat(40);
const job={id,project:'Listening Mirror',directorId:'listening-director',
 workerId:'listening-developer',approvedForProposal:true};
const evidence={repository:'mr-tanq/concerts',ref:'main',readOnly:true,
 files:[{path:'js/concert-image-quality.js',sha,lines:'L1 export function usableConcertImage() {}'}]};
const proposal={jobId:id,repository:'mr-tanq/concerts',baseRef:'main',
 summary:'Improve image validation',edits:[{path:'js/concert-image-quality.js',
 expectedSha:sha,replacement:'export function usableConcertImage() { return null; }'}]};
const verify=(changes={})=>validateChangeProposal({
 job:changes.job||job,proposal:changes.proposal||proposal,
 evidence:changes.evidence||evidence});
test('Approved bounded proposal is review-only, never an execution authorization',()=>{
 const x=verify();
 assert.equal(x.jobId,id);
 assert.equal(x.repository,'mr-tanq/concerts');
 assert.equal(x.approvalRequired,true);
 assert.equal(x.execution,'none');
 assert.equal(x.canWrite,false);
 assert.equal(x.canDeploy,false);
 assert.equal(x.edits.length,1);
 assert.ok(Object.isFrozen(x.edits));
});
test('Rejects jobs without proposal approval, wrong owner or worker',()=>{
 for(const changed of [{approvedForProposal:false},{workerId:'other'},
  {directorId:'pokemon-director'},{project:'Pokémon'}]){
  assert.throws(()=>verify({job:{...job,...changed}}));
 }
});
test('Rejects unreviewed paths, duplicates, wrong branches and revisions',()=>{
 for(const changed of [
  {edits:[{...proposal.edits[0],path:'../.github/workflows/deploy.yml'}]},
  {edits:[proposal.edits[0],proposal.edits[0]]},
  {baseRef:'release'},{repository:'attacker/repo'},
  {edits:[{...proposal.edits[0],expectedSha:'b'.repeat(40)}]},
  {edits:[{...proposal.edits[0],replacement:' '}]}
 ])assert.throws(()=>verify({proposal:{...proposal,...changed}}));
});
test('Requires evidence tied to fixed repository and exact source revision',()=>{
 assert.throws(()=>verify({evidence:{...evidence,ref:'other'}}));
 assert.throws(()=>verify({evidence:{...evidence,files:[]}}));
 assert.throws(()=>verify({evidence:{...evidence,readOnly:false}}));
});
test('Does not perform writes or call AI; source remains declarative',()=>{
 const fs=require('node:fs'),s=fs.readFileSync('server/listening-change-proposal.cjs','utf8');
 assert.doesNotMatch(s,/fetch\(|https\.request|child_process|exec\(|createPullRequest|createBranch|sendAndWait|writeFile/);
});
