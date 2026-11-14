/* PAPERWORLD Workshop dialogue: deterministic routing only.
   Not an LLM, not a claim that an agent has executed code. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldWorkshop=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TOKEN_WORDS=['ticketswap','ticket swap','τικετσουαπ','τικετσβαπ'];
 function classify(value){
  const text=String(value||'').trim().slice(0,1500);
  if(!text)return {type:'empty',text};
  const normal=text.toLocaleLowerCase('el-GR');
  if(TOKEN_WORDS.some(x=>normal.includes(x)))
   return {type:'ticketswap',text,reply:'Κατάλαβα. Πρόκειται για το TicketSwap του Listening Mirror. Θα χρησιμοποιήσουμε την ήδη υπάρχουσα αποστολή αντί να δημιουργήσουμε άλλο αντίγραφο. Μπορώ να σου δείξω την κατάστασή της και, μόνο με ξεχωριστή έγκρισή σου, να ζητήσω έρευνα από τον AI Developer.'};
  return {type:'other',text,reply:'Το σημείωσα ως αίτημα για το Listening Mirror. Δεν έχω ακόμη γενικό AI Developer για οποιοδήποτε πρόβλημα. Μπορείς να αποθηκεύσεις το αίτημα ως εργασία ή να το επεξεργαστούμε όταν προστεθεί ο αντίστοιχος Worker.'};
 }
 function existingTicketSwap(missions){
  if(!Array.isArray(missions))return null;
  const valid=missions.filter(m=>m?.project_room==='workshop'&&m.repository==='mr-tanq/concerts'&&/ticketswap/i.test(m.title||'')&&m.status!=='cancelled');
  const priority={ready_for_review:0,draft:1};
  return valid.sort((a,b)=>(priority[a.status]??9)-(priority[b.status]??9)||Date.parse(b.created_at||0)-Date.parse(a.created_at||0))[0]||null;
 }
 return {classify,existingTicketSwap};
});