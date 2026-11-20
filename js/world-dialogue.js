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
 const proposedMemoryMessages=new Set(); // UI hint only; server+RLS remain authority.
 let latestSavedCrowReply=null; // Last persisted Crow agent reply, not temporary UI bubbles.
 let latestStudioHandoff=null,latestSavedStudioDraft=null;
 let mattCachedEntries=null; // Keep visible replies while owner history refreshes.
 let mattJourneyCaption='',villageActivityText='',villageActivityLastRead=0;
 const historyCodec=()=>window.PaperworldMattHistory;
  // Short-lived conversation context for multi-turn continuity; no localStorage secrets.
  let activeMattDirector=null;
  const mattConversation=[];
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const format=()=>window.PaperworldMessengerFormat;
 const AGENT_PROJECT={matt:'town','listening-director':'workshop','pokemon-director':'pokemon',
  'studio-director':'studio','wellbeing-director':'wellbeing'};
 const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 const actions=make('div','world-talk-actions');
 const mattBtn=make('button','','M · Matt'),nearBtn=make('button','','T · Talk');
 for(const b of [mattBtn,nearBtn]){b.type='button';actions.append(b)}
 view.append(actions);

 const veil=make('div','world-chat-veil');veil.hidden=true;view.append(veil);
 const panel=make('section','world-dialogue pw-messenger');panel.hidden=true;
 // On phones the Messenger collapses to a bottom sheet while Matt walks to a
 // Director, so the real village journey stays visible.
 new MutationObserver(()=>panel.classList.toggle('pw-journey',
  veil.classList.contains('world-chat-journey'))).observe(veil,{attributes:true,attributeFilter:['class']});
 panel.setAttribute('aria-label','Agent conversation');panel.lang='el';panel.setAttribute('role','dialog');
 panel.setAttribute('aria-modal','true');
 const top=make('header','world-dialogue-head');
 const avatar=make('span','world-chat-avatar','M');
 avatar.setAttribute('aria-hidden','true');
 const identity=make('div','world-chat-identity');
 const heading=make('strong','','Matt');
 const activity=make('small','world-chat-presence','Chief of Staff · AI offline');
 identity.append(heading,activity);
 const close=make('button','world-chat-close');
 close.append(make('span','pw-ico-close','×'),make('span','pw-ico-back','‹'));
 close.type='button';close.setAttribute('aria-label','Κλείσιμο συνομιλίας');
 close.title='Κλείσιμο (Esc)';
 // Secondary actions live in one compact overflow menu, not in the chat.
 const menuBtn=make('button','pw-icon-btn pw-menu-btn');
 menuBtn.type='button';menuBtn.setAttribute('aria-label','Περισσότερες επιλογές');
 menuBtn.setAttribute('aria-haspopup','menu');menuBtn.setAttribute('aria-expanded','false');
 menuBtn.append(make('span','','⋯'));
 const menu=make('div','pw-menu');menu.setAttribute('role','menu');menu.hidden=true;
 menu.setAttribute('aria-label','Επιλογές συνομιλίας');
 const memoryItem=make('button','pw-menu-item','Τι γνωρίζει');
 memoryItem.type='button';memoryItem.setAttribute('role','menuitem');
 function menuItems(){return [...menu.querySelectorAll('button')].filter(b=>!b.hidden&&!b.disabled)}
 function setMenu(open){
  menu.hidden=!open;menuBtn.setAttribute('aria-expanded',String(open));
  if(open)menuItems()[0]?.focus();
 }
 menuBtn.addEventListener('click',e=>{e.stopPropagation();setMenu(menu.hidden)});
 menu.addEventListener('keydown',e=>{
  const items=menuItems(),at=items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();
   items[(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
  }else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setMenu(false);menuBtn.focus()}
  else if(e.key==='Tab')setMenu(false);
 });
 menu.addEventListener('click',e=>{if(e.target.closest('button'))setMenu(false)});
 document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==menuBtn)setMenu(false)});

 const status=make('p','world-dialogue-status');
 status.setAttribute('role','status');
 const messages=make('div','world-dialogue-messages');
 messages.setAttribute('role','log');
 messages.setAttribute('aria-label','Conversation messages');
 const connectGithub=make('button','world-connection-chip','GitHub · Έλεγχος…');
 connectGithub.type='button';connectGithub.hidden=true;
 connectGithub.dataset.state='checking';
 connectGithub.setAttribute('aria-label','Κατάσταση σύνδεσης GitHub');
 function setGithubConnection(state){
  connectGithub.dataset.state=state;
  // Shared honest vocabulary (js/connection-status.js); 'unknown' = no
  // trustworthy answer, never shown as connected.
  connectGithub.textContent=state==='connected'?'GitHub · Συνδεδεμένο':
   state==='disconnected'?'GitHub · Σύνδεση':
   state==='not_configured'?'GitHub · Δεν έχει ρυθμιστεί':
   state==='signed_out'?'GitHub · Χρειάζεται σύνδεση στο Cloud':
   state==='unknown'?'GitHub · Μη διαθέσιμο τώρα':'GitHub · Έλεγχος…';
  connectGithub.disabled=state==='connected';
  connectGithub.title=state==='connected'?'GitHub συνδεδεμένο':
   state==='disconnected'?'Σύνδεση στο GitHub':'Πάτησε για επανέλεγχο GitHub';
 }
 async function refreshGithubConnection(selectedRevision=revision){
  if(openId!=='matt'||!cloud()?.signedIn()||
     typeof cloud()?.githubLinkStatus!=='function')return 'unknown';
  setGithubConnection('checking');
  try{
   const link=await cloud().githubLinkStatus();
   if(selectedRevision!==revision||openId!=='matt')return 'unknown';
   const state=link.connected===true||link.chatConnected===true?
    'connected':'disconnected';
   setGithubConnection(state);
   return state;
  }catch(error){
   if(selectedRevision===revision&&openId==='matt'){
    const reason=String(error?.message||'');
    if(/not_configured/.test(reason))setGithubConnection('not_configured');
    else setGithubConnection('unknown');
    status.textContent=/session expired|sign in/i.test(reason)?
     'Η σύνδεση στο PAPERWORLD Cloud έληξε. Συνδέσου ξανά στο Cloud.':
     /HTTP 401/.test(reason)?
     'Ο έλεγχος GitHub χρειάζεται νέα σύνδεση στο PAPERWORLD Cloud.':
     /HTTP 503|unavailable|Network/i.test(reason)?
     'Ο server σύνδεσης GitHub δεν απαντά. Δοκίμασε ξανά αργότερα.':
     'Δεν μπόρεσα να επαληθεύσω τη σύνδεση GitHub.';
   }
   return 'unknown';
  }
 }
 let githubLinkBusy=false;
 connectGithub.addEventListener('click',async()=>{
  if(openId!=='matt'||!cloud()?.signedIn()||githubLinkBusy||
     connectGithub.dataset.state==='connected')return;
  githubLinkBusy=true;connectGithub.disabled=true;
  try{
   // One tap must complete the read-only verification and, if disconnected,
   // continue directly to OAuth. Never require a second identical click.
   const state=await refreshGithubConnection();
   if(openId!=='matt')return;
   if(state==='connected'){
    status.textContent='Το GitHub είναι ήδη συνδεδεμένο.';
    return;
   }
   if(state!=='disconnected'){
    // The read-only check already supplied the specific reason.
    return;
   }
   if(typeof cloud()?.beginGithubLink!=='function'){
    status.textContent='Η σύνδεση GitHub δεν φορτώθηκε. Κάνε ανανέωση της σελίδας.';
    return;
   }
   connectGithub.textContent='GitHub · Σύνδεση…';
   status.textContent='Μεταφορά στο GitHub για εξουσιοδότηση…';
   const url=await cloud().beginGithubLink();
   window.location.assign(url);
  }catch(_){
   status.textContent='Η σύνδεση GitHub δεν ξεκίνησε. Δοκίμασε ξανά.';
   if(openId==='matt')setGithubConnection('unknown');
  }finally{
   githubLinkBusy=false;
   connectGithub.disabled=connectGithub.dataset.state==='connected';
  }
 });
 connectGithub.setAttribute('role','menuitem');
 const headTools=make('div','pw-head-tools');
 top.append(avatar,identity,headTools,close);
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
   publishPokemon:item=>cloud().preparePokemonSolution(item),
   rejectPokemon:item=>cloud().discardPokemonSolution(item),
   runSourceFact:async item=>{
    const result=await cloud().runApprovedSourceFact(item);
    const files=result.evidence?.files||[];
    mattReplies.push({content:String(result.content||'')+
     (files.length?'\\n'+files.map(f=>f.path+' · '+f.sha.slice(0,10)).join('\\n'):''),
     time:new Date().toISOString()});
    if(openId==='matt')paint();
    return result;
   },
   runWorker:async item=>{
    const result=await cloud().runApprovedHandoff(item);
    mattReplies.push({content:String(result.content||''),
     time:new Date().toISOString()});
    if(openId==='matt')paint();
    return result;
   },
   onError:()=>{}
  });
 }
 // Crow's optional Suno preview is a separate, owner-triggered action.
 // Owner permits Suno credit use; a capability grant does not itself run tools.
 const musicToggle=make('button','crow-music-toggle pw-studio-btn');
 musicToggle.append(make('span','pw-studio-glyph','♫'),make('span','pw-studio-label','Studio'));
 musicToggle.type='button';musicToggle.hidden=true;
 musicToggle.setAttribute('aria-expanded','false');
 musicToggle.setAttribute('aria-label','Άνοιγμα Music Studio');
 musicToggle.title='Music Studio';
 // The Music Studio is a dedicated creative workspace beside (desktop/tablet)
 // or over (phone) the conversation — never squeezed into the composer.
 const musicPanel=make('section','crow-music-panel pw-studio');musicPanel.hidden=true;
 musicPanel.setAttribute('aria-label','Music Studio');
 musicPanel.setAttribute('role','region');
 const musicHelp=make('p','crow-music-help',
  'Τίτλος, ήχος, στίχοι και φωνή — έτοιμα για το Suno.');
 const musicForm=make('form','crow-music-form');
 const musicTitle=make('input','crow-music-title');
 musicTitle.type='text';musicTitle.maxLength=120;musicTitle.required=true;
 musicTitle.placeholder='π.χ. Ash on the Windowsill';musicTitle.setAttribute('aria-label','Τίτλος τραγουδιού');
 musicTitle.id='pw-studio-title';
 const musicStyle=make('textarea','crow-music-style');
 musicStyle.rows=4;musicStyle.maxLength=1000;musicStyle.required=true;
 musicStyle.placeholder='Είδος, tempo, όργανα, φωνή, ατμόσφαιρα…';musicStyle.setAttribute('aria-label','Suno style prompt');
 musicStyle.id='pw-studio-style';
 const musicLyrics=make('textarea','crow-music-lyrics');
 musicLyrics.rows=10;musicLyrics.maxLength=8000;
 musicLyrics.placeholder='[Verse 1]\nΠρωτότυποι στίχοι…\n\n[Chorus]\n…\n\n[End]';
 musicLyrics.id='pw-studio-lyrics';
 musicLyrics.setAttribute('aria-label','Πρωτότυποι στίχοι');
 const voiceLabel=make('label','crow-music-voice-label','Φωνή Suno');
 const voiceSelect=make('select','crow-music-voice');
 voiceSelect.setAttribute('aria-label','Επιλογή φωνής για δημιουργία στο Suno');
 const voiceRefresh=make('button','crow-music-check','Ανανέωση φωνών');
 voiceRefresh.type='button';
 const voiceHint=make('p','crow-music-help',
  'Προεπιλογή: The Wanderer. Αν δεν επαληθευτεί, δεν θα χρησιμοποιηθεί τυχαία φωνή.');
 let verifiedVoices=[],voicesLoaded=false,voicesLoading=false;
 const voiceChoiceKey=()=>validSongOwner(songOwner())?
  'paperworld-suno-voice-choice-v1-'+songOwner():null;
 function storedVoiceChoice(){
  try{const key=voiceChoiceKey();return key?window.localStorage.getItem(key):null}
  catch(_){return null}
 }
 function saveVoiceChoice(){
  try{const key=voiceChoiceKey();if(key)window.localStorage.setItem(key,voiceSelect.value)}
  catch(_){}
 }
 function drawVoiceOptions(){
  const preferred=storedVoiceChoice();
  const random=make('option','','Τυχαία φωνή (χωρίς επιλογή)');
  random.value='random';
  const choice=preferred||'wanderer';
  voiceSelect.replaceChildren(random);
  for(const voice of verifiedVoices){
   const option=make('option','',voice.name);
   option.value='voice:'+voice.id;voiceSelect.append(option);
  }
  const matched=verifiedVoices.find(v=>v.name.trim().toLowerCase()==='the wanderer');
  const canRestore=preferred&&Array.from(voiceSelect.options).some(o=>o.value===preferred);
  if(canRestore)voiceSelect.value=preferred;
  else if(matched)voiceSelect.value='voice:'+matched.id;
  else{
   const missing=make('option','','The Wanderer — δεν βρέθηκε');
   missing.value='wanderer';voiceSelect.append(missing);voiceSelect.value='wanderer';
  }
  voiceHint.textContent=voiceSelect.value==='random'?
   'Θα δημιουργηθεί τραγούδι χωρίς συγκεκριμένη φωνή.':
   voiceSelect.value==='wanderer'?
   'Η φωνή The Wanderer δεν έχει επαληθευτεί. Η δημιουργία θα μπλοκαριστεί.':
   'Η επιλεγμένη φωνή θα επαληθευτεί ξανά πριν χρησιμοποιηθούν credits.';
 }
 async function refreshSunoVoices(){
  if(voicesLoading||openId!=='studio-director'||!cloud()?.signedIn()||
     typeof cloud()?.listSunoVoices!=='function')return;
  voicesLoading=true;voiceRefresh.disabled=true;
  voiceHint.textContent='Ανάκτηση αποθηκευμένων φωνών από το Suno (χωρίς credits)…';
  try{
   const voices=await cloud().listSunoVoices();
   if(openId!=='studio-director')return;
   verifiedVoices=voices;voicesLoaded=true;drawVoiceOptions();
  }catch(_){
   voicesLoaded=false;verifiedVoices=[];
   voiceSelect.replaceChildren();
   const missing=make('option','','The Wanderer — δεν έχει επαληθευτεί');
   missing.value='wanderer';voiceSelect.append(missing);
   const random=make('option','','Τυχαία φωνή (χωρίς επιλογή)');
   random.value='random';voiceSelect.append(random);
   voiceSelect.value='wanderer';
   voiceHint.textContent='Δεν φορτώθηκαν οι φωνές Suno. Επανέλεγξε τη σύνδεση ή πάτησε Ανανέωση.';
  }finally{voicesLoading=false;voiceRefresh.disabled=false}
 }
 voiceSelect.addEventListener('change',()=>{saveVoiceChoice();drawVoiceOptions()});
 voiceRefresh.addEventListener('click',()=>{void refreshSunoVoices()});
 voiceLabel.append(voiceSelect);
 const musicSave=make('button','crow-music-save','Ετοίμασε draft');
 musicSave.type='submit';musicSave.classList.add('pw-btn-secondary');
 musicSave.textContent='Αποθήκευση';
 // An OAuth redirect reloads this page. Keep the editable song in this tab
 // across that redirect, bound to the authenticated Cloud owner and a short TTL.
 // This never stores Suno/GitHub credentials or triggers generation.
 const songDraftStorageKey='paperworld-crow-oauth-draft-v1';
 const songDraftMaxAge=2*60*60*1000;
 const songOwner=()=>cloud()?.signedIn()?cloud()?.ownerId?.():null;
 const validSongOwner=id=>typeof id==='string'&&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
 function rememberSongDraft(){
  const ownerId=songOwner();
  if(!validSongOwner(ownerId))return;
  const title=musicTitle.value,style=musicStyle.value,lyrics=musicLyrics.value;
  if(title.length>120||style.length>1000||lyrics.length>8000)return;
  try{
   window.sessionStorage.setItem(songDraftStorageKey,JSON.stringify({
    ownerId,title,style,lyrics,savedAt:Date.now()
   }));
  }catch(_){/* Private-session storage may be unavailable. */}
 }
 function restoreSongDraft(){
  const ownerId=songOwner();
  if(!validSongOwner(ownerId))return false;
  try{
   const raw=window.sessionStorage.getItem(songDraftStorageKey);
   if(!raw)return false;
   const draft=JSON.parse(raw);
   if(draft?.ownerId!==ownerId||!Number.isFinite(draft.savedAt)||
      draft.savedAt>Date.now()+60000||Date.now()-draft.savedAt>songDraftMaxAge||
      typeof draft.title!=='string'||draft.title.length>120||
      typeof draft.style!=='string'||draft.style.length>1000||
      typeof draft.lyrics!=='string'||draft.lyrics.length>8000){
    window.sessionStorage.removeItem(songDraftStorageKey);return false;
   }
   // Do not replace a newer in-memory draft or overwrite current editing.
   if(musicTitle.value||musicStyle.value||musicLyrics.value)return false;
   musicTitle.value=draft.title;musicStyle.value=draft.style;
   musicLyrics.value=draft.lyrics;
   return !!(draft.title||draft.style||draft.lyrics);
  }catch(_){return false}
 }
 function forgetSongDraft(){
  try{window.sessionStorage.removeItem(songDraftStorageKey)}catch(_){}
 }
 for(const field of [musicTitle,musicStyle,musicLyrics]){
  field.addEventListener('input',rememberSongDraft);
 }
 const musicResult=make('p','crow-music-result','');
 musicResult.setAttribute('role','status');
 // The callback carries only fixed, non-sensitive categories, never provider details.
 const sunoReturn=new URLSearchParams(window.location.search);
 if(sunoReturn.get('suno_link')==='failed'){
  const messages={
   authorization_denied:'Η εξουσιοδότηση Suno δεν ολοκληρώθηκε ή απορρίφθηκε.',
   authorization_expired:'Η σύνδεση Suno έληξε. Δοκίμασε ξανά τη σύνδεση.',
   token_exchange_rejected:'Το Suno απέρριψε την ανταλλαγή εξουσιοδότησης. Η σύνδεση δεν ολοκληρώθηκε.',
   token_response_invalid:'Το Suno επέστρεψε μη έγκυρη απάντηση εξουσιοδότησης.',
   provider_unavailable:'Δεν ολοκληρώθηκε η επικοινωνία με το Suno.'
  };
  musicResult.textContent=messages[sunoReturn.get('suno_reason')]||
   'Η σύνδεση Suno δεν ολοκληρώθηκε.';
 }else if(sunoReturn.get('suno_link')==='connected'){
  musicResult.textContent='Η εξουσιοδότηση Suno ολοκληρώθηκε. Έλεγξε τα διαθέσιμα εργαλεία πριν συνεχίσεις.';
 }
 const musicFromCrow=make('button','crow-music-from-reply pw-btn-secondary','Φόρτωση τελευταίας πρότασης του Crow');
 musicFromCrow.type='button';
 const musicCopy=make('button','crow-music-copy pw-btn-secondary','Αντιγραφή');
 musicCopy.type='button';
 musicCopy.hidden=true;
 musicCopy.setAttribute('aria-label','Αντιγραφή του ελεγμένου αιτήματος για Suno MCP');
 const sunoGenerate=make('button','crow-music-save pw-btn-primary','Δημιουργία στο Suno');
 sunoGenerate.type='button';
 const sunoCreateStatus=make('p','crow-suno-create-status','');
 sunoCreateStatus.setAttribute('role','status');
 sunoCreateStatus.setAttribute('aria-live','polite');
 function showSunoCreateStatus(text,state='notice'){
  sunoCreateStatus.dataset.state=state;
  sunoCreateStatus.textContent=text;
  // Keep action feedback immediately beside the button, below long lyrics.
  sunoCreateStatus.hidden=!text;
  if(text&&!musicPanel.hidden){
   // Music Studio is a 270px inner scroller on mobile. Keep this result in
   // sight rather than writing an error above a long lyrics textarea.
   sunoCreateStatus.scrollIntoView?.({block:'nearest'});
  }
 }
 sunoCreateStatus.hidden=true;
 let lastSunoSubmission=null;
 sunoGenerate.addEventListener('click',async()=>{
  if(openId!=='studio-director')return;
  showSunoCreateStatus('Έλεγχος του τραγουδιού…','pending');
  if(musicBusy){
   showSunoCreateStatus('Υπάρχει ήδη υποβολή σε εξέλιξη. Δεν στέλνω δεύτερο αίτημα.','pending');
   return;
  }
  if(lastSunoSubmission){
   showSunoCreateStatus('Έχει ήδη επιχειρηθεί υποβολή σε αυτή τη συνεδρία. '+
    'Έλεγξε πρώτα τη Suno Library πριν δημιουργήσεις ξανά.','error');
   return;
  }
  if(!cloud()?.signedIn()){
   showSunoCreateStatus('Χρειάζεται σύνδεση στο Paperworld Cloud για δημιουργία στο Suno.','error');
   return;
  }
  if(typeof cloud()?.createSunoSong!=='function'){
   showSunoCreateStatus('Η λειτουργία δημιουργίας Suno δεν έχει φορτωθεί. '+
    'Κάνε ανανέωση της σελίδας για να φορτωθεί η νέα έκδοση.','error');
   return;
  }
  if(voiceSelect.value!=='random'&&
     (!voicesLoaded||!voiceSelect.value.startsWith('voice:')||
      !verifiedVoices.some(v=>'voice:'+v.id===voiceSelect.value))){
   showSunoCreateStatus('Η φωνή The Wanderer δεν έχει επαληθευτεί. '+
    'Πάτησε «Ανανέωση φωνών» ή διάλεξε ρητά «Τυχαία». Δεν στάλθηκε αίτημα.','error');
   return;
  }
  const selectedVoiceId=voiceSelect.value==='random'?null:voiceSelect.value.slice(6);
  const selectedVoiceName=selectedVoiceId?
   verifiedVoices.find(v=>v.id===selectedVoiceId)?.name:'Τυχαία';
  const brief={title:musicTitle.value.trim(),style:musicStyle.value.trim(),
   lyrics:musicLyrics.value};
  if(!brief.title||brief.title.length>120||!brief.style||brief.style.length>1000||
     !window.PaperworldCrowStudioDraft?.validLyrics(brief.lyrics)){
   showSunoCreateStatus('Το τραγούδι δεν είναι έτοιμο: έλεγξε τίτλο, ύφος και '+
    'τις αγκύλες στους στίχους. Οι μισογραμμένες οδηγίες δεν στέλνονται στη Suno.','error');
   return;
  }
  if(!window.confirm('Να στείλω το τραγούδι στο Suno με φωνή «'+
   selectedVoiceName+'»; Μπορεί να χρησιμοποιηθούν Suno credits.')){
   showSunoCreateStatus('Η δημιουργία ακυρώθηκε. Δεν στάλθηκε αίτημα στη Suno.','notice');
   return;
  }
  const key=window.crypto?.randomUUID?.();
  if(!key){
   showSunoCreateStatus('Δεν υποστηρίζεται ασφαλές μοναδικό κλειδί υποβολής.','error');
   return;
  }
  rememberSongDraft();
  lastSunoSubmission=key;
  musicBusy=true;sunoGenerate.disabled=true;
  sunoGenerate.textContent='Αποστολή…';
  showSunoCreateStatus('Υποβολή στο Suno… Μην επαναλάβεις το αίτημα.','pending');
  try{
   const result=await cloud().createSunoSong(brief,key,selectedVoiceId);
   if(result.accepted===true){
    showSunoCreateStatus('Η Suno επιβεβαίωσε τη λήψη του αιτήματος. '+
     'Η ολοκλήρωση του τραγουδιού δεν έχει ακόμη επαληθευτεί. '+
     'Έλεγξε τη Suno Library.','success');
   }else if(result.status==='blocked_before_submission'){
    const hints={
     suno_oauth_required:'Η σύνδεση Suno έληξε. Σύνδεσε ξανά τον λογαριασμό.',
     audio_create_not_verified:'Το εργαλείο δημιουργίας Suno δεν επαληθεύτηκε.',
     audio_create_voice_invalid:'Η επιλεγμένη φωνή έχει μη έγκυρο αναγνωριστικό.',
     audio_create_voice_unsupported:'Το Suno δεν δέχεται voice_id στο audio-create.',
     audio_create_voice_unavailable:'Η επιλεγμένη φωνή δεν βρέθηκε ή δεν επαληθεύτηκε στον λογαριασμό.',
     invalid_audio_create_request:'Το τραγούδι απορρίφθηκε πριν σταλεί στη Suno. Έλεγξε τίτλο και στίχους.',
     invalid_body:'Το τραγούδι έχει υπερβολικό μέγεθος.',
     request_too_large:'Το αίτημα είναι υπερβολικά μεγάλο για τον server.',
     unauthorized:'Η σύνδεση Paperworld Cloud χρειάζεται ανανέωση.',
     origin_denied:'Ο server απέρριψε τη σύνδεση από αυτή τη σελίδα.',
     audio_create_session_limit:'Έχει συμπληρωθεί το όριο υποβολών αυτής της συνεδρίας.',
     suno_claim_storage_missing:'Λείπει ο πίνακας ασφαλείας υποβολών στη βάση Paperworld '+
      '(sql/paperworld_suno_durable_claim_v1.sql δεν έχει εφαρμοστεί).',
     suno_claim_unavailable:'Η βάση Paperworld δεν επιβεβαίωσε το κλείδωμα υποβολής.',
     audio_create_already_submitted:'Αυτό το αίτημα έχει ήδη υποβληθεί.',
     audio_create_transport_unsupported:'Η Suno απάντησε μόνο σε παλαιότερο MCP που δεν υποστηρίζεται για δημιουργία.',
     audio_create_schema_unverified:'Δεν επαληθεύτηκε το σχήμα του εργαλείου δημιουργίας της Suno.',
     audio_create_schema_mismatch:'Το εργαλείο της Suno περιμένει διαφορετικό πεδίο',
     audio_create_field_too_long:'Ένα πεδίο ξεπερνά το όριο της Suno',
     audio_create_required_field_unsupported:'Η Suno ζητά υποχρεωτικό πεδίο που δεν υποστηρίζεται ακόμη'
    };
    const fieldNames={title:'τίτλος',style:'ύφος',lyrics:'στίχοι',
     instrumental:'instrumental',idempotency_key:'κλειδί υποβολής'};
    const fieldNote=typeof result.field==='string'?
     ' ('+(fieldNames[result.field]||result.field.slice(0,40))+
     (Number.isSafeInteger(result.limit)?', μέγιστο '+result.limit+' χαρακτήρες':'')+')':'';
    showSunoCreateStatus((hints[result.reason]||'Η υποβολή απορρίφθηκε.')+fieldNote+
     ' Δεν στάλθηκε αίτημα στη Suno και δεν χρησιμοποιήθηκαν credits.','error');
    lastSunoSubmission=null;
   }else{
    const diagnostic={
     provider_async_http_unverified:'Η Suno επέστρεψε ασύγχρονη HTTP απάντηση χωρίς επιβεβαιωμένο αποτέλεσμα.',
     provider_server_error_unverified:'Η Suno επέστρεψε σφάλμα server.',
     provider_http_unverified:'Η Suno επέστρεψε μη αναμενόμενη HTTP κατάσταση.',
     provider_unexpected_content_type:'Η Suno επέστρεψε μη υποστηριζόμενο τύπο απάντησης.',
     provider_response_oversized:'Η απάντηση της Suno ξεπέρασε το ασφαλές όριο.',
     provider_mcp_reply_unverified:'Η απάντηση MCP δεν είχε επαληθεύσιμη μορφή.',
     provider_invalid_tool_arguments:'Η Suno απέρριψε τη μορφή των παραμέτρων δημιουργίας.',
     provider_rpc_rejected:'Η Suno επέστρεψε σφάλμα MCP.',
     provider_tool_rejected:'Το εργαλείο δημιουργίας της Suno επέστρεψε αποτυχία.',
     provider_timeout_unverified:'Η επικοινωνία με τη Suno έληξε χωρίς επιβεβαίωση.',
     provider_network_unverified:'Η σύνδεση διακόπηκε χωρίς επιβεβαίωση.',
     authorization_rejected:'Η Suno απέρριψε την εξουσιοδότηση.',
     provider_rate_limited:'Η Suno επέστρεψε προσωρινό περιορισμό αιτημάτων.',
     provider_header_mismatch:'Η Suno απέρριψε τις κεφαλίδες MCP του αιτήματος πριν τρέξει το εργαλείο.',
     provider_client_capability_required:'Η Suno ζητά δυνατότητα MCP που ο Crow δεν υποστηρίζει ακόμη.',
     provider_protocol_version_unsupported:'Η Suno δεν δέχεται την έκδοση MCP 2026-07-28 για αυτό το αίτημα.',
     provider_method_not_found:'Η Suno δεν βρήκε τη μέθοδο MCP.',
     provider_invalid_request:'Η Suno απέρριψε τη μορφή του αιτήματος MCP.',
     provider_input_required:'Η Suno ζητά επιπλέον επιβεβαίωση πριν ξεκινήσει. Το τραγούδι δεν δημιουργήθηκε.',
     provider_result_type_unsupported:'Η Suno επέστρεψε άγνωστο τύπο αποτελέσματος MCP.'
    };
    const providerCode=(Number.isInteger(result.httpStatus)&&result.httpStatus>=300&&
      result.httpStatus<=599?' (HTTP '+result.httpStatus+')':'')+
     (Number.isInteger(result.rpcCode)?' (MCP '+result.rpcCode+')':'')+
     (Array.isArray(result.requiredCapabilities)&&result.requiredCapabilities.length?
      ' ['+result.requiredCapabilities.join(', ').slice(0,80)+']':'')+
     (Array.isArray(result.inputKinds)&&result.inputKinds.length?
      ' ['+result.inputKinds.join(', ').slice(0,80)+']':'');
    showSunoCreateStatus((diagnostic[result.reason]||
     'Δεν επιβεβαιώθηκε η υποβολή.')+providerCode+' Κωδικός: '+
     String(result.reason||'unknown').slice(0,80)+
     '. Έλεγξε τη Suno Library και τα credits πριν νέα προσπάθεια.','error');
   }
  }catch(_){
   showSunoCreateStatus('Η απάντηση της Suno δεν επιβεβαιώθηκε. '+
    'Έλεγξε τη Suno Library πριν προσπαθήσεις ξανά.','error');
  }finally{musicBusy=false;sunoGenerate.disabled=false;
   sunoGenerate.textContent='Δημιουργία στο Suno'}
 });
 const sunoTransportCheck=make('button','crow-music-check',
  'Έλεγχος MCP (χωρίς credits)');
 sunoTransportCheck.type='button';
 sunoTransportCheck.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn()||
     typeof cloud()?.diagnoseSunoConnection!=='function')return;
  sunoTransportCheck.disabled=true;
  showSunoCreateStatus('Έλεγχος σύνδεσης MCP χωρίς παραγωγή μουσικής…','pending');
  try{
   const result=await cloud().diagnoseSunoConnection();
   const mode=result.toolTransport==='modern'?'Νεότερο MCP (2026-07-28)':
    result.toolTransport==='legacy'?'Παλαιότερο MCP (handshake)':
    'Μη επαληθευμένη έκδοση MCP';
   const create=result.audioCreate;
   const createNote=!create?'':create.compatible===true?
    ' Δημιουργία: συμβατό σχήμα'+(Array.isArray(create.paramHeaders)&&
     create.paramHeaders.length?' ('+create.paramHeaders.length+' Mcp-Param)':'')+'.':
    ' Δημιουργία: μη συμβατό σχήμα ('+String(create.reason||'unknown').slice(0,60)+
     (typeof create.field==='string'?': '+create.field.slice(0,40):'')+').';
   const claimNote=typeof result.createClaimReady!=='boolean'?'':
    result.createClaimReady?' Ασφάλεια υποβολών: έτοιμη.':
    ' Ασφάλεια υποβολών: ΜΗ έτοιμη ('+
     String(result.createClaimReason||'unknown').slice(0,40)+').';
   showSunoCreateStatus('Suno: '+mode+'. Εργαλεία: '+
    (result.toolsListed?result.toolCount:'μη επαληθευμένα')+'.'+createNote+claimNote+
    ' Δεν έγινε δημιουργία ή χρήση credits.',
    create&&create.compatible===false||result.createClaimReady===false?'error':'notice');
  }catch(_){
   showSunoCreateStatus('Δεν ολοκληρώθηκε ο read-only έλεγχος MCP. '+
    'Δεν στάλθηκε τραγούδι.','error');
  }finally{sunoTransportCheck.disabled=false}
 });
 const musicCancel=make('button','crow-music-cancel pw-btn-ghost','Καθαρισμός');
 musicCancel.type='button';musicCancel.hidden=true;
 // Grouped, labelled creative sections instead of a flat settings form.
 function studioGroup(title,hint,...children){
  const group=make('fieldset','pw-studio-group');
  const legend=make('legend','pw-studio-legend',title);group.append(legend);
  if(hint)group.append(make('p','pw-studio-hint',hint));
  group.append(...children);return group;
 }
 function counter(input,max){
  const c=make('span','pw-studio-count','0 / '+max);c.setAttribute('aria-live','off');
  const update=()=>{const n=input.value.length;c.textContent=n+' / '+max;
   c.dataset.state=n>max*.92?'near':'ok'};
  input.addEventListener('input',update);c.update=update;return c;
 }
 const styleCount=counter(musicStyle,1000),lyricsCount=counter(musicLyrics,8000);
 const refreshCounters=()=>{styleCount.update();lyricsCount.update()};
 const lyricTags=make('div','pw-studio-tags');lyricTags.setAttribute('aria-label','Γρήγορη εισαγωγή ενότητας');
 for(const tag of ['[Intro]','[Verse]','[Pre-Chorus]','[Chorus]','[Bridge]','[Outro]','[End]']){
  const chip=make('button','pw-chip',tag);chip.type='button';
  chip.addEventListener('click',()=>{
   const at=musicLyrics.selectionStart??musicLyrics.value.length;
   const before=musicLyrics.value.slice(0,at),after=musicLyrics.value.slice(at);
   const insert=(before&&!before.endsWith('\n')?'\n':'')+tag+'\n';
   musicLyrics.value=before+insert+after;
   musicLyrics.focus();musicLyrics.selectionStart=musicLyrics.selectionEnd=at+insert.length;
   musicLyrics.dispatchEvent(new Event('input'));
  });
  lyricTags.append(chip);
 }
 const label=(text,input)=>{const l=make('label','pw-studio-label',text);l.htmlFor=input.id;return l};
 voiceSelect.id='pw-studio-voice';
 const voiceRow=make('div','pw-studio-voice-row');voiceRow.append(voiceLabel,voiceRefresh);
 const studioActions=make('div','pw-studio-actions');
 musicForm.append(
  studioGroup('Τραγούδι',null,label('Τίτλος',musicTitle),musicTitle),
  studioGroup('Ήχος','Το πλήρες Suno style prompt.',label('Style prompt',musicStyle),musicStyle,styleCount),
  studioGroup('Στίχοι','Πρωτότυποι στίχοι με οδηγίες σε [αγκύλες].',lyricTags,
   label('Στίχοι',musicLyrics),musicLyrics,lyricsCount),
  studioGroup('Φωνή','Αποθηκευμένη φωνή Suno. Προεπιλογή: The Wanderer.',voiceRow,voiceHint),
  studioActions);
 const sunoConnect=make('button','world-connection-chip','Suno · Έλεγχος…');
 sunoConnect.type='button';
 sunoConnect.dataset.state='checking';
 sunoConnect.setAttribute('aria-label','Κατάσταση σύνδεσης Suno');
 function setSunoConnection(state){
  sunoConnect.dataset.state=state;
  sunoConnect.disabled=state==='connected'||state==='checking'||
   state==='signed_out'||state==='not_configured';
  sunoConnect.textContent=state==='connected'?'Suno · Συνδεδεμένο':
   state==='disconnected'?'Suno · Σύνδεση':
   state==='not_configured'?'Suno · Δεν έχει ρυθμιστεί':
   state==='signed_out'?'Suno · Χρειάζεται σύνδεση στο Cloud':
   state==='unknown'?'Suno · Μη διαθέσιμο τώρα':'Suno · Έλεγχος…';
  sunoConnect.title=state==='connected'?'Suno συνδεδεμένο':
   state==='disconnected'?'Σύνδεση στον λογαριασμό Suno':
   'Πάτησε για επανέλεγχο σύνδεσης Suno';
 }
 async function refreshSunoConnection(){
  if(openId!=='studio-director')return;
  // Never leave the chip on "checking" when no request is made.
  if(!cloud()?.signedIn()){setSunoConnection('signed_out');return}
  if(typeof cloud()?.sunoLinkStatus!=='function'){setSunoConnection('unknown');return}
  const selectedRevision=revision;
  setSunoConnection('checking');
  try{
   const r=await cloud().sunoLinkStatus();
   if(selectedRevision!==revision||openId!=='studio-director')return;
   setSunoConnection(r.oauthAuthorized===true?'connected':'disconnected');
  }catch(error){
   if(selectedRevision===revision&&openId==='studio-director')
    setSunoConnection(/not_configured/.test(String(error?.message||''))?'not_configured':'unknown');
  }
 }
 sunoConnect.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn())return;
  if(sunoConnect.dataset.state==='unknown'){
   await refreshSunoConnection();return;
  }
  if(sunoConnect.dataset.state!=='disconnected'||
     typeof cloud()?.beginSunoLink!=='function')return;
  const agreed=window.confirm('Θα μεταφερθείς στη σελίδα εξουσιοδότησης του Suno. '+
   'Δεν θα δημιουργηθεί τραγούδι και δεν θα καταναλωθούν credits. Συνέχεια;');
  if(!agreed)return;
  sunoConnect.disabled=true;musicResult.textContent='Έλεγχος ασφαλούς σύνδεσης…';
  rememberSongDraft();
  try{
   const url=await cloud().beginSunoLink();
   window.location.assign(url);
  }catch(_){
   musicResult.textContent='Το Suno δεν προσφέρει ακόμη επιβεβαιωμένη σύνδεση σε αυτόν τον client. '+
    'Η παραγωγή παραμένει απενεργοποιημένη.';
  }finally{void refreshSunoConnection()}
 });
 const sunoLinkStatus=make('button','crow-music-check','Κατάσταση λογαριασμού Suno');
 sunoLinkStatus.type='button';
 sunoLinkStatus.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn()||
   typeof cloud()?.sunoLinkStatus!=='function')return;
  sunoLinkStatus.disabled=true;
  try{
   const r=await cloud().sunoLinkStatus();
   setSunoConnection(r.oauthAuthorized===true?'connected':'disconnected');
   musicResult.textContent=r.oauthAuthorized?
    'Ο λογαριασμός Suno συνδέθηκε.':
    'Ο λογαριασμός Suno δεν έχει συνδεθεί ακόμη.';
  }catch(_){musicResult.textContent='Δεν επαληθεύτηκε η σύνδεση Suno.'}
  finally{sunoLinkStatus.disabled=false}
 });
 const sunoTools=make('button','crow-music-check','Έλεγχος εργαλείων Suno');
 sunoTools.type='button';
 sunoTools.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn()||
     typeof cloud()?.inspectSunoTools!=='function')return;
  sunoTools.disabled=true;
  musicResult.textContent='Έλεγχος εργαλείων Suno…';
  try{
   const r=await cloud().inspectSunoTools();
   const toolFailures={
    not_authorized:'Δεν υπάρχει ενεργή εξουσιοδότηση Suno.',
    authorization_rejected:'Το Suno απέρριψε το token πρόσβασης (401/403).',
    unsupported_mcp_transport:'Το Suno απάντησε με μη υποστηριζόμενη HTTP κατάσταση.',
    unsupported_response_type:'Το Suno επέστρεψε μη υποστηριζόμενο τύπο απάντησης.',
    unverified_mcp_response:'Η απάντηση MCP δεν πέρασε τον έλεγχο μορφής.',
    mcp_invalid_json:'Το Suno επέστρεψε απάντηση που δεν είναι έγκυρο JSON.',
    mcp_invalid_sse:'Το Suno επέστρεψε μη αναγνωρίσιμη ροή SSE.',
    mcp_invalid_envelope:'Το Suno επέστρεψε JSON-RPC με μη αναμενόμενο ID ή μορφή.',
    mcp_tools_missing:'Η απάντηση Suno δεν περιέχει λίστα MCP εργαλείων.',
    mcp_pagination_unsupported:'Το Suno επέστρεψε τμηματική λίστα εργαλείων.',
    mcp_tool_limit_exceeded:'Το Suno επέστρεψε περισσότερα εργαλεία από το επιτρεπτό όριο.',
    mcp_invalid_tool_definition:'Η λίστα MCP περιέχει μη αναγνωρίσιμο ορισμό εργαλείου.',
    mcp_response_oversized:'Η απάντηση Suno ξεπέρασε το ασφαλές όριο μεγέθους.',
    provider_rpc_rejected:'Το Suno επέστρεψε σφάλμα MCP JSON-RPC.',
    provider_rate_limited:'Το Suno περιόρισε προσωρινά τα αιτήματα (429).',
    provider_server_error:'Το Suno αντιμετωπίζει σφάλμα server (5xx).',
    provider_endpoint_missing:'Δεν βρέθηκε το MCP endpoint.',
    provider_timeout:'Έληξε ο χρόνος αναμονής του Suno.',
    mcp_probe_unavailable:'Η επικοινωνία με το Suno απέτυχε.',
    legacy_probe_unavailable:'Απέτυχε η σύνδεση με το παλαιότερο MCP.',
    legacy_handshake_unverified:'Δεν ολοκληρώθηκε το MCP initialize handshake.',
    legacy_session_invalid:'Το Suno επέστρεψε μη έγκυρο MCP session.',
    legacy_tools_unverified:'Η παλαιότερη σύνδεση δεν επέστρεψε έγκυρη λίστα εργαλείων.'
   };
   const candidates=Array.isArray(r.creationTools)?r.creationTools:[];
   const signatures=candidates.slice(0,4).map(t=>
    t.name+' · fields: '+t.fields.map(f=>f.name+' ('+f.type+')').join(', ')+
    ' · required: '+(t.required.join(', ')||'none')).join(' | ');
   musicResult.textContent=r.toolsListed?
    'Επαληθεύτηκαν '+r.toolCount+' εργαλεία MCP. '+
    (signatures?'Εργαλεία παραγωγής: '+signatures:
     'Δεν εντοπίστηκε γνωστό εργαλείο δημιουργίας στα διαθέσιμα schemas.'):
    (toolFailures[r.reason]||'Δεν επαληθεύτηκαν τα εργαλεία MCP.');
  }catch(_){musicResult.textContent='Απαιτείται ενεργή σύνδεση Suno ή συμβατή έκδοση MCP.'}
  finally{sunoTools.disabled=false}
 });
 const sunoCheck=make('button','crow-music-check','Διάγνωση σύνδεσης Suno');
 sunoCheck.type='button';
 sunoCheck.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn()||
     typeof cloud()?.diagnoseSunoConnection!=='function')return;
  sunoCheck.disabled=true;
  musicResult.textContent='Έλεγχος σύνδεσης Suno…';
  try{
   const r=await cloud().diagnoseSunoConnection();
   const descriptions={
    provider_resource_unavailable:'Δεν επιβεβαιώθηκαν τα δημόσια στοιχεία MCP του Suno.',
    client_registration_unverified:'Το Suno δεν έχει επιβεβαιώσει τη συμβατότητα εξουσιοδότησης με το Paperworld.',
    owner_oauth_required:'Ο λογαριασμός δεν έχει συνδεθεί. Χρησιμοποίησε «Σύνδεση Suno».',
    mcp_tools_unverified:'Ο λογαριασμός συνδέθηκε, αλλά δεν επαληθεύτηκαν τα εργαλεία MCP.',
    generation_not_enabled:'Ο λογαριασμός και τα '+r.toolCount+' εργαλεία επαληθεύτηκαν.'
   };
   const reasonHint={
    authorization_rejected:'Ο πάροχος απέρριψε την εξουσιοδότηση.',
    unsupported_mcp_transport:'Μη υποστηριζόμενη απάντηση HTTP/MCP.',
    unsupported_response_type:'Μη υποστηριζόμενος τύπος απάντησης MCP.',
    unverified_mcp_response:'Μη έγκυρη απάντηση JSON-RPC.',
    mcp_invalid_json:'Μη έγκυρο JSON από το Suno.',
    mcp_invalid_sse:'Μη αναγνωρίσιμη απάντηση SSE.',
    mcp_invalid_envelope:'Μη αναμενόμενο JSON-RPC ID ή δομή.',
    mcp_tools_missing:'Δεν επιστράφηκε λίστα εργαλείων.',
    mcp_pagination_unsupported:'Η λίστα εργαλείων απαιτεί pagination.',
    mcp_tool_limit_exceeded:'Υπέρβαση ασφαλούς ορίου εργαλείων.',
    mcp_invalid_tool_definition:'Μη έγκυρος ορισμός MCP εργαλείου.',
    mcp_response_oversized:'Υπέρβαση ορίου μεγέθους MCP απάντησης.',
    mcp_capability_unverified:'Η απάντηση εργαλείων δεν πέρασε τον δεύτερο έλεγχο συμβατότητας.',
    provider_rpc_rejected:'Σφάλμα MCP JSON-RPC από τον πάροχο.',
    provider_rate_limited:'Προσωρινός περιορισμός αιτημάτων (429).',
    provider_server_error:'Σφάλμα server Suno (5xx).',
    provider_timeout:'Λήξη χρόνου αναμονής Suno.',
    mcp_probe_unavailable:'Αποτυχία επικοινωνίας.',
    legacy_probe_unavailable:'Αποτυχία παλαιότερου MCP.',
    legacy_handshake_unverified:'Αποτυχία initialize handshake.',
    legacy_session_invalid:'Μη έγκυρο MCP session.',
    legacy_tools_unverified:'Μη έγκυρη λίστα εργαλείων.'
   };
   const hint=r.nextStep==='mcp_tools_unverified'?
    (reasonHint[r.toolReason]||'Η ακριβής τεχνική αιτία δεν έχει επαληθευτεί.'):'';
   musicResult.textContent=(descriptions[r.nextStep]||
    'Δεν ολοκληρώθηκε η διάγνωση σύνδεσης.')+
    (hint?' Αιτία: '+hint:'');
  }catch(_){
   musicResult.textContent='Ο έλεγχος σύνδεσης δεν ολοκληρώθηκε.';
  }finally{sunoCheck.disabled=false}
 });
 const sunoInstructions=make('a','crow-music-instructions','Οδηγίες σύνδεσης Suno MCP');
 sunoInstructions.href='https://suno.com/mcp';
 sunoInstructions.target='_blank';sunoInstructions.rel='noopener noreferrer';
 const crowTechnical=make('details','crow-technical-tools');
  crowTechnical.append(make('summary','','Έλεγχοι σύνδεσης για συντήρηση'),
   sunoCheck,sunoLinkStatus,sunoTools,sunoInstructions);
  // Studio layout: header · source · grouped form · sticky actions · tools.
  const studioHead=make('header','pw-studio-head');
  const studioBack=make('button','pw-icon-btn pw-studio-back');
  studioBack.type='button';studioBack.append(make('span','','‹'),make('span','pw-studio-back-label','Συνομιλία'));
  studioBack.setAttribute('aria-label','Επιστροφή στη συνομιλία');
  const studioTitle=make('div','pw-studio-title');
  studioTitle.append(make('strong','','Music Studio'),musicHelp);
  studioHead.append(studioBack,studioTitle,sunoConnect);
  studioBack.addEventListener('click',()=>{if(!musicPanel.hidden)musicToggle.click()});
  const studioSource=make('div','pw-studio-source');
  studioSource.append(musicFromCrow,musicResult);
  musicResult.setAttribute('aria-live','polite');
  studioActions.append(musicCancel,musicCopy,musicSave,sunoGenerate);
  const studioTools=make('details','pw-studio-tools');
  studioTools.append(make('summary','','Σύνδεση & έλεγχοι Suno'),sunoTransportCheck,crowTechnical);
  const studioBody=make('div','pw-studio-body');
  studioBody.append(studioSource,musicForm,sunoCreateStatus,studioTools);
  musicPanel.append(studioHead,studioBody);
 let musicBusy=false;
 const openStudio=make('button','crow-music-toggle','♫ Συνέχεια στο Music Studio');
 openStudio.type='button';openStudio.hidden=true;
 openStudio.addEventListener('click',()=>{
  if(openId!=='matt'||busy||!cloud()?.signedIn()||!latestStudioHandoff)return;
  const draft=latestSavedStudioDraft||window.PaperworldCrowStudioDraft?.fromMatt(latestStudioHandoff);
  if(!draft){status.textContent='Δεν υπάρχει έγκυρη αναφορά Crow για μεταφορά.';return}
  show('studio-director');
  musicPanel.hidden=false;musicToggle.setAttribute('aria-expanded','true');
  musicTitle.value=draft.title;musicStyle.value=draft.style;musicLyrics.value=draft.lyrics;
  syncStudio();void refreshSunoVoices();
  musicResult.textContent='Μεταφέρθηκε η πραγματική αναφορά του Crow. '+
   'Διόρθωσε τίτλο, μουσική κατεύθυνση και στίχους.';
  musicCopy.hidden=false;musicCancel.hidden=false;rememberSongDraft();musicTitle.focus();
 });
 // One source of truth for the studio's open state and responsive layout.
 function syncStudio(){
  const open=!musicPanel.hidden;
  panel.classList.toggle('pw-studio-open',open);
  musicToggle.setAttribute('aria-expanded',String(open));
  musicToggle.setAttribute('aria-label',open?'Κλείσιμο Music Studio':'Άνοιγμα Music Studio');
  refreshCounters();
 }
 function resetMusic(){
  musicPanel.hidden=true;musicToggle.setAttribute('aria-expanded','false');
  panel.classList.remove('pw-studio-open');
  musicForm.reset();musicResult.textContent='';musicCancel.hidden=true;
  musicCopy.hidden=true;
 }
 musicToggle.addEventListener('click',()=>{
  if(musicBusy)return;
  musicPanel.hidden=!musicPanel.hidden;
  musicToggle.setAttribute('aria-expanded',String(!musicPanel.hidden));
  syncStudio();
  if(musicPanel.hidden){field.focus({preventScroll:true});return}
  if(!musicPanel.hidden){
   const restored=restoreSongDraft();
   if(restored)musicResult.textContent='Το τραγούδι σου επανήλθε μετά τη σύνδεση.';
   void refreshSunoConnection();
   void refreshSunoVoices();
   if(!musicTitle.value)musicTitle.focus();else studioBack.focus();
  }
 });
 musicFromCrow.addEventListener('click',()=>{
  if(openId!=='studio-director'||musicBusy)return;
  const replies=directorReplies.get('studio-director')||[];
  const recent=replies[replies.length-1]||null;
  const saved=latestSavedCrowReply;
  const latest=recent&&(!saved||Date.parse(recent.time||0)>=Date.parse(saved.time||0))?
   recent:saved;
  const text=latest?.content;
  if(typeof text!=='string'||!text.trim()){
   musicResult.textContent='Δεν υπάρχει αποθηκευμένη απάντηση Crow. Ζήτησέ του πρώτα ένα τραγούδι.';
   return;
  }
  const parser=window.PaperworldCrowStudioDraft;
  const song=parser?.parseSong(text);
  if(!song){
   musicResult.textContent='Η τελευταία απάντηση του Crow είναι ελλιπής ή έχει '+
    'κομμένες μουσικές οδηγίες. Ζήτησέ του να ολοκληρώσει TITLE, SUNO STYLE '+
    'PROMPT, LYRICS και να κλείσει με [End]. Δεν άλλαξα κανένα πεδίο.';
   return;
  }
  musicTitle.value=song.title;
  musicStyle.value=song.style;
  musicLyrics.value=song.lyrics;
  refreshCounters();
  musicCopy.hidden=false;musicCancel.hidden=false;
  rememberSongDraft();
  musicResult.textContent='Μεταφέρθηκαν μόνο ο τίτλος, το Suno style prompt και οι στίχοι. '+
   'Έλεγξε τα πεδία πριν δημιουργήσεις τραγούδι.';
 });
 musicCopy.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!musicTitle.value.trim()||
    !musicStyle.value.trim())return;
  try{
   const formatter=window.PaperworldCrowSunoPrompt;
   if(!formatter?.format)throw Error('unavailable');
   const text=formatter.format({title:musicTitle.value,style:musicStyle.value,
    lyrics:musicLyrics.value});
   // Clipboard writes are only initiated by the user's explicit button press.
   await navigator.clipboard.writeText(text);
   musicResult.textContent='Αντιγράφηκε. Μπορείς να το χρησιμοποιήσεις σε assistant με συνδεδεμένο Suno MCP.';
  }catch(_){musicResult.textContent='Η αντιγραφή απέτυχε. Έλεγξε τα πεδία και τα δικαιώματα του browser.'}
 });
 musicForm.addEventListener('submit',e=>{
  e.preventDefault();
  if(openId!=='studio-director'||musicBusy)return;
  if(!musicTitle.value.trim()||!musicStyle.value.trim())return;
  musicCopy.hidden=false;musicCancel.hidden=false;
  rememberSongDraft();
  musicResult.textContent='Το draft είναι έτοιμο για επεξεργασία ή αντιγραφή.';
 });
 musicCancel.addEventListener('click',()=>{
  if(openId!=='studio-director'||musicBusy)return;
  musicForm.reset();forgetSongDraft();musicCancel.hidden=true;musicCopy.hidden=false;
  musicResult.textContent='Το draft καθαρίστηκε.';
 });
 // One deliberate, owner-only batch approval for the staged private import.
 // Never trigger this from Matt's model reply or automatically on page load.
 const memoryReview=make('button','world-dialogue-handoff','Έλεγχος μνήμης Directors');
 memoryReview.type='button';memoryReview.hidden=true;
 memoryReview.addEventListener('click',async()=>{
  if(openId!=='matt'||!cloud()?.signedIn()||busy)return;
  memoryReview.disabled=true;
  const selection=openId;
  try{
   const preview=await cloud().previewImportedDirectorMemory();
   if(selection!==openId)return;
   if(!preview.total){status.textContent='Δεν υπάρχουν νέες εισαγόμενες μνήμες για έγκριση.';return}
   const labels={workshop:'Luna',pokemon:'Joey',studio:'Crow',wellbeing:'Dave'};
   const summary=preview.groups.filter(group=>group.items.length).map(group=>
    labels[group.projectId]+' ('+group.items.length+'):\n'+
    group.items.map(item=>'• '+item.title+(item.sensitivity==='private'?' [ιδιωτικό]':'')).join('\n')
   ).join('\n\n');
   if(!window.confirm('Έλεγχος '+preview.total+' εισαγόμενων μνημών.\n\n'+
    summary+'\n\nΘέλεις να ενεργοποιηθούν ΟΛΕΣ οι παραπάνω μνήμες; '+
    'Θα γίνουν διαθέσιμες μόνο στους αντίστοιχους Directors. '+
    'Οι ευαίσθητες πληροφορίες παραμένουν στην ιδιωτική βάση. '+
    'Η αλλαγή καταγράφεται και δεν ενεργοποιεί AI εργασίες.'))return;
   // No further user interaction is needed: the approved set is atomic.
   const result=await cloud().approveImportedDirectorMemory(preview);
   if(selection===openId)status.textContent='Ενεργοποιήθηκαν '+result.approved+' εγγραφές μνήμης.';
  }catch(error){
   if(selection===openId)status.textContent='Η μαζική έγκριση δεν ολοκληρώθηκε: '+error.message;
  }finally{memoryReview.disabled=false}
 });
 // ---- "What does this agent know?" — owner-only, RLS-scoped, read first.
 // Approved, proposed and private notes are labelled distinctly; a proposed
 // note is never presented as knowledge until the owner explicitly approves.
 const memorySheet=make('section','pw-sheet pw-memory');memorySheet.hidden=true;
 memorySheet.setAttribute('role','region');memorySheet.setAttribute('aria-label','Μνήμη agent');
 const memoryHead=make('header','pw-studio-head');
 const memoryBack=make('button','pw-icon-btn pw-studio-back');memoryBack.type='button';
 memoryBack.append(make('span','','‹'),make('span','pw-studio-back-label','Συνομιλία'));
 memoryBack.setAttribute('aria-label','Επιστροφή στη συνομιλία');
 const memoryTitle=make('div','pw-studio-title');
 const memoryName=make('strong','','Τι γνωρίζει');
 memoryTitle.append(memoryName,make('p','crow-music-help',
  'Μόνο οι επιβεβαιωμένες σημειώσεις χρησιμοποιούνται στις απαντήσεις.'));
 memoryHead.append(memoryBack,memoryTitle);
 const memoryBody=make('div','pw-studio-body pw-memory-body');memoryBody.setAttribute('aria-live','polite');
 memorySheet.append(memoryHead,memoryBody);
 const KIND_LABEL={project_bible:'Ταυτότητα',decision:'Απόφαση',preference:'Προτίμηση',
  current_state:'Τρέχουσα κατάσταση',work_history:'Ιστορικό'};
 let memoryOwner=null,memoryBusy=false;
 function closeMemory(){
  memorySheet.hidden=true;panel.classList.remove('pw-memory-open');
  if(openId)field.focus({preventScroll:true});
 }
 memoryBack.addEventListener('click',closeMemory);
 function memoryCard(row,projectId){
  const card=make('details','pw-memory-card');card.dataset.status=row.status;
  const summary=make('summary','');
  const meta=make('span','pw-memory-meta',(KIND_LABEL[row.kind]||'Σημείωση')+
   (row.sensitivity==='private'?' · Ιδιωτικό':'')+
   (Number.isFinite(Date.parse(row.observed_at))?' · '+
    new Date(row.observed_at).toLocaleDateString('el-GR',{day:'numeric',month:'short',year:'numeric'}):''));
  summary.append(make('span','pw-memory-title',row.title),meta);
  card.append(summary,make('p','pw-memory-text',row.body));
  card.append(make('p','pw-memory-source','Πηγή: '+(row.source_type==='conversation'?'συνομιλία':
   row.source_type==='project_file'?'αρχείο project':row.source_type==='owner_note'?'σημείωσή σου':
   'επαληθευμένο αποτέλεσμα')));
  if(row.status==='proposed'&&typeof cloud()?.reviewDirectorMemory==='function'){
   const actions=make('div','pw-memory-actions');
   const approve=make('button','pw-btn-secondary','Έγκριση'),reject=make('button','pw-btn-ghost','Απόρριψη');
   approve.type=reject.type='button';
   const decide=async decision=>{
    if(!window.confirm(decision==='approved'?
     'Να γίνει αυτή η σημείωση επιβεβαιωμένη γνώση για αυτόν τον agent;\n\n«'+row.title+'»':
     'Να απορριφθεί η πρόταση «'+row.title+'»;'))return;
    approve.disabled=reject.disabled=true;
    try{
     const result=await cloud().reviewDirectorMemory({projectId,entryId:row.id,decision});
     if(result?.status!==decision)throw Error('unverified');
     await openMemory(true);
    }catch(_){
     approve.disabled=reject.disabled=false;
     actions.append(make('p','pw-memory-error','Η αλλαγή δεν επιβεβαιώθηκε. Δοκίμασε ξανά.'));
    }
   };
   approve.addEventListener('click',()=>decide('approved'));
   reject.addEventListener('click',()=>decide('rejected'));
   actions.append(reject,approve);card.append(actions);
  }
  return card;
 }
 async function openMemory(keepOpen=false){
  const owner=openId,projectId=AGENT_PROJECT[owner];
  if(!owner||!projectId||memoryBusy)return;
  if(!musicPanel.hidden)resetMusic();
  memorySheet.hidden=false;panel.classList.add('pw-memory-open');
  const who=window.PaperworldProfiles?.get(owner)?.name||heading.textContent;
  memoryName.textContent='Τι γνωρίζει '+(owner==='matt'?'ο Matt':who==='Luna'?'η Luna':'ο '+who);
  if(!keepOpen)memoryBack.focus();
  if(!cloud()?.signedIn()||typeof cloud()?.listDirectorMemory!=='function'){
   memoryBody.replaceChildren(make('p','pw-empty','Συνδέσου στο PAPERWORLD Cloud για να δεις τη μνήμη.'));return;
  }
  memoryBusy=true;memoryOwner=owner;
  memoryBody.replaceChildren(make('p','pw-empty pw-loading','Φόρτωση μνήμης…'));
  try{
   const rows=await cloud().listDirectorMemory(projectId);
   if(memoryOwner!==owner||openId!==owner)return;
   const valid=Array.isArray(rows)?rows.filter(r=>r&&r.project_id===projectId&&
    typeof r.title==='string'&&typeof r.body==='string'):[];
   const approved=valid.filter(r=>r.status==='approved');
   const proposed=valid.filter(r=>r.status==='proposed');
   const stats=make('div','pw-memory-stats');
   for(const [n,label] of [[approved.length,'επιβεβαιωμένες'],[proposed.length,'προς έγκριση']]){
    const stat=make('div','pw-memory-stat');stat.append(make('strong','',String(n)),make('span','',label));
    stats.append(stat);
   }
   const body=[stats];
   const section=(title,hint,list,empty)=>{
    const wrap=make('section','pw-memory-section');
    wrap.append(make('h3','',title));if(hint)wrap.append(make('p','pw-studio-hint',hint));
    if(!list.length)wrap.append(make('p','pw-empty',empty));
    for(const row of list)wrap.append(memoryCard(row,projectId));
    return wrap;
   };
   body.push(section('Επιβεβαιωμένα','Αυτά διαβάζει ο agent πριν απαντήσει.',approved,
    'Δεν υπάρχουν ακόμη επιβεβαιωμένες σημειώσεις.'));
   body.push(section('Προτάσεις προς έγκριση','Δεν χρησιμοποιούνται μέχρι να τις εγκρίνεις.',proposed,
    'Καμία πρόταση σε αναμονή.'));
   const missing=make('section','pw-memory-section pw-memory-missing');
   missing.append(make('h3','','Τι δεν γνωρίζει'),make('p','pw-studio-hint',
    'Ήχος, πλήρεις στίχοι και αρχεία που δεν έχουν καταγραφεί δεν είναι διαθέσιμα. '+
    'Όταν λείπει κάτι σημαντικό, ο agent το λέει αντί να το μαντέψει. '+
    'Πρόσθεσε μια διόρθωση με «Να το θυμάται;» κάτω από το μήνυμά σου.'));
   body.push(missing);
   memoryBody.replaceChildren(...body);
  }catch(_){
   if(memoryOwner===owner)memoryBody.replaceChildren(make('p','pw-empty',
    'Η μνήμη δεν φορτώθηκε. Δοκίμασε ξανά σε λίγο.'));
  }finally{memoryBusy=false}
 }
 memoryItem.addEventListener('click',()=>{void openMemory()});
 const studioItem=make('button','pw-menu-item','Music Studio');
 studioItem.type='button';studioItem.setAttribute('role','menuitem');
 studioItem.addEventListener('click',()=>{if(musicPanel.hidden)musicToggle.click()});
 // One optional inline review: a routine is never created by model text.
 const routineReview=make('section','world-routine-review');
 routineReview.hidden=true;
 routineReview.setAttribute('aria-label','Έλεγχος εβδομαδιαίου προγράμματος');
 let routineRequest=null,routinePending=false;
 function clearRoutineReview(){
  routineReview.hidden=true;routineReview.replaceChildren();routineRequest=null;
  routineReview.classList.remove('world-routine-list');
 }
 function showRoutineMessage(message){
  routineReview.classList.remove('world-routine-list');
  routineReview.replaceChildren();
  const heading=make('strong','','Matt · Εβδομαδιαίο πρόγραμμα');
  const note=make('p','',message);
  const cancel=make('button','','Κλείσιμο');
  cancel.type='button';
  cancel.addEventListener('click',clearRoutineReview);
  routineReview.append(heading,note,cancel);
  routineReview.hidden=false;
 }
 async function listMattRoutines(){
  if(openId!=='matt'||routinePending||typeof cloud()?.listRoutines!=='function')return;
  routinePending=true;
  try{
   const entries=await cloud().listRoutines();
   if(openId!=='matt')return;
   routineReview.replaceChildren();
   routineReview.classList.add('world-routine-list');
   const header=make('div','world-routine-list-heading');
   const heading=make('strong','','Οι ρουτίνες σου');
   const count=make('span','world-routine-count',entries.length===1?'1 πρόγραμμα':entries.length+' προγράμματα');
   header.append(heading,count);
   routineReview.append(header);
   if(!entries.length)routineReview.append(make('p','','Δεν υπάρχουν αποθηκευμένα προγράμματα.'));
   for(const r of entries){
    const line=make('section','world-routine-entry');
    line.setAttribute('aria-label','Ρουτίνα '+(r.projectId||''));
    const day=['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'][r.dayOfWeek]||'';
    const time=String(r.hour).padStart(2,'0')+':'+String(r.minute).padStart(2,'0');
    const name={listening:'Listening Mirror',pokemon:'Pokémon',studio:'Lost Wanderer',
     wellbeing:'Wellbeing'}[r.projectId]||r.projectId;
    const zone=r.timezone==='UTC'?' UTC':'';
    const nextText=r.enabled&&Number.isFinite(Date.parse(r.nextReviewAt||''))?
     'Επόμενη: '+new Date(r.nextReviewAt).toLocaleString('el-GR',{weekday:'short',day:'numeric',
      month:'short',hour:'2-digit',minute:'2-digit',timeZone:r.timezone||'Europe/Amsterdam',hourCycle:'h23'}):'';
    const head=make('div','world-routine-entry-head');
    const label=make('strong','world-routine-name',name);
    const state=make('span','world-routine-state'+(r.enabled?' is-active':' is-paused'),r.enabled?'Ενεργή':'Σε παύση');
    head.append(label,state);
    const schedule=make('p','world-routine-schedule','Κάθε '+day+' · '+time+zone);
    const next=make('p','world-routine-next',nextText);
    next.hidden=!nextText;
    const goal=make('p','world-routine-goal',r.goal);
    const actions=make('div','world-routine-entry-actions');
    line.append(head,schedule,next,goal,actions);
    // Edit goal/day/time: inline, explicit save. The database recalculates
    // the next date (incl. daylight saving).
    if(typeof cloud()?.updateRoutine==='function'){
     const editBtn=make('button','','Αλλαγή');editBtn.type='button';
     const editor=make('div','world-routine-edit');editor.hidden=true;
     const daySel=make('select');daySel.setAttribute('aria-label','Ημέρα');
     ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'].forEach((d,i)=>{
      const o=make('option','',d);o.value=String(i);o.selected=i===r.dayOfWeek;daySel.append(o)});
     const timeIn=make('input');timeIn.type='time';timeIn.value=time;timeIn.setAttribute('aria-label','Ώρα');
     const goalIn=make('textarea');goalIn.rows=2;goalIn.maxLength=1200;goalIn.value=r.goal;
     goalIn.setAttribute('aria-label','Τι να γίνεται');
     const save=make('button','','Αποθήκευση αλλαγών');save.type='button';
     const editResult=make('p','');editResult.setAttribute('role','status');
     editBtn.addEventListener('click',()=>{editor.hidden=!editor.hidden});
     save.addEventListener('click',async()=>{
      if(routinePending||openId!=='matt')return;
      const [hh,mm]=String(timeIn.value).split(':').map(Number);
      const changes={};
      if(Number(daySel.value)!==r.dayOfWeek)changes.dayOfWeek=Number(daySel.value);
      if(Number.isInteger(hh)&&hh!==r.hour)changes.hour=hh;
      if(Number.isInteger(mm)&&mm!==r.minute)changes.minute=mm;
      if(goalIn.value.trim()&&goalIn.value.trim()!==r.goal)changes.goal=goalIn.value.trim();
      if(!Object.keys(changes).length){editResult.textContent='Δεν άλλαξε τίποτα.';return}
      routinePending=true;save.disabled=true;editResult.textContent='Αποθήκευση…';
      try{
       const updated=await cloud().updateRoutine(r.id,changes);
       if(openId!=='matt')return;
       Object.assign(r,{dayOfWeek:updated.dayOfWeek,hour:updated.hour,minute:updated.minute,goal:updated.goal});
       editResult.textContent='Οι αλλαγές αποθηκεύτηκαν.'+(updated.enabled&&updated.nextReviewAt?
        ' Επόμενη φορά: '+new Date(updated.nextReviewAt).toLocaleString('el-GR',{weekday:'long',
         hour:'2-digit',minute:'2-digit',timeZone:updated.timezone||'Europe/Amsterdam',hourCycle:'h23'})+'.':'');
      }catch(_){editResult.textContent='Δεν αποθηκεύτηκαν οι αλλαγές. Δοκίμασε ξανά.';}
      finally{routinePending=false;save.disabled=false}
     });
     editor.append(daySel,timeIn,goalIn,save,editResult);
     actions.append(editBtn);
     line.append(editor);
    }
    if(!r.enabled&&typeof cloud()?.changeRoutine==='function'){
     const resume=make('button','','Ενεργοποίηση');resume.type='button';
     const resumeResult=make('p','');resumeResult.setAttribute('role','status');
     resume.addEventListener('click',async()=>{
      if(routinePending||openId!=='matt')return;
      routinePending=true;resume.disabled=true;
      try{
       const changed=await cloud().changeRoutine(r.id,true);
       if(changed.enabled!==true)throw Error('Unverified');
       resumeResult.textContent='Ενεργοποιήθηκε. Θα σου ετοιμάζω την εργασία για έλεγχο τη σωστή μέρα και ώρα.';
       resume.hidden=true;
       r.enabled=true;state.textContent='Ενεργή';state.classList.remove('is-paused');state.classList.add('is-active');
       schedule.textContent='Κάθε '+day+' · '+time+zone;
      }catch(_){resumeResult.textContent='Η ενεργοποίηση δεν επιβεβαιώθηκε.';resume.disabled=false}
      finally{routinePending=false}
     });
     actions.append(resume);
     line.append(resumeResult);
    }
    if(r.enabled){
     const pause=make('button','','Παύση');
     pause.type='button';
     const result=make('p','','');
     result.setAttribute('role','status');
     pause.addEventListener('click',async()=>{
      if(routinePending||openId!=='matt')return;
      // The named routine is visible; the actual pause is a separate, owner click.
      routinePending=true;pause.disabled=true;
      try{
       const changed=await cloud().changeRoutine(r.id,false);
       if(openId!=='matt')return;
       if(changed.enabled!==false)throw Error('Unverified pause');
       result.textContent='Σε παύση. Δεν θα ετοιμάζεται νέα εργασία μέχρι να το ενεργοποιήσεις.';
       pause.hidden=true;
       r.enabled=false;state.textContent='Σε παύση';state.classList.remove('is-active');state.classList.add('is-paused');
       next.hidden=true;
      }catch(_){
       result.textContent='Η παύση δεν επιβεβαιώθηκε. Έλεγξε την κατάσταση πριν ξαναδοκιμάσεις.';
       pause.disabled=false;
      }finally{routinePending=false}
     });
     actions.append(pause);
     line.append(result);
    }
    routineReview.append(line);
   }
   const footer=make('div','world-routine-list-footer');
   const close=make('button','world-routine-close','Κλείσιμο');
   close.type='button';close.addEventListener('click',clearRoutineReview);
   footer.append(close);
   routineReview.append(footer);routineReview.hidden=false;
   return true;
  }catch(_){
   if(openId==='matt')showRoutineMessage('Δεν μπόρεσα να φορτώσω τα προγράμματα. Δεν έγινε καμία αλλαγή.');
  }finally{routinePending=false}
 }
 async function previewMattRoutine(intent){
  if(routinePending||openId!=='matt')return;
  if(intent.kind==='clarify'){
   showRoutineMessage('Πες μου project, ημέρα και ώρα. '+
    'Π.χ. «Κάθε Δευτέρα στις 09:00 έλεγχε το Listening Mirror».');
   return;
  }
  const cloudClient=cloud();
  if(typeof cloudClient?.previewRoutine!=='function'){
   showRoutineMessage('Η λειτουργία προγραμμάτων δεν είναι διαθέσιμη αυτή τη στιγμή.');
   return;
  }
  routinePending=true;
  const plan={projectId:intent.projectId,dayOfWeek:intent.dayOfWeek,
   hour:intent.hour,minute:intent.minute,goal:intent.goal,
   ...(intent.timezone==='UTC'?{timezone:'UTC'}:{})};
  const token=revision;
  try{
   const preview=await cloudClient.previewRoutine(plan);
   if(openId!=='matt'||token!==revision)return;
   routineRequest=plan;
   routineReview.classList.remove('world-routine-list');
   routineReview.replaceChildren();
   const heading=make('strong','','Matt · Να το κρατήσω ως πρόγραμμα;');
   const day=['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'][plan.dayOfWeek];
   const time=String(plan.hour).padStart(2,'0')+':'+
    String(plan.minute).padStart(2,'0');
   const name={listening:'Listening Mirror',pokemon:'Pokémon',
    studio:'Lost Wanderer',wellbeing:'Wellbeing'}[plan.projectId];
   const description=make('p','',name+' · κάθε '+day+' στις '+time+(plan.timezone==='UTC'?' UTC':''));
   const next=new Date(preview.nextReviewAt).toLocaleString('el-GR',{
    weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',
    timeZone:preview.timezone||'Europe/Amsterdam',hourCycle:'h23'});
   const detail=make('p','','Πρώτη φορά: '+next+'. Η ώρα ακολουθεί και τη θερινή ώρα.');
   // Phase 5 (owner decision): coding projects run the check on their own.
   const safety=make('p','',['listening','pokemon'].includes(plan.projectId)?
    'Τη σωστή μέρα η ομάδα θα κάνει μόνη της τον έλεγχο, θα διορθώνει ό,τι βρει '+
     'και θα σου λέει τι έγινε, μέσα στο όριο των 5 εργασιών τη μέρα.':
    'Τη σωστή μέρα θα σου ετοιμάζω την εργασία για έλεγχο. '+
     'Δεν ξεκινά τίποτα και δεν χρεώνεται τίποτα χωρίς εσένα.');
   const controls=make('div','world-routine-actions');
   const cancel=make('button','','Ακύρωση');
   const confirm=make('button','','Αποθήκευση');
   cancel.type=confirm.type='button';
   const feedback=make('p','','');
   feedback.setAttribute('role','status');
   cancel.addEventListener('click',clearRoutineReview);
   confirm.addEventListener('click',async()=>{
    if(routinePending||openId!=='matt'||!routineRequest)return;
    routinePending=true;confirm.disabled=true;cancel.disabled=true;
    feedback.textContent='Αποθήκευση…';
    try{
     const saved=await cloudClient.createRoutine(routineRequest);
     if(openId!=='matt')return;
     routineRequest=null;
     feedback.textContent='Αποθηκεύτηκε, σε παύση. Ενεργοποίησέ το όταν θέλεις να ξεκινήσει.';
     confirm.hidden=true;cancel.disabled=false;cancel.textContent='Κλείσιμο';
     // Separate user click is needed to enable draft-only recurring checks.
     const enable=make('button','','Ενεργοποίηση');
     enable.type='button';
     enable.addEventListener('click',async()=>{
      enable.disabled=true;cancel.disabled=true;
      feedback.textContent='Έλεγχος ενεργοποίησης…';
      try{
       const changed=await cloudClient.changeRoutine(saved.routineId,true);
       if(openId!=='matt')return;
       if(changed.enabled!==true)throw Error('Not verified');
       feedback.textContent='Ενεργοποιήθηκε. Θα σου ετοιμάζω την εργασία για έλεγχο τη σωστή μέρα και ώρα.';
       enable.hidden=true;cancel.disabled=false;
      }catch(_){
       feedback.textContent='Η ενεργοποίηση δεν επιβεβαιώθηκε. Το σχέδιο παραμένει χωρίς επιβεβαιωμένο ενεργό πρόγραμμα.';
       cancel.disabled=false;enable.disabled=false;
      }
     });
     controls.insertBefore(enable,cancel);
    }catch(_){
     feedback.textContent='Δεν αποθηκεύτηκε επιβεβαιωμένο πρόγραμμα. Η υπηρεσία ή η βάση μπορεί να μην είναι έτοιμη.';
     cancel.disabled=false;confirm.disabled=false;
    }finally{routinePending=false}
   });
   controls.append(cancel,confirm);
   routineReview.append(heading,description,detail,safety,feedback,controls);
   routineReview.hidden=false;
   return true; // Preview verified: the user's request was accepted for review.
  }catch(_){
   if(openId==='matt')showRoutineMessage('Δεν μπόρεσα να επαληθεύσω πρόγραμμα. Δεν δημιουργήθηκε καμία ρουτίνα.');
  }finally{routinePending=false}
 }
 const composer=make('footer','world-chat-composer');
 memoryReview.classList.add('village-maintenance-only');
 memoryReview.setAttribute('role','menuitem');memoryReview.classList.add('pw-menu-item');
 connectGithub.classList.add('pw-menu-item');
 menu.append(memoryItem,studioItem,connectGithub,memoryReview);
 headTools.append(musicToggle,menuBtn,menu);
 // Contextual next steps sit just above the composer, only when relevant.
 const contextRow=make('div','pw-context-row');
 openStudio.classList.add('pw-chip','pw-chip-accent');
 openStudio.textContent='♫ Άνοιγμα στο Music Studio';
 contextRow.append(openStudio);
 composer.append(contextRow,form);
 composer.insertBefore(routineReview,form);
 const chat=make('div','pw-chat');
 chat.append(top,status,messages,decisions,composer);
 panel.append(chat,musicPanel,memorySheet);view.append(panel);
 // Matt owns the conversation; internal agent and worker routing stays invisible.
 async function runMattWorkflow(text){
  if(openId!=='matt'||!cloud()?.signedIn()||busy||!text.trim())return;
  busy=true;field.disabled=true;send.disabled=true;
  veil.classList.remove('world-chat-journey');mattJourneyCaption='';
  status.textContent='Ο Matt το σκέφτεται…';
  pendingFailure=null;
  {const sent=bubble('human',text,new Date().toISOString());sent.classList.add('pw-pending');
   messages.querySelector('.world-dialogue-note')?.remove();messages.append(sent);showTyping()}
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
       status.textContent='Ο Matt έρχεται με νέα…';
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
   latestSavedStudioDraft=null;
   const crowDraft=result.delegated===true&&result.directorId==='studio-director'?
    window.PaperworldCrowStudioDraft?.parseSong(result.directorReport):null;
   latestStudioHandoff=crowDraft?{delegated:true,directorId:result.directorId,
    requestId:result.requestId,request:text,directorReport:result.directorReport}:null;
   field.value='';autoGrow();
   if(openId==='matt')paint();
   const plan=result.delegated?result.workProposal:null;
   const permitted=plan?.requiresSeparateConsent===true&&
    plan.execution==='none'&&
    ((plan.directorId==='pokemon-director'&&plan.workerId==='pokemon-developer')||
     (plan.directorId==='listening-director'&&plan.workerId==='listening-developer'));
   if(permitted){
    const pokemon=plan.workerId==='pokemon-developer';
    const scope=pokemon?
     'Θα διαβαστεί το ιδιωτικό project.godot και έως τρία προκαθορισμένα '+
     'GDScript αρχεία του Pokémon Echoes, μόνο από τη σχετική κατηγορία '+
     '(κίνηση, διάλογοι, μάχες ή χάρτες). Το περιεχόμενο θα σταλεί ως '+
     'πηγή στο GitHub Copilot για αυτή τη διερεύνηση. '+
     'Η εγκεκριμένη διερεύνηση καταγράφεται στο ιδιωτικό ιστορικό όταν είναι διαθέσιμο.':

     'Θα διαβαστούν μόνο προκαθορισμένα αρχεία του Listening Mirror. '+
     'Η εξέλιξη καταγράφεται στο προστατευμένο ιστορικό.';
    const consent='Ο Matt θέλει να ζητήσει βοήθεια από τον '+
     (pokemon?'Pokémon Developer':'Listening Mirror Developer')+
     '. Χρειάζεται η έγκρισή σου για αυτή την επιπλέον εργασία (έως 5 κλήσεις, χωρίς πρόσθετη χρέωση). '+
     scope+' ΜΟΝΟ ανάγνωση, χωρίς αλλαγές, PR ή deployment. Εγκρίνεις;';
    if(window.confirm(consent)){
     if(openId==='matt')status.textContent='Ο Matt ξεκίνησε την εγκεκριμένη διερεύνηση…';
     // The original human note is already stored by delegateMatt.
     const worker=pokemon?
      await cloud().delegatePokemonWorker(text,{saveNote:false,requestId:result.requestId}):
      await cloud().delegateMattWorker(text,{saveNote:false,requestId:result.requestId,onStart:id=>{
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
   if(openId!=='matt')showNotice('⚠ Η εργασία απέτυχε ή η συνομιλία δεν ολοκληρώθηκε. Άνοιξε τη συνομιλία με τον Matt για επανάληψη.');
   pendingFailure={agentId:'matt',text,noteSaved:error?.noteSaved===true,error};
   if(error.noteSaved)field.value='';
  }finally{
   if(watcher!==null)clearInterval(watcher);
   busy=false;field.disabled=false;send.disabled=false;
   if(openId==='matt'){
    paint();
    if(failure)status.textContent=friendlyError(failure);
   }else if(!failure)showNotice('Ο Matt απάντησε. Πάτησε M για να δεις τη συνομιλία.');
  }
 }
 function rememberAction(item,message){
  if(openId==='matt'||![
    'listening-director','pokemon-director','studio-director','wellbeing-director'
   ].includes(openId)||typeof cloud()?.proposeDirectorCorrection!=='function'||
   !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(message?.id||''))
   return;
  const targetDirector=openId;
  const button=make('button','world-chat-remember',
   proposedMemoryMessages.has(message.id)?'Προτάθηκε για μνήμη':'Να το θυμάται;');
  button.type='button';
  button.disabled=proposedMemoryMessages.has(message.id);
  const review=make('div','world-chat-memory-preview');
  review.hidden=true;
  button.addEventListener('click',()=>{
   if(openId!==targetDirector||review.hidden===false)return;
   review.replaceChildren();
   const heading=make('strong','','Πρόταση μνήμης');
   const explanation=make('p','',
    'Ο Director θα μπορεί να το χρησιμοποιεί μόνο μετά από ξεχωριστή έγκρισή σου.');
   const excerpt=make('p','world-chat-memory-excerpt',message.text);
   const label=make('label','','Σύντομος τίτλος');
   const title=make('input','world-chat-memory-title');
   title.type='text';title.maxLength=140;title.required=true;
   title.value=message.text.replace(/\s+/g,' ').trim().slice(0,100);
   label.append(title);
   const notice=make('p','world-chat-memory-state','Θα αποθηκευτεί ιδιωτικά ως πρόταση.');
   notice.setAttribute('role','status');
   const controls=make('div','world-chat-memory-controls');
   const cancel=make('button','','Ακύρωση');
   const confirm=make('button','','Πρόταση');
   cancel.type=confirm.type='button';
   cancel.addEventListener('click',()=>{review.hidden=true;review.replaceChildren()});
   confirm.addEventListener('click',async()=>{
    if(openId!==targetDirector||!title.value.trim())return;
    confirm.disabled=true;cancel.disabled=true;button.disabled=true;
    notice.textContent='Αποθήκευση πρότασης…';
    try{
     const result=await cloud().proposeDirectorCorrection(targetDirector,message.id,{
      title:title.value.trim()});
     if(result.status!=='proposed'||result.approved!==false)throw Error('unverified');
     proposedMemoryMessages.add(message.id);
     button.textContent='Προτάθηκε για μνήμη';
     notice.textContent='Αποθηκεύτηκε ως πρόταση, όχι ως εγκεκριμένη μνήμη.';
     cancel.textContent='Κλείσιμο';cancel.disabled=false;
     confirm.hidden=true;
    }catch(_){
     notice.textContent='Δεν αποθηκεύτηκε επιβεβαιωμένη πρόταση. Έλεγξε τη μνήμη Directors πριν ξαναδοκιμάσεις.';
     button.disabled=false;cancel.disabled=false;confirm.disabled=false;
    }
   });
   controls.append(cancel,confirm);
   review.append(heading,explanation,excerpt,label,notice,controls);
   review.hidden=false;
   title.focus();
  });
  item.append(button,review);
 }
 // Rich, safe formatting for AI replies; human text stays verbatim.
 function richText(host,text){
  const fmt=format();
  if(fmt?.render)host.append(fmt.render(document,text));
  else host.append(make('p','',String(text||'')));
 }
 // Load a specific Crow song reply into the studio (explicit user action).
 function openSongInStudio(text){
  const song=window.PaperworldCrowStudioDraft?.parseSong(text);
  if(!song){status.textContent='Η πρόταση δεν περιέχει ολοκληρωμένο τραγούδι για το Studio.';return}
  if(musicPanel.hidden)musicToggle.click();
  musicTitle.value=song.title;musicStyle.value=song.style;musicLyrics.value=song.lyrics;
  refreshCounters();rememberSongDraft();musicCopy.hidden=false;musicCancel.hidden=false;
  musicResult.textContent='Μεταφέρθηκε η πρόταση του Crow. Έλεγξε τα πεδία πριν τη δημιουργία.';
 }
 function bubble(role,text,when,message=null){
  const item=make('article','world-chat-message '+(role==='human'?'world-dialogue-human':'world-dialogue-agent'));
  // Human text is rendered verbatim. AI replies use the safe Markdown subset
  // (DOM nodes only, never HTML) so lists, links and code stay readable.
  const normalized=role==='human'?text:String(text||'').replace(/\\n/g,'\n');
  const fmt=format();
  if(role==='human')item.append(make('p','pw-human-text',normalized));
  else if(fmt?.looksLikeSong(normalized)&&window.PaperworldCrowStudioDraft?.parseSong(normalized)){
   // A song package becomes a compact card; lyrics stay one tap away and the
   // full text is preserved for the Studio import.
   const song=window.PaperworldCrowStudioDraft.parseSong(normalized);
   const lead=normalized.split(/\n\s*\**\s*TITLE\s*\**\s*:/i)[0].trim();
   if(lead){const body=make('div','pw-md');richText(body,fmt.isLong(lead)?fmt.summary(lead):lead);item.append(body)}
   const card=make('div','pw-song-card');
   card.append(make('span','pw-song-kicker','Πρόταση τραγουδιού'),make('strong','pw-song-title',song.title),
    make('p','pw-song-style',song.style));
   const lyrics=make('details','world-chat-full-report pw-song-lyrics');
   lyrics.append(make('summary','','Στίχοι'),make('p','pw-song-lyrics-text',song.lyrics));
   card.append(lyrics);item.append(card);
  }
  else if(fmt?.isLong(normalized)){
   // Long reports lead with a readable summary; the complete, unaltered
   // answer stays one tap away and opens in place without moving the view.
   item.classList.add('pw-long');
   item.append(make('p','world-chat-brief',fmt.summary(normalized)));
   const details=make('details','world-chat-full-report');
   const full=make('div','world-chat-unabridged pw-md');
   details.append(make('summary','','Ολόκληρη απάντηση'),full);
   details.addEventListener('toggle',()=>{
    if(details.open&&!full.childNodes.length)richText(full,normalized);
   },{once:false});
   item.append(details);
  }else{
   const body=make('div','pw-md');richText(body,normalized);item.append(body);
  }
  const footer=make('div','pw-msg-footer');
  if(when&&Number.isFinite(Date.parse(when))){
   const time=make('time','world-chat-time',new Date(when).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'}));
   time.dateTime=when;footer.append(time);
  }
  if(role!=='human'&&openId==='studio-director'&&fmt?.looksLikeSong(normalized)){
   const action=make('button','pw-chip pw-chip-accent','♫ Άνοιγμα στο Music Studio');
   action.type='button';action.addEventListener('click',()=>openSongInStudio(normalized));
   footer.prepend(action);
  }
  if(footer.childNodes.length)item.append(footer);
  if(role==='human'&&message?.rememberable===true)rememberAction(item,message);
  return item;
 }
 // Friendly, non-technical failure copy. Technical detail stays collapsed.
 function friendlyError(error){
  const raw=String(error?.message||error||'');
  if(/github_reconnect_required/.test(raw))return 'Χρειάζεται επανασύνδεση του GitHub για τις AI απαντήσεις.';
  if(/verify_github_zero_overage_budget|no_verified_price_model/.test(raw))return 'Η AI σύνδεση δεν είναι ενεργή αυτή τη στιγμή.';
  if(/another_request_active|429/.test(raw))return 'Ολοκληρώνεται ήδη ένα άλλο αίτημα. Δοκίμασε σε λίγο.';
  if(/session expired|sign in|unauthorized|401/i.test(raw))return 'Η σύνδεση στο PAPERWORLD Cloud χρειάζεται ανανέωση.';
  if(/503|unavailable|network|failed to fetch|timeout/i.test(raw))return 'Ο server δεν απάντησε. Δοκίμασε ξανά σε λίγο.';
  return 'Η απάντηση δεν ολοκληρώθηκε.';
 }
 let pendingFailure=null; // {agentId,text,noteSaved,error}
 function failureCard(failure){
  const card=make('div','pw-failure');card.setAttribute('role','alert');
  card.append(make('p','pw-failure-text',friendlyError(failure.error)));
  const row=make('div','pw-failure-actions');
  const retry=make('button','pw-chip pw-chip-accent','Ξαναδοκίμασε');retry.type='button';
  retry.addEventListener('click',()=>retryFailure(failure));
  const detail=make('details','pw-failure-detail');
  detail.append(make('summary','','Λεπτομέρειες'),
   make('p','',String(failure.error?.message||'').slice(0,240)));
  row.append(retry,detail);card.append(row);
  return card;
 }
 function retryFailure(failure){
  if(busy||openId!==failure.agentId)return;
  pendingFailure=null;
  if(failure.agentId!=='matt'&&failure.noteSaved){
   // The message is already saved: ask again without saving a duplicate.
   void submitDirector(failure.agentId,failure.text,{saveNote:false});
   return;
  }
  field.value=failure.text;autoGrow();field.focus();
  if(failure.agentId!=='matt')form.requestSubmit();
  else paint();
 }
 const typing=make('div','pw-typing');typing.setAttribute('aria-label','Γράφει…');
 typing.append(make('span'),make('span'),make('span'));
 function showTyping(){
  if(!busy){typing.remove();return}
  messages.append(typing);scrollBottom();
 }
 function system(text){return make('p','world-dialogue-note',text)}
 function scrollBottom(){messages.scrollTo?.({top:messages.scrollHeight,behavior:'auto'});
  messages.scrollTop=messages.scrollHeight}
 function appendEntries(entries){
  messages.replaceChildren();
  const eligible=entries.map((m,i)=>m.role==='human'&&m.id?i:-1)
   .filter(i=>i>=0).at(-1);
  for(const [i,m] of entries.entries())
   messages.append(bubble(m.role,m.text,m.time,{
    id:m.id,text:m.text,rememberable:i===eligible&&openId!=='matt'
   }));
  if(openId==='matt')for(const reply of mattReplies)messages.append(bubble('agent',reply.content,reply.time));
  else for(const reply of directorReplies.get(openId)||[])
   messages.append(bubble('agent',reply.content,reply.time));
  if(!entries.length&&!(openId==='matt'?mattReplies.length:(directorReplies.get(openId)||[]).length))messages.append(system(openId==='matt'?
   'Πες μου τι έχεις στο μυαλό σου. Θα βρούμε μαζί πώς να προχωρήσουμε.':
   'Γράψε '+(openId==='listening-director'?'στη ':'στον ')+heading.textContent+' ό,τι χρειάζεσαι για το project.'));
  if(pendingFailure&&pendingFailure.agentId===openId)messages.append(failureCard(pendingFailure));
  showTyping();
  scrollBottom();
 }
 // Matt's authenticated history includes spontaneous village notifications.
 // Read-only, visible-chat-only refresh. No AI turns, jobs or background writes.
 let mattLiveTimer=null,mattLiveReading=false,mattHistorySignature='';
 function ingestMattHistory(history){
  if(!Array.isArray(history)||!historyCodec())return;
  const fingerprint=history.length+':'+history.map(m=>String(m?.id||'')).join('|');
  if(fingerprint===mattHistorySignature&&mattCachedEntries!==null)return;
  mattHistorySignature=fingerprint;
   const recovered=historyCodec().recover(history);
   // Recover owner-scoped Crow drafts after reload or a duplicate HTTP 409.
   const savedStudio=window.PaperworldCrowStudioDraft?.fromSavedHistory(
    history,historyCodec().decode);
   if(savedStudio&&!latestStudioHandoff){
    latestSavedStudioDraft=savedStudio;
    latestStudioHandoff={delegated:true,directorId:'studio-director',
     requestId:savedStudio.requestId,request:savedStudio.originalRequest,
     directorReport:savedStudio.style};
    openStudio.hidden=false;
   }
   // Persisted ID = original request UUID. Discard only the matching
   // temporary bubble to prevent duplicates, not all unsaved replies.
   const freshReplies=historyCodec().reconcileReplies(mattReplies,history);
   mattReplies.splice(0,mattReplies.length,...freshReplies);
   mattCachedEntries=recovered.display;
   if(!busy){activeMattDirector=recovered.activeDirector;
    mattConversation.splice(0,mattConversation.length,...recovered.turns)}
   appendEntries(recovered.display);
 }
 async function refreshLiveMatt(){
  if(mattLiveReading||openId!=='matt'||busy||
   !cloud()?.signedIn()||typeof cloud()?.privateAgentMessages!=='function'||
   (typeof document.visibilityState==='string'&&document.visibilityState!=='visible'))
   return;
  const selectedRevision=revision;
  mattLiveReading=true;
  try{
   const history=await cloud().privateAgentMessages('matt');
   if(openId==='matt'&&!busy&&selectedRevision===revision)
    ingestMattHistory(history);
  }catch(_){/* A failed read never implies any completed work. */}
  finally{mattLiveReading=false}
 }
 function stopLiveMatt(){
  if(mattLiveTimer!==null){clearInterval(mattLiveTimer);mattLiveTimer=null}
 }
 function startLiveMatt(){
  stopLiveMatt();
  if(openId==='matt'&&cloud()?.signedIn())
   mattLiveTimer=setInterval(()=>{void refreshLiveMatt()},20000);
 }
 function paint(){
  const token=++revision;
  document.documentElement.classList.toggle('pw-chat-open',!!openId);
  if(!openId){panel.hidden=true;veil.hidden=true;return}
  panel.hidden=false;veil.hidden=false;
  const isMatt=openId==='matt';
  if(panel.dataset.agent!==openId){setMenu(false);
   if(pendingFailure&&pendingFailure.agentId!==openId)pendingFailure=null}
  panel.dataset.agent=openId;
  if(memorySheet.hidden===false&&memoryOwner!==openId)closeMemory();
  const agent=world()?.agents()?.find(a=>a.id===openId);
  const profile=window.PaperworldProfiles?.get(openId);
  heading.textContent=profile?.name||(isMatt?'Matt':agent?.name||'Director');
  if(window.PaperworldProfiles)window.PaperworldProfiles.paintAvatar(avatar,openId);
  else avatar.textContent=heading.textContent.charAt(0).toUpperCase();
  activity.textContent=(isMatt?'Chief of Staff':(profile?.project||'Η ομάδα σου'));
  const active=cloud()?.signedIn()===true;
  const available=active&&typeof cloud()?.privateAgentMessages==='function'&&!busy;
  status.textContent=!active?'Συνδέσου στο PAPERWORLD Cloud για να στείλεις μηνύματα.':
   isMatt?(mattJourneyCaption||villageActivityText||'Πες μου τι έχεις στο μυαλό σου.'):
   'Μίλα μου ελεύθερα.';
  // Owner-scoped progress is read-only; opening Messenger never starts a Worker.
   if(isMatt&&active&&!busy&&
     typeof cloud()?.listAutonomousMissions==='function'&&
     Date.now()-villageActivityLastRead>30000){
    villageActivityLastRead=Date.now();
    cloud().listAutonomousMissions().then(rows=>{
     if(token!==revision||openId!=='matt'||busy)return;
     const summary=window.PaperworldVillageActivity?.summary(rows);
     if(!summary)return;
     villageActivityText=summary.attention?
      'Έχουμε '+summary.attention+' θέματα που χρειάζονται την απόφασή σου.':
      summary.active?'Η ομάδα δουλεύει σε '+summary.active+' '+(summary.active===1?'εργασία.':'εργασίες.'):
      'Πες μου τι έχεις στο μυαλό σου.';
     if(!mattJourneyCaption)status.textContent=villageActivityText;
    }).catch(()=>{/* A failed read never implies completion. */});
   }
   decisions.hidden=!isMatt||!active;
  memoryReview.hidden=!isMatt||!active;
  musicToggle.hidden=openId!=='studio-director'||!active;
  studioItem.hidden=musicToggle.hidden;
  memoryItem.hidden=!active||!AGENT_PROJECT[openId];
  memoryItem.textContent=isMatt?'Τι γνωρίζει ο Matt':'Τι γνωρίζει '+
   (heading.textContent==='Luna'?'η ':'ο ')+heading.textContent;
  activity.dataset.state=active?'online':'offline';
  activity.title=active?'Συνδεδεμένο στο PAPERWORLD Cloud':'Εκτός σύνδεσης';
  openStudio.hidden=!isMatt||!active||!latestStudioHandoff||busy;
  if(musicToggle.hidden)resetMusic();
  if(isMatt&&active){setupDecisions();void refreshDecisions()}
  if(active&&isMatt&&(mattCachedEntries!==null||mattReplies.length))
   appendEntries(mattCachedEntries||[]);
  else messages.replaceChildren(system(active?'Φόρτωση ιδιωτικού ιστορικού…':'Απαιτείται σύνδεση.'));
  connectGithub.hidden=!isMatt||!active;
  if(isMatt&&active)void refreshGithubConnection(token);
  if(openId==='studio-director'&&active)void refreshSunoConnection();
  if(active&&typeof cloud()?.privateAgentMessages==='function'){
   const selected=openId;
   cloud().privateAgentMessages(selected).then(history=>{
    if(token!==revision||openId!==selected)return;
    if(selected==='matt'&&historyCodec()){
     ingestMattHistory(history);
    }else{
     if(selected==='studio-director'){
      const last=history.filter(m=>m.role==='agent'&&typeof m.content==='string').at(-1);
      latestSavedCrowReply=last?{content:last.content,time:last.created_at||null}:null;
     }
     const existing=directorReplies.get(selected)||[];
     const savedIds=new Set(history.filter(m=>m.role==='agent').map(m=>m.id));
     const waiting=existing.filter(m=>!m.id||!savedIds.has(m.id));
     directorReplies.set(selected,waiting);
     appendEntries(history.map(m=>({role:m.role==='human'?'human':'agent',
      id:m.id,text:m.content,time:m.created_at})));
    }
   }).catch(error=>{
    if(token!==revision||openId!==selected)return;
    messages.replaceChildren(system('Το ιστορικό δεν φορτώθηκε: '+error.message));
   });
  }
  field.disabled=!available;send.disabled=!available;
  field.placeholder=available?'Μήνυμα προς '+heading.textContent+'…':
   busy?'Περιμένω απάντηση…':'Συνδέσου για να στείλεις μήνυμα';
  field.setAttribute('aria-label','Μήνυμα προς '+heading.textContent);
  contextRow.hidden=openStudio.hidden;
 }
 // Return focus to whatever opened the Messenger (village control, shortcut).
 let opener=null;
 document.addEventListener('focusin',e=>{if(!panel.contains(e.target))opener=e.target});
 function show(id){stopLiveMatt();openId=id;paint();startLiveMatt();fitViewport();autoGrow();
  document.dispatchEvent(new CustomEvent('paperworld:chat-opened',{detail:{id}}));
  // Avoid popping the phone keyboard over the conversation on open.
  if(!field.disabled&&!window.matchMedia?.('(pointer: coarse)')?.matches)field.focus();
 }
 function hide(){stopLiveMatt();openId=null;const closed=panel.hidden?null:panel.dataset.agent||null;clearRoutineReview();resetMusic();setMenu(false);memorySheet.hidden=true;
  panel.classList.remove('pw-memory-open');veil.classList.remove('world-chat-journey');paint();
  (opener&&opener.isConnected&&opener!==document.body?opener:mattBtn).focus?.();opener=null;
  // Lets the Workspace return the user to where they came from (Team/Work).
  if(closed)document.dispatchEvent(new CustomEvent('paperworld:chat-closed',{detail:{id:closed}}))}
 // Optional draft from Work ("Ζήτα κάτι από την ομάδα"): prefilled only,
 // never sent automatically — the owner still presses Send.
 function open(id,{draft=''}={}){
  show(id);
  if(typeof draft==='string'&&draft.trim()&&!field.disabled){
   field.value=draft.trim().slice(0,1500);autoGrow();field.focus();
  }
 }
 function showMemory(id){if(!AGENT_PROJECT[id])return;show(id);void openMemory()}
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
   const routineIntent=window.PaperworldRoutineIntent?.classify?.(text);
   if(routineIntent){
    // A recognized scheduling request is not an AI chat dispatch. Only mark
    // it submitted after the authenticated routine preview/list succeeded.
    // On errors/clarifications keep the draft so the owner can retry/edit.
    const accepted=routineIntent.kind==='list_routines'?
     await listMattRoutines():await previewMattRoutine(routineIntent);
    if(accepted===true&&openId==='matt'){
     // Never erase newer text typed while the asynchronous preview was loading.
     if(field.value.trim()===text){field.value='';autoGrow()}
     const submitted=bubble('human',text,new Date().toISOString());
     submitted.classList.add('pw-routine-request');
     submitted.setAttribute('aria-label','Αίτημα προγράμματος');
     messages.querySelector('.world-dialogue-note')?.remove();
     messages.append(submitted);
     scrollBottom();
    }
    return;
   }
   clearRoutineReview();
   await runMattWorkflow(text);
   return;
  }
  const isDirector=['listening-director','pokemon-director',
   'studio-director','wellbeing-director'].includes(id);
  if(isDirector){await submitDirector(id,text);return}
  busy=true;field.disabled=true;send.disabled=true;
  try{
   await cloud().sendPrivateAgentMessage(id,text);
   field.value='';autoGrow();
  }catch(error){
   status.textContent='Η συνομιλία δεν ολοκληρώθηκε: '+error.message;
   if(error.noteSaved)field.value='';
  }
  finally{busy=false;if(openId===id)paint()}
 });
 // Optimistic send: the message appears at once, a typing indicator follows,
 // and a failure offers one-tap retry without duplicating a saved note.
 async function submitDirector(id,text,{saveNote=true}={}){
  if(busy||!cloud()?.signedIn())return;
  busy=true;field.disabled=true;send.disabled=true;pendingFailure=null;
  const optimistic=bubble('human',text,new Date().toISOString());
  optimistic.classList.add('pw-pending');
  if(saveNote&&openId===id){messages.querySelector('.world-dialogue-note')?.remove();messages.append(optimistic)}
  field.value='';autoGrow();showTyping();scrollBottom();
  try{
   const result=saveNote?await cloud().askDirector(id,text):
    await cloud().askDirector(id,text,{saveNote:false});
   const existing=directorReplies.get(id)||[];
   directorReplies.set(id,[...existing,{id:result.persisted===true?result.requestId:null,
    content:result.content,time:new Date().toISOString()}].slice(-12));
  }catch(error){
   pendingFailure={agentId:id,text,noteSaved:error?.noteSaved===true||!saveNote,error};
   if(!pendingFailure.noteSaved&&openId===id){field.value=text;autoGrow()}
  }
  finally{busy=false;typing.remove();if(openId===id)paint()}
 }
 // Composer grows with its content up to a comfortable maximum.
 function autoGrow(){
  field.style.height='auto';
  field.style.height=Math.min(field.scrollHeight,160)+'px';
 }
 field.addEventListener('input',autoGrow);
 // Keep the composer above the on-screen keyboard on phones and tablets.
 const vv=window.visualViewport;
 function fitViewport(){
  if(!vv)return;
  panel.style.setProperty('--pw-vvh',Math.round(vv.height)+'px');
  panel.style.setProperty('--pw-vvtop',Math.round(vv.offsetTop)+'px');
 }
 if(vv){vv.addEventListener('resize',fitViewport);vv.addEventListener('scroll',fitViewport);fitViewport()}
 field.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!field.disabled&&field.value.trim())form.requestSubmit()}
 });
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
  const t=e.target;
  if(e.key==='Escape'&&openId){
   if(!menu.hidden){setMenu(false);menuBtn.focus();return}
   if(!memorySheet.hidden){closeMemory();return}
   if(!musicPanel.hidden&&panel.classList.contains('pw-studio-open')&&
      window.matchMedia?.('(max-width: 899px)')?.matches){musicToggle.click();return}
   hide();return}
  if(t?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(e.key.toLowerCase()==='m'){e.preventDefault();show('matt')}
  if(e.key.toLowerCase()==='t'){e.preventDefault();nearby()}
 });
 // Return to the prepared song after Suno redirects back to Paperworld.
 // The callback query string alone is NOT a connection proof: the status
 // indicator separately reads the authenticated server's current OAuth state.
 if(sunoReturn.get('suno_link')==='connected'&&cloud()?.signedIn()&&
    validSongOwner(songOwner())){
  show('studio-director');
  musicPanel.hidden=false;
  musicToggle.setAttribute('aria-expanded','true');
  syncStudio();
  if(restoreSongDraft()){
   musicResult.textContent='Το τραγούδι σου διατηρήθηκε. Έλεγξε τη σύνδεση Suno και συνέχισε.';
   musicCopy.hidden=false;musicCancel.hidden=false;
  }
  void refreshSunoConnection();
 }else if(new URLSearchParams(window.location.search).get('github_link')==='connected'&&
   cloud()?.signedIn()){
  show('matt');
 }
 document.addEventListener('visibilitychange',()=>{
  if(openId==='matt'&&document.visibilityState==='visible')void refreshLiveMatt();
 });
 window.PaperworldWorldDialogue=Object.freeze({show,close:hide,nearby,open,showMemory,
  isOpen:()=>!!openId});
})();
