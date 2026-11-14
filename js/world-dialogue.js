/* World dialogue overlay: shortcuts, touch actions and honest non-AI state.
   Existing Matt conversation is reused; no model calls or worker dispatch. */
(()=>{'use strict';
 const view=document.querySelector('#view'),world=()=>window.PaperworldWorld,cloud=()=>window.PaperworldCloudUI;
 if(!view)return;
 let openId=null,revision=0,busy=false;
 const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
 const actions=make('div','world-talk-actions');
 const mattBtn=make('button','','M · Matt'),nearBtn=make('button','','T · Talk');
 for(const b of [mattBtn,nearBtn]){b.type='button';actions.append(b)}
 view.append(actions);
 const panel=make('section','world-dialogue');panel.hidden=true;panel.setAttribute('aria-label','Agent conversation');panel.setAttribute('role','dialog');
 const top=make('div','world-dialogue-head'),heading=make('strong','','Agent'),close=make('button','','×');
 close.type='button';close.setAttribute('aria-label','Close conversation');top.append(heading,close);panel.append(top);
 const status=make('p','world-dialogue-status'),messages=make('div','world-dialogue-messages');
 const privateLog=make('div','world-dialogue-private');
 const form=make('form','world-dialogue-form'),field=make('textarea'),send=make('button','','Send');
 field.rows=2;field.maxLength=1500;field.required=true;field.setAttribute('aria-label','Message to agent');send.type='submit';
 form.append(field,send);panel.append(status,messages,privateLog,form);view.append(panel);
 function paint(){
  const token=++revision;
  if(!openId){panel.hidden=true;privateLog.replaceChildren();return}
  panel.hidden=false;heading.textContent=openId==='matt'?'Matt · Chief of Staff':(world()?.agents().find(a=>a.id===openId)?.name||'Director');
  messages.replaceChildren();
  const active=cloud()?.signedIn();
  const available=active&&typeof cloud()?.privateAgentMessages==='function'&&!busy;
  const localMatt=openId==='matt'&&active&&typeof cloud()?.mattMessages==='function';
  if(localMatt){
   status.textContent='Ιστορικό Matt σε αυτή τη συσκευή · δεν είναι ακόμη AI · καμία αυτόματη ανάθεση.';
   const history=cloud().mattMessages();
   if(!history.length)messages.append(make('p','world-dialogue-agent','Matt: Μπορώ να προτείνω μια ανάθεση ή να σου δείξω εκκρεμότητες.'));
   for(const message of history)messages.append(make('p',message.role==='human'?'world-dialogue-human':'world-dialogue-agent',(message.role==='human'?'Εσύ: ':'Matt: ')+message.text));
  }else if(openId==='matt'){
   status.textContent='Συνδέσου στο PAPERWORLD Cloud από το πλαϊνό μενού για να μιλήσεις στον Matt. Δεν αποστέλλονται μηνύματα χωρίς σύνδεση.';
   messages.append(make('p','world-dialogue-agent','Το ιστορικό Matt είναι συνδεδεμένο με τον λογαριασμό σου.'));
  }else{
   status.textContent='Τα μηνύματά σου αποθηκεύονται ιδιωτικά. Ο Director δεν έχει ακόμη AI μοντέλο ή σύστημα εκτέλεσης.';
   messages.append(make('p','world-dialogue-agent','Μπορείς να αφήσεις μήνυμα για αργότερα. Κανένας Worker δεν ξεκινά και δεν δημιουργείται αυτόματη απάντηση.'));
  }
  privateLog.replaceChildren();
  if(active&&typeof cloud()?.privateAgentMessages==='function'){
   privateLog.append(make('p','world-dialogue-note','Φόρτωση ιδιωτικών μηνυμάτων…'));
   const selected=openId;
   cloud().privateAgentMessages(selected).then(history=>{
    if(token!==revision||openId!==selected)return;
    privateLog.replaceChildren(make('p','world-dialogue-note','Ιδιωτικά αποθηκευμένα μηνύματα · όχι AI απαντήσεις'));
    if(!history.length)privateLog.append(make('p','world-dialogue-note','Δεν υπάρχουν αποθηκευμένα μηνύματα.'));
    for(const m of history)privateLog.append(make('p',m.role==='human'?'world-dialogue-human':'world-dialogue-agent',(m.role==='human'?'Εσύ: ':'Agent: ')+m.content));
   }).catch(error=>{
    if(token!==revision)return;
    privateLog.replaceChildren(make('p','world-dialogue-note','Το ιδιωτικό ιστορικό δεν φορτώθηκε: '+error.message));
   });
  }
  field.disabled=!available;send.disabled=!available;
  field.placeholder=available?(openId==='matt'?'Μίλησε στον Matt…':'Αποθήκευσε μήνυμα για Director (δεν απαντά ακόμη με AI)…'):'Συνδέσου στο Cloud για να στείλεις μήνυμα';
  messages.scrollTop=messages.scrollHeight;
 }
 function show(id){openId=id;paint();if(!field.disabled)field.focus()}
 function hide(){openId=null;paint()}
 function nearby(){
  const target=world()?.nearestAgent(100);
  if(!target){showNotice('Δεν υπάρχει agent κοντά σου. Πλησίασε έναν χαρακτήρα.');return}
  show(target.id);
 }
 let notice;
 function showNotice(s){if(!notice){notice=make('div','world-talk-notice');view.append(notice)}notice.textContent=s;notice.hidden=false}
 mattBtn.addEventListener('click',()=>show('matt'));
 nearBtn.addEventListener('click',nearby);
 close.addEventListener('click',hide);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!openId||!cloud()?.signedIn()||field.disabled||busy)return;
  const id=openId,text=field.value;
  busy=true;send.disabled=true;field.disabled=true;
  let failure=null;
  try{
   await cloud().sendPrivateAgentMessage(id,text);
   if(id==='matt')cloud().sendMattMessage(text);
   field.value='';
  }catch(error){failure=error}
  finally{busy=false;if(openId===id){paint();if(failure)status.textContent='Μήνυμα δεν αποθηκεύτηκε: '+failure.message}}
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
