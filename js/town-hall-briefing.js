/* Paperworld Town Hall: real owner-scoped briefing, never a simulated AI meeting.
 * The village's existing gathering animation remains illustration. A briefing
 * reads only verified owner jobs and proposes conversations, not model calls.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldTownHall=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const ACTORS=Object.freeze([
  {id:'matt',name:'Matt',role:'Chief of Staff',project:'Όλα τα projects'},
  {id:'listening-director',name:'Luna',role:'Director',project:'Listening Mirror'},
  {id:'pokemon-director',name:'Joey',role:'Director',project:'Pokémon Echoes'},
  {id:'studio-director',name:'Crow',role:'Director',project:'The Lost Wanderer'},
  {id:'wellbeing-director',name:'Dave',role:'Director',project:'Wellbeing'}
 ]);
 function getAgenda(raw){
  const hub=globalThis.PaperworldHumanFirstHub;
  if(!hub?.project)throw Error('task_projection_unavailable');
  const data=hub.project(raw);
  const relevant=data.rows.filter(r=>['decision','review_required','needs_attention',
   'in_progress','diagnosed','planned'].includes(r.stage)).slice(0,8);
  return Object.freeze({items:Object.freeze(relevant.map(r=>Object.freeze({
   id:r.id,project:r.project||'Paperworld',
   text:String(r.summary||'').slice(0,180),status:hub.stateLabel(r.stage)
  }))),count:data.counts.decision});
 }
 const make=(tag,cls,text)=>{
  const n=document.createElement(tag);if(cls)n.className=cls;
  if(text!==undefined)n.textContent=text;return n;
 };
 function button(label,cb,cls=''){
  const b=make('button',cls,label);b.type='button';b.addEventListener('click',cb);return b;
 }
 function create(view,{load,chat,openWork,askAI}={}){
  if(!view||typeof load!=='function'||typeof chat!=='function')
   throw Error('town_hall_dependencies_required');
  const modal=make('section','town-hall-panel');modal.hidden=true;
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','false');
  modal.setAttribute('aria-label','Town Hall · συντονισμός');
  const header=make('div','town-hall-head');
  header.append(make('div','',''),button('×',hide,'town-hall-close'));
  const content=make('div','town-hall-body');modal.append(header,content);
  view.append(modal);
  let revision=0,shown=false,meetingBusy=false,lastAgenda='',message='';
  const transcript=[];
  function hide(){shown=false;revision++;modal.hidden=true}
  function paint(data,error=''){
   content.replaceChildren();
   content.append(make('p','town-hall-kicker','TOWN HALL · Η ΟΜΑΔΑ ΣΟΥ'),
    make('h2','','Συνάντηση της ομάδας'),
    make('p','town-hall-description','Οι χαρακτήρες συγκεντρώνονται στο χωριό. '+
     'Εδώ βλέπεις την πραγματική κατάσταση των εργασιών και μπορείς να μιλήσεις '+
     'σε κάθε Director. Δεν ξεκίνησε κοινή AI συζήτηση ή νέα εργασία.'));
   if(error)content.append(make('p','town-hall-error',error));
   const workers=make('div','town-hall-people');
   workers.append(make('h3','','Οι συνεργάτες μου'));
   const roster=make('div','town-hall-roster');
   for(const actor of ACTORS){
    const row=button(actor.name+' · '+actor.project,()=>{
     hide();chat(actor.id);
    },'town-hall-person');
    row.title='Άνοιξε προσωπική συνομιλία με τον '+actor.name;
    roster.append(row);
   }workers.append(roster);content.append(workers);
   // A real multi-agent discussion is always a separate explicit choice.
   // Never infer consent from the illustrative gathering animation.
   const aiSection=make('section','town-hall-ai-session');
   aiSection.append(make('h3','','Πραγματική συζήτηση AI'));
   aiSection.append(make('p','town-hall-description',
    'Η Luna, ο Joey και ο Crow μπορούν να συζητήσουν ένα κοινό θέμα. '+
    'Μόνο εφόσον το εγκρίνεις: έως 3 AI απαντήσεις, μία ανά Director. '+
    'Το Wellbeing δεν συμμετέχει για λόγους ιδιωτικότητας.'));
   const agendaInput=make('textarea','town-hall-agenda-input');
   agendaInput.rows=3;agendaInput.maxLength=280;
   agendaInput.placeholder='Ποιο θέμα θέλεις να συζητήσουμε;';
   agendaInput.setAttribute('aria-label','Θέμα συνάντησης');
   agendaInput.value=lastAgenda;
   aiSection.append(agendaInput);
   const run=button(meetingBusy?'Η συνάντηση εκτελείται…':
    'Έναρξη AI συνάντησης · έως 3 απαντήσεις',async()=>{
     if(meetingBusy||!shown||typeof askAI!=='function')return;
     const text=String(agendaInput.value||'').trim();
     if(!text||text.length>280){message='Γράψε ένα συγκεκριμένο θέμα για τη συνάντηση.';paint(data);return}
     lastAgenda=text;meetingBusy=true;message='Οι Directors συζητούν το θέμα σου…';
     const consentRevision=revision;
     transcript.length=0;paint(data);
     try{
      const speaker=[ACTORS[1],ACTORS[2],ACTORS[3]];
      for(const actor of speaker){
       // Closing the meeting prevents subsequent AI turns; the already
       // started server request must finish before the client can abort it.
       if(!shown||consentRevision!==revision)break;
       const prior=transcript.map(x=>x.name+': '+x.reply.slice(0,130)).join('\\n');
       const request=('Συνάντηση Town Hall. Θέμα από τον χρήστη: '+lastAgenda+
        '. Πες με συντομία (μέχρι 4 προτάσεις) τι προτείνεις για το δικό σου '+
        'project. Μην ισχυριστείς ότι εκτελέστηκε εργασία. '+
        (prior?'Προηγούμενες προτάσεις για συζήτηση: '+prior:'')).slice(0,1100);
       // Every server request enforces owner, thread, its own budget and
       // reject-all tool permissions; the UI cannot authorize writes.
       const result=await askAI(actor.id,request);
       if(result?.executed!==true||result?.aiTurns!==1||
        typeof result.content!=='string'||!result.content.trim())
        throw Error('Η απάντηση του Director δεν επαληθεύτηκε.');
       transcript.push({name:actor.name,reply:result.content.trim().slice(0,1500)});
       message=actor.name+' απάντησε · '+transcript.length+'/3';
       paint(data);
      }
      message=!shown||consentRevision!==revision?
       'Η συνάντηση διακόπηκε από τον χρήστη. Δεν έγιναν άλλες AI κλήσεις.':
       'Η AI συζήτηση ολοκληρώθηκε. Καμία εργασία δεν εφαρμόστηκε.';
     }catch(err){
      message='Η συνάντηση διακόπηκε: '+String(err.message||'').slice(0,120)+
       '. Δεν έγιναν άλλες AI κλήσεις.';
     }finally{meetingBusy=false;paint(data)}
   },'town-hall-run-ai');
   run.disabled=meetingBusy;
   aiSection.append(run);
   if(message)aiSection.append(make('p','town-hall-progress',message));
   for(const reply of transcript){
    const card=make('article','town-hall-ai-reply');
    card.append(make('strong','',reply.name),make('p','',reply.reply));
    aiSection.append(card);
   }
   if(transcript.length)aiSection.append(button('Αντιγραφή πρακτικών',async()=>{
    const text='Town Hall: '+lastAgenda+'\\n\\n'+transcript.map(x=>x.name+
     ': '+x.reply).join('\\n\\n');
    try{await navigator.clipboard.writeText(text)}
    catch(_){message='Δεν ήταν δυνατή η αντιγραφή. Τα πρακτικά παραμένουν εδώ.';paint(data)}
   },'town-hall-copy'));
   content.append(aiSection);
   const agenda=make('section','town-hall-agenda');
   agenda.append(make('h3','','Τι έχουμε σε εκκρεμότητα;'));
   if(data?.items?.length){
    if(data.count)agenda.append(make('p','town-hall-priority',
     data.count+' λύση/λύσεις περιμένουν έγκριση.'));
    for(const item of data.items){
     const row=make('div','town-hall-agenda-item');
     row.append(make('strong','',item.text),
      make('span','',item.project+' · '+item.status));
     agenda.append(row);
    }
   }else agenda.append(make('p','','Δεν υπάρχουν επιβεβαιωμένες εκκρεμότητες αυτή τη στιγμή.'));
   content.append(agenda);
   const foot=make('div','town-hall-footer');
   if(typeof openWork==='function')foot.append(button('Δες όλες τις εργασίες',()=>{
    hide();openWork();
   },'town-hall-work'));
   foot.append(button('Κλείσιμο',hide,'town-hall-dismiss'));
   content.append(foot);
  }
  async function show(){
   const token=++revision;shown=true;modal.hidden=false;
   paint(null);
   try{
    const raw=await load();
    if(token!==revision||!shown)return;
    paint(getAgenda(raw));
   }catch(err){
    if(token!==revision||!shown)return;
    paint(null,'Δεν μπόρεσα να φορτώσω τις εργασίες: '+String(err.message||'').slice(0,160));
   }
  }
  document.addEventListener('keydown',ev=>{
   if(ev.key==='Escape'&&shown)hide();
  });
  paint(null);
  return Object.freeze({show,hide,get open(){return shown}});
 }
 return Object.freeze({create,getAgenda,ACTORS});
});
