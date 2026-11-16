/* Private Director Memory owner review desk. Requires confirmed individual
 * decisions and Supabase Auth + per-row owner RLS. Never calls any AI model.
 * Exposes only five fixed projects, not a user-selected SQL query.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldDirectorMemoryReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PROJECTS=Object.freeze([
  {id:'town',name:'Matt · PAPERWORLD'},
  {id:'workshop',name:'Listening Mirror'},
  {id:'studio',name:'The Lost Wanderer'},
  {id:'pokemon',name:'Pokémon Echoes'},
  {id:'wellbeing',name:'Wellbeing · Private'}
 ]);
 const STATUS=Object.freeze(['proposed','approved','rejected','superseded']);
 const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 const TYPES=new Set(['project_bible','decision','preference','current_state','work_history']);
 const SOURCES=new Set(['project_file','conversation','owner_note','verified_result']);
 const SENSITIVITY=new Set(['standard','private']);
 function reject(){throw Error('Invalid Director Memory response')}
 function normalize(rows,projectId){
  if(!PROJECTS.some(p=>p.id===projectId)||!Array.isArray(rows)||rows.length>100)reject();
  return Object.freeze(rows.map(row=>{
   if(!row||!ID.test(row.id||'')||row.project_id!==projectId||
    !TYPES.has(row.kind)||!STATUS.includes(row.status)||
    !SOURCES.has(row.source_type)||!SENSITIVITY.has(row.sensitivity)||
    typeof row.title!=='string'||row.title.length<1||row.title.length>140||
    typeof row.body!=='string'||row.body.length<1||row.body.length>4000||
    typeof row.source_ref!=='string'||row.source_ref.length<1||row.source_ref.length>400||
    typeof row.observed_at!=='string'||!Number.isFinite(Date.parse(row.observed_at))||
    !Number.isSafeInteger(row.version)||row.version<1)reject();
   return Object.freeze({id:row.id,projectId,kind:row.kind,status:row.status,
    title:row.title,body:row.body,sourceType:row.source_type,
    sourceRef:row.source_ref,observedAt:row.observed_at,
    sensitivity:row.sensitivity,version:row.version});
  }));
 }
 function counts(rows){return Object.freeze({
  total:rows.length,pending:rows.filter(r=>r.status==='proposed').length,
  approved:rows.filter(r=>r.status==='approved').length
 })}
 function createView({document,load,requestReview=null,confirmDecision=null,confirmBatch=null,enableReview=false}={}){
  if(!document||typeof document.createElement!=='function'||typeof load!=='function')
   reject();
  const e=(tag,value,cls)=>{
   const node=document.createElement(tag);
   if(value!==undefined)node.textContent=value;
   if(cls)node.className=cls;
   return node;
  };
  if(enableReview&&(
    typeof requestReview!=='function'||typeof confirmDecision!=='function'))reject();
  let selected='workshop',rows=[],busy=false,error='',notice='';
  async function decide(host,row,decision){
   if(!enableReview||busy||row.status!=='proposed'||
    !['approved','rejected'].includes(decision))return;
   // The confirmation includes the full evidence the user is approving.
   const accepted=await confirmDecision({projectId:selected,entry:row,decision});
   if(accepted!==true)return;
   busy=true;error='';notice='';draw(host);
   try{
    await requestReview({projectId:selected,entryId:row.id,decision});
    rows=normalize(await load(selected),selected);
   }catch(_){error='Η απόφαση δεν επιβεβαιώθηκε στη βάση. Κάνε ανανέωση.'}
   finally{busy=false;draw(host)}
  }
  async function reviewBatch(host){
   if(!enableReview||busy||typeof confirmBatch!=='function')return;
   const projectId=selected;
   // Frozen snapshot; no AI or agent-generated selectors may expand this list.
   const proposed=rows.filter(row=>row.status==='proposed');
   if(!proposed.length)return;
   const decisions=proposed.map(row=>Object.freeze({
    id:row.id,projectId,rowTitle:row.title,body:row.body,
    sourceType:row.sourceType,sourceRef:row.sourceRef,
    observedAt:row.observedAt,version:row.version,sensitivity:row.sensitivity
   }));
   const accepted=await confirmBatch({projectId,entries:decisions});
   if(accepted!==true||selected!==projectId)return;
   busy=true;error='';notice='';draw(host);
   let succeeded=0;
   try{
    for(const snapshot of decisions){
     // An owner-confirmed frozen snapshot is revalidated before every write.
     const latest=normalize(await load(projectId),projectId);
     const current=latest.find(row=>row.id===snapshot.id);
     if(!current||current.status!=='proposed'||current.projectId!==projectId||
      current.title!==snapshot.rowTitle||current.body!==snapshot.body||
      current.sourceType!==snapshot.sourceType||
      current.sourceRef!==snapshot.sourceRef||
      current.observedAt!==snapshot.observedAt||
      current.version!==snapshot.version||
      current.sensitivity!==snapshot.sensitivity)
      throw Error('memory_batch_stale_snapshot');
     await requestReview({projectId,entryId:snapshot.id,decision:'approved'});
     succeeded++;
    }
    notice= 'Εγκρίθηκαν '+succeeded+' από '+decisions.length+' εγγραφές του '+projectId+'.';
   }catch(_){
    error='Ομαδική έγκριση: επιβεβαιώθηκαν '+succeeded+' από '+
     decisions.length+'. Η διαδικασία σταμάτησε. Έλεγξε τη λίστα.';
   }finally{
    try{rows=normalize(await load(projectId),projectId)}
    catch(_){rows=[];error='Η κατάσταση μνήμης δεν επαληθεύτηκε μετά την έγκριση.'}
    busy=false;draw(host);
   }
  }
  async function refresh(host){
   if(busy)return;
   busy=true;error='';draw(host);
   try{rows=normalize(await load(selected),selected)}
   catch(_){rows=[];error='Η ιδιωτική μνήμη δεν φορτώθηκε. Έλεγξε τη σύνδεση.'}
   finally{busy=false;draw(host)}
  }
  function draw(host){
   host.replaceChildren();
   const heading=e('section',undefined,'director-memory-heading');
   heading.append(e('h3','Director Memory · Ιδιωτική γνώση'),
    e('p',enableReview?
     'Εξέτασε κάθε ανάμνηση και την πηγή της. Μόνο εσύ αποφασίζεις, μία καταχώριση κάθε φορά.':
     'Ανάγνωση μόνο: οι αποφάσεις έγκρισης/απόρριψης δεν έχουν ακόμη ενεργοποιηθεί.','room-footnote'));
   const select=e('select');
   select.setAttribute('aria-label','Project memory');
   for(const p of PROJECTS){
    const option=e('option',p.name);option.value=p.id;option.selected=p.id===selected;
    select.append(option);
   }
   select.disabled=busy;
   select.addEventListener('change',()=>{selected=select.value;rows=[];
    refresh(host)});
   const controls=e('div',undefined,'room-ops');
   controls.append(select);
   const reload=e('button','Ανανέωση');reload.type='button';reload.disabled=busy;
   reload.addEventListener('click',()=>refresh(host));controls.append(reload);
   if(enableReview&&typeof confirmBatch==='function'){
    const pending=rows.filter(r=>r.status==='proposed').length;
    const batch=e('button','Έγκριση '+pending+' αναμνήσεων μαζί');
    batch.type='button';batch.disabled=busy||pending===0;
    batch.addEventListener('click',()=>reviewBatch(host));
    controls.append(batch);
   }
   heading.append(controls);host.append(heading);
   if(busy){host.append(e('p','Φόρτωση ιδιωτικών καταχωρίσεων…','room-footnote'));return}
   if(error){host.append(e('p',error,'room-error'));return}
   if(notice)host.append(e('p',notice,'room-footnote'));
   const metrics=counts(rows);
   host.append(e('p',metrics.pending+' προτάσεις προς έλεγχο · '+
    metrics.approved+' εγκεκριμένες · '+metrics.total+' συνολικά','room-stats'));
   if(!rows.length){host.append(e('p','Δεν υπάρχουν καταχωρίσεις για αυτό το project.','room-footnote'));return}
   const list=e('div',undefined,'director-memory-list');
   for(const row of rows){
    const article=e('article',undefined,'director-memory-entry');
    const head=e('div',undefined,'room-task-top');
    head.append(e('strong',row.title),
     e('span',row.status==='proposed'?'Αναμένει έλεγχο':row.status,'director-memory-status'));
    article.append(head,e('p',row.body,'director-memory-body'));
    const details=e('details');details.append(e('summary','Πηγή & στοιχεία'));
    details.append(e('p',row.sourceType+' · '+row.sourceRef,'room-footnote'),
     e('p','Ημερομηνία πηγής: '+row.observedAt+
      ' · v'+row.version+' · '+(row.sensitivity==='private'?'Ιδιωτικό':'Κανονικό'),'room-footnote'));
    article.append(details);
    if(row.status==='proposed'){
     if(enableReview){
      const actions=e('div',undefined,'director-memory-review-actions');
      for(const decision of ['approved','rejected']){
       const button=e('button',decision==='approved'?'Έγκριση':'Απόρριψη');
       button.type='button';button.disabled=busy;
       button.setAttribute('aria-label',(decision==='approved'?'Έγκριση: ':'Απόρριψη: ')+row.title);
       button.addEventListener('click',()=>decide(host,row,decision));
       actions.append(button);
      }
      article.append(actions);
     }else article.append(
      e('p','Έγκριση/απόρριψη: δεν έχει ενεργοποιηθεί ακόμη.','room-footnote'));
    }
    list.append(article);
   }
   host.append(list);
  }
  return Object.freeze({draw,refresh,getSelection:()=>selected});
 }
 return Object.freeze({PROJECTS,STATUS,normalize,counts,createView});
});
