'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {TAG,parseWorkerProposal,previewPayload}=require('../server/listening-proposal-intake.cjs');
const {digestPlan,createOneUseApprovalVerifier}=require('../server/listening-write-approval.cjs');
const id='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
const sha='a'.repeat(40);
const secret='b'.repeat(64);
const job={id,project:'Listening Mirror',directorId:'listening-director',
 workerId:'listening-developer',approvedForProposal:true};
const evidence={repository:'mr-tanq/concerts',ref:'main',readOnly:true,
 files:[{path:'js/concert-image-quality.js',sha,
  lines:'L1 export const image = false;'}]};
const proposal={jobId:id,repository:'mr-tanq/concerts',baseRef:'main',
 summary:'Fix missing concert images',edits:[{path:'js/concert-image-quality.js',
 expectedSha:sha,replacement:'export const image = true;'}]};
const report='Confirmed observation, see L1.\n'+TAG+JSON.stringify(proposal);
test('Accepts a real structured Worker proposal only when job/evidence match',()=>{
 const plan=parseWorkerProposal(report,{job,evidence});
 assert.equal(plan.kind,'paperworld-listening-change-proposal-v1');
 const preview=previewPayload(plan,evidence);
 assert.equal(preview.plan.edits[0].path,proposal.edits[0].path);
 assert.equal(preview.evidence.files[0].sha,sha);
 assert.equal(preview.evidence.files[0].lines,evidence.files[0].lines);
 assert.equal(plan.approvalRequired,true);
 assert.equal(plan.execution,'none');
});
test('Unsafe or malformed Worker output remains an analysis, not a proposal',()=>{
 for(const altered of [
  'No structured proposal',
  report+TAG+JSON.stringify(proposal),
  TAG+JSON.stringify({...proposal,repository:'attacker/repo'}),
  TAG+JSON.stringify({...proposal,edits:[{...proposal.edits[0],
   path:'../.github/workflows/deploy.yml'}]}),
  TAG+JSON.stringify({...proposal,edits:[{...proposal.edits[0],
   expectedSha:'c'.repeat(40)}]}),
  TAG+'not json',
  TAG+JSON.stringify({...proposal,approval:true})
 ])assert.equal(parseWorkerProposal(altered,{job,evidence}),null);
 assert.equal(parseWorkerProposal(report,{job:{...job,approvedForProposal:false},evidence}),null);
});
test('An approval digest includes exact replacement text and file revision',()=>{
 const plan=parseWorkerProposal(report,{job,evidence});
 const original=digestPlan(plan);
 assert.match(original,/^[a-f0-9]{64}$/);
 assert.notEqual(original,digestPlan({...plan,summary:'Different review request'}));
 assert.notEqual(original,digestPlan({...plan,edits:plan.edits.map(e=>({...e,replacement:'other'}))}));
 assert.notEqual(original,digestPlan({...plan,edits:plan.edits.map(e=>({...e,expectedSha:'c'.repeat(40)}))}));
});
test('Approval can only be consumed by one caller for the exact owner and plan',async()=>{
 const plan=parseWorkerProposal(report,{job,evidence});
 const seen=[],once=new Set();
 const store={consumeOnce:async data=>{
  seen.push(data);
  const key=data.id+':'+data.ownerId+':'+data.digest+':'+data.secretHash;
  if(once.has(key))return false;
  once.add(key);return true;
 }};
 const verifier=createOneUseApprovalVerifier({store,clock:()=>1000});
 const request={approval:{id,secret},ownerId:owner,jobId:id,
  repository:'mr-tanq/concerts',plan};
 assert.equal(await verifier.verifyAndConsumeApproval(request),true);
 assert.equal(await verifier.verifyAndConsumeApproval(request),false);
 assert.equal(seen.length,2);
 assert.equal(seen[0].digest,digestPlan(plan));
 assert.equal(seen[0].now,1000);
 assert.notEqual(seen[0].secretHash,secret);
 assert.equal(await verifier.verifyAndConsumeApproval({...request,ownerId:'bad'}),false);
 assert.equal(await verifier.verifyAndConsumeApproval({...request,repository:'different/repo'}),false);
 assert.equal(seen.length,2);
});
test('Never trusts client boolean or allows a non-atomic verifier adapter',async()=>{
 assert.throws(()=>createOneUseApprovalVerifier({store:{}}));
 const plan=parseWorkerProposal(report,{job,evidence});
 let accessed=false;
 const verifier=createOneUseApprovalVerifier({store:{consumeOnce:async()=>{accessed=true;return false}}});
 const allowed=await verifier.verifyAndConsumeApproval({approval:true,ownerId:owner,
  jobId:id,repository:'mr-tanq/concerts',plan});
 assert.equal(allowed,false);assert.equal(accessed,false);
});
test('Neither module contains network calls or runs Copilot models',()=>{
 const fs=require('node:fs');
 for(const file of ['server/listening-proposal-intake.cjs','server/listening-write-approval.cjs']){
  const text=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(text,/fetch\(|sendAndWait|createSession|writeFile|createPullRequest|exec\(/);
 }
});

test('Worker flow uses an OPTIONAL verified review proposal without more AI turns',()=>{
 const fs=require('node:fs');
 const server=fs.readFileSync('server/matt-worker-delegation.cjs','utf8');
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(server,/parseWorkerProposal\(workerReport,\{job:approvedForProposal,evidence\}\)/);
 assert.match(server,/reviewProposal=suggested\?previewPayload\(suggested,evidence\):null/);
 assert.match(server,/\.\.\.\(reviewProposal\?\{reviewProposal\}:\{\}\)/);
 assert.match(ui,/if\(worker\.reviewProposal\)/);
 assert.match(ui,/previewListeningChange\?\.\(worker\.reviewProposal\.plan/);
 assert.doesNotMatch(ui,/approval\.secret|grantWrite|createDraftPr\(/);
});
