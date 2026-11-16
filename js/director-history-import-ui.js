/* Browser-only owner-selected import interface. No external upload of raw export.
 * A confirmed import stores only the selected excerpts in owner-scoped Supabase.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldHistoryImportUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const PROJECTS=[
  ['workshop','Luna · Listening Mirror'],
  ['pokemon','Joey · Pokémon Echoes'],
  ['studio','Crow · The Lost Wanderer'],
  ['wellbeing','Dave · Wellbeing (private)']
 ];
 function createView({document,parser,upload,confirm,afterImport=()=>{}}={}){
  if(typeof document?.createElement!=='function'||typeof parser?.catalog!=='function'||
   typeof parser?.prepare!=='function'||typeof upload!=='function'||
   typeof confirm!=='function')throw Error('History import requires trusted UI callbacks');
  let source=null,items=[],chosen=null,projectId='',offset=0,busy=false;
  let status='Αρχείο εξαγωγής ChatGPT: conversations.json · Δεν μεταφορτώνεται αυτόματα.';
  const e=(tag,txt)=>{const element=document.createElement(tag);
   if(txt!==undefined)element.textContent=txt;return element};
  let host=null;
  function draw(target=host){
   if(!target)return;host=target;
   target.replaceChildren();
   const area=e('section');area.className='director-history-import';
   const heading=e('h3','Εισαγωγή παλιών συνομιλιών ChatGPT');
   const intro=e('p','Διάλεξε μία συνομιλία και τον σωστό Director. '+
    'Το αρχείο διαβάζεται σε αυτή τη συσκευή. Τίποτα δεν αποστέλλεται χωρίς επιβεβαίωση.');
   intro.className='room-footnote';area.append(heading,intro);
   const file=e('input');
   file.type='file';file.accept='.json,application/json';
   file.setAttribute('aria-label','ChatGPT conversations.json');
   file.disabled=busy;
   file.addEventListener('change',async()=>{
    const picked=file.files?.[0];
    if(!picked)return;
    busy=true;status='Ανάλυση αρχείου στη συσκευή…';draw();
    try{
     if(picked.size>25*1024*1024)throw Error('Το αρχείο ξεπερνά τα 25 MB — χρησιμοποίησε μικρότερη εξαγωγή.');
     const json=JSON.parse(await picked.text());
     const catalogue=parser.catalog(json);
     if(!catalogue.length)throw Error('Δεν βρέθηκαν αναγνώσιμες συνομιλίες με κείμενο.');
     source=json;items=catalogue;chosen=null;projectId='';offset=0;
     status='Βρέθηκαν '+catalogue.length+' συνομιλίες. Διάλεξε μία.';
    }catch(err){
     source=null;items=[];chosen=null;projectId='';offset=0;
     status='Η ανάγνωση απέτυχε: '+err.message;
    }finally{busy=false;draw()}
   });
   area.append(file);
   if(items.length){
    const conversation=e('select');
    conversation.setAttribute('aria-label','Συνομιλία προς εισαγωγή');
    const emptyConversation=e('option','Επίλεξε συνομιλία');emptyConversation.value='';conversation.append(emptyConversation);
    for(const item of items){
     const option=e('option',item.title+' ('+item.count+' μηνύματα)');
     option.value=String(item.index);option.selected=chosen===item.index;
     conversation.append(option);
    }
    conversation.disabled=busy;
    conversation.addEventListener('change',()=>{
     chosen=conversation.value===''?null:Number(conversation.value);
     offset=0;draw();
    });area.append(conversation);
    const project=e('select');
    project.setAttribute('aria-label','Director που θα λάβει το ιστορικό');
    const empty=e('option','Επίλεξε Director');empty.value='';project.append(empty);
    for(const [id,label] of PROJECTS){
     const option=e('option',label);option.value=id;option.selected=id===projectId;
     project.append(option);
    }
    project.disabled=busy;project.addEventListener('change',()=>{
     projectId=project.value;offset=0;draw()
    });area.append(project);
    if(chosen!==null&&projectId){
     let preview;
     try{preview=parser.prepare(source,chosen,projectId,{offset,limit:30})}
     catch(err){status='Προεπισκόπηση απέτυχε: '+err.message}
     if(preview?.records.length){
      const info=e('p','Τμήματα '+(offset+1)+'–'+(offset+preview.records.length)+
       ' από '+preview.total+' · Εισαγωγή ως ιδιωτικές προτάσεις μνήμης');
      area.append(info);
      const sample=e('pre',preview.records[0].body.slice(0,600));
      sample.className='room-footnote';sample.style.whiteSpace='pre-wrap';
      area.append(sample);
      const action=e('button','Εισαγωγή αυτών των '+preview.records.length+' τμημάτων');
      action.type='button';action.disabled=busy;
      action.addEventListener('click',async()=>{
       if(busy)return;
       const selected=items.find(x=>x.index===chosen);
       if(!selected)return;
       const accepted=await confirm({
        projectId,title:selected.title,
        count:preview.records.length,total:preview.total,
        includesPrivate:true});
       if(accepted!==true)return;
       busy=true;status='Ιδιωτική εισαγωγή…';draw();
       try{
        const result=await upload({projectId,records:preview.records});
        if(!result||!Number.isInteger(result.imported)||!Number.isInteger(result.skipped)||
         result.imported+result.skipped!==preview.records.length)
         throw Error('Η βάση δεν επιβεβαίωσε την εισαγωγή.');
        offset=preview.nextOffset===null?preview.total:preview.nextOffset;
        status='Εισήχθησαν '+result.imported+' νέα τμήματα, '+result.skipped+
         ' ήδη υπάρχοντα. Παραμένουν μη εγκεκριμένα.';
        await afterImport();
       }catch(err){
        status='Η εισαγωγή σταμάτησε: '+err.message+
         ' · Ξαναδοκίμασε· τα αποθηκευμένα τμήματα παραλείπονται.';
       }finally{busy=false;draw()}
      });area.append(action);
     }else if(preview&&!preview.nextOffset){
      area.append(e('p','Όλα τα τμήματα αυτής της συνομιλίας ελέγχθηκαν για εισαγωγή.'));
     }
    }
   }
   const message=e('p',status);message.className='room-footnote';
   area.append(message);target.append(area);
  }
  return Object.freeze({draw});
 }
 return Object.freeze({createView});
});