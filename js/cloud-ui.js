(()=>{'use strict';
const host=document.querySelector('#project-room'),model=window.PaperworldProjects,client=window.PaperworldCloud.createClient();
let room='town',tasks=[],allTasks=[],missions=[],busy=false,message='',edit=null,active=false;
const workerReports=new Map();
let workshopInput='',workshopResponse=null;
const el=(tag,text,cls)=>{let e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const btn=(text,fn,cls)=>{let b=el('button',text,cls);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b};
const note=(s,isError=false)=>{message=(isError?'Error: ':'')+s;render()};
async function work(fn){if(busy)return;busy=true;message='';render();try{await fn()}catch(e){message='Error: '+e.message}finally{busy=false;render()}}
async function reload(){
 [allTasks,missions]=await Promise.all([client.list(),client.listMissions()]);
 tasks=allTasks.filter(t=>t.room===room);
 if(room==='workshop'&&window.PaperworldWorkshop){
  const current=window.PaperworldWorkshop.existingTicketSwap(missions);
  if(current){
   try{workerReports.set(current.id,await client.workerStatus(current.id))}
   catch(_){/* Keep task board usable if GitHub status is temporarily unavailable. */}
  }
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
  btn('Sign out',()=>work(async()=>{await client.signout();tasks=[];allTasks=[];missions=[];edit=null;workshopInput='';workshopResponse=null})));
 host.append(userBar);
 if(room==='workshop'){
  renderWorkshop();return;
 }
 renderChiefOrRoom();
}
function renderWorkshop(){
 const workshop=window.PaperworldWorkshop,chief=window.PaperworldChief;
 const header=el('section',undefined,'developer-chat');
 header.append(el('h3','Ο προγραμματιστής σου'));
 header.append(el('p','Πες μου τι χρειάζεται το Listening Mirror. Για το TicketSwap μπορώ ήδη να αναθέσω ασφαλή τεχνική έρευνα, με την έγκρισή σου.','room-footnote'));
 const chat=el('div',undefined,'developer-messages');
 if(!workshopResponse)chat.append(el('p','Developer: Γεια σου! Τι δεν δουλεύει;','developer-bubble'));
 else{
  chat.append(el('p','Εσύ: '+workshopResponse.text,'human-bubble'));
  chat.append(el('p','Developer: '+workshopResponse.reply,'developer-bubble'));
 }
 header.append(chat);
 const f=el('form',undefined,'developer-form');
 const input=el('textarea');input.rows=3;input.maxLength=1500;
 input.placeholder='Π.χ. Φίλε, δεν δουλεύει το TicketSwap…';
 input.value=workshopInput;input.setAttribute('aria-label','Μήνυμα στον προγραμματιστή');
 input.addEventListener('input',()=>{workshopInput=input.value});
 const send=el('button','Στείλε','primary');send.type='submit';
 f.append(input,send);
 f.addEventListener('submit',event=>{
  event.preventDefault();const result=workshop.classify(input.value);
  if(result.type==='empty'){message='Γράψε πρώτα τι θέλεις να ελέγξουμε.';render();return}
  workshopResponse=result;workshopInput='';message='';render()
 });
 header.append(f);
 host.append(header);
 const current=workshop.existingTicketSwap(missions);
 const isTicket=workshopResponse?.type==='ticketswap';
 if(isTicket){
  const card=el('section',undefined,'developer-mission');
  card.append(el('h3','TicketSwap · μία αποστολή'));
  if(current){
   card.append(el('p',current.status==='ready_for_review'?'Έτοιμη για τεχνική έρευνα':'Προσχέδιο · δεν έχει εγκριθεί ακόμη','room-footnote'));
   const ops=el('div',undefined,'room-ops');
   if(current.status==='draft')ops.append(btn('Ετοίμασε για έλεγχο',()=>work(async()=>{
    await client.setMissionStatus(current.id,'ready_for_review');await reload();
    message='Η αποστολή είναι έτοιμη. Δεν εκτελέστηκε AI.'
   }),'primary'));
   else{
    ops.append(btn('Έλεγχος προόδου',()=>work(async()=>{
     const response=await client.workerStatus(current.id);
     workerReports.set(current.id,response);
     message=response.run?.conclusion==='failure'?
      'Error: Η προηγούμενη AI εκτέλεση απέτυχε. Το TicketSwap δεν έχει διορθωθεί. Δες την αιτία και την αναφορά παρακάτω.':
      response.run?'Εκτέλεση: '+response.run.status+(response.run.conclusion?' · '+response.run.conclusion:''):
      'Δεν βρέθηκε ακόμη εκτέλεση για αυτή την αποστολή.'
    })));
    const previousRun=workerReports.get(current.id)?.run;
    const blocked=previousRun?.mode==='run-ai'&&previousRun.retryBlocked;
    if(!blocked){
     ops.append(btn('Ξεκίνα έρευνα AI',()=>work(async()=>{
      const latest=await client.workerStatus(current.id);
      workerReports.set(current.id,latest);
      if(latest.run?.mode==='run-ai'&&latest.run.retryBlocked){
       message='Η προηγούμενη έρευνα έχει προσωρινό κλείδωμα. Δεν ξεκίνησε δεύτερη εκτέλεση.';
       return;
      }
      const explanation='Να ζητήσω ΜΙΑ έρευνα του TicketSwap από GitHub Copilot; Μπορεί να καταναλώσει τα διαθέσιμα Copilot Free AI credits. Έλεγξε ότι η πρόσθετη χρήση παραμένει απενεργοποιημένη και το budget είναι $0. Δεν θα γίνει push, merge ή deployment. Συνέχεια;';
      if(!confirm(explanation)){message='Η έρευνα δεν ξεκίνησε.';return}
      const result=await client.runApprovedAiMission(current.id,'I_APPROVE_INCLUDED_AI_CREDITS');
      message=result.accepted?'Η έρευνα ζητήθηκε. Ο Developer θα εμφανίσει την κατάσταση της εκτέλεσης.':'Η έρευνα δεν ξεκίνησε.';
      try{workerReports.set(current.id,await client.workerStatus(current.id))}catch(_){}
     }),'primary'));
    }
   }
   const status=workerReports.get(current.id);
   if(status?.run?.status==='completed'){
    ops.append(btn('Δες την αναφορά',()=>work(async()=>{
     const report=await client.workerStatus(current.id,true);
     workerReports.set(current.id,report);
     message=report.report?'Η αναφορά φορτώθηκε από το GitHub.':'Δεν υπάρχει διαθέσιμη αναφορά.';
    })));
   }
   card.append(ops);
   if(status){
    const results=el('div',undefined,'developer-result');
    const run=status.run;
    results.classList.toggle('worker-failed',Boolean(run?.conclusion==='failure'));
    const statusLabel=!run?'Δεν έχει ξεκινήσει ακόμη κάποια έρευνα.':
     run.status!=='completed'?'Η εκτέλεση βρίσκεται σε εξέλιξη.':
     run.conclusion==='success'?
      (run.mode==='prepare-only'?'Η προετοιμασία ολοκληρώθηκε, χωρίς AI.':'Η εκτέλεση τελείωσε. Έλεγξε την αναφορά πριν θεωρήσεις το πρόβλημα λυμένο.'):
     run.conclusion==='failure'?'Η προηγούμενη προσπάθεια απέτυχε. Δεν διορθώθηκε το TicketSwap.':
     'Η εκτέλεση ολοκληρώθηκε με κατάσταση '+(run.conclusion||'άγνωστη')+'.';
    results.append(el('p',statusLabel));
    if(run?.retryBlocked&&run.mode==='run-ai'){
     const when=new Date(run.retryAt);
     const date=Number.isNaN(when.getTime())?run.retryAt:
       when.toLocaleString('el-GR',{dateStyle:'medium',timeStyle:'short'});
     results.append(el('p','Νέα έρευνα AI επιτρέπεται μετά τις '+date+'. Το κουμπί εκκίνησης παραμένει κρυφό μέχρι τότε.','room-footnote'));
    }
    if(run?.conclusion==='failure'&&run.mode==='run-ai'){
     const reason=run.id===43533783800?
      'Η συγκεκριμένη δοκιμή απέτυχε πριν την ανάλυση: το Copilot απέρριψε παλιό όριο 0.5 AI credits. Αυτό διορθώθηκε στο PR #35.':
      'Η AI εκτέλεση απέτυχε. Άνοιξε το GitHub run για να δεις την πραγματική αιτία, χωρίς να υποθέσουμε ότι ο κώδικας διορθώθηκε.';
     results.append(el('p',reason,'room-footnote'));
    }
    if(run?.url){
     const link=el('a','Άνοιξε την εκτέλεση στο GitHub');
     link.href=run.url;link.target='_blank';link.rel='noopener noreferrer';results.append(link)
    }
    if(status.report?.files){
     for(const name of ['analysis.md','audit.json','tests.log','worker.patch','scope.json','prompt.txt']){
      if(!status.report.files[name])continue;
      const details=el('details',undefined,'worker-report-file');
      details.append(el('summary',name),el('pre',status.report.files[name],'mission-brief'));
      results.append(details)
     }
    }
    card.append(results)
   }
  }else card.append(el('p','Δεν βρέθηκε ενεργή αποστολή TicketSwap. Άνοιξε τον Chief of Staff για να οργανώσουμε την πρώτη.','room-footnote'));
  host.append(card)
 }else if(workshopResponse?.type==='other'){
  const save=el('section',undefined,'developer-mission');
  save.append(el('p','Μπορώ να κρατήσω το αίτημά σου χωρίς να προσποιηθώ ότι εκτελείται ήδη.','room-footnote'));
  save.append(btn('Αποθήκευση αιτήματος',()=>work(async()=>{
   if(!confirm('Να αποθηκεύσω το αίτημα ως εργασία στο Listening Mirror;'))return;
   const note=workshopResponse.text;
   await client.add('workshop',note.slice(0,160),note);
   await reload();workshopResponse=null;message='Το αίτημα αποθηκεύτηκε. Δεν ξεκίνησε AI.';
  }),'primary'));
  host.append(save)
 }
 const other=missions.filter(m=>m.project_room==='workshop'&&m.id!==current?.id);
 if(other.length){
  const details=el('details',undefined,'developer-archive');
  details.append(el('summary','Παλαιότερες αποστολές ('+other.length+')'));
  details.append(el('p','Τα παλιά προσχέδια διατηρούνται στο cloud, αλλά δεν εμφανίζονται ως ξεχωριστές ενεργές εργασίες.','room-footnote'));
  host.append(details)
 }
 const tasksPanel=el('details',undefined,'developer-tasks');
 tasksPanel.append(el('summary','Εργασίες Listening Mirror · '+tasks.length));
 const wrap=el('div',undefined,'developer-task-body');
 wrap.append(btn('+ Νέα εργασία',()=>{edit=true;render()},'primary'));
 if(edit)wrap.append(form(edit===true?null:edit));
 for(const status of ['doing','todo','done'])for(const task of tasks.filter(t=>t.status===status))wrap.append(taskRow(task));
 tasksPanel.append(wrap);host.append(tasksPanel)
}
function renderChiefOrRoom(){
 const tabs=el('div',undefined,'room-tabs');
 for(const r of model.ROOMS)tabs.append(btn(r.name,()=>work(async()=>{room=r.id;edit=null;workshopResponse=null;await reload()}),r.id===room?'selected':''));
 host.append(tabs);
 if(room==='town'){
  host.append(el('p','Εδώ παρακολουθείς όλα τα projects. Για αλλαγές στο Listening Mirror μίλα στον προγραμματιστή του Workshop.','room-footnote'));
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

function open(id='town'){if(model.ROOMS.some(r=>r.id===id))room=id;active=true;edit=null;message='';render();if(client.signedIn())work(reload)}
function focusChief(){
 const item=host.querySelector('.chief-desk');
 if(item){item.scrollIntoView({behavior:'smooth',block:'start'});item.classList.add('chief-focused')}
}
function openChief(){
 open('town');
 if(client.signedIn())setTimeout(focusChief,350);
}
window.PaperworldCloudUI={open,openChief,isActive:()=>active,signedIn:()=>client.signedIn()};
})();
