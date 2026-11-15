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
 function create(host){
  if(!host||typeof host.append!=='function')throw Error('review_host_required');
  let current=null;
  const root=el('section','listening-review');
  root.setAttribute('aria-label','Έλεγχος προτεινόμενων αλλαγών');
  function paint(){
   root.replaceChildren();
   root.append(el('h3','Έλεγχος αλλαγών · Listening Mirror'));
   if(!current){
    root.append(el('p','Δεν υπάρχει ακόμη εγκεκριμένη προς ανασκόπηση πρόταση. Ο Worker παραμένει μόνο για ανάγνωση.','listening-review-note'));
    return;
   }
   root.append(el('p',current.summary,'listening-review-summary'));
   root.append(el('p','Repository: '+current.repository+' · Βάση: '+current.branch+
    ' · Εργασία: '+current.jobId,'listening-review-meta'));
   root.append(el('p','Μόνο προεπισκόπηση · καμία αλλαγή δεν έχει πραγματοποιηθεί.','listening-review-warning'));
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
   const approve=el('button',null,'Έγκριση εγγραφής · μη ενεργή');
   approve.type='button';approve.disabled=true;
   approve.setAttribute('aria-describedby','listening-review-disabled-reason');
   actions.append(approve);
   root.append(actions);
   const reason=el('p','listening-review-note',
    'Η έγκριση θα ενεργοποιηθεί μόνο μετά από ασφαλή, μοναδική εξουσιοδότηση στον server. Δεν δημιουργείται ακόμη branch ή Draft PR.');
   reason.id='listening-review-disabled-reason';root.append(reason);
  }
  host.append(root);paint();
  return Object.freeze({
   show:(plan,evidence)=>{current=summarize(plan,evidence);paint()},
   clear:()=>{current=null;paint()},
   hasProposal:()=>current!==null
  });
 }
 return Object.freeze({summarize,create});
});
