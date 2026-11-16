/* PAPERWORLD in-world Messenger-style conversations.
 * One visual message stream and private user notes, waiting for real AI connection.
 * No Copilot model call, credit use or automatic worker execution.
 */
(()=>{'use strict';
 const view=document.querySelector('#view'),world=()=>window.PaperworldWorld,cloud=()=>window.PaperworldCloudUI;
 if(!view)return;
 let openId=null,revision=0,busy=false;
 const mattReplies=[];
 const directorReplies=new Map(); // Keep only replies not yet reconciled with saved history.
 let mattCachedEntries=null; // Keep visible replies while owner history refreshes.
 let mattJourneyCaption='';
 const historyCodec=()=>window.PaperworldMattHistory;
  // Short-lived conversation context for multi-turn continuity; no localStorage secrets.
  let activeMattDirector=null;
  const mattConversation=[];
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
 const form=make('form','world-dialogue-form');
 const field=make('textarea','world-chat-input');
 const send=make('button','world-chat-send','➤');
 field.rows=1;field.maxLength=1500;field.required=true;
 field.setAttribute('aria-label','Message to agent');
 send.type='submit';send.setAttribute('aria-label','Send message');
 form.append(field,send);
 // Optional real decision inbox. Never invokes AI automatically or claims the
 // village actors worked merely because an animation played.
 const decisions=make('div','world-chat-decisions');
 decisions.hidden=true;
 let decisionView=null,decisionLoading=false,lastDecisionRead=0;
 async function refreshDecisions({force=false}={}){
  if(!cloud()?.signedIn()||!decisionView||decisionLoading)return;
  // Avoid repeated owner-scoped HTTP reads whenever Messenger repaints.
  // A newly finished Worker run bypasses this brief UI-only cooldown.
  if(!force&&Date.now()-lastDecisionRead<30000)return;
  decisionLoading=true;
  try{await decisionView.refresh();lastDecisionRead=Date.now()}
  finally{decisionLoading=false}
 }
 function setupDecisions(){
  if(decisionView||!window.PaperworldHumanFirstHub?.create)return;
  decisionView=window.PaperworldHumanFirstHub.create(decisions,{
   compact:true,load:()=>cloud().loadHumanWork(),
   approve:item=>cloud().prepareHumanSolution(item),
   reject:item=>cloud().discardHumanSolution(item),
   onError:()=>{}
  });
 }
 // Crow's optional Suno preview is a separate, owner-triggered action.
 // Never infer consent to spend credits from a conversational AI reply.
 const musicToggle=make('button','crow-music-toggle','♫ Προετοιμασία τραγουδιού');
 musicToggle.type='button';musicToggle.hidden=true;
 musicToggle.setAttribute('aria-expanded','false');
 const musicPanel=make('section','crow-music-panel');musicPanel.hidden=true;
 musicPanel.setAttribute('aria-label','Προεπισκόπηση τραγουδιού');
 const musicHelp=make('p','crow-music-help',
  'Ετοίμασε την περιγραφή για τον Crow. Δεν γίνεται ακόμη παραγωγή στο Suno και δεν ξοδεύονται credits.');
 const musicForm=make('form','crow-music-form');
 const musicTitle=make('input','crow-music-title');
 musicTitle.type='text';musicTitle.maxLength=120;musicTitle.required=true;
 musicTitle.placeholder='Τίτλος τραγουδιού';musicTitle.setAttribute('aria-label','Τίτλος τραγουδιού');
 const musicStyle=make('textarea','crow-music-style');
 musicStyle.rows=2;musicStyle.maxLength=1000;musicStyle.required=true;
 musicStyle.placeholder='Ύφος, όργανα, φωνή…';musicStyle.setAttribute('aria-label','Μουσική κατεύθυνση');
 const musicLyrics=make('textarea','crow-music-lyrics');
 musicLyrics.rows=3;musicLyrics.maxLength=8000;
 musicLyrics.placeholder='Πρωτότυποι στίχοι (προαιρετικό)';
 musicLyrics.setAttribute('aria-label','Πρωτότυποι στίχοι');
 const musicSave=make('button','crow-music-save','Αποθήκευση προεπισκόπησης');
 musicSave.type='submit';
 const musicResult=make('p','crow-music-result','');
 musicResult.setAttribute('role','status');
 const musicFromCrow=make('button','crow-music-from-reply','Χρήση τελευταίας πρότασης Crow');
 musicFromCrow.type='button';
 const musicCopy=make('button','crow-music-copy','Αντιγραφή για Suno');
 musicCopy.type='button';
 musicCopy.hidden=true;
 musicCopy.setAttribute('aria-label','Αντιγραφή του ελεγμένου αιτήματος για Suno MCP');
 const musicCancel=make('button','crow-music-cancel','Ακύρωση πρότασης');
 musicCancel.type='button';musicCancel.hidden=true;
 musicForm.append(musicTitle,musicStyle,musicLyrics,musicSave);
 musicPanel.append(musicHelp,musicFromCrow,musicForm,musicResult,musicCopy,musicCancel);
 let previewId=null,musicBusy=false;
 function resetMusic(){
  musicPanel.hidden=true;musicToggle.setAttribute('aria-expanded','false');
  musicForm.reset();musicResult.textContent='';musicCancel.hidden=true;
  musicCopy.hidden=true;
  previewId=null;
 }
 musicToggle.addEventListener('click',()=>{
  if(musicBusy)return;
  musicPanel.hidden=!musicPanel.hidden;
  musicToggle.setAttribute('aria-expanded',String(!musicPanel.hidden));
  if(!musicPanel.hidden)musicTitle.focus();
 });
 musicFromCrow.addEventListener('click',()=>{
  if(openId!=='studio-director'||musicBusy)return;
  const replies=directorReplies.get('studio-director')||[];
  const last=replies[replies.length-1]?.content;
  if(typeof last!=='string'||!last.trim()){
   musicResult.textContent='Δεν υπάρχει πρόσφατη απάντηση του Crow. Μίλησέ του πρώτα.';
   return;
  }
  // Suggestions remain editable; never send AI text to Suno automatically.
  if(!musicTitle.value.trim())musicTitle.value='New Lost Wanderer Song';
  musicStyle.value=last.trim().slice(0,1000);
  musicResult.textContent='Προστέθηκε η τελευταία πρόταση του Crow. Έλεγξε και διόρθωσε τη μουσική κατεύθυνση.';
 });
 musicCopy.addEventListener('click',async()=>{
  if(openId!=='studio-director'||!previewId||musicBusy)return;
  try{
   const formatter=window.PaperworldCrowSunoPrompt;
   if(!formatter?.format)throw Error('unavailable');
   const text=formatter.format({title:musicTitle.value,style:musicStyle.value,
    lyrics:musicLyrics.value});
   // Clipboard writes are only initiated by the user's explicit button press.
   await navigator.clipboard.writeText(text);
   musicResult.textContent='Αντιγράφηκε. Επικόλλησέ το σε AI assistant με συνδεδεμένο Suno MCP. Δεν έγινε παραγωγή.';
  }catch(_){musicResult.textContent='Η αντιγραφή απέτυχε. Έλεγξε τα πεδία και τα δικαιώματα του browser.'}
 });
 musicForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn()||
   typeof cloud()?.crowSunoPreview!=='function')return;
  const title=musicTitle.value.trim(),style=musicStyle.value.trim(),lyrics=musicLyrics.value;
  if(!title||!style)return;
  musicBusy=true;musicSave.disabled=true;musicToggle.disabled=true;
  musicResult.textContent='Αποθήκευση ιδιωτικής προεπισκόπησης…';
  try{
   // Cancel old owner-scoped draft before replacing, avoiding unused previews.
   if(previewId)await cloud().cancelCrowSunoPreview(previewId);
   previewId=null;musicCopy.hidden=true;
   const response=await cloud().crowSunoPreview({operation:'create',title,style,lyrics});
   previewId=response.proposalId;
   musicCopy.hidden=false;
   musicResult.textContent='Προεπισκόπηση έτοιμη: '+response.title+
    '. Το Suno δεν συνδέθηκε και δεν έγινε παραγωγή. Credits: άγνωστα.';
   musicCancel.hidden=false;
  }catch(_){
   musicResult.textContent='Η προεπισκόπηση δεν αποθηκεύτηκε. Δοκίμασε ξανά αφού συνδεθείς.';
  }finally{musicBusy=false;musicSave.disabled=false;musicToggle.disabled=false}
 });
 musicCancel.addEventListener('click',async()=>{
  if(!previewId||musicBusy||typeof cloud()?.cancelCrowSunoPreview!=='function')return;
  musicBusy=true;musicCancel.disabled=true;
  try{
   await cloud().cancelCrowSunoPreview(previewId);
   previewId=null;musicCancel.hidden=true;musicCopy.hidden=true;
   musicResult.textContent='Η πρόταση ακυρώθηκε. Κανένα Suno credit δεν χρησιμοποιήθηκε.';
  }catch(_){musicResult.textContent='Δεν επιβεβαιώθηκε η ακύρωση. Μπορείς να δοκιμάσεις ξανά.'}
  finally{musicBusy=false;musicCancel.disabled=false}
 });
 const composer=make('footer','world-chat-composer');
 composer.append(connectGithub,musicToggle,musicPanel,form);
 panel.append(top,status,messages,decisions,composer);view.append(panel);
 // Matt owns the conversation; internal agent and worker routing stays invisible.
 async function runMattWorkflow(text){
  if(openId!=='matt'||!cloud()?.signedIn()||busy||!text.trim())return;
  if(!window.confirm('Να ρωτήσω τον Matt; Έως 3 GitHub Copilot AI κλήσεις '+
   'με το υπάρχον όριο και επιπλέον χρέωση $0. Ο Matt μπορεί να συμβουλευτεί '+
   'τον κατάλληλο μη ευαίσθητο Director. Δεν θα εκτελεστεί εργασία ή ανάγνωση '+
   'αρχείων χωρίς νέα έγκριση. Συνέχεια;'))return;
  busy=true;field.disabled=true;send.disabled=true;
  veil.classList.remove('world-chat-journey');mattJourneyCaption='';
  status.textContent='Ο Matt επεξεργάζεται το αίτημα…';
  let failure=null,requestId=null,watcher=null,polling=false;
  const poll=async()=>{
   if(!requestId||polling)return;
   polling=true;
   try{
    const history=await cloud().mattJobHistory();
    const job=history.jobs.find(item=>item.id===requestId);
    const last=job?.events?.[job.events.length-1];
    if(last&&typeof last.state==='string')
     world()?.setAgentWorkflowStage?.(last.state);
   }catch(_){/* Read-only status failure cannot imply completed work. */}
   finally{polling=false}
  };
  let journeyStarted=false,journeyDirector=null;
  const directorNames={'studio-director':'Crow','pokemon-director':'Joey',
   'listening-director':'Luna'};
  try{
   const result=await cloud().delegateMatt(text,{targetDirector:'auto',
     conversation:{activeDirector:activeMattDirector,turns:mattConversation.slice(-8)},
     onProgress:event=>{
      // Stage comes from authenticated, owner-scoped AI routing response.
      if(event.stage==='routed'&&!journeyStarted){
       journeyStarted=world()?.startMattDirectorJourney?.(event.directorId)===true;
       if(journeyStarted){
        journeyDirector=event.directorId;
        status.textContent='Ο Matt πηγαίνει στον '+(directorNames[journeyDirector]||'Director')+'…';
       }
      }else if(event.stage==='director_reported'&&journeyStarted){
       status.textContent='Ο Director απάντησε · ο Matt ετοιμάζει την αναφορά…';
      }
     }});
   if(result.delegated&&['listening-director','studio-director','pokemon-director'].includes(result.directorId)){
    if(activeMattDirector!==result.directorId)mattConversation.length=0;
    activeMattDirector=result.directorId;
    mattConversation.push({role:'human',text:text.slice(0,600)},
     {role:'assistant',text:String(result.content||'').slice(0,900)});
    if(mattConversation.length>8)mattConversation.splice(0,mattConversation.length-8);
   }else{
    activeMattDirector=null;
    mattConversation.length=0;
   }
   // The Director AI has completed, but DO NOT show the answer yet.
   // Wait until Matt has physically returned on the mapped village route.
   if(result.delegated===true&&!journeyStarted){
    journeyStarted=world()?.startMattDirectorJourney?.(result.directorId)===true;
    if(journeyStarted)journeyDirector=result.directorId;
   }
   if(journeyStarted){
    veil.classList.add('world-chat-journey');
    const who=directorNames[journeyDirector]||'Director';
    status.textContent='Ο Matt επιστρέφει από τον '+who+'…';
    world()?.completeMattDirectorJourney?.();
    // If browser animation is paused, do not leave the reply blocked forever.
    await Promise.race([world()?.waitMattDirectorReturn?.()||Promise.resolve(),
     new Promise(resolve=>setTimeout(resolve,90000))]);
    mattJourneyCaption='Ο Matt επέστρεψε από τον '+who;
   }
   mattReplies.push({id:result.persisted===true?result.requestId:null,
    content:String(result.content||
     'Δεν μπόρεσα να προσδιορίσω με ασφάλεια τον αρμόδιο Director.'),
    time:new Date().toISOString()});
   field.value='';
   if(openId==='matt')paint();
   const plan=result.delegated?result.workProposal:null;
   const permitted=plan?.requiresSeparateConsent===true&&
    plan.execution==='none'&&
    ((plan.directorId==='pokemon-director'&&plan.workerId==='pokemon-developer')||
     (plan.directorId==='listening-director'&&plan.workerId==='listening-developer'));
   if(permitted){
    const pokemon=plan.workerId==='pokemon-developer';
    const scope=pokemon?
     'Θα διαβαστεί ΜΟΝΟ το ιδιωτικό project.godot του Pokémon Echoes και θα '+
     'σταλεί ως πηγή στο GitHub Copilot. Δεν υπάρχει ακόμη μόνιμο ιστορικό της εργασίας.':
     'Θα διαβαστούν μόνο προκαθορισμένα αρχεία του Listening Mirror. '+
     'Η εξέλιξη καταγράφεται στο προστατευμένο ιστορικό.';
    const consent='Ο Matt προτείνει έλεγχο πηγαίου κώδικα από τον '+
     (pokemon?'Pokémon Developer':'Listening Mirror Developer')+
     '. Πρόσθετη έγκριση: έως 5 AI κλήσεις (επιπλέον χρέωση $0). '+
     scope+' ΜΟΝΟ ανάγνωση, χωρίς αλλαγές, PR ή deployment. Εγκρίνεις;';
    if(window.confirm(consent)){
     if(openId==='matt')status.textContent='Ο Matt ξεκίνησε την εγκεκριμένη διερεύνηση…';
     // The original human note is already stored by delegateMatt.
     const worker=pokemon?
      await cloud().delegatePokemonWorker(text,{saveNote:false}):
      await cloud().delegateMattWorker(text,{saveNote:false,onStart:id=>{
       requestId=id;
       watcher=setInterval(poll,1300);
      }});
     if(!pokemon){
      await poll();
      if(worker.persisted===true)world()?.setAgentWorkflowStage?.('reported');
      // A real, owner-scoped Worker proposal is REVIEW ONLY.
      // Do not request, issue, or pretend to have write authorization.
      if(worker.reviewProposal){
       try{
        cloud()?.previewListeningChange?.(worker.reviewProposal.plan,
         worker.reviewProposal.evidence);
        mattReplies.push({content:worker.proposalPersisted===true?
         'Ο Developer ετοίμασε και αποθήκευσε πρόταση αλλαγών. '+
         'Θα τη βρεις στο Listening Mirror Work Desk για έλεγχο και έγκριση. '+
         'Δεν έγινε αλλαγή αρχείων ή δημιουργία PR.':
         'Ο Developer ετοίμασε προεπισκόπηση αλλαγών, αλλά δεν επιβεβαιώθηκε '+
         'η αποθήκευσή της. Δεν υπάρχει ακόμη έτοιμο Draft PR για έγκριση.',
         time:new Date().toISOString()});
       }catch(_){
        mattReplies.push({content:'Η πρόταση δεν πέρασε τον έλεγχο '+
         'προεπισκόπησης. Δεν έγινε καμία αλλαγή.',time:new Date().toISOString()});
       }
      }else{
       mattReplies.push({content:'Ο Developer ολοκλήρωσε την ανάλυση, αλλά '+
        'δεν μπόρεσε να παραδώσει ασφαλή πλήρη διόρθωση προς έγκριση. '+
        'Δεν δημιουργήθηκε πρόταση στο Work Desk και δεν άλλαξε κανένα αρχείο.',
        time:new Date().toISOString()});
      }
     }
     mattReplies.push({content:String(worker.content||''),time:new Date().toISOString()});
     if(openId==='matt')paint();
     // Refresh the one real, persisted decision in the same conversation.
     if(!pokemon)await refreshDecisions({force:true});
    }else{
     mattReplies.push({content:'Δεν ξεκίνησα τον Worker. Μπορούμε να συνεχίσουμε τη συζήτηση.',
      time:new Date().toISOString()});
     if(openId==='matt')paint();
    }
   }
  }catch(error){
   failure=error;
   // An AI error after routing must not leave Matt stuck at the Director.
   if(journeyStarted){
    world()?.completeMattDirectorJourney?.();
    world()?.setAgentWorkflowFailure?.();
   }
   if(requestId)world()?.setAgentWorkflowFailure?.();
   if(openId==='matt')status.textContent='Δεν ολοκληρώθηκε: '+error.message;
   showNotice('⚠ Η εργασία απέτυχε ή η συνομιλία δεν ολοκληρώθηκε: '+error.message);
   if(error.noteSaved)field.value='';
  }finally{
   if(watcher!==null)clearInterval(watcher);
   busy=false;field.disabled=false;send.disabled=false;
   if(openId==='matt'){
    paint();
    if(failure)status.textContent='Δεν ολοκληρώθηκε: '+failure.message;
   }else if(!failure)showNotice('Ο Matt απάντησε. Πάτησε M για να δεις τη συνομιλία.');
  }
 }
 function bubble(role,text,when){
  const item=make('article','world-chat-message '+(role==='human'?'world-dialogue-human':'world-dialogue-agent'));
  // Some Copilot responses contain literal escaped newlines. Render them
  // as plain text with line breaks, never as HTML or executable markup.
  const normalized=role==='human'?text:String(text||'').replace(/\\n/g,'\n');
  // AI analyses can be long. Lead with the useful opening and keep the full
  // unaltered source text behind a disclosure instead of filling the screen.
  if(role!=='human'&&normalized.length>850){
   const intro=normalized.slice(0,650);
   const cut=Math.max(intro.lastIndexOf('\n'),intro.lastIndexOf('. '));
   const brief=intro.slice(0,cut>350?cut:intro.length);
   item.append(make('p','world-chat-brief',brief));
   const details=make('details','world-chat-full-report');
   details.append(make('summary','','Ολόκληρη αναφορά · προαιρετικά'),
    make('p','world-chat-unabridged',normalized));
   item.append(details);
  }else item.append(make('p','',normalized));
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
  else for(const reply of directorReplies.get(openId)||[])
   messages.append(bubble('agent',reply.content,reply.time));
  if(!entries.length&&!(openId==='matt'?mattReplies.length:(directorReplies.get(openId)||[]).length))messages.append(system(openId==='matt'?
   'Μίλησε στον Matt όπως σε έναν συνεργάτη. Το ιστορικό αποθηκεύεται όταν ο server είναι ρυθμισμένος.':
   'Μίλα απευθείας στον Director. Κάθε AI απάντηση χρειάζεται δική σου έγκριση.'));
  scrollBottom();
 }
 function paint(){
  const token=++revision;
  if(!openId){panel.hidden=true;veil.hidden=true;return}
  panel.hidden=false;veil.hidden=false;
  const isMatt=openId==='matt';
  const agent=world()?.agents()?.find(a=>a.id===openId);
  const profile=window.PaperworldProfiles?.get(openId);
  heading.textContent=profile?.name||(isMatt?'Matt':agent?.name||'Director');
  if(window.PaperworldProfiles)window.PaperworldProfiles.paintAvatar(avatar,openId);
  else avatar.textContent=heading.textContent.charAt(0).toUpperCase();
  activity.textContent=isMatt?'Chief of Staff · GitHub Copilot':(profile?.project||'Project')+' · Director · GitHub Copilot';
  const active=cloud()?.signedIn()===true;
  const available=active&&typeof cloud()?.privateAgentMessages==='function'&&!busy;
  status.textContent=!active?'Συνδέσου στο PAPERWORLD Cloud για να στείλεις μηνύματα.':
   isMatt?(mattJourneyCaption||'Συνομιλία με τον Matt · καμία εργασία χωρίς έγκριση'):
   'Απευθείας συνομιλία Director · κάθε AI απάντηση χρειάζεται έγκριση';
  decisions.hidden=!isMatt||!active;
  musicToggle.hidden=openId!=='studio-director'||!active;
  if(musicToggle.hidden)resetMusic();
  if(isMatt&&active){setupDecisions();void refreshDecisions()}
  if(active&&isMatt&&(mattCachedEntries!==null||mattReplies.length))
   appendEntries(mattCachedEntries||[]);
  else messages.replaceChildren(system(active?'Φόρτωση ιδιωτικού ιστορικού…':'Απαιτείται σύνδεση.'));
  connectGithub.hidden=true;
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
    if(selected==='matt'&&historyCodec()){
     const recovered=historyCodec().recover(history);
     // Persisted ID = original request UUID. Discard only the matching
     // temporary bubble to prevent duplicates, not all unsaved replies.
     const freshReplies=historyCodec().reconcileReplies(mattReplies,history);
     mattReplies.splice(0,mattReplies.length,...freshReplies);
     mattCachedEntries=recovered.display;
     if(!busy){activeMattDirector=recovered.activeDirector;
      mattConversation.splice(0,mattConversation.length,...recovered.turns)}
     appendEntries(recovered.display);
    }else{
     const existing=directorReplies.get(selected)||[];
     const savedIds=new Set(history.filter(m=>m.role==='agent').map(m=>m.id));
     const waiting=existing.filter(m=>!m.id||!savedIds.has(m.id));
     directorReplies.set(selected,waiting);
     appendEntries(history.map(m=>({role:m.role==='human'?'human':'agent',
      text:m.content,time:m.created_at})));
    }
   }).catch(error=>{
    if(token!==revision||openId!==selected)return;
    messages.replaceChildren(system('Το ιστορικό δεν φορτώθηκε: '+error.message));
   });
  }
  field.disabled=!available;send.disabled=!available;
  field.placeholder=available?'Γράψε μήνυμα…':'Συνδέσου για να στείλεις μήνυμα';
 }
 function show(id){openId=id;paint();if(!field.disabled)field.focus()}
 function hide(){openId=null;resetMusic();veil.classList.remove('world-chat-journey');paint();mattBtn.focus()}
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
  try{
   const isDirector=['listening-director','pokemon-director',
    'studio-director','wellbeing-director'].includes(id);
   if(isDirector){
    const approved=window.confirm('Άμεση συνομιλία με τον Director. '+
     'Εγκρίνεις 1 AI κλήση μέσω GitHub Copilot; '+
     'Χρησιμοποιούνται διαθέσιμα AI Credits, με επιπλέον χρέωση $0 '+
     'εφόσον ισχύει το επαληθευμένο όριο του λογαριασμού. '+
     'ΜΟΝΟ συνομιλία: χωρίς εργαλεία, αλλαγές αρχείων ή ανάθεση εργασίας.');
    if(!approved)return;
    const result=await cloud().askDirector(id,text);
    const existing=directorReplies.get(id)||[];
    directorReplies.set(id,[...existing,{id:result.persisted===true?result.requestId:null,
     content:result.content,time:new Date().toISOString()}].slice(-12));
    field.value='';
   }else{
    await cloud().sendPrivateAgentMessage(id,text);
    field.value='';
   }
  }catch(error){
   status.textContent='Η συνομιλία δεν ολοκληρώθηκε: '+error.message;
   if(error.noteSaved)field.value='';
  }
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
