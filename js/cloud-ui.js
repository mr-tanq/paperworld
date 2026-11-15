(()=>{'use strict';
const host=document.querySelector('#project-room'),model=window.PaperworldProjects,client=window.PaperworldCloud.createClient();
let room='town',tasks=[],allTasks=[],busy=false,message='',edit=null,active=false;
let memoryOpen=false,memoryView=null;
// Display-only proposals. No approval grant or server write capability.
let listeningReviewPayload=null,listeningStoredProposals=[],listeningProposalError='';

const el=(tag,text,cls)=>{let e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const btn=(text,fn,cls)=>{let b=el('button',text,cls);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b};
const note=(s,isError=false)=>{message=(isError?'Error: ':'')+s;render()};
async function work(fn){if(busy)return;busy=true;message='';render();try{await fn()}catch(e){message='Error: '+e.message}finally{busy=false;render()}}
async function reload(){
 allTasks=await client.list();
 tasks=allTasks.filter(t=>t.room===room);
 try{
  listeningStoredProposals=await client.listListeningProposals();
  listeningProposalError='';
 }catch(e){
  listeningStoredProposals=[];
  listeningProposalError='Δεν φορτώθηκαν οι προτάσεις: '+e.message;
 }
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
  confirmDecision:({entry,decision})=>window.confirm(
   (decision==='approved'?'Να εγκριθεί αυτή η ανάμνηση;':'Να απορριφθεί αυτή η ανάμνηση;')+
   '\n\n'+entry.title+'\n'+entry.body+
   '\n\nΠηγή: '+entry.sourceType+' / '+entry.sourceRef+
   '\n\nΗ απόφαση αφορά μόνο αυτή την καταχώριση.'
  )
 });
 memoryOpen=true;render();
 const target=host.querySelector('#director-memory-panel');
 if(target)memoryView.refresh(target);
}
function renderDirectorMemory(){
 const section=el('section',undefined,'director-memory-desk');
 section.id='director-memory-panel';
 host.append(btn('← Επιστροφή στις εργασίες',()=>{
  memoryOpen=false;render()
 }));
 host.append(section);
 if(memoryView)memoryView.draw(section);
}
function render(){
 if(!active)return;
 host.hidden=false;host.replaceChildren();
 if(!client.signedIn()){
  host.append(el('h2','PAPERWORLD · Sign in'),el('p','Sign in to open your private project workspace.'),loginForm());return;
 }
 const top=el('div',undefined,'room-heading');
 top.append(el('h2',room==='workshop'?'Listening Mirror Workshop':room==='town'?'Chief of Staff':model.ROOMS.find(r=>r.id===room).name));
 top.append(btn('Back to local',()=>{active=false;window.PaperworldRooms.open(room,true)}));
 host.append(top);
 if(message)host.append(el('p',message,message.startsWith('Error:')?'room-error':'room-notice'));
 if(busy)host.append(el('p','Working…','room-footnote'));
 const userBar=el('div',undefined,'room-ops');
 userBar.append(el('small',client.identity()),
  btn('Refresh',()=>work(reload)),
  btn('Μνήμη Directors',openDirectorMemory),
  btn('Sign out',()=>work(async()=>{await client.signout();tasks=[];allTasks=[];edit=null})));
 host.append(userBar);
 if(memoryOpen){renderDirectorMemory();return}
 if(room==='workshop'){
  renderWorkshop();return;
 }
 renderChiefOrRoom();
}
function renderWorkshop(){
 // Any Listening Mirror request belongs in the same general project workspace.
 // Project diagnosis and worker routing must come from authorized AI, not keywords.
 const section=el('section',undefined,'developer-chat');
 section.append(el('h3','Listening Mirror'));
 section.append(el('p','Ο αρμόδιος Director και ο Developer θα χειρίζονται οποιοδήποτε αίτημα ανατεθεί από τον Matt. Το AI δεν έχει συνδεθεί ακόμη.','room-footnote'));
 section.append(btn('Μίλα στον Matt',()=>{
  if(window.PaperworldWorldDialogue?.show)window.PaperworldWorldDialogue.show('matt');
  else note('Το Messenger δεν είναι διαθέσιμο.',true);
 },'primary'));
 host.append(section);
 const reviewHost=el('section',undefined,'listening-review-host human-first-decisions');
 const reviewModule=window.PaperworldListeningReview;
 const pendingReviews=listeningStoredProposals.filter(p=>p.status==='pending_review');
 const completedReviews=listeningStoredProposals.filter(p=>p.status!=='pending_review');
 reviewHost.append(el('h3',undefined,pendingReviews.length?
  'Χρειάζεται η απόφασή σου ('+pendingReviews.length+')':'Οι προτάσεις σου'));
 reviewHost.append(el('p','Οι λύσεις παρουσιάζονται απλά. Η τεχνική διαδικασία παραμένει κρυμμένη μέχρι να τη ζητήσεις.','room-footnote'));
 const publish=(summary,digest)=>{
  const lines=summary.files.map(f=>f.path).join(', ');
  if(!window.confirm('Εγκρίνεις να προετοιμάσουμε τη λύση για τελικό έλεγχο;\\n\\n'+
   'Η αλλαγή αφορά '+lines+'.\\n'+
   'Θα δημιουργηθεί μόνο προσχέδιο στο GitHub. ΔΕΝ θα εφαρμοστεί στην εφαρμογή, '+ 
   'δεν θα γίνει merge ή δημοσίευση. Θα ζητηθεί νέα έγκρισή σου για αυτά.'))return;
  work(async()=>{
   const result=await client.publishListeningProposal(summary.jobId,digest);
   await reload();
   message='Η λύση προετοιμάστηκε για τελικό έλεγχο. Δεν εφαρμόστηκε καμία αλλαγή. '+result.url;
  });
 };
 const reject=(summary,digest)=>{
  if(!window.confirm('Να απορρίψουμε αυτή τη λύση; Δεν θα αλλάξει τίποτα στην εφαρμογή.'))return;
  work(async()=>{
   await client.rejectListeningProposal(summary.jobId,digest);
   await reload();message='Η πρόταση απορρίφθηκε. Δεν έγινε καμία αλλαγή.';
  });
 };
 const advanced=el('details',undefined,'human-first-advanced');
 advanced.append(el('summary','Περισσότερες επιλογές'));
 advanced.append(btn('Ανανέωση',()=>work(reload)));
 advanced.append(btn('Σύνδεση GitHub για προετοιμασία αλλαγών',()=>work(async()=>{
  const link=await client.beginGithubLink();
  window.location.assign(link);
 })));
 advanced.append(el('p','Η σύνδεση ζητά άδεια public_repo. Επιτρέπεται μόνο προετοιμασία Draft PR — ποτέ αυτόματο merge ή δημοσίευση.','room-footnote'));
 if(listeningProposalError)reviewHost.append(el('p',listeningProposalError,'room-footnote'));
 if(listeningStoredProposals.length){
  for(const proposal of [...pendingReviews,...completedReviews].slice(0,8)){
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
    link.textContent='Δες την προετοιμασμένη αλλαγή (GitHub)';
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
 reviewHost.append(advanced);
 host.append(reviewHost);
 const tasksPanel=el('section',undefined,'developer-tasks');
 tasksPanel.append(el('h3','Οι εργασίες μου'));
 tasksPanel.append(btn('+ Νέα εργασία',()=>{edit=true;render()},'primary'));
 if(edit)tasksPanel.append(form(edit===true?null:edit));
 for(const task of tasks)tasksPanel.append(taskRow(task));
 
 // First show only decisions that require the owner's attention.
 host.append(tasksPanel);
}
function renderMattConversation(){
 const sec=el('section',undefined,'developer-chat');
 sec.append(el('h3','Matt · Chief of Staff'));
 sec.append(el('p','Μίλα ελεύθερα στον Matt μέσω GitHub Copilot. Η AI συνομιλία ζητά ξεχωριστή έγκριση ανά μήνυμα. Ο Matt μπορεί να απαντήσει και να σχεδιάσει, αλλά δεν μπορεί ακόμη να αναθέσει πραγματική εργασία ή να αλλάξει αρχεία.','room-footnote'));
 sec.append(el('p','GitHub Copilot · οι AI κλήσεις γίνονται μόνο μετά τη δική σου έγκριση ανά μήνυμα και τον έλεγχο διαθέσιμου ορίου.','room-footnote'));
 sec.append(btn('Σύνδεσε το GitHub',()=>work(async()=>{
  const authorizationUrl=await client.beginGithubLink();
  // Redirect only to verified github.com OAuth authorization URL.
  window.location.assign(authorizationUrl);
 }),'primary'));
 sec.append(btn('Έλεγχος σύνδεσης GitHub',()=>work(async()=>{
  const status=await client.githubLinkStatus();
  message=status.connected?'GitHub συνδεδεμένο: '+status.login+
   ' · προσωρινή σύνδεση (Render Free). Καμία AI κλήση.':
   'Δεν υπάρχει ενεργή σύνδεση GitHub. Πάτησε «Σύνδεσε το GitHub».';
 })));
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
  host.append(renderMattConversation());
  host.append(el('p','Εδώ παρακολουθείς όλα τα projects. Ο Matt θα κατευθύνει τα αιτήματα στους κατάλληλους Directors και Workers όταν ενεργοποιηθεί το AI.','room-footnote'));
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
  if(edit)host.append(form(edit===true?null:edit));
  else host.append(btn('+ Νέα εργασία',()=>{edit=true;render()},'primary'));
  for(const task of tasks)host.append(taskRow(task))
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
 open,openChief,isActive:()=>active,signedIn:()=>client.signedIn(),
 privateAgentMessages:(id)=>client.agentMessages(id),
 sendPrivateAgentMessage:(id,text)=>client.sendAgentNote(id,text),
 askDirector:(id,text,options)=>client.askDirector(id,text,options),
 askMatt:(text)=>client.askMatt(text),
 delegateMatt:(text,opts)=>client.delegateMatt(text,opts),
 delegateMattWorker:(text,opts)=>client.delegateMattWorker(text,opts),
 delegatePokemonWorker:(text,opts)=>client.delegatePokemonWorker(text,opts),
 mattJobHistory:()=>client.mattJobHistory(),
 diagnoseMattSession:()=>client.diagnoseMattSession(),
 githubLinkStatus:()=>client.githubLinkStatus(),
 beginGithubLink:()=>client.beginGithubLink(),
 // Display-only hook for future trusted proposals. Never implies user consent.
 previewListeningChange:(plan,evidence)=>{
  if(!window.PaperworldListeningReview)throw Error('Listening review unavailable');
  const snapshot=window.PaperworldListeningReview.summarize(plan,evidence);
  listeningReviewPayload={plan,evidence};
  if(client.signedIn()){
   room='workshop';active=true;edit=null;memoryOpen=false;
   render();work(reload);
  }
  return snapshot;
 },
 clearListeningChangePreview:()=>{listeningReviewPayload=null;if(active&&room==='workshop')render()}
};
})();
