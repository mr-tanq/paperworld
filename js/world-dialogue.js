/* PAPERWORLD in-world Messenger-style conversations.
 * One visual message stream, real private user notes, and honest non-AI responses.
 * No Copilot model call, credit use or automatic worker execution.
 */
(()=>{'use strict';
 const view=document.querySelector('#view'),world=()=>window.PaperworldWorld,cloud=()=>window.PaperworldCloudUI;
 if(!view)return;
 let openId=null,revision=0,busy=false,proposedHandoff=null;
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
 const activity=make('small','world-chat-presence','Chief of Staff · AI not connected');
 identity.append(heading,activity);
 const close=make('button','world-chat-close','×');
 close.type='button';close.setAttribute('aria-label','Close conversation');
 top.append(avatar,identity,close);
 const status=make('p','world-dialogue-status');
 status.setAttribute('role','status');
 const messages=make('div','world-dialogue-messages');
 messages.setAttribute('role','log');
 messages.setAttribute('aria-label','Conversation messages');
 const handoffAction=make('button','world-dialogue-handoff','Άνοιξε την αποστολή στο Listening Mirror Workshop');
 handoffAction.type='button';handoffAction.hidden=true;
 const form=make('form','world-dialogue-form');
 const field=make('textarea','world-chat-input');
 const send=make('button','world-chat-send','➤');
 field.rows=1;field.maxLength=1500;field.required=true;
 field.setAttribute('aria-label','Message to agent');
 send.type='submit';send.setAttribute('aria-label','Send message');
 form.append(field,send);
 const composer=make('footer','world-chat-composer');
 const helper=make('small','world-chat-helper','Human-controlled · No automatic AI or spending');
 composer.append(handoffAction,form,helper);
 panel.append(top,status,messages,composer);view.append(panel);

 function bubble(role,text,when){
  const item=make('article','world-chat-message '+(role==='human'?'world-dialogue-human':'world-dialogue-agent'));
  const body=make('p','',text);item.append(body);
  if(when&&Number.isFinite(Date.parse(when))){
   const time=make('time','world-chat-time',new Date(when).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'}));
   time.dateTime=when;item.append(time);
  }
  return item;
 }
 function system(text){return make('p','world-dialogue-note',text)}
 function scrollBottom(){messages.scrollTop=messages.scrollHeight}
 function localMattEntries(){
  const history=cloud()?.mattMessages?.()||[];
  return history.map(m=>({role:m.role==='human'?'human':'agent',text:m.text,time:m.createdAt}));
 }
 function appendEntries(entries){
  messages.replaceChildren();
  for(const m of entries)messages.append(bubble(m.role,m.text,m.time));
  if(!entries.length)messages.append(system(openId==='matt'?'Πες στον Matt τι χρειάζεσαι. Προς το παρόν μπορεί να προτείνει αναθέσεις, όχι να εκτελέσει AI.':'Μπορείς να αφήσεις ένα ιδιωτικό μήνυμα. Ο Director δεν απαντά ακόμη με AI.'));
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
  activity.textContent=isMatt?'Chief of Staff · AI not connected':'Project Director · AI not connected';
  const active=cloud()?.signedIn()===true;
  const available=active&&typeof cloud()?.privateAgentMessages==='function'&&!busy;
  const localMatt=isMatt&&active&&typeof cloud()?.mattMessages==='function';
  status.textContent=!active?'Sign in to PAPERWORLD Cloud from the side menu to save messages.':
   isMatt?'Τοπικές απαντήσεις Matt · χωρίς πραγματικό AI ακόμα':'Τα μηνύματα αποθηκεύονται ιδιωτικά · χωρίς αυτόματη απάντηση';
  // One conversation stream: Matt's local messages, or Directors' cloud messages.
  if(localMatt){appendEntries(localMattEntries())}
  else {messages.replaceChildren(system(active?'Φόρτωση ιστορικού…':'Συνδέσου για να δεις τα μηνύματά σου.'))}
  if(active&&typeof cloud()?.privateAgentMessages==='function'){
   const selected=openId;
   cloud().privateAgentMessages(selected).then(history=>{
    if(token!==revision||openId!==selected)return;
    if(isMatt&&localMatt&&localMattEntries().length)return; // No duplicate sent notes.
    appendEntries(history.map(m=>({role:m.role==='human'?'human':'agent',text:m.content,time:m.created_at})));
   }).catch(error=>{
    if(token!==revision)return;
    if(!isMatt||!localMatt)messages.replaceChildren(system('Το ιστορικό δεν φορτώθηκε: '+error.message));
   });
  }
  handoffAction.hidden=!(isMatt&&proposedHandoff?.to==='listening-director'&&
    /ticket\s*swap|ticketswap|τικετ/i.test(proposedHandoff.request||'')&&
    typeof cloud()?.openMattHandoff==='function');
  field.disabled=!available;send.disabled=!available;
  field.placeholder=available?'Γράψε μήνυμα…':'Συνδέσου για να στείλεις μήνυμα';
 }
 function show(id){if(id!=='matt')proposedHandoff=null;openId=id;paint();if(!field.disabled)field.focus()}
 function hide(){openId=null;proposedHandoff=null;paint();mattBtn.focus()}
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
 handoffAction.addEventListener('click',()=>{
  try{cloud().openMattHandoff(proposedHandoff);hide()}
  catch(error){status.textContent='Δεν άνοιξε η αποστολή: '+error.message}
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!openId||!cloud()?.signedIn()||field.disabled||busy)return;
  const id=openId,text=field.value;
  busy=true;send.disabled=true;field.disabled=true;
  let failure=null;
  try{
   await cloud().sendPrivateAgentMessage(id,text);
   if(id==='matt'){
    const response=cloud().sendMattMessage(text);
    proposedHandoff=response?.proposal||null;
   }
   field.value='';
  }catch(error){failure=error}
  finally{busy=false;if(openId===id){paint();if(failure)status.textContent='Μήνυμα δεν αποθηκεύτηκε: '+failure.message}}
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
