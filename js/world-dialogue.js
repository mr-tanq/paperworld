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
 let latestSavedCrowReply=null; // Last persisted Crow agent reply, not temporary UI bubbles.
 let latestStudioHandoff=null,latestSavedStudioDraft=null;
 let mattCachedEntries=null; // Keep visible replies while owner history refreshes.
 let mattJourneyCaption='',villageActivityText='',villageActivityLastRead=0;
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
  connectGithub.textContent=state==='connected'?'GitHub · Συνδεδεμένο':
   state==='disconnected'?'GitHub · Σύνδεση':
   state==='unknown'?'GitHub · Άγνωστο':'GitHub · Έλεγχος…';
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
    setGithubConnection('unknown');
    const reason=String(error?.message||'');
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
 top.append(avatar,identity,connectGithub,close);
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
 const musicToggle=make('button','crow-music-toggle','♫ Προετοιμασία τραγουδιού');
 musicToggle.type='button';musicToggle.hidden=true;
 musicToggle.setAttribute('aria-expanded','false');
 const musicPanel=make('section','crow-music-panel');musicPanel.hidden=true;
 musicPanel.setAttribute('aria-label','Προεπισκόπηση τραγουδιού');
 const musicHelp=make('p','crow-music-help',
  'Ετοίμασε την περιγραφή και τους στίχους για τον Crow.');
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
 const musicSave=make('button','crow-music-save','Ετοίμασε draft');
 musicSave.type='submit';
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
 const musicFromCrow=make('button','crow-music-from-reply','Χρήση τελευταίας πρότασης Crow');
 musicFromCrow.type='button';
 const musicCopy=make('button','crow-music-copy','Αντιγραφή για Suno');
 musicCopy.type='button';
 musicCopy.hidden=true;
 musicCopy.setAttribute('aria-label','Αντιγραφή του ελεγμένου αιτήματος για Suno MCP');
 const sunoGenerate=make('button','crow-music-save','Δημιουργία στο Suno');
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
  const brief={title:musicTitle.value.trim(),style:musicStyle.value.trim(),
   lyrics:musicLyrics.value};
  if(!brief.title||brief.title.length>120||!brief.style||brief.style.length>1000||
     !window.PaperworldCrowStudioDraft?.validLyrics(brief.lyrics)){
   showSunoCreateStatus('Το τραγούδι δεν είναι έτοιμο: έλεγξε τίτλο, ύφος και '+
    'τις αγκύλες στους στίχους. Οι μισογραμμένες οδηγίες δεν στέλνονται στη Suno.','error');
   return;
  }
  if(!window.confirm('Να στείλω αυτό το τραγούδι στο Suno; Μπορεί να χρησιμοποιηθούν Suno credits.')){
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
   const result=await cloud().createSunoSong(brief,key);
   if(result.accepted===true){
    showSunoCreateStatus('Η Suno επιβεβαίωσε τη λήψη του αιτήματος. '+
     'Η ολοκλήρωση του τραγουδιού δεν έχει ακόμη επαληθευτεί. '+
     'Έλεγξε τη Suno Library.','success');
   }else if(result.status==='blocked_before_submission'){
    const hints={
     suno_oauth_required:'Η σύνδεση Suno έληξε. Σύνδεσε ξανά τον λογαριασμό.',
     audio_create_not_verified:'Το εργαλείο δημιουργίας Suno δεν επαληθεύτηκε.',
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
 const musicCancel=make('button','crow-music-cancel','Ακύρωση πρότασης');
 musicCancel.type='button';musicCancel.hidden=true;
 musicForm.append(musicTitle,musicStyle,musicLyrics,musicSave);
 const sunoConnect=make('button','world-connection-chip','Suno · Έλεγχος…');
 sunoConnect.type='button';
 sunoConnect.dataset.state='checking';
 sunoConnect.setAttribute('aria-label','Κατάσταση σύνδεσης Suno');
 function setSunoConnection(state){
  sunoConnect.dataset.state=state;
  sunoConnect.disabled=state==='connected'||state==='checking';
  sunoConnect.textContent=state==='connected'?'Suno · Συνδεδεμένο':
   state==='disconnected'?'Suno · Σύνδεση':
   state==='unknown'?'Suno · Άγνωστο':'Suno · Έλεγχος…';
  sunoConnect.title=state==='connected'?'Suno συνδεδεμένο':
   state==='disconnected'?'Σύνδεση στον λογαριασμό Suno':
   'Πάτησε για επανέλεγχο σύνδεσης Suno';
 }
 async function refreshSunoConnection(){
  if(openId!=='studio-director'||!cloud()?.signedIn()||
     typeof cloud()?.sunoLinkStatus!=='function'){
   setSunoConnection('checking');return;
  }
  const selectedRevision=revision;
  setSunoConnection('checking');
  try{
   const r=await cloud().sunoLinkStatus();
   if(selectedRevision!==revision||openId!=='studio-director')return;
   setSunoConnection(r.oauthAuthorized===true?'connected':'disconnected');
  }catch(_){
   if(selectedRevision===revision&&openId==='studio-director')
    setSunoConnection('unknown');
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
  musicPanel.append(sunoConnect,musicHelp,musicResult,musicFromCrow,
   musicForm,sunoGenerate,sunoCreateStatus,sunoTransportCheck,musicCopy,musicCancel,crowTechnical);
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
  musicResult.textContent='Μεταφέρθηκε η πραγματική αναφορά του Crow. '+
   'Διόρθωσε τίτλο, μουσική κατεύθυνση και στίχους.';
  musicCopy.hidden=false;musicCancel.hidden=false;rememberSongDraft();musicTitle.focus();
 });
 function resetMusic(){
  musicPanel.hidden=true;musicToggle.setAttribute('aria-expanded','false');
  musicForm.reset();musicResult.textContent='';musicCancel.hidden=true;
  musicCopy.hidden=true;
 }
 musicToggle.addEventListener('click',()=>{
  if(musicBusy)return;
  musicPanel.hidden=!musicPanel.hidden;
  musicToggle.setAttribute('aria-expanded',String(!musicPanel.hidden));
  if(!musicPanel.hidden){
   const restored=restoreSongDraft();
   if(restored)musicResult.textContent='Το τραγούδι σου επανήλθε μετά τη σύνδεση.';
   void refreshSunoConnection();
   musicTitle.focus();
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
 const composer=make('footer','world-chat-composer');
 memoryReview.classList.add('village-maintenance-only');
 composer.append(memoryReview,openStudio,musicToggle,musicPanel,form);
 panel.append(top,status,messages,decisions,composer);view.append(panel);
 // Matt owns the conversation; internal agent and worker routing stays invisible.
 async function runMattWorkflow(text){
  if(openId!=='matt'||!cloud()?.signedIn()||busy||!text.trim())return;
  busy=true;field.disabled=true;send.disabled=true;
  veil.classList.remove('world-chat-journey');mattJourneyCaption='';
  status.textContent='Ο Matt το σκέφτεται…';
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
   'Πες μου τι έχεις στο μυαλό σου. Θα βρούμε μαζί πώς να προχωρήσουμε.':
   'Μίλα απευθείας στον Director. Κάθε AI απάντηση χρειάζεται δική σου έγκριση.'));
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
  if(!openId){panel.hidden=true;veil.hidden=true;return}
  panel.hidden=false;veil.hidden=false;
  const isMatt=openId==='matt';
  const agent=world()?.agents()?.find(a=>a.id===openId);
  const profile=window.PaperworldProfiles?.get(openId);
  heading.textContent=profile?.name||(isMatt?'Matt':agent?.name||'Director');
  if(window.PaperworldProfiles)window.PaperworldProfiles.paintAvatar(avatar,openId);
  else avatar.textContent=heading.textContent.charAt(0).toUpperCase();
  activity.textContent=isMatt?'Εδώ για ό,τι χρειαστείς':(profile?.project||'Η ομάδα σου');
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
 function show(id){stopLiveMatt();openId=id;paint();startLiveMatt();if(!field.disabled)field.focus()}
 function hide(){stopLiveMatt();openId=null;resetMusic();veil.classList.remove('world-chat-journey');paint();mattBtn.focus()}
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
 // Return to the prepared song after Suno redirects back to Paperworld.
 // The callback query string alone is NOT a connection proof: the status
 // indicator separately reads the authenticated server's current OAuth state.
 if(sunoReturn.get('suno_link')==='connected'&&cloud()?.signedIn()&&
    validSongOwner(songOwner())){
  show('studio-director');
  musicPanel.hidden=false;
  musicToggle.setAttribute('aria-expanded','true');
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
 window.PaperworldWorldDialogue=Object.freeze({show,close:hide,nearby});
})();
