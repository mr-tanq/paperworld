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
  {id:'wellbeing-director',name:'Wellbeing Director',role:'Director',project:'Wellbeing'}
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
 function create(view,{load,chat,openWork}={}){
  if(!view||typeof load!=='function'||typeof chat!=='function')
   throw Error('town_hall_dependencies_required');
  const modal=make('section','town-hall-panel');modal.hidden=true;
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','false');
  modal.setAttribute('aria-label','Town Hall · συντονισμός');
  const header=make('div','town-hall-head');
  header.append(make('div','',''),button('×',hide,'town-hall-close'));
  const content=make('div','town-hall-body');modal.append(header,content);
  view.append(modal);
  let revision=0,shown=false;
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
