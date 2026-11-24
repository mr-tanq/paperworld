(()=>{'use strict';
const host=document.querySelector('#project-room'),model=window.PaperworldProjects,client=window.PaperworldCloud.createClient();
let room='town',tasks=[],allTasks=[],busy=false,message='',edit=null,active=false;
let memoryOpen=false,memoryView=null,historyImportView=null;
// Display-only proposals. No approval grant or server write capability.
let listeningReviewPayload=null,listeningStoredProposals=[],listeningProposalError='';
let workJobs=[],teamJobs=[],workerRuns=[],pokemonProposals=[],autonomyReports=[],pokemonUnavailable=false,jobHistoryError='',teamHistoryError='',humanHub=null;
let autonomousMissions=[],autonomousHistoryError='';
let controllerStatus=null;


const el=(tag,text,cls)=>{let e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const btn=(text,fn,cls)=>{let b=el('button',text,cls);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b};
const note=(s,isError=false)=>{message=(isError?'Error: ':'')+s;render()};
async function work(fn){if(busy)return;busy=true;message='';render();try{await fn()}catch(e){message='Error: '+e.message}finally{busy=false;render()}}
async function publicAutonomyReports(){
 const feed=window.PaperworldAutonomyFeed;
 if(!feed?.load)return [];
 try{return await feed.load()}catch(_){return []}
}
async function reload(){
 allTasks=await client.list();
 tasks=allTasks.filter(t=>t.room===room);
 try{
  const history=await client.mattJobHistory();
  workJobs=history.jobs;jobHistoryError='';
 }catch(e){workJobs=[];jobHistoryError='Δεν φορτώθηκε το ιστορικό εργασιών: '+e.message}
 try{const team=await client.teamHandoffHistory();
  teamJobs=team.jobs;workerRuns=Array.isArray(team.workerRuns)?team.workerRuns:[];
  teamHistoryError=team.workerHistoryUnavailable?'Το ιστορικό Workers δεν φορτώθηκε.':'';
 }catch(e){teamJobs=[];workerRuns=[];teamHistoryError='Οι αναθέσεις V5 δεν είναι διαθέσιμες.'}
 try{pokemonProposals=await client.listPokemonProposals();pokemonUnavailable=false}
 catch(_){pokemonProposals=[];pokemonUnavailable=true}
 try{
  listeningStoredProposals=await client.listListeningProposals();
  listeningProposalError='';
 }catch(e){
  listeningStoredProposals=[];
  listeningProposalError='Δεν φορτώθηκαν οι προτάσεις: '+e.message;
 }
 try{autonomousMissions=await client.listAutonomousMissions();autonomousHistoryError=''}
 catch(_){autonomousMissions=[];autonomousHistoryError='Δεν φορτώθηκαν οι αυτόνομες αποστολές.'}
 try{controllerStatus=await client.autonomousControllerStatus()}catch(_){controllerStatus=null}
 autonomyReports=await publicAutonomyReports();
}
function loginForm(){let f=el('form');let email=el('input'),password=el('input');email.type='email';email.required=true;email.placeholder='Email';email.autocomplete='email';password.type='password';password.required=true;password.minLength=6;password.placeholder='Password';password.autocomplete='current-password';f.append(email,password);
let sign=el('button','Sign in','primary');sign.type='submit';f.append(sign,btn('Create account',()=>work(async()=>{let ready=await client.signup(email.value.trim(),password.value);if(ready)await reload();else message='Check your email for the confirmation message, then sign in.'})));
f.addEventListener('submit',e=>{e.preventDefault();work(async()=>{await client.login(email.value.trim(),password.value);await reload()})});return f}
function form(t){let f=el('form',undefined,'room-task-form');let title=el('input'),notes=el('textarea');title.value=t?.title||'';notes.value=t?.notes||'';title.placeholder='Task title';title.required=true;title.maxLength=160;notes.placeholder='Notes';notes.maxLength=1500;notes.rows=3;
let b=el('button',t?'Save changes':'Add cloud task','primary');b.type='submit';f.append(title,notes,b,btn('Cancel',()=>{edit=null;render()}));
f.addEventListener('submit',e=>{e.preventDefault();work(async()=>{if(t)await client.update(t.id,{title:title.value,notes:notes.value});else await client.add(room,title.value,notes.value);edit=null;await reload()})});return f}
function taskRow(t){let card=el('article',undefined,'room-task'),top=el('div',undefined,'room-task-top'),sel=el('select');for(const [id,label] of [['todo','To do'],['doing','In progress'],['done','Done']]){let o=el('option',label);o.value=id;o.selected=id===t.status;sel.append(o)}sel.disabled=busy;sel.setAttribute('aria-label','Task status: '+t.title);sel.addEventListener('change',()=>work(async()=>{await client.update(t.id,{status:sel.value});await reload()}));top.append(el('strong',t.title),sel);card.append(top);if(t.notes)card.append(el('p',t.notes,'room-task-notes'));let ops=el('div',undefined,'room-ops');ops.append(btn('Edit',()=>{edit=t;render()}),btn('Delete',()=>{if(confirm('Permanently delete this cloud task?'))work(async()=>{await client.remove(t.id);await reload()})},'danger'));card.append(ops);return card}
function migration(){let sec=el('section',undefined,'cloud-import'),store;try{store=model.createStore(localStorage)}catch(_){}
sec.append(el('h4','Copy tasks from this tablet'));
if(!store||store.warning){sec.append(el('p','Local tasks cannot be read safely.'));return sec}
let originals=store.snapshot().tasks;sec.append(el('p',originals.length+' local tasks found. Originals will remain on this device.'));
sec.append(btn('Preview and copy',()=>work(async()=>{const plan=client.prepareImport(originals,await client.list());if(!plan.incoming.length){message='No new local tasks to import.';return}if(!confirm('Copy '+plan.incoming.length+' local tasks into your private cloud? Existing local tasks will be preserved.')){message='Import cancelled.';return}const result=await client.importTasks(originals);await reload();message='Imported '+result.imported+', skipped '+result.skipped+'.'})));return sec}
function openDirectorMemory(){
 if(busy)return;
 const module=window.PaperworldDirectorMemoryReview;
 if(!module?.createView){note('Το Director Memory Review δεν φορτώθηκε.',true);return}
 if(!memoryView)memoryView=module.createView({
  document,load:projectId=>client.listDirectorMemory(projectId),
  // The owner-approved audit migration is installed. The confirmation UI
  // becomes active only when this PR is separately merged and deployed.
  // Every individual decision re-verifies Supabase Auth and uses owner RLS.
  enableReview:true,
  requestReview:args=>client.reviewDirectorMemory(args),
  confirmBatch:({projectId,entries})=>{
   if(!Array.isArray(entries)||entries.length<1||entries.length>100)return false;
   const labels={town:'Matt',workshop:'Luna',studio:'Crow',pokemon:'Joey',wellbeing:'Dave'};
   if(!Object.prototype.hasOwnProperty.call(labels,projectId)||
      entries.some(x=>x.projectId!==projectId))return false;
   const preview=entries.map((x,i)=>(i+1)+'. '+x.rowTitle+
    ' · '+x.sourceType+' / '+x.sourceRef+
    (x.sensitivity==='private'?' · ΙΔΙΩΤΙΚΟ':'')).join('\n');
   return window.confirm('Ενεργοποίηση '+entries.length+' αναμνήσεων για '+labels[projectId]+';'+
    '\n\n'+preview+
    '\n\nΟι ιδιωτικές πληροφορίες θα μπορούν να χρησιμοποιηθούν '+
    'ως πλαίσιο στην εγκεκριμένη AI συνομιλία αυτού του Director. '+
    'Κάθε αλλαγή καταγράφεται χωριστά. '+
    'Δεν δίνεται πρόσβαση σε άλλους Directors ή δικαίωμα εργασιών.\n\nΕγκρίνεις;');
  },
  confirmDecision:({entry,decision})=>window.confirm(
   (decision==='approved'?'Να εγκριθεί αυτή η ανάμνηση;':'Να απορριφθεί αυτή η ανάμνηση;')+
   '\n\n'+entry.title+'\n'+entry.body+
   '\n\nΠηγή: '+entry.sourceType+' / '+entry.sourceRef+
   '\n\nΗ απόφαση αφορά μόνο αυτή την καταχώριση.'
  )
 });
 if(!historyImportView&&window.PaperworldHistoryImportUI?.createView&&
  window.PaperworldHistoryImport?.prepare){
  historyImportView=window.PaperworldHistoryImportUI.createView({
   document,parser:window.PaperworldHistoryImport,
   upload:args=>client.proposeDirectorHistory(args),
   confirm:({projectId,title,count,total})=>{
    const labels={workshop:'Luna',pokemon:'Joey',studio:'Crow',wellbeing:'Dave'};
    if(!Object.prototype.hasOwnProperty.call(labels,projectId))return false;
    return window.confirm('Αποθήκευση '+count+' από '+total+' τμήματα της συνομιλίας "'+
     title+'" στη μνήμη '+labels[projectId]+';'+
     '\n\nΘα μεταφερθούν στο ιδιωτικό σου Supabase ως ΜΗ εγκεκριμένα.'+
     '\nΤο αρχικό αρχείο δεν ανεβαίνει. Ενδέχεται να περιέχουν ευαίσθητα '+
     'στοιχεία ή ανέκδοτο υλικό.\n\nΣυνέχεια;');
   },
   afterImport:async()=>{
    const target=host.querySelector('#director-memory-panel');
    if(target&&memoryView)await memoryView.refresh(target);
   }
  });
 }
 memoryOpen=true;render();
 const target=host.querySelector('#director-memory-panel');
 if(target)memoryView.refresh(target);
}
function renderDirectorMemory(){
 const section=el('section',undefined,'director-memory-desk');
 section.id='director-memory-panel';
 const focus=document.querySelector('#world-drawer')?.classList.contains('pw-classic-focus');
 host.append(btn(focus?'← Πίσω στις Ρυθμίσεις':'← Επιστροφή στις εργασίες',()=>{
  memoryOpen=false;
  if(focus){document.querySelector('#world-drawer').hidden=true;window.PaperworldWorkspace?.open?.('settings');return}
  render()
 }));
 host.append(section);
 if(memoryView)memoryView.draw(section);
 if(historyImportView){
  const importer=el('section',undefined,'director-history-import-panel');
  host.append(importer);historyImportView.draw(importer);
 }
}
function render(){
 if(!active)return;
 host.hidden=false;host.replaceChildren();
 if(!client.signedIn()){
  host.append(el('h2','PAPERWORLD · Σύνδεση'),el('p','Συνδέσου για να δεις την ομάδα και τις εργασίες σου.'),loginForm());return;
 }
 const top=el('div',undefined,'room-heading');
 top.append(el('h2',room==='workshop'?'Listening Mirror · Η ομάδα μου':room==='town'?'Οι εργασίες μου':model.ROOMS.find(r=>r.id===room).name));
 top.append(btn('Πίσω στο χωριό',()=>{active=false;window.PaperworldRooms.open(room,true)}));
 host.append(top);
 if(message)host.append(el('p',message,message.startsWith('Error:')?'room-error':'room-notice'));
 if(busy)host.append(el('p','Ένα λεπτό…','room-footnote'));
 const userBar=el('div',undefined,'room-ops');
 userBar.append(el('small',client.identity()),
  btn('Ανανέωση',()=>work(reload)),
  btn('Μνήμη Directors',openDirectorMemory),
  btn('Sign out',()=>work(async()=>{await client.signout();tasks=[];allTasks=[];edit=null})));
 const settings=el('details',undefined,'human-hub-account-settings');
 settings.append(el('summary','Λογαριασμός και ρυθμίσεις'));
 settings.append(userBar);
 host.append(settings);
 if(memoryOpen){renderDirectorMemory();return}
 if(room==='workshop'){
  renderWorkshop();return;
 }
 renderChiefOrRoom();
}
// The Village Hub is driven by authenticated real jobs and persisted proposals.
// No model call, write grant or fabricated task status is created by this view.
async function loadHumanWork(){
 const results=await Promise.all([client.mattJobHistory(),
  client.listListeningProposals(),client.list(),
  client.teamHandoffHistory().catch(()=>({jobs:[],unavailable:true})),
  client.listPokemonProposals().then(proposals=>({proposals})).catch(()=>({proposals:[],unavailable:true})),
  publicAutonomyReports()]);
 return {jobs:results[0].jobs,proposals:results[1],tasks:results[2],
  teamJobs:results[3].jobs,workerRuns:results[3].workerRuns||[],
  teamUnavailable:results[3].unavailable===true,
  workerHistoryUnavailable:results[3].workerHistoryUnavailable===true,
  pokemonProposals:results[4].proposals,pokemonUnavailable:results[4].unavailable===true,
  autonomyReports:results[5]};
}
async function preparePokemonSolution(item){
 const r=await client.publishPokemonProposal(item.jobId,item.digest);
 if(r.created!==true||r.draft!==true||r.merged!==false)throw Error('Pokémon Draft PR not verified');
 message='Το Draft PR δημιουργήθηκε για έλεγχο. Δεν έγινε merge.';
 await reload();render();return r;
}
async function discardPokemonSolution(item){
 await client.rejectPokemonProposal(item.jobId,item.digest);
 message='Η πρόταση του Joey απορρίφθηκε. Δεν έγινε αλλαγή.';
 await reload();render();return true;
}
async function prepareSolution(item){
 const result=await client.publishListeningProposal(item.jobId,item.digest);
 if(result.created!==true||result.draft!==true)
  throw Error('Η αλλαγή δεν επιβεβαιώθηκε.');
 message='Η λύση προετοιμάστηκε για τελικό έλεγχο. Δεν έχει εφαρμοστεί.';
 await reload();render();
 return result;
}
async function discardSolution(item){
 await client.rejectListeningProposal(item.jobId,item.digest);
 message='Η λύση απορρίφθηκε. Δεν έγινε καμία αλλαγή.';
 await reload();render();
}
async function runApprovedSourceFact(item){
 if(!item||item.kind!=='handoff'||item.status!=='awaiting_consent'||
  !['pokemon-developer','listening-developer'].includes(item.workerId)||
  !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(item.requestId||'')||
  typeof item.summary!=='string'||!item.summary.trim())
  throw Error('Invalid source fact handoff');
 const project=item.workerId==='pokemon-developer'?'pokemon':'listening';
 const result=await client.sourceFactWorker(item.summary,{project,requestId:item.requestId});
 message=result.content;
 return result;
}
async function runApprovedHandoff(item){
 if(!item||item.kind!=='handoff'||item.status!=='awaiting_consent'||
  !['pokemon-developer','listening-developer'].includes(item.workerId)||
  typeof item.summary!=='string'||!item.summary.trim()||
  !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(item.requestId||''))
  throw Error('Invalid approved Worker handoff');
 const options={saveNote:false,requestId:item.requestId};
 const result=item.workerId==='pokemon-developer'?
  await client.delegatePokemonWorker(item.summary,options):
  await client.delegateMattWorker(item.summary,options);
 if(result?.executed!==true||result?.delegated!==true||
  result?.requestId!==item.requestId||
  typeof result.content!=='string')throw Error('Worker result was not verified');
 message='Ο Worker επέστρεψε αναφορά. '+result.content.slice(0,1000);
 return result;
}
function renderAutonomousMissions(target){
 const activity=window.PaperworldVillageActivity,card=el('section',undefined,'village-progress');
 card.append(el('h3','Τι κάνει η ομάδα'));
 if(!activity){card.append(el('p','Η ενημέρωση δεν είναι διαθέσιμη.','room-footnote'));target.append(card);return}
 const summary=activity.summary(autonomousMissions);
 if(!summary.items.length)card.append(el('p','Δεν υπάρχουν ακόμη εργασίες. Πες στον Matt τι χρειάζεσαι.','room-footnote'));
 else{
  const info=[];
  if(summary.active)info.push(summary.active+' σε εξέλιξη');
  if(summary.attention)info.push(summary.attention+' χρειάζονται προσοχή');
  if(summary.finished)info.push(summary.finished+' ολοκληρώθηκαν');
  if(info.length)card.append(el('p',info.join(' · '),'room-footnote'));
  for(const item of summary.items.slice(0,8)){
   const line=el('article',undefined,'room-task village-progress-item');
   line.append(el('strong',item.person+' · '+({listening:'Listening Mirror',pokemon:'Pokémon: Echoes',studio:'The Lost Wanderer',wellbeing:'Wellbeing'}[item.projectId])),
    el('p',item.title,'room-task-notes'),el('p',item.message,'room-footnote'));
   if(item.cause)line.append(el('p','Τι έφταιγε: '+item.cause,'room-task-notes'));
   if(item.fix)line.append(el('p','Τι αλλάξαμε: '+item.fix,'room-task-notes'));
   if(item.resultNote)line.append(el('p',item.resultNote,'room-footnote'));
   if(item.resultLink){const link=el('a',item.resultLabel,'human-hub-tech-link');
    link.href=item.resultLink;link.target='_blank';link.rel='noopener noreferrer';line.append(link)}
   card.append(line);
  }
 }
 if(autonomousHistoryError)card.append(el('p','Δεν κατάφερα να ενημερώσω τις εργασίες.','room-footnote'));
 card.append(btn('Μίλα στον Matt',()=>window.PaperworldWorldDialogue?.show('matt'),'primary'));
 target.append(card);
}
function renderHumanWork(target){
 const module=window.PaperworldHumanFirstHub;
 if(!module?.create){target.append(el('p','Το κέντρο εργασιών δεν φορτώθηκε.','room-footnote'));return}
 renderAutonomousMissions(target);
 const mount=el('div',undefined,'human-hub-mount');
 target.append(mount);
 humanHub=module.create(mount,{load:loadHumanWork,
  approve:prepareSolution,reject:discardSolution,
  publishPokemon:preparePokemonSolution,rejectPokemon:discardPokemonSolution,
  runWorker:runApprovedHandoff,runSourceFact:runApprovedSourceFact,
  openMatt:()=>window.PaperworldWorldDialogue?.show('matt'),
  openProject:()=>{room='workshop';render()},
  onError:e=>{jobHistoryError=e}
 });
 humanHub.setData({jobs:workJobs,proposals:listeningStoredProposals,pokemonProposals,autonomyReports,tasks:allTasks,teamJobs,workerRuns});
 if(jobHistoryError||listeningProposalError||teamHistoryError){
  target.append(el('p',[jobHistoryError,listeningProposalError,teamHistoryError].filter(Boolean).join(' · '),'room-footnote'));
 }
}
function renderWorkshop(){
 // Any Listening Mirror request belongs in the same general project workspace.
 // Project diagnosis and worker routing must come from authorized AI, not keywords.
 const section=el('section',undefined,'developer-chat');
 section.append(el('h3','Listening Mirror'));
 section.append(el('p','Πες στον Matt τι χρειάζεσαι. Η ομάδα θα διερευνήσει το πρόβλημα και θα σου παρουσιάσει μια λύση για έγκριση.','room-footnote'));
 section.append(btn('Μίλα στον Matt',()=>{
  if(window.PaperworldWorldDialogue?.show)window.PaperworldWorldDialogue.show('matt');
  else note('Το Messenger δεν είναι διαθέσιμο.',true);
 },'primary'));
 host.append(section);
 const tasksPanel=el('section',undefined,'developer-tasks');
 tasksPanel.append(el('h3','Εργασίες του project'));
 tasksPanel.append(btn('+ Νέα εργασία',()=>{edit=true;render()},'primary'));
 if(edit)tasksPanel.append(form(edit===true?null:edit));
 for(const task of tasks)tasksPanel.append(taskRow(task));
 renderHumanWork(host);
 const manual=el('details',undefined,'human-hub-manual');
 manual.append(el('summary','Χειροκίνητες εργασίες project (προαιρετικά)'));
 manual.append(tasksPanel);host.append(manual);
 const reviewHost=el('div',undefined,'listening-review-host');
 const reviewModule=window.PaperworldListeningReview;
 const publish=(summary,digest)=>{
  if(!window.confirm('Εγκρίνεις να ετοιμάσουμε την προτεινόμενη λύση;\n\n'+
   summary.summary+'\n\n'+
   'Θα δημιουργηθεί μόνο μια προτεινόμενη αλλαγή για έλεγχο. '+
   'Η εφαρμογή ΔΕΝ αλλάζει τώρα. Δεν θα γίνει αυτόματο merge ή δημοσίευση.'))return;
  work(async()=>{
   const result=await client.publishListeningProposal(summary.jobId,digest);
   await reload();
   message='Η λύση προετοιμάστηκε για τελικό έλεγχο. Δεν έχει εφαρμοστεί στην εφαρμογή. '+result.url;
  });
 };
 const reject=(summary,digest)=>{
  if(!window.confirm('Να απορρίψουμε οριστικά αυτή τη λύση; Δεν θα εφαρμοστεί καμία αλλαγή.'))return;
  work(async()=>{
   await client.rejectListeningProposal(summary.jobId,digest);
   await reload();message='Η πρόταση απορρίφθηκε. Δεν έγινε καμία αλλαγή.';
  });
 };
 reviewHost.append(el('h3','Τεχνικός έλεγχος (προαιρετικά)'));
 reviewHost.append(el('p','Η ομάδα προτείνει, εσύ αποφασίζεις. Καμία αλλαγή δεν εφαρμόζεται χωρίς ξεχωριστή έγκριση.','room-footnote'));
 reviewHost.append(btn('Ανανέωση',()=>work(reload),'human-first-utility'));
 const advanced=el('details','human-first-settings');
 advanced.append(el('summary','', 'Ρυθμίσεις σύνδεσης (προαιρετικά)'));
 advanced.append(btn('Σύνδεση GitHub για προετοιμασία αλλαγών',()=>work(async()=>{
  const link=await client.beginGithubLink();
  window.location.assign(link);
 })));
 advanced.append(el('p','Η σύνδεση ζητά πρόσβαση public_repo και επιτρέπει μόνο την προετοιμασία Draft PR του Listening Mirror. Δεν γίνεται αυτόματη εφαρμογή.','room-footnote'));
 reviewHost.append(advanced);
 if(listeningProposalError)reviewHost.append(el('p',listeningProposalError,'room-footnote'));
 if(listeningStoredProposals.length){
  for(const proposal of listeningStoredProposals.slice(0,8)){
   const place=el('div',undefined,'listening-stored-review');
   const review=reviewModule?.create(place,{publish,reject});
   if(review){
    try{review.show(proposal.plan,proposal.evidence,{
     persisted:true,status:proposal.status,digest:proposal.digest
    })}catch(_){place.append(el('p','Μη έγκυρη αποθηκευμένη πρόταση.','room-footnote'))}
   }
   if(proposal.status==='draft_created'&&
    /^https:\/\/github\.com\/mr-tanq\/concerts\/pull\/[1-9][0-9]*$/.test(proposal.draftUrl||'')){
    const link=document.createElement('a');
    link.href=proposal.draftUrl;
    link.textContent='Τεχνικός έλεγχος στο GitHub (προαιρετικά)';
    link.target='_blank';link.rel='noopener noreferrer';
    place.append(link);
   }
   reviewHost.append(place);
  }
 }else{
  const review=reviewModule?.create(reviewHost);
  if(review&&listeningReviewPayload){
   try{review.show(listeningReviewPayload.plan,listeningReviewPayload.evidence)}
   catch(_){listeningReviewPayload=null;review.clear()}
  }
 }
 const technical=el('details',undefined,'human-hub-legacy village-maintenance-only');
 technical.append(el('summary','Τεχνικές ρυθμίσεις και λεπτομέρειες'));
 technical.append(reviewHost);
 host.append(technical);
}
function renderMattConversation(){
 const sec=el('section',undefined,'developer-chat');
 sec.append(el('h3','Matt · Chief of Staff'));
 sec.append(el('p','Μίλα στον Matt όπως σε έναν συνεργάτη. Εκείνος βρίσκει ποιος μπορεί να βοηθήσει και σου λέει πότε υπάρχει αποτέλεσμα.','room-footnote'));
 sec.append(el('p','Για σημαντικές αποφάσεις ή επιπλέον κόστος θα ζητηθεί η έγκρισή σου.','room-footnote'));
 sec.append(btn('Σύνδεσε το GitHub',()=>work(async()=>{
  const authorizationUrl=await client.beginGithubLink();
  // Redirect only to verified github.com OAuth authorization URL.
  window.location.assign(authorizationUrl);
 }),'primary'));
 const githubDiagnostics=el('div',undefined,'village-maintenance-only');
 githubDiagnostics.append(btn('Έλεγχος σύνδεσης GitHub',()=>work(async()=>{
  const status=await client.githubLinkStatus();
  message=status.connected?'GitHub συνδεδεμένο: '+status.login+
   ' · προσωρινή σύνδεση (Render Free). Καμία AI κλήση.':
   'Δεν υπάρχει ενεργή σύνδεση GitHub. Πάτησε «Σύνδεσε το GitHub».';
 })));
 sec.append(githubDiagnostics);
 sec.append(btn('Άνοιξε το Messenger του Matt',()=>{
  if(!window.PaperworldWorldDialogue?.show){note('Το παράθυρο Messenger δεν φορτώθηκε.',true);return}
  window.PaperworldWorldDialogue.show('matt');
 },'primary'));
 return sec;
}
function renderChiefOrRoom(){
 const tabs=el('div',undefined,'room-tabs');
 for(const r of model.ROOMS)tabs.append(btn(r.name,()=>work(async()=>{room=r.id;edit=null;await reload()}),r.id===room?'selected':''));
 host.append(tabs);
 if(room==='town'){
  renderHumanWork(host);
  host.append(renderMattConversation());
  host.append(el('p','Μίλησε στον Matt όπως σε έναν συνεργάτη. Οι πραγματικές εργασίες και οι αποφάσεις σου εμφανίζονται εδώ.','room-footnote'));
  const overview=el('div',undefined,'overview-projects');
  for(const r of model.ROOMS){
   const count=allTasks.filter(t=>t.room===r.id&&t.status!=='done').length;
   overview.append(btn(r.name+' · '+count+' εκκρεμότητες',()=>work(async()=>{
    room=r.id;edit=null;await reload()
   }),'overview-project'))
  }
  host.append(overview)
 }else{
  host.append(el('h3',model.ROOMS.find(r=>r.id===room).name));
  host.append(el('p',tasks.length+' cloud tasks','room-stats'))
 }
 if(room!=='town'){
  const notes=el('details',undefined,'human-hub-manual');
  notes.append(el('summary','Προσωπικές σημειώσεις (προαιρετικά)'));
  if(edit)notes.append(form(edit===true?null:edit));
  else notes.append(btn('+ Νέα σημείωση',()=>{edit=true;render()},'primary'));
  for(const task of tasks)notes.append(taskRow(task));
  host.append(notes);
 }
 if(room==='town'){
  const pending=allTasks.filter(t=>t.status==='todo'||t.status==='doing');
  if(pending.length){
   const panel=el('section',undefined,'chief-desk');
   panel.append(el('h3','Ανοιχτές εργασίες'));
   for(const task of pending.slice(0,8)){
    const item=el('div',undefined,'chief-item');
    item.append(el('strong',task.title),el('p',model.ROOMS.find(r=>r.id===task.room)?.name||task.room,'room-footnote'));
    item.append(btn('Άνοιξε project',()=>work(async()=>{room=task.room;await reload()})));
    panel.append(item)
   }
   host.append(panel)
  }
 }else host.append(migration())
}

function open(id='town'){if(model.ROOMS.some(r=>r.id===id))room=id;active=true;edit=null;memoryOpen=false;message='';render();if(client.signedIn())work(reload)}
function focusChief(){
 const item=host.querySelector('.chief-desk');
 if(item){item.scrollIntoView({behavior:'smooth',block:'start'});item.classList.add('chief-focused')}
}
function openChief(){
 open('town');
 if(client.signedIn())setTimeout(focusChief,350);
}
window.PaperworldCloudUI={
 open,openChief,isActive:()=>active,signedIn:()=>client.signedIn(),ownerId:()=>client.ownerId(),
 privateAgentMessages:(id)=>client.agentMessages(id),
 sendPrivateAgentMessage:(id,text)=>client.sendAgentNote(id,text),
 askDirector:(id,text,options)=>client.askDirector(id,text,options),
 previewRoutine:plan=>client.previewRoutine(plan),
 listRoutines:()=>client.listRoutines(),
 createRoutine:plan=>client.createRoutine(plan),
 changeRoutine:(routineId,enabled)=>client.changeRoutine(routineId,enabled),
 updateRoutine:(routineId,changes)=>client.updateRoutine(routineId,changes),
 systemHealth:()=>client.systemHealth(),
 proposeDirectorCorrection:(id,messageId,options)=>client.proposeDirectorCorrection(id,messageId,options),
 // Owner-only, RLS-scoped memory view; review applies to ONE proposed row.
 listDirectorMemory:(projectId)=>client.listDirectorMemory(projectId),
 reviewDirectorMemory:(args)=>client.reviewDirectorMemory(args),
 crowSunoPreview:(brief)=>client.crowSunoPreview(brief),
 crowSunoConnectionStatus:()=>client.crowSunoConnectionStatus(),
 beginSunoLink:()=>client.beginSunoLink(),
 sunoLinkStatus:()=>client.sunoLinkStatus(),
 inspectSunoTools:()=>client.inspectSunoTools(),
 diagnoseSunoConnection:()=>client.diagnoseSunoConnection(),
 createSunoSong:(brief,idempotencyKey,voiceId)=>client.createSunoSong(brief,idempotencyKey,voiceId),
 listSunoVoices:()=>client.listSunoVoices(),
 cancelCrowSunoPreview:(id)=>client.cancelCrowSunoPreview(id),
 askMatt:(text)=>client.askMatt(text),
 delegateMatt:(text,opts)=>client.delegateMatt(text,opts),
 delegateMattWorker:(text,opts)=>client.delegateMattWorker(text,opts),
 delegatePokemonWorker:(text,opts)=>client.delegatePokemonWorker(text,opts),
 mattJobHistory:()=>client.mattJobHistory(),
 teamHandoffHistory:()=>client.teamHandoffHistory(),
 loadHumanWork,runApprovedHandoff,runApprovedSourceFact,
 createAutonomousMission:(projectId,goal)=>client.createAutonomousMission(projectId,goal),
 listAutonomousMissions:()=>client.listAutonomousMissions(),
 listDismissed:()=>client.listDismissed(),
 dismissItem:key=>client.dismissItem(key),
 restoreItem:key=>client.restoreItem(key),
 listProposals:()=>client.listProposals(),
 decideProposal:(id,accept)=>client.decideProposal(id,accept),
 savePushSubscription:sub=>client.savePushSubscription(sub),
 deletePushSubscription:endpoint=>client.deletePushSubscription(endpoint),
 preparePokemonSolution,discardPokemonSolution,
 prepareHumanSolution:prepareSolution,
 discardHumanSolution:discardSolution,
 refreshHumanWork:async()=>{await reload();if(active)render();return {
  jobs:workJobs,proposals:listeningStoredProposals,tasks:allTasks}},
 openHumanWork:()=>{room='town';open('town')},
 diagnoseMattSession:()=>client.diagnoseMattSession(),
 githubLinkStatus:()=>client.githubLinkStatus(),
 beginGithubLink:()=>client.beginGithubLink(),
 // Display-only hook for future trusted proposals. Never implies user consent.
 // Workspace V2 (Team · Work · Settings) uses the same owner-scoped client.
 // Every call is RLS-scoped; nothing here grants new permissions.
 identity:()=>client.identity(),
 signIn:async(email,password)=>{await client.login(email,password);if(active)await reload()},
 signUp:(email,password)=>client.signup(email,password),
 signOut:async()=>{await client.signout();tasks=[];allTasks=[];edit=null},
 listTasks:()=>client.list(),
 addTask:(room,title,notes)=>client.add(room,title,notes),
 updateTask:(id,patch)=>client.update(id,patch),
 removeTask:(id)=>client.remove(id),
 // The classic desk keeps every advanced tool (memory desk, history import,
 // Listening technical review, local task import) reachable from Settings.
 openClassicDesk:async(view='town')=>{const d=document.querySelector('#world-drawer');if(d)d.hidden=false;
  // Memory review opens as one focused page, without the old desk around it.
  d?.classList.toggle('pw-classic-focus',view==='memory');
  const label=d?.querySelector('.world-drawer-head small');if(label)label.textContent=view==='memory'?'ΜΝΗΜΗ ΤΗΣ ΟΜΑΔΑΣ':'ΟΙ ΕΡΓΑΣΙΕΣ ΜΟΥ';
  open(view==='memory'?'town':view);
  if(view==='memory'&&client.signedIn()){
   // Wait for the reload that open() started; the desk refuses while busy.
   for(let i=0;i<50&&busy;i++)await new Promise(r=>setTimeout(r,200));
   openDirectorMemory();
  }},
 previewListeningChange:(plan,evidence)=>{
  if(!window.PaperworldListeningReview)throw Error('Listening review unavailable');
  const snapshot=window.PaperworldListeningReview.summarize(plan,evidence);
  listeningReviewPayload={plan,evidence};
  // Do not steal focus from the Matt Messenger. The user can approve
  // a verified persisted solution inline; the Work Desk remains optional.
  if(active&&room==='workshop')render();
  return snapshot;
 },
 clearListeningChangePreview:()=>{listeningReviewPayload=null;if(active&&room==='workshop')render()}
};
})();
