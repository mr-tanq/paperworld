/* PAPERWORLD in-world Messenger-style conversations.
 * One visual message stream and private user notes, waiting for real AI connection.
 * No Copilot model call, credit use or automatic worker execution.
 */
(()=>{'use strict';
 const view=document.querySelector('#view'),world=()=>window.PaperworldWorld,cloud=()=>window.PaperworldCloudUI;
 if(!view)return;
 let openId=null,revision=0,busy=false,workflowMode='ask';
 const mattReplies=[];
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const actions=make('div','world-talk-actions');
 const mattBtn=make('button','','M · Matt'),nearBtn=make('button','','T · Talk');
 for(const b of [mattBtn,nearBtn]){b.type='button';actions.append(b)}
 view.append(actions);

 const veil=make('div','world-chat-veil');veil.hidden=true;view.append(veil);
 const panel=make('section','world-dialogue');panel.hidden=true;
 panel.setAttribute('aria-label','Agent conversation');panel.setAttribute('role','dialog');
 panel.setAttribute('aria-modal','true');
 const top=make('header','world-dialogue-head');
 const avatar=make('span','world-chat-avatar','M');
 avatar.setAttribute('aria-hidden','true');
 const identity=make('div','world-chat-identity');
 const heading=make('strong','','Matt');
 const activity=make('small','world-chat-presence','Chief of Staff · AI offline');
 identity.append(heading,activity);
 const close=make('button','world-chat-close','×');
 close.type='button';close.setAttribute('aria-label','Close conversation');
 top.append(avatar,identity,close);
 const status=make('p','world-dialogue-status');
 status.setAttribute('role','status');
 const messages=make('div','world-dialogue-messages');
 messages.setAttribute('role','log');
 messages.setAttribute('aria-label','Conversation messages');
 const connectGithub=make('button','world-dialogue-handoff','Σύνδεσε το GitHub για να μιλήσεις στον Matt');
 connectGithub.type='button';connectGithub.hidden=true;
 connectGithub.addEventListener('click',async()=>{
  try{const url=await cloud().beginGithubLink();window.location.assign(url)}
  catch(e){status.textContent='Η σύνδεση GitHub δεν ξεκίνησε: '+e.message}
 });
 const modePicker=make('div','world-chat-mode-picker');
 modePicker.setAttribute('role','group');
 modePicker.setAttribute('aria-label','Επιλογή λειτουργίας Matt');
 const askMode=make('button','world-chat-mode selected','Ρώτα τον Director · έως 3 AI κλήσεις');
 const workMode=make('button','world-chat-mode','Ανάθεσε σε Worker · έως 5 AI κλήσεις');
 const modeHint=make('small','world-chat-mode-hint');
 const projectLabel=make('label','world-chat-project-label','Project Director για ερωτήσεις');
 const projectSelect=make('select','world-chat-project-select');
 const projects=[
  ['auto','Αυτόματη επιλογή Matt (όχι Wellbeing)'],
  ['listening-director','Listening Mirror'],
  ['studio-director','The Lost Wanderer'],
  ['pokemon-director','Pokémon Echoes'],
  ['wellbeing-director','Wellbeing — ευαίσθητη ιδιωτική μνήμη']
 ];
 for(const [value,label] of projects){
  const option=make('option','',label);option.value=value;projectSelect.append(option);
 }
 projectSelect.value='auto';
 const projectTarget=make('div','world-chat-project-target');
 projectLabel.append(projectSelect);projectTarget.append(projectLabel);
 const workerTarget=make('div','world-chat-project-target');
 const workerLabel=make('label','world-chat-project-label','Project Worker για διερεύνηση');
 const workerSelect=make('select','world-chat-project-select');
 for(const [value,label] of [
  ['listening-director','Listening Mirror · δημόσιος κώδικας'],
  ['pokemon-director','Pokémon Echoes · ιδιωτικό project.godot']
 ]){
  const option=make('option','',label);option.value=value;workerSelect.append(option);
 }
 workerSelect.value='listening-director';
 workerLabel.append(workerSelect);workerTarget.append(workerLabel);
 function setWorkflowMode(mode){
  if(!['ask','work'].includes(mode)||busy)return;
  workflowMode=mode;
  askMode.classList.toggle('selected',mode==='ask');
  workMode.classList.toggle('selected',mode==='work');
  askMode.setAttribute('aria-pressed',String(mode==='ask'));
  workMode.setAttribute('aria-pressed',String(mode==='work'));
  projectTarget.hidden=mode!=='ask';
  workerTarget.hidden=mode!=='work';
  modeHint.textContent=mode==='ask'
   ?'Ερωτήσεις, αποφάσεις και εγκεκριμένη μνήμη · Matt → Director, χωρίς Worker.'
   :'Τεχνικός έλεγχος · Matt → Director → Worker, μόνο ανάγνωση.';
 }
 askMode.type='button';workMode.type='button';
 askMode.addEventListener('click',()=>setWorkflowMode('ask'));
 workMode.addEventListener('click',()=>setWorkflowMode('work'));
 modePicker.append(askMode,workMode);
 setWorkflowMode('ask');
 const form=make('form','world-dialogue-form');
 const field=make('textarea','world-chat-input');
 const send=make('button','world-chat-send','➤');
 field.rows=1;field.maxLength=1500;field.required=true;
 field.setAttribute('aria-label','Message to agent');
 send.type='submit';send.setAttribute('aria-label','Send message');
 form.append(field,send);
 const composer=make('footer','world-chat-composer');
 const diagnoseBtn=make('button','world-dialogue-handoff',
  'Έλεγχος Copilot · χωρίς AI μήνυμα');
 diagnoseBtn.type='button';diagnoseBtn.hidden=true;
 diagnoseBtn.addEventListener('click',async()=>{
  if(openId!=='matt'||busy||!cloud()?.signedIn())return;
  const selected=openId;busy=true;diagnoseBtn.disabled=true;
  field.disabled=true;send.disabled=true;
  status.textContent='Δοκιμή δημιουργίας συνεδρίας χωρίς αποστολή AI μηνύματος…';
  try{
   const result=await cloud().diagnoseMattSession();
   if(openId===selected)status.textContent=
    'Η συνεδρία Copilot δημιουργήθηκε επιτυχώς. AI μηνύματα: '+result.aiMessagesSent+
    '. Τώρα μπορείς να δοκιμάσεις πραγματική απάντηση.';
  }catch(error){
   if(openId===selected)status.textContent='Διάγνωση Copilot: '+error.message;
  }finally{
   busy=false;diagnoseBtn.disabled=false;
   if(openId===selected){field.disabled=false;send.disabled=false}
  }
 });
 // One natural instruction to Matt. AI routing decides the active Director;
 // there is no Director/Worker transcript in the human Messenger.
 async function runMattWorkflow(text){
  if(openId!=='matt'||!cloud()?.signedIn()||busy||!text.trim())return;
  // The human chooses the route before consent; never infer permission
  // to engage a Worker from an ambiguous natural-language message.
  const isWork=workflowMode==='work';
  const targetDirector=isWork?'auto':projectSelect.value;
  const workerProject=isWork?workerSelect.value:null;
  const pokemonWork=isWork&&workerProject==='pokemon-director';
  const includesWellbeing=targetDirector==='wellbeing-director';
  const consentText=isWork?
   (pokemonWork?
    'Pokémon Echoes: Matt → Pokémon Director → Pokémon Developer → Director → Matt. '+
    'Έως 5 AI κλήσεις, επιπλέον budget $0. Θα διαβαστεί ΜΟΝΟ το ιδιωτικό '+
    'project.godot από το προσωπικό σου GitHub και θα σταλεί ως πηγή στο Copilot. '+
    'Δεν αποθηκεύεται ακόμη ιστορικό εργασίας.':
    'Listening Mirror: Matt → Director → Worker. Έως 5 AI κλήσεις '+
    'με τα υπάρχοντα Copilot Credits και επιπλέον budget $0. Μόνο ανάγνωση κώδικα.'):
   'Ερώτηση προς Director: Matt → Director → Matt. Έως 3 AI κλήσεις '+
   'με τα υπάρχοντα Copilot Credits και επιπλέον budget $0. Χωρίς Worker.';
  if(!window.confirm(consentText+
   ' Καμία αλλαγή αρχείων, δικαιώματα εργαλείων ή deployment. Συνέχεια;'))return;
  // Private wellbeing history is forwarded to the selected GitHub Copilot
  // model only after a second, explicit sensitive-data confirmation.
  if(includesWellbeing&&!window.confirm(
   'ΕΙΔΙΚΗ ΣΥΝΑΙΝΕΣΗ WELLBEING: Μόνο αυτή τη φορά, ο Wellbeing Director '+
   'μπορεί να χρησιμοποιήσει εγκεκριμένα ευαίσθητα δεδομένα της υγείας σου '+
   'μέσα σε αίτημα προς το GitHub Copilot AI. Δεν θα τα δει Worker ή άλλος '+
   'Director. Εγκρίνεις αυτή την αποστολή;'))return;
  busy=true;field.disabled=true;send.disabled=true;
  let requestId=null,lastPhase=null,polling=false,watcher=null,failed=null;
  const showStage=phase=>{
   if(phase===lastPhase)return;
   lastPhase=phase;
   world()?.setAgentWorkflowStage?.(phase);
  };
  const poll=async()=>{
   if(!requestId||polling)return;
   polling=true;
   try{
    const history=await cloud().mattJobHistory();
    const job=history.jobs.find(item=>item.id===requestId);
    const last=job?.events?.[job.events.length-1];
    if(last&&typeof last.state==='string')showStage(last.state);
   }catch(_){/* Progress is optional; never imply that a failed poll means work completed. */}
   finally{polling=false}
  };
  // Close the overlay after the user's explicit AI approval so the village
  // remains visible; the map follows real stored stages only.
  hide();
  showNotice(isWork?
   (pokemonWork?
    'Ο Matt εξετάζει το ιδιωτικό Pokémon project.godot. Χωρίς αλλαγές και χωρίς καταγεγραμμένα στάδια.':
    'Ο Matt εξετάζει την εργασία. Η πορεία θα εμφανιστεί όταν καταγραφεί.'):
   'Ο Matt ρωτά τον Director με βάση την εγκεκριμένη μνήμη. Χωρίς Worker.');
  try{
   const result=isWork?
    (pokemonWork?
     await cloud().delegatePokemonWorker(text):
     await cloud().delegateMattWorker(text,{onStart:id=>{
      requestId=id;
      watcher=setInterval(poll,1300);
     }})):
    await cloud().delegateMatt(text,{
     targetDirector,wellbeingConsent:includesWellbeing
    });
   if(isWork&&!pokemonWork)await poll();
   if(result.delegated){
    if(isWork&&!pokemonWork)showStage('reported');
    showNotice('Ο Matt επέστρεψε με '+(isWork?'την αναφορά της εργασίας.':'την απάντηση του Director.')+
     ' Πάτησε M για να τη διαβάσεις.');
   }else showNotice('Ο Matt δεν βρήκε κατάλληλο Director. Επίλεξε συγκεκριμένο Project Director αν χρειάζεται.');
   const attribution=result.delegated&&result.directorName?
    'Matt · '+result.directorName:'Matt';
   mattReplies.push({content:attribution+' — ενημέρωση:\n'+result.content,
    time:new Date().toISOString()});
   field.value='';
  }catch(error){
   failed=error;
   if(!pokemonWork)await poll();
   if(!pokemonWork)world()?.setAgentWorkflowFailure?.();
   showNotice('⚠ Η εργασία απέτυχε (δεν ολοκληρώθηκε): '+error.message);
   if(error.noteSaved)field.value='';
  }finally{
   if(watcher!==null)clearInterval(watcher);
   busy=false;field.disabled=false;send.disabled=false;
   // Do not reopen the Messenger automatically. The user owns the view.
   if(openId==='matt'){
    paint();
    if(failed)status.textContent='Η ανάθεση απέτυχε: '+failed.message;
   }
  }
 }
 const historyBtn=make('button','world-dialogue-handoff','Ιστορικό εργασιών · χωρίς AI κλήση');
 historyBtn.type='button';historyBtn.hidden=true;
 historyBtn.addEventListener('click',async()=>{
  if(openId!=='matt'||busy||!cloud()?.signedIn())return;
  busy=true;historyBtn.disabled=true;
  const selected=openId;
  try{
   const result=await cloud().mattJobHistory();
   if(openId!==selected)return;
   const lines=result.jobs.slice(0,15).map(job=>{
    const last=job.events?.[job.events.length-1];
    const summary=String(job.summary||'').slice(0,120);
    return '• '+summary+' — '+(last?.state||'χωρίς καταγεγραμμένο στάδιο')+
     ' ('+(job.events?.length||0)+' συμβάντα)';
   });
   const heading=system('Αποθηκευμένο ιστορικό αναθέσεων · καταγραφές χρήστη, όχι απόδειξη εκτέλεσης');
   const detail=system(lines.length?lines.join('\\n'):'Δεν υπάρχουν αποθηκευμένες αναθέσεις.');
   messages.prepend(detail);messages.prepend(heading);
   status.textContent='Το ιστορικό φορτώθηκε χωρίς AI Credits.';
  }catch(error){
   if(openId===selected)status.textContent='Ιστορικό: '+error.message;
  }finally{busy=false;historyBtn.disabled=false}
 });
 const helper=make('small','world-chat-helper','Copilot AI Credits · Έγκριση ανά μήνυμα · Καμία ενέργεια σε αρχεία');
 composer.append(connectGithub,historyBtn,modePicker,modeHint,projectTarget,workerTarget,form,helper);
 panel.append(top,status,messages,composer);view.append(panel);

 function bubble(role,text,when){
  const item=make('article','world-chat-message '+(role==='human'?'world-dialogue-human':'world-dialogue-agent'));
  // Some Copilot responses contain literal escaped newlines. Render them
  // as plain text with line breaks, never as HTML or executable markup.
  const normalized=role==='human'?text:String(text||'').replace(/\\n/g,'\n');
  const body=make('p','',normalized);item.append(body);
  if(when&&Number.isFinite(Date.parse(when))){
   const time=make('time','world-chat-time',new Date(when).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'}));
   time.dateTime=when;item.append(time);
  }
  return item;
 }
 function system(text){return make('p','world-dialogue-note',text)}
 function scrollBottom(){messages.scrollTop=messages.scrollHeight}
 function appendEntries(entries){
  messages.replaceChildren();
  for(const m of entries)messages.append(bubble(m.role,m.text,m.time));
  if(openId==='matt')for(const reply of mattReplies)messages.append(bubble('agent',reply.content,reply.time));
  if(!entries.length&&!mattReplies.length)messages.append(system(openId==='matt'?
   'Ο Matt απαντά με πραγματικό Copilot AI όταν είναι συνδεδεμένο το GitHub. Οι απαντήσεις αυτού του δοκιμαστικού chat δεν αποθηκεύονται ακόμη μόνιμα.':
   'Μπορείς να αφήσεις ένα ιδιωτικό μήνυμα. Ο Director δεν απαντά ακόμη με AI.'));
  scrollBottom();
 }
 function paint(){
  const token=++revision;
  if(!openId){panel.hidden=true;veil.hidden=true;return}
  panel.hidden=false;veil.hidden=false;
  const isMatt=openId==='matt';
  const agent=world()?.agents()?.find(a=>a.id===openId);
  heading.textContent=isMatt?'Matt':(agent?.name||'Director');
  avatar.textContent=isMatt?'M':(heading.textContent.trim().charAt(0)||'D').toUpperCase();
  activity.textContent=isMatt?'Chief of Staff · GitHub Copilot':'Project Director · AI not connected';
  const active=cloud()?.signedIn()===true;
  const available=active&&typeof cloud()?.privateAgentMessages==='function'&&!busy;
  status.textContent=!active?'Συνδέσου στο PAPERWORLD Cloud για να στείλεις μηνύματα.':
   isMatt?'Copilot AI · ζητείται έγκριση ανά μήνυμα · χωρίς εργαλεία':
   'Ιδιωτική συνομιλία · ο Director δεν έχει AI ακόμη';
  messages.replaceChildren(system(active?'Φόρτωση ιδιωτικού ιστορικού…':'Απαιτείται σύνδεση.'));
  connectGithub.hidden=true;
  diagnoseBtn.hidden=!(isMatt&&active);
  historyBtn.hidden=!(isMatt&&active);
  modePicker.hidden=!isMatt;
  modeHint.hidden=!isMatt;
  projectTarget.hidden=!isMatt||workflowMode!=='ask';
  workerTarget.hidden=!isMatt||workflowMode!=='work';
  if(isMatt&&active&&typeof cloud()?.githubLinkStatus==='function'){
   const selected=openId;
   cloud().githubLinkStatus().then(link=>{
    if(token!==revision||openId!==selected)return;
    connectGithub.hidden=link.connected===true;
    if(!link.connected)status.textContent='Σύνδεσε το GitHub για να ενεργοποιηθεί το πραγματικό Copilot AI.';
   }).catch(()=>{
    if(token===revision&&openId===selected)connectGithub.hidden=false;
   });
  }
  if(active&&typeof cloud()?.privateAgentMessages==='function'){
   const selected=openId;
   cloud().privateAgentMessages(selected).then(history=>{
    if(token!==revision||openId!==selected)return;
    appendEntries(history.map(m=>({role:m.role==='human'?'human':'agent',text:m.content,time:m.created_at})));
   }).catch(error=>{
    if(token!==revision||openId!==selected)return;
    messages.replaceChildren(system('Το ιστορικό δεν φορτώθηκε: '+error.message));
   });
  }
  field.disabled=!available;send.disabled=!available;
  field.placeholder=available?'Γράψε μήνυμα…':'Συνδέσου για να στείλεις μήνυμα';
 }
 function show(id){openId=id;paint();if(!field.disabled)field.focus()}
 function hide(){openId=null;paint();mattBtn.focus()}
 function nearby(){
  const target=world()?.nearestAgent(100);
  if(!target){showNotice('Δεν υπάρχει agent κοντά σου. Πλησίασε έναν χαρακτήρα.');return}
  show(target.id);
 }
 let notice;
 function showNotice(s){if(!notice){notice=make('div','world-talk-notice');view.append(notice)}notice.textContent=s;notice.hidden=false}
 mattBtn.addEventListener('click',()=>show('matt'));
 nearBtn.addEventListener('click',nearby);
 veil.addEventListener('click',hide);
 close.addEventListener('click',hide);
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!openId||!cloud()?.signedIn()||field.disabled||busy)return;
  const id=openId,text=field.value.trim();
  if(!text)return;
  if(id==='matt'){
   await runMattWorkflow(text);
   return;
  }
  busy=true;field.disabled=true;send.disabled=true;
  try{await cloud().sendPrivateAgentMessage(id,text);field.value=''}
  catch(error){status.textContent='Το μήνυμα δεν αποθηκεύτηκε: '+error.message}
  finally{busy=false;if(openId===id)paint()}
 });
 field.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!field.disabled&&field.value.trim())form.requestSubmit()}
 });
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
  const t=e.target;
  if(e.key==='Escape'&&openId){hide();return}
  if(t?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(e.key.toLowerCase()==='m'){e.preventDefault();show('matt')}
  if(e.key.toLowerCase()==='t'){e.preventDefault();nearby()}
 });
 window.PaperworldWorldDialogue=Object.freeze({show,close:hide,nearby});
})();
