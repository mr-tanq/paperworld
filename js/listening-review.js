/* PAPERWORLD Listening Mirror change review — display only.
 * No approval token, GitHub write, AI call or side effects.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldListeningReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const PATHS=new Set(['js/concert-image-quality.js','js/festival-artwork.js',
  'scripts/cache-share-photos.mjs','js/ticketswap-check.js',
  'js/concert-ticketswap.js','scripts/lib/ticketswap-api.mjs',
  'README.md','package.json','js/warmup-setlist-model.js']);
 const HEX=/^[a-f0-9]{40}$/i;
 const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 function summarize(plan,evidence){
  if(!plan||plan.kind!=='paperworld-listening-change-proposal-v1'||
   !UUID.test(plan.jobId||'')||plan.repository!=='mr-tanq/concerts'||
   plan.baseRef!=='main'||plan.execution!=='none'||
   plan.approvalRequired!==true||plan.canWrite!==false||
   plan.canDeploy!==false||typeof plan.summary!=='string'||
   !plan.summary.trim()||plan.summary.length>500||
   !Array.isArray(plan.edits)||plan.edits.length===0||plan.edits.length>3||
   !evidence||evidence.repository!=='mr-tanq/concerts'||
   evidence.ref!=='main'||evidence.readOnly!==true||
   !Array.isArray(evidence.files))throw Error('review_payload_invalid');
  const originals=new Map(evidence.files.map(f=>[f.path,f]));
  const paths=new Set();
  const files=plan.edits.map(edit=>{
   const source=originals.get(edit?.path);
   if(!PATHS.has(edit?.path)||paths.has(edit.path)||
    !HEX.test(edit.expectedSha||'')||
    typeof edit.replacement!=='string'||!edit.replacement.trim()||
    edit.replacement.length>12000||
    !source||source.sha!==edit.expectedSha||
    typeof source.lines!=='string')
    throw Error('review_source_mismatch');
   paths.add(edit.path);
   return Object.freeze({path:edit.path,sha:edit.expectedSha,
    before:source.lines,after:edit.replacement});
  });
  return Object.freeze({jobId:plan.jobId,repository:plan.repository,
   branch:plan.baseRef,summary:plan.summary.trim(),
   files:Object.freeze(files),readOnly:true,approvalEnabled:false});
 }
 function el(tag,className,value){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(value!==undefined)node.textContent=value;
  return node;
 }
 function create(host,{publish,reject}={}){
  // UI callbacks cannot authorize themselves: server always rechecks owner,
  // exact immutable proposal digest and a one-use grant.
  if(!host||typeof host.append!=='function')throw Error('review_host_required');
  let current=null,review=null;
  const root=el('section','listening-review');
  root.setAttribute('aria-label','Έλεγχος προτεινόμενων αλλαγών');
  function paint(){
   root.replaceChildren();
   root.append(el('h3','Έλεγχος αλλαγών · Listening Mirror'));
   if(!current){
    root.append(el('p','listening-review-note','Δεν υπάρχει ακόμη εγκεκριμένη προς ανασκόπηση πρόταση. Ο Developer μπορεί να έχει ολοκληρώσει μόνο διάγνωση.'));
    return;
   }
   root.append(el('p','listening-review-summary',current.summary));
   root.append(el('p','listening-review-meta','Repository: '+current.repository+' · Βάση: '+current.branch+
    ' · Εργασία: '+current.jobId));
   root.append(el('p','listening-review-warning','Μόνο προεπισκόπηση · καμία αλλαγή δεν έχει πραγματοποιηθεί.'));
   for(const file of current.files){
    const section=el('details','listening-review-file');
    const summary=el('summary',null,file.path+' · '+file.sha.slice(0,10));
    section.append(summary,el('h4',null,'Υφιστάμενα αποσπάσματα από το GitHub'));
    section.append(el('pre','listening-review-before',file.before));
    section.append(el('h4',null,'Προτεινόμενο πλήρες περιεχόμενο αρχείου'));
    section.append(el('pre','listening-review-after',file.after));
    root.append(section);
   }
   const actions=el('div','listening-review-actions');
   const ready=review?.persisted===true&&review.status==='pending_review'&&
    /^[a-f0-9]{64}$/.test(review.digest||'');
   const approve=el('button',null,ready?'Δημιουργία Draft PR με έγκριση':
    'Έγκριση εγγραφής · μη ενεργή');
   approve.type='button';approve.disabled=true;
   approve.setAttribute('aria-describedby','listening-review-disabled-reason');
   if(ready&&typeof publish==='function'){
    approve.disabled=false;
    approve.addEventListener('click',()=>publish(current,review.digest));
   }
   actions.append(approve);
   if(ready&&typeof reject==='function'){
    const rejectButton=el('button',null,'Απόρριψη πρότασης');
    rejectButton.type='button';
    rejectButton.addEventListener('click',()=>reject(current,review.digest));
    actions.append(rejectButton);
   }
   root.append(actions);
   const label=review?.status==='rejected'?'Η πρόταση απορρίφθηκε.':
    review?.status==='draft_created'?'Δημιουργήθηκε Draft PR · δεν έγινε merge.':
    ready?'Απαιτείται η δική σου επιβεβαίωση για το συγκεκριμένο περιεχόμενο.':
    'Μόνο προεπισκόπηση: δεν έχει αποθηκευτεί ακόμη επιβεβαιωμένη πρόταση.';
   const reason=el('p','listening-review-note',label);
   reason.id='listening-review-disabled-reason';root.append(reason);
  }
  host.append(root);paint();
  return Object.freeze({
   show:(plan,evidence,status={})=>{current=summarize(plan,evidence);review=status;paint()},
   clear:()=>{current=null;review=null;paint()},
   hasProposal:()=>current!==null
  });
 }
 return Object.freeze({summarize,create});
});
