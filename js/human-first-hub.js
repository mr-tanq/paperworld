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
 const POKE_PR=/^https:\/\/github\.com\/mr-tanq\/pokemon-echoes\/pull\/[1-9][0-9]*$/;
 const POKE_FILES=new Set(['player.gd','scripts/alder_route_gate_v1.gd','scripts/battle_test_trigger.gd','scripts/inventory_manager_v1.gd','scripts/npc.gd']);
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
 function pokemonProposal(item){
  if(!item||!UUID.test(item.jobId||'')||!DIGEST.test(item.digest||'')||
   !REVIEW_STATES.has(item.status)||!item.plan||!item.evidence||
   item.plan.kind!=='paperworld-pokemon-code-proposal-v5'||
   item.plan.jobId!==item.jobId||
   item.plan.repository!=='mr-tanq/pokemon-echoes'||
   item.plan.baseRef!=='main'||item.plan.execution!=='none'||
   item.plan.approvalRequired!==true||item.plan.canWrite!==false||
   item.plan.canDeploy!==false||
   !Array.isArray(item.plan.edits)||item.plan.edits.length!==1||
   item.evidence.repository!=='mr-tanq/pokemon-echoes'||
   item.evidence.ref!=='main'||item.evidence.readOnly!==true||
   !Array.isArray(item.evidence.files)||
   (item.status==='draft_created'&&!POKE_PR.test(item.draftUrl||'')))
   return null;
  const edit=item.plan.edits[0];
  const original=item.evidence.files.find(f=>f.path===edit?.path);
  if(!POKE_FILES.has(edit?.path)||! /^[a-f0-9]{40}$/i.test(edit.expectedSha||'')||
   !original||original.sha!==edit.expectedSha||
   typeof original.lines!=='string'||typeof edit.replacement!=='string'||
   !edit.replacement.trim()||edit.replacement.length>4000||
   !human(item.plan.summary,300))return null;
  return freeze({kind:'pokemon-proposal',id:item.jobId,jobId:item.jobId,
   status:item.status,digest:item.digest,project:'Pokémon Echoes',
   summary:human(item.plan.summary,300),createdAt:human(item.createdAt,50),
   draftUrl:item.status==='draft_created'?item.draftUrl:null,
   files:freeze([freeze({path:edit.path,before:original.lines,
    after:edit.replacement,sha:edit.expectedSha})]),
   stage:item.status==='pending_review'?'decision':
    item.status==='draft_created'?'prepared':
    item.status==='rejected'?'rejected':'review_required'});
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
 function teamHandoff(item){
  const projectNames={listening:'Listening Mirror',pokemon:'Pokémon Echoes',
   studio:'The Lost Wanderer',wellbeing:'Wellbeing'};
  const directors={listening:'listening-director',pokemon:'pokemon-director',
   studio:'studio-director',wellbeing:'wellbeing-director'};
  const workers={listening:'listening-developer',pokemon:'pokemon-developer'};
  if(!item||!UUID.test(item.id||'')||!UUID.test(item.requestId||'')||
   !Object.hasOwn(projectNames,item.project)||
   item.directorId!==directors[item.project]||
   !['reported','awaiting_consent'].includes(item.status)||
   !human(item.summary,1200))return null;
  return freeze({kind:'handoff',id:item.id,requestId:item.requestId,
   project:projectNames[item.project],summary:human(item.summary,1200),
   createdAt:human(item.createdAt,50),status:item.status,
   directorId:item.directorId,
   workerId:workers[item.project]===item.workerId?item.workerId:null,
   stage:item.status==='awaiting_consent'?'planned':'diagnosed'});
 }
 function workerRun(item){
  const projects={listening:'Listening Mirror',pokemon:'Pokémon Echoes'};
  const directors={listening:'listening-director',pokemon:'pokemon-director'};
  const workers={listening:'listening-developer',pokemon:'pokemon-developer'};
  if(!item||!UUID.test(item.id||'')||!UUID.test(item.requestId||'')||
   !Object.hasOwn(projects,item.project)||
   item.directorId!==directors[item.project]||
   item.workerId!==workers[item.project]||
   !['running','reported','failed'].includes(item.status)||
   !human(item.summary,1200))return null;
  return freeze({kind:'worker-run',id:item.id,requestId:item.requestId,
   project:projects[item.project],summary:human(item.summary,1200),
   createdAt:human(item.createdAt,50),status:item.status,
   stage:item.status==='failed'?'needs_attention':
    item.status==='reported'?'diagnosed':'in_progress'});
 }
 function project({jobs=[],proposals=[],pokemonProposals=[],tasks=[],teamJobs=[],workerRuns=[]}={}){
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
  const validPokemon=Array.isArray(pokemonProposals)?
   pokemonProposals.map(pokemonProposal).filter(Boolean).slice(0,MAX):[];
  for(const p of validPokemon)rows.push(p);
  const proposalIds=new Set([...validProposals.map(p=>p.id),...validPokemon.map(p=>p.id)]);
  const validWorkerRuns=Array.isArray(workerRuns)?workerRuns.map(workerRun).filter(Boolean).slice(0,MAX):[];
  const trackedWorkerJobs=new Set(validWorkerRuns.map(x=>x.requestId));
  for(const j of validJobs){
   if(proposalIds.has(j.id)||trackedWorkerJobs.has(j.id))continue;
   rows.push(freeze({...j,stage:j.last==='failed'?'needs_attention':
    j.last==='reported'?'diagnosed':'in_progress'}));
  }
  for(const run of validWorkerRuns){
   if(proposalIds.has(run.requestId))continue;
   rows.push(run);
  }
  if(Array.isArray(teamJobs))for(const entry of teamJobs.slice(0,MAX)){
   const item=teamHandoff(entry);
   if(item&&!trackedWorkerJobs.has(item.requestId)&&!proposalIds.has(item.requestId))rows.push(item);
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
 function create(host,{load,approve,reject,publishPokemon,rejectPokemon,runWorker,runSourceFact,openMatt,openProject,
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
   }else if(item.kind==='pokemon-proposal'){
    card.append(e('strong','human-hub-mini-title','Προτεινόμενη αλλαγή από τον Joey'));
    card.append(e('p','human-hub-summary',item.summary));
    card.append(e('p','human-hub-caution',
     'Αυτή είναι πρόταση AI και ΔΕΝ έχει δοκιμαστεί ή εφαρμοστεί στο παιχνίδι.'));
    const details=e('details','human-hub-technical');
    details.append(e('summary','','Δες την ακριβή αλλαγή πριν εγκρίνεις'));
    for(const file of item.files){
     const section=e('details','human-hub-file');
     section.append(e('summary','',file.path+' · '+file.sha.slice(0,10)));
     section.append(e('h4','','Τρέχουσα πηγή (γραμμές)'),
      e('pre','',file.before),e('h4','','Προτεινόμενο αρχείο'),
      e('pre','',file.after));
     details.append(section);
    }
    card.append(details);
    if(item.status==='pending_review'){
     const actions=e('div','human-hub-item-actions');
     const publish=button('Εγκρίνω Draft PR',()=>performPokemon('publish',item),'human-hub-yes');
     publish.disabled=opBusy||loading;
     actions.append(publish,button('Απόρριψη',()=>performPokemon('reject',item),
      'human-hub-no'));
     card.append(actions);
    }else if(item.status==='draft_created'&&item.draftUrl){
     const link=e('a','human-hub-tech-link','Άνοιξε το Draft PR στο GitHub');
     link.href=item.draftUrl;link.target='_blank';
     link.rel='noopener noreferrer';card.append(link);
    }
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
   }else if(item.kind==='worker-run'){
    card.append(e('p','human-hub-summary',item.status==='reported'?
     'Ο Worker ολοκλήρωσε επαληθευμένη διερεύνηση μόνο για ανάγνωση. '+
     'Δεν έγιναν αλλαγές αρχείων ή deployment.':
     item.status==='failed'?
     'Η διερεύνηση απέτυχε ή διακόπηκε. Για νέα εκτέλεση απαιτείται νέο αίτημα '+
     'και νέα έγκριση· δεν επανεκτελείται αυτόματα.':
     'Η διερεύνηση καταγράφηκε ως εκκρεμής. Αν η σύνδεση διακόπηκε, '+
     'δεν ξεκινά ξανά μόνη της και χρειάζεται νέο εγκεκριμένο αίτημα.'));
   }else if(item.kind==='handoff'){
    card.append(e('p','human-hub-summary',item.status==='awaiting_consent'?
     'Ο Matt συμβουλεύτηκε τον Director και πρότεινε διερεύνηση από Worker. '+
     'Η ανάθεση καταγράφηκε, αλλά δεν άρχισε εκτέλεση. Η πρόσθετη έγκριση '+
     'ζητείται στη συνομιλία με τον Matt.':
     'Ο Director απάντησε στον Matt. Αυτή είναι καταγραφή συμβουλής, '+
     'όχι εκτελεσμένη αλλαγή ή ολοκληρωμένη εργασία.'));
    if(item.status==='awaiting_consent'&&
     ['listening-developer','pokemon-developer'].includes(item.workerId)&&
     typeof runWorker==='function'){
     const actions=e('div','human-hub-item-actions');
     const start=button('Έγκριση ελέγχου από Worker',()=>executeWorker(item),'human-hub-yes');
     start.disabled=opBusy||loading;
     actions.append(start);
     if(typeof runSourceFact==='function'){
      const check=button('Έλεγχος πηγών · χωρίς AI',()=>executeSourceFact(item),'human-hub-no');
      check.disabled=opBusy||loading;
      actions.append(check);
     }
     card.append(actions);
    }
   }else card.append(e('p','human-hub-summary',
     item.stage==='completed'?'Την ολοκλήρωση την σημείωσες εσύ.':
      'Προσωπική εργασία · δεν σημαίνει ότι εκτελέστηκε από AI agent.'));
   return card;
  }
  async function executeSourceFact(item){
   if(opBusy||loading||!item||item.kind!=='handoff'||
    item.status!=='awaiting_consent'||typeof runSourceFact!=='function')return;
   opBusy=true;error='';render();
   try{
    const raw=await load();
    const matches=Array.isArray(raw?.teamJobs)&&raw.teamJobs.some(j=>
     j.id===item.id&&j.requestId===item.requestId&&
     j.status==='awaiting_consent'&&j.workerId===item.workerId&&
     j.directorId===item.directorId&&j.summary===item.summary);
    const used=Array.isArray(raw?.workerRuns)&&raw.workerRuns.some(j=>
     j.requestId===item.requestId);
    if(!matches||used||raw?.workerHistoryUnavailable===true||
     raw?.teamUnavailable===true)throw Error('Δεν επιβεβαιώθηκε η εργασία.');
    if(!window.confirm('Να ελέγξει ο Worker μόνο τα επιτρεπόμενα αρχεία GitHub;\\n\\n'+
     item.summary+'\\n\\nΜηδέν κλήσεις AI, μηδέν αλλαγές κώδικα, '+
     'μηδέν PR ή deployment. Η εργασία δεν επαναλαμβάνεται αυτόματα.'))return;
    const result=await runSourceFact(item);
    if(result?.modelCalls!==0||result?.changedFiles!==0||
     result?.execution!=='read_only_source_facts')
     throw Error('Η εκτέλεση δεν επιβεβαιώθηκε.');
    if(typeof onChanged==='function')onChanged('source',item);
   }catch(err){markError(err?.message||'Ο έλεγχος πηγών απέτυχε.')}
   finally{
    const failure=error;opBusy=false;
    await refresh();
    if(failure){markError(failure);render()}
   }
  }
  async function executeWorker(item){
   if(opBusy||loading||!item||item.kind!=='handoff'||
    item.status!=='awaiting_consent'||typeof runWorker!=='function')return;
   opBusy=true;error='';render();
   try{
    const raw=await load();
    const fresh=Array.isArray(raw?.teamJobs)?raw.teamJobs.find(x=>
     x.id===item.id&&x.requestId===item.requestId&&
     x.status==='awaiting_consent'&&x.workerId===item.workerId&&
     x.directorId===(item.workerId==='pokemon-developer'?
      'pokemon-director':'listening-director')):null;
    const used=Array.isArray(raw?.workerRuns)&&raw.workerRuns.some(x=>
     x.requestId===item.requestId);
    if(!fresh||used||raw?.workerHistoryUnavailable===true||
     raw?.teamUnavailable===true)
     throw Error('Η ανάθεση δεν επιβεβαιώθηκε ή έχει ήδη εκτελεστεί.');
    const scope=item.workerId==='pokemon-developer'?
     'Θα διαβαστεί μόνο το ιδιωτικό project.godot του Pokémon Echoes.':
     'Θα διαβαστούν μόνο τα επιτρεπόμενα αρχεία του Listening Mirror.';
    if(!window.confirm('Εγκρίνεις ΜΙΑ εκτέλεση του Worker για την εργασία;\\n\\n'+
     item.summary+'\\n\\n'+scope+
     '\\n\\nΈως 5 AI κλήσεις με επαληθευμένο όριο επιπλέον χρέωσης $0. '+
     'Μόνο ανάγνωση, χωρίς αλλαγές αρχείων, PR ή deployment. '+
     'Αν διακοπεί, δεν γίνεται αυτόματη επανάληψη.'))return;
    await runWorker(item);
    if(typeof onChanged==='function')onChanged('worker',item);
   }catch(err){markError(err?.message||'Η διερεύνηση δεν ολοκληρώθηκε.')}
   finally{
    const failure=error;
    opBusy=false;
    await refresh();
    if(failure){markError(failure);render()}
   }
  }
  async function performPokemon(action,item){
   if(opBusy||loading||item?.kind!=='pokemon-proposal'||
    item.status!=='pending_review'||!DIGEST.test(item.digest||''))return;
   const callback=action==='publish'?publishPokemon:rejectPokemon;
   if(typeof callback!=='function')return;
   opBusy=true;error='';render();
   try{
    const raw=await load();
    if(raw?.pokemonUnavailable===true)throw Error('Η κατάσταση της πρότασης δεν επιβεβαιώθηκε.');
    const fresh=Array.isArray(raw?.pokemonProposals)?
     raw.pokemonProposals.map(pokemonProposal).find(p=>
      p?.id===item.id&&p.status==='pending_review'&&
      p.digest===item.digest&&p.files[0]?.sha===item.files[0]?.sha&&
      p.files[0]?.path===item.files[0]?.path&&
      p.files[0]?.after===item.files[0]?.after):null;
    if(!fresh)throw Error('Η πρόταση άλλαξε ή έχει ήδη εξεταστεί.');
    const question=action==='publish'?
     'Να δημιουργηθεί ΜΟΝΟ Draft PR στο ιδιωτικό Pokémon Echoes;\\n\\n'+
     item.summary+'\\nΑρχείο: '+item.files[0].path+
     '\\n\\nΗ αλλαγή ΔΕΝ έχει δοκιμαστεί. Δες πρώτα την πλήρη '+ 
     'αντικατάσταση του αρχείου. Δεν θα γίνει merge ή deployment. '+
     'Χρειάζεται εγκεκριμένη σύνδεση GitHub για private repositories.':
     'Να απορριφθεί οριστικά αυτή η προτεινόμενη αλλαγή;';
    if(!window.confirm(question))return;
    await callback(item);
    if(typeof onChanged==='function')onChanged(action,item);
   }catch(err){markError(err?.message||'Η ενέργεια απέτυχε.')}
   finally{
    const failure=error;opBusy=false;
    await refresh();
    if(failure){markError(failure);render()}
   }
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
   const shown=current.rows.filter(item=>compact?
    item.stage==='decision'||(item.kind==='handoff'&&item.status==='awaiting_consent'):
    visible(item));
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
   }catch(err){
    // Fail closed: never keep showing a previously actionable proposal when
    // the authenticated reload could not verify its current server state.
    current=project();
    markError('Δεν ήταν δυνατή η επιβεβαίωση των τωρινών εργασιών. '+
     'Οι προηγούμενες αποφάσεις κρύφτηκαν για ασφάλεια. '+
     (err?.message||'Δοκίμασε ξανά.'));
   }
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
 return freeze({project,stateLabel,create,job,proposal,pokemonProposal,manual,teamHandoff,workerRun});
});
