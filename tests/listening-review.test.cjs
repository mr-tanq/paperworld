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
 assert.match(work,/PaperworldListeningReview/);
 assert.match(work,/reviewModule\?\.create\(place,\{publish,reject\}\)/);
 assert.match(work,/previewListeningChange:/);
 assert.doesNotMatch(messenger,/PaperworldListeningReview|listening-review/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('js/listening-review.js')<html.indexOf('js/cloud-ui.js'));
});
test('Empty review should not invent jobs or approvals',()=>{
 assert.throws(()=>review.summarize(null,null));
 const source=fs.readFileSync('js/listening-review.js','utf8');
 assert.match(source,/Δεν υπάρχει κάποια λύση που χρειάζεται την απόφασή σου/);
 assert.match(source,/Η αλλαγή δεν έχει εφαρμοστεί/);
});

test('Empty Work Desk displays a readable sentence, not a CSS class name',()=>{
 const prior=global.document;
 global.document={createElement(tag){
  return {tag,children:[],className:'',textContent:'',append(...nodes){this.children.push(...nodes)},
   replaceChildren(...nodes){this.children=[...nodes]},setAttribute(){}};
 }};
 try{
  const host={children:[],append(...nodes){this.children.push(...nodes)}};
  review.create(host);
  const content=host.children[0].children[2];
  assert.equal(content.className,'listening-review-note');
  assert.match(content.textContent,/Δεν υπάρχει κάποια λύση/);
  assert.doesNotMatch(content.textContent,/^listening-review-note$/);
 }finally{global.document=prior}
});

test('Human-first review shows one preparation-only decision and collapses implementation details',()=>{
 const prior=global.document;let publishCount=0,rejectCount=0;
 const node=(tag)=>({
  tag,children:[],className:'',textContent:'',attributes:{},disabled:false,
  listeners:{},append(...nodes){this.children.push(...nodes)},
  replaceChildren(...nodes){this.children=[...nodes]},
  setAttribute(k,v){this.attributes[k]=v},
  addEventListener(k,fn){this.listeners[k]=fn}
 });
 global.document={createElement:node};
 const flat=n=>[n,...(n.children||[]).flatMap(flat)];
 try{
  const host=node('div');
  const view=review.create(host,{publish:()=>publishCount++,reject:()=>rejectCount++});
  view.show(plan,evidence,{persisted:true,status:'pending_review',digest:'b'.repeat(64)});
  const elements=flat(host);
  const technical=elements.find(n=>n.className==='listening-review-technical');
  assert.equal(technical.tag,'details');
  assert.ok(flat(technical).some(n=>n.textContent.includes('Repository:')));
  assert.equal(elements.find(n=>n.className==='listening-review-summary').textContent,plan.summary);
  const approve=elements.find(n=>n.className==='listening-review-approve');
  assert.equal(approve.disabled,false);
  assert.equal(approve.textContent,'Εγκρίνω την προετοιμασία');
  assert.match(elements.find(n=>n.className==='listening-review-warning').textContent,/δεν έχει εφαρμοστεί/);
  assert.ok(approve.listeners.click);
  approve.listeners.click();
  assert.equal(publishCount,1);
  assert.equal(rejectCount,0);
  view.show(plan,evidence,{persisted:false,status:'pending_review'});
  const disabled=flat(host).find(n=>n.className==='listening-review-approve');
  assert.equal(disabled.disabled,true);
  assert.equal(disabled.listeners.click,undefined);
 }finally{global.document=prior}
});
test('UX copy does not imply GitHub preparation deploys any change',()=>{
 const ui=fs.readFileSync('js/cloud-ui.js','utf8');
 assert.match(ui,/ΔΕΝ θα εφαρμοστεί στην εφαρμογή/);
 assert.match(ui,/δεν θα γίνει merge ή δημοσίευση/);
 assert.match(ui,/Περισσότερες επιλογές/);
 assert.match(ui,/pendingReviews/);
 assert.ok(ui.indexOf('host.append(reviewHost)')<ui.indexOf('host.append(tasksPanel)'));
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/human-first-review-v3/);
});
