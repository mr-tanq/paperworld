/* PAPERWORLD Matt conversation v1: honest local, non-AI session.
   Persistent on this device only; handoffs are previews, NEVER executions. */
(function(root,factory){
'use strict';const api=factory(root.PaperworldAgents);
if(typeof module==='object'&&module.exports)module.exports=factory(require('./agents.js'));
else root.PaperworldMattChat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(agents){
'use strict';
const KEY='paperworld-matt-chat-v1:',MAX=50,MAX_LEN=1500;
const ROUTES=[
 {pattern:/ticket\s*swap|ticketswap/i,to:'listening-director',project:'workshop'},
 {pattern:/listening\s*mirror|συναυλ|concert/i,to:'listening-director',project:'workshop'},
 {pattern:/pok[eé]mon|ποκεμον/i,to:'pokemon-director',project:'pokemon'},
 {pattern:/wanderer|τραγούδ|μουσικ|suno/i,to:'studio-director',project:'studio'},
 {pattern:/γυμνασ|ασκήσ|wellbeing|training/i,to:'wellbeing-director',project:'wellbeing'}
];
function validIdentity(identity){if(typeof identity!=='string'||!identity.trim()||identity.length>250)throw Error('Invalid account');return identity.trim().toLowerCase()}
function storageKey(identity){return KEY+encodeURIComponent(validIdentity(identity))}
function validMessages(raw){
 if(!Array.isArray(raw))return [];
 return raw.filter(m=>m&&['human','matt'].includes(m.role)&&typeof m.text==='string'&&m.text.length<=2200&&
 typeof m.createdAt==='string'&&Number.isFinite(Date.parse(m.createdAt))).slice(-MAX).map(m=>({role:m.role,text:m.text,createdAt:m.createdAt}));
}
function createSession({storage,identity,clock=()=>new Date().toISOString()}){
 const key=storageKey(identity);let history=[];
 try{history=validMessages(JSON.parse(storage?.getItem(key)||'[]'))}catch(_){}
 const persist=()=>{try{storage?.setItem(key,JSON.stringify(history))}catch(_){}};
 function send(text,tasks=[]){
  if(typeof text!=='string'||!text.trim()||text.length>MAX_LEN)throw Error('Message must be 1–1500 characters');
  const input=text.trim(), timestamp=clock();
  let reply,proposal=null;
  const route=ROUTES.find(r=>r.pattern.test(input));
  if(/τι (γίνεται|κάνουν|έχουμε)|εκκρεμ|status|progress|overview/i.test(input)){
   const open=Array.isArray(tasks)?tasks.filter(t=>t&&(t.status==='todo'||t.status==='doing')):[];
   reply='Αυτή τη στιγμή βλέπω '+open.length+' ανοιχτές εργασίες στον πίνακα PAPERWORLD. Δεν έχω εκτελέσει κάποια εργασία. Μπορείς να μου πεις ποιο project να εξετάσουμε.';
  }else if(route){
   proposal=agents.proposeHandoff({from:'matt',to:route.to,project:route.project,operation:'investigate',request:input});
   reply='Μπορώ να προτείνω ανάθεση στον '+agents.agent(route.to).name+'. Είναι μόνο πρόταση: δεν έχει σταλεί σε agent, δεν έχει γίνει AI run και δεν ξοδεύτηκαν credits.';
  }else{
   reply='Σε άκουσα και κράτησα το μήνυμά σου σε αυτή τη συσκευή. Δεν έχω ακόμη συνδεθεί με AI μοντέλο, οπότε δεν θα προσποιηθώ ότι κατάλαβα ή εκτέλεσα την εντολή. Μπορώ να σου δείξω τις εργασίες ή να προτείνω ανάθεση για Listening Mirror, Pokémon, The Lost Wanderer ή Wellbeing.';
  }
  history=[...history,{role:'human',text:input,createdAt:timestamp},{role:'matt',text:reply,createdAt:timestamp}].slice(-MAX);
  persist();
  return {reply,proposal,history:messages()};
 }
 function messages(){return history.map(m=>({...m}))}
 function clear(){history=[];try{storage?.removeItem(key)}catch(_){}}
 return Object.freeze({send,messages,clear});
}
return Object.freeze({createSession,storageKey});
});
