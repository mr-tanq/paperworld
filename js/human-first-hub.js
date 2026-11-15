/* Paperworld Human First Village Hub.
 * One owner-scoped, read-only view over real jobs, saved user tasks and review
 * proposals. It has NO network, secrets, AI, GitHub, write grants or timers.
 * The host injects authenticated loaders and explicitly confirmed actions.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldHumanFirstHub=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const REVIEW_STATES=new Set(['pending_review','draft_created','rejected','needs_reverification']);
 const JOB_STATES=new Set(['created','routed','scoped','evidence_read','worker_reported',
  'director_reviewed','reported','failed']);
 const TASK_STATES=new Set(['todo','doing','done']);
 const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 const DIGEST=/^[a-f0-9]{64}$/;
 const PR=/^https:\/\/github\.com\/mr-tanq\/concerts\/pull\/[1-9][0-9]*$/;
 const ROOM={town:'Paperworld',workshop:'Listening Mirror',pokemon:'Pokémon Echoes',
  studio:'The Lost Wanderer',wellbeing:'Wellbeing'};
 const MAX=30;
 const human=(text,n=500)=>String(text||'').trim().slice(0,n);
 const time=x=>Number.isFinite(Date.parse(x))?Date.parse(x):0;
 const freeze=x=>Object.freeze(x);
 function proposal(item){
  if(!item||!UUID.test(item.jobId||'')||
    !REVIEW_STATES.has(item.status)||!DIGEST.test(item.digest||'')||
    !item.plan||!item.evidence)return null;
  // Browser validation is only presentation; server always rechecks owner,
  // immutable digest, source revision and one-use write authorization.
  try{
   const review=globalThis.PaperworldListeningReview;
   if(!review?.summarize)return null;
   const checked=review.summarize(item.plan,item.evidence);
   if(checked.jobId!==item.jobId)return null;
   if(item.status==='draft_created'&&!PR.test(item.draftUrl||''))return null;
   return freeze({kind:'proposal',id:item.jobId,jobId:item.jobId,
    status:item.status,digest:item.digest,summary:checked.summary,
    files:checked.files,createdAt:human(item.createdAt,50),draftUrl:
     item.status==='draft_created'?item.draftUrl:null});
  }catch(_){return null}
 }
 function job(item){
  if(!item||!UUID.test(item.id||'')||
   item.project!=='Listening Mirror'||!Array.isArray(item.events))return null;
  const events=item.events.filter(e=>e&&JOB_STATES.has(e.state)&&
   typeof e.actor==='string').slice(0,100);
  const last=events.at(-1)?.state||'created';
  return freeze({kind:'job',id:item.id,project:'Listening Mirror',
   summary:human(item.summary,1200)||'Εργασία Listening Mirror',
   createdAt:human(item.createdAt,50),last,events:freeze(events.map(e=>freeze({
    state:e.state,at:human(e.createdAt,50),actor:human(e.actor,40)})))});
 }
 function manual(item){
  if(!item||typeof item.id!=='string'||!TASK_STATES.has(item.status)||
   !Object.hasOwn(ROOM,item.room)||!human(item.title,160))return null;
  return freeze({kind:'manual',id:human(item.id,80),project:ROOM[item.room],
   status:item.status,summary:human(item.title,160),
   createdAt:Number.isFinite(item.created)?new Date(item.created).toISOString():
    human(item.created_at,50)});
 }
 function project({jobs=[],proposals=[],tasks=[]}={}){
  const validJobs=Array.isArray(jobs)?jobs.map(job).filter(Boolean).slice(0,MAX):[];
  const validProposals=Array.isArray(proposals)?
   proposals.map(proposal).filter(Boolean).slice(0,MAX):[];
  const byJob=new Map(validJobs.map(j=>[j.id,j]));
  const rows=[];
  for(const p of validProposals){
   const related=byJob.get(p.jobId);
   rows.push(freeze({...p,summary:p.summary||related?.summary||'Προτεινόμενη λύση',
    request:related?.summary||null,project:'Listening Mirror',
    stage:p.status==='pending_review'?'decision':
     p.status==='draft_created'?'prepared':
     p.status==='rejected'?'rejected':'review_required'}));
  }
  const proposalIds=new Set(validProposals.map(p=>p.id));
  for(const j of validJobs){
   if(proposalIds.has(j.id))continue;
   rows.push(freeze({...j,stage:j.last==='failed'?'needs_attention':
    j.last==='reported'?'diagnosed':'in_progress'}));
  }
  if(Array.isArray(tasks))for(const t of tasks.slice(0,200)){
   const m=manual(t);if(m)rows.push(freeze({...m,
    stage:m.status==='done'?'completed':m.status==='doing'?'in_progress':'planned'}))
  }
  const order={decision:0,review_required:1,needs_attention:2,in_progress:3,
   diagnosed:4,planned:5,prepared:6,completed:7,rejected:8};
  rows.sort((a,b)=>(order[a.stage]??9)-(order[b.stage]??9)||
   time(b.createdAt)-time(a.createdAt));
  const counts={decision:rows.filter(x=>x.stage==='decision').length,
   active:rows.filter(x=>['in_progress','planned','needs_attention','diagnosed','review_required'].includes(x.stage)).length,
   prepared:rows.filter(x=>x.stage==='prepared').length,
   all:rows.length};
  return freeze({rows:freeze(rows),counts:freeze(counts)});
 }
 function stateLabel(s){return ({
  decision:'Χρειάζεται η απόφασή σου',
  review_required:'Χρειάζεται επανέλεγχος',
  needs_attention:'Η διερεύνηση δεν ολοκληρώθηκε',
  in_progress:'Σε εξέλιξη',
  diagnosed:'Η διερεύνηση ολοκληρώθηκε · χωρίς έτοιμη λύση',
  planned:'Στη λίστα εργασιών',
  prepared:'Προετοιμάστηκε · δεν εφαρμόστηκε',
  completed:'Ολοκληρώθηκε (χειροκίνητη εργασία)',
  rejected:'Απορρίφθηκε'
 })[s]||'Εργασία'}
 const e=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 function button(label,handler,cls){
  const b=e('button',cls,label);b.type='button';
  b.addEventListener('click',handler);return b;
 }
 function create(host,{load,approve,reject,openMatt,openProject,
  onChanged,onError,compact=false}={}){
  if(!host||typeof host.replaceChildren!=='function'||
   typeof load!=='function')throw Error('human_first_host_required');
  let current=freeze({rows:freeze([]),counts:freeze({decision:0,active:0,prepared:0,all:0})});
  let loading=false,error='',filter='attention',selected=null,rendered=false;
  let opBusy=false;
  const markError=msg=>{
   error=human(msg,160)||'Η ενημέρωση δεν ολοκληρώθηκε.';
   if(typeof onError==='function')onError(error);
  };
  function visible(row){
   return filter==='all'||filter==='attention'&&
    ['decision','review_required','needs_attention','in_progress','diagnosed','planned'].includes(row.stage)||
    filter==='prepared'&&['prepared','completed','rejected'].includes(row.stage);
  }
  function rowCard(item){
   const card=e('article','human-hub-item human-hub-'+item.stage);
   const top=e('div','human-hub-item-top');
   top.append(e('span','human-hub-project',item.project||'Listening Mirror'),
    e('span','human-hub-status',stateLabel(item.stage)));
   card.append(top,e('h4','',item.kind==='proposal'&&item.request?
     human(item.request,170):item.summary));
   if(item.kind==='proposal'){
    const solution=e('p','human-hub-summary',item.summary);
    card.append(e('strong','human-hub-mini-title','Η λύση της ομάδας'),solution);
    if(item.stage==='decision'){
     card.append(e('p','human-hub-caution','Η έγκριση προετοιμάζει αλλαγή στο GitHub. Δεν την εφαρμόζει ή δημοσιεύει.'));
     const a=e('div','human-hub-item-actions');
     a.append(button('Εγκρίνω την προετοιμασία',()=>perform('approve',item),'human-hub-yes'),
      button('Απόρριψη λύσης',()=>perform('reject',item),'human-hub-no'));
     card.append(a);
    }else if(item.stage==='prepared'&&item.draftUrl){
     const a=e('a','human-hub-tech-link','Δες την προετοιμασμένη αλλαγή');
     a.href=item.draftUrl;a.target='_blank';a.rel='noopener noreferrer';
     card.append(a);
    }
    const details=e('details','human-hub-technical');
    details.append(e('summary','','Τεχνικά στοιχεία (προαιρετικά)'));
    for(const file of item.files){
     const f=e('details','human-hub-file');
     f.append(e('summary','',file.path),e('pre','',file.before),e('pre','',file.after));
     details.append(f);
    }
    card.append(details);
   }else if(item.kind==='job'){
    const last=item.events.at(-1);
    card.append(e('p','human-hub-summary',
     item.stage==='diagnosed'?'Η ομάδα ολοκλήρωσε την ανάγνωση και την ανάλυση. Δεν υπάρχει αποθηκευμένη λύση προς έγκριση.':
     item.stage==='needs_attention'?'Η διερεύνηση σταμάτησε. Μπορείς να συζητήσεις το πρόβλημα ξανά με τον Matt.':
     'Η εργασία έχει καταγραφεί. Δεν θεωρείται ολοκληρωμένη μέχρι να υπάρχει επαληθευμένο αποτέλεσμα.'));
    const details=e('details','human-hub-technical');
    details.append(e('summary','','Τι έκανε η ομάδα'));
    for(const event of item.events)details.append(e('p','',human(event.state,35)+
     ' · '+human(event.actor,35)));
    card.append(details);
   }else card.append(e('p','human-hub-summary',
     item.stage==='completed'?'Την ολοκλήρωση την σημείωσες εσύ.':
      'Προσωπική εργασία · δεν σημαίνει ότι εκτελέστηκε από AI agent.'));
   return card;
  }
  async function perform(action,item){
   if(opBusy||loading||item.stage!=='decision'||!DIGEST.test(item.digest))return;
   if(typeof (action==='approve'?approve:reject)!=='function')return;
   const text=action==='approve'?
    'Εγκρίνεις να προετοιμαστεί η συγκεκριμένη λύση;\n\n'+
    item.summary+'\n\nΘα δημιουργηθεί μόνο προτεινόμενη αλλαγή για τελικό έλεγχο. '+
    'ΔΕΝ θα εφαρμοστεί, συγχωνευθεί ή δημοσιευτεί αυτόματα.':
    'Θέλεις να απορρίψεις οριστικά αυτή τη λύση; Δεν θα γίνει καμία αλλαγή.';
   if(!window.confirm(text))return;
   opBusy=true;error='';render();
   try{
    await (action==='approve'?approve:reject)(item);
    if(typeof onChanged==='function')onChanged(action,item);
    await refresh();
   }catch(err){markError(err.message||'Η ενέργεια απέτυχε.');render()}
   finally{opBusy=false;render()}
  }
  function render(){
   rendered=true;host.replaceChildren();
   host.hidden=false;
   const header=e('header','human-hub-header');
   header.append(e('p','human-hub-eyebrow',compact?'Ο MATT ΕΧΕΙ ΜΙΑ ΕΝΗΜΕΡΩΣΗ':
    'PAPERWORLD · ΤΟ ΓΡΑΦΕΙΟ ΣΟΥ'),
    e('h3','',compact?'Οι λύσεις της ομάδας':'Οι εργασίες μου'),
    e('p','human-hub-intro',compact?'Αποφασίζεις εδώ, χωρίς να φύγεις από τη συνομιλία.':
     'Ο Matt οργανώνει την ομάδα. Εδώ βλέπεις πραγματικές εργασίες και αποφάσεις.'));
   host.append(header);
   const summary=e('div','human-hub-counts');
   for(const [count,label] of [[current.counts.decision,'Αποφάσεις'],
    [current.counts.active,'Εκκρεμούν'],[current.counts.prepared,'Προετοιμάστηκαν']]){
    const box=e('div','human-hub-count');
    box.append(e('strong','',String(count)),e('span','',label));summary.append(box);
   }if(!compact)host.append(summary);
   const controls=e('div','human-hub-controls');
   for(const [id,label] of [['attention','Προτεραιότητες'],
    ['prepared','Προηγούμενα'],['all','Όλα']]){
    const b=button(label,()=>{filter=id;render()},'human-hub-tab');
    b.setAttribute('aria-pressed',String(filter===id));controls.append(b);
   }
   controls.append(button(loading?'Φόρτωση…':'Ανανέωση',()=>refresh(),'human-hub-refresh'));
   if(!compact)host.append(controls);
   if(error)host.append(e('p','human-hub-error',error));
   if(loading&&!current.rows.length)host.append(e('p','human-hub-loading','Ανακτώ τις εργασίες σου…'));
   const shown=current.rows.filter(item=>compact?item.stage==='decision':visible(item));
   if(compact&&!shown.length&&!error){host.hidden=true;return}
   if(!loading&&!shown.length){
    host.append(e('div','human-hub-empty',
     current.counts.all?'Δεν υπάρχουν εργασίες σε αυτή την κατηγορία.':
     'Δεν υπάρχουν εργασίες ακόμη. Μίλησε στον Matt για να ξεκινήσεις.'));
   }
   const list=e('div','human-hub-list');
   for(const item of shown.slice(0,MAX))list.append(rowCard(item));
   host.append(list);
   if(compact)return;
   const foot=e('div','human-hub-footer');
   if(typeof openMatt==='function')foot.append(button('Μίλα στον Matt',openMatt,'human-hub-talk'));
   if(typeof openProject==='function')foot.append(button('Άνοιξε Listening Mirror',openProject,'human-hub-project-open'));
   foot.append(e('p','',
    'Οι καταγραφές εργασιών δεν αποτελούν απόδειξη ότι έγινε αλλαγή. '+
    'Κάθε έγκριση ελέγχεται ξανά από τον server και δεν προκαλεί αυτόματο deployment.'));
   host.append(foot);
  }
  async function refresh(){
   if(loading)return current;
   loading=true;error='';render();
   try{
    const raw=await load();
    if(!raw||!Array.isArray(raw.jobs)||!Array.isArray(raw.proposals)||
      !Array.isArray(raw.tasks))throw Error('Η κατάσταση εργασιών δεν επιβεβαιώθηκε.');
    current=project(raw);
   }catch(err){markError(err.message||'Το ιστορικό δεν είναι διαθέσιμο.')}
   finally{loading=false;render()}
   return current;
  }
  function setData(raw){
   if(!raw||!Array.isArray(raw.jobs)||!Array.isArray(raw.proposals)||
     !Array.isArray(raw.tasks))throw Error('invalid_hub_data');
   current=project(raw);error='';render();return current;
  }
  function focus(jobId){
   if(!UUID.test(jobId||''))return;
   selected=jobId;
   filter='all';render();
   const cards=host.querySelectorAll?.('.human-hub-item')||[];
   const row=current.rows.filter(visible).findIndex(x=>x.id===jobId);
   cards[row]?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  }
  render();
  return freeze({refresh,focus,render,setData,get snapshot(){return current},
   get error(){return error},get ready(){return rendered}});
 }
 return freeze({project,stateLabel,create,job,proposal,manual});
});
