'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const review=require('../js/listening-review.js');
const id='11111111-1111-4111-8111-111111111111',sha='a'.repeat(40);
const path='js/concert-image-quality.js';
const plan={kind:'paperworld-listening-change-proposal-v1',jobId:id,
 repository:'mr-tanq/concerts',baseRef:'main',summary:'Improve artwork check',
 edits:[{path,expectedSha:sha,replacement:'export const safe = true;'}],
 execution:'none',approvalRequired:true,canWrite:false,canDeploy:false};
const evidence={repository:'mr-tanq/concerts',ref:'main',readOnly:true,
 files:[{path,sha,lines:'L1 export const safe = false;'}]};
test('Owner review is a pure, read-only display of exact proposal and source revision',()=>{
 const result=review.summarize(plan,evidence);
 assert.equal(result.jobId,id);
 assert.equal(result.files[0].path,path);
 assert.equal(result.files[0].sha,sha);
 assert.equal(result.files[0].before,evidence.files[0].lines);
 assert.equal(result.files[0].after,plan.edits[0].replacement);
 assert.equal(result.approvalEnabled,false);
 assert.equal(result.readOnly,true);
 assert.ok(Object.isFrozen(result.files));
});
test('Rejects fabricated write authority, mismatched paths or revisions',()=>{
 const invalid=[
  [{...plan,canWrite:true},evidence],
  [{...plan,execution:'draft'},evidence],
  [{...plan,repository:'other/repo'},evidence],
  [{...plan,edits:[{...plan.edits[0],path:'../.github/workflows/ci.yml'}]},evidence],
  [plan,{...evidence,files:[{...evidence.files[0],sha:'b'.repeat(40)}]}],
  [{...plan,edits:[plan.edits[0],plan.edits[0]]},evidence],
  [plan,{...evidence,readOnly:false}],
  [{...plan,jobId:'not-a-uuid'},evidence]
 ];
 for(const args of invalid)assert.throws(()=>review.summarize(...args));
});
test('Approval cannot be activated by the browser review UI',()=>{
 const source=fs.readFileSync('js/listening-review.js','utf8');
 assert.match(source,/approve.disabled=true/);
 assert.match(source,/approvalEnabled:false/);
 assert.match(source,/node.textContent=value/);
 assert.doesNotMatch(source,/fetch\(|sendAndWait|createPullRequest|localStorage/);
 assert.match(source,/review\?\.persisted===true&&review\.status==='pending_review'/);
 assert.match(source,/approve\.disabled=false/);
 assert.match(source,/approve\.addEventListener/);
 const work=fs.readFileSync('js/cloud-ui.js','utf8');
 const messenger=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(work,/PaperworldListeningReview\?\.create\(reviewHost\)/);
 assert.match(work,/previewListeningChange:/);
 assert.doesNotMatch(messenger,/PaperworldListeningReview|listening-review/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('js/listening-review.js')<html.indexOf('js/cloud-ui.js'));
});
test('Empty review should not invent jobs or approvals',()=>{
 assert.throws(()=>review.summarize(null,null));
 const source=fs.readFileSync('js/listening-review.js','utf8');
 assert.match(source,/Δεν υπάρχει ακόμη εγκεκριμένη προς ανασκόπηση πρόταση/);
 assert.match(source,/καμία αλλαγή δεν έχει πραγματοποιηθεί/);
});
