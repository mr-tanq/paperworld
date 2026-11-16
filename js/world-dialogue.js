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
 const sunoConnect=make('button','crow-music-check','Σύνδεση Suno');
 sunoConnect.type='button';
 sunoConnect.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn()||
     typeof cloud()?.beginSunoLink!=='function')return;
  const agreed=window.confirm('Θα μεταφερθείς στη σελίδα εξουσιοδότησης του Suno. '+
   'Δεν θα δημιουργηθεί τραγούδι και δεν θα καταναλωθούν credits. Συνέχεια;');
  if(!agreed)return;
  sunoConnect.disabled=true;musicResult.textContent='Έλεγχος ασφαλούς σύνδεσης…';
  try{
   const url=await cloud().beginSunoLink();
   window.location.assign(url);
  }catch(_){
   musicResult.textContent='Το Suno δεν προσφέρει ακόμη επιβεβαιωμένη σύνδεση σε αυτόν τον client. '+
    'Η παραγωγή παραμένει απενεργοποιημένη.';
  }finally{sunoConnect.disabled=false}
 });
 const sunoLinkStatus=make('button','crow-music-check','Κατάσταση λογαριασμού Suno');
 sunoLinkStatus.type='button';
 sunoLinkStatus.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn()||
   typeof cloud()?.sunoLinkStatus!=='function')return;
  sunoLinkStatus.disabled=true;
  try{
   const r=await cloud().sunoLinkStatus();
   musicResult.textContent=r.oauthAuthorized?
    'Ο λογαριασμός εξουσιοδοτήθηκε στον server. Η παραγωγή παραμένει απενεργοποιημένη.':
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
  musicResult.textContent='Έλεγχος διαθέσιμων εργαλείων χωρίς δημιουργία μουσικής…';
  try{
   const r=await cloud().inspectSunoTools();
   const toolFailures={
    not_authorized:'Δεν υπάρχει ενεργή εξουσιοδότηση Suno.',
    authorization_rejected:'Το Suno απέρριψε το token πρόσβασης (401/403).',
    unsupported_mcp_transport:'Το Suno απάντησε με μη υποστηριζόμενη HTTP κατάσταση.',
    unsupported_response_type:'Το Suno επέστρεψε μη υποστηριζόμενο τύπο απάντησης.',
    unverified_mcp_response:'Η απάντηση MCP δεν πέρασε τον έλεγχο μορφής.',
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
   musicResult.textContent=r.toolsListed?
    'Επαληθεύτηκαν '+r.toolCount+' εργαλεία MCP. Η παραγωγή παραμένει απενεργοποιημένη.':
    (toolFailures[r.reason]||'Δεν επαληθεύτηκαν τα εργαλεία MCP.')+
    ' Η παραγωγή παραμένει απενεργοποιημένη.';
  }catch(_){musicResult.textContent='Απαιτείται ενεργή σύνδεση Suno ή συμβατή έκδοση MCP.'}
  finally{sunoTools.disabled=false}
 });
 const sunoCheck=make('button','crow-music-check','Διάγνωση σύνδεσης Suno');
 sunoCheck.type='button';
 sunoCheck.addEventListener('click',async()=>{
  if(openId!=='studio-director'||musicBusy||!cloud()?.signedIn()||
     typeof cloud()?.diagnoseSunoConnection!=='function')return;
  sunoCheck.disabled=true;
  musicResult.textContent='Έλεγχος σύνδεσης Suno, χωρίς χρήση credits…';
  try{
   const r=await cloud().diagnoseSunoConnection();
   const descriptions={
    provider_resource_unavailable:'Δεν επιβεβαιώθηκαν τα δημόσια στοιχεία MCP του Suno.',
    client_registration_unverified:'Το Suno δεν έχει επιβεβαιώσει τη συμβατότητα εξουσιοδότησης με το Paperworld.',
    owner_oauth_required:'Ο λογαριασμός δεν έχει συνδεθεί. Χρησιμοποίησε «Σύνδεση Suno».',
    mcp_tools_unverified:'Ο λογαριασμός συνδέθηκε, αλλά δεν επαληθεύτηκαν τα εργαλεία MCP.',
    generation_not_enabled:'Ο λογαριασμός και τα '+r.toolCount+' εργαλεία επαληθεύτηκαν. Η παραγωγή δεν έχει ενεργοποιηθεί.'
   };
   const reasonHint={
    authorization_rejected:'Ο πάροχος απέρριψε την εξουσιοδότηση.',
    unsupported_mcp_transport:'Μη υποστηριζόμενη απάντηση HTTP/MCP.',
    unsupported_response_type:'Μη υποστηριζόμενος τύπος απάντησης MCP.',
    unverified_mcp_response:'Μη έγκυρη απάντηση JSON-RPC.',
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
   musicResult.textContent='Ο έλεγχος δεν ολοκληρώθηκε. Η παραγωγή παραμένει απενεργοποιημένη.';
  }finally{sunoCheck.disabled=false}
 });
 const sunoInstructions=make('a','crow-music-instructions','Οδηγίες σύνδεσης Suno MCP');
 sunoInstructions.href='https://suno.com/mcp';
 sunoInstructions.target='_blank';sunoInstructions.rel='noopener noreferrer';
 musicPanel.append(musicHelp,sunoCheck,musicResult,sunoConnect,sunoLinkStatus,
  sunoTools,sunoInstructions,musicFromCrow,musicForm,musicCopy,musicCancel);
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
   musicResult.textContent='Αντιγράφηκε. Μπορείς να το χρησιμοποιήσεις σε assistant με συνδεδεμένο Suno MCP.';
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
    '.';
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
   musicResult.textContent='Η πρόταση ακυρώθηκε.';
  }catch(_){musicResult.textContent='Δεν επιβεβαιώθηκε η ακύρωση. Μπορείς να δοκιμάσεις ξανά.'}
  finally{musicBusy=false;musicCancel.disabled=false}
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
 composer.append(connectGithub,memoryReview,musicToggle,musicPanel,form);
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
     'σταλεί ως πηγή στο GitHub Copilot. Η εγκεκριμένη διερεύνηση καταγράφεται στο ιδιωτικό ιστορικό όταν είναι διαθέσιμο.':
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
  memoryReview.hidden=!isMatt||!active;
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
