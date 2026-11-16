/* Local, explicit bulk history review. Nothing leaves browser until confirmed.
 * Suggestions never auto-select. Ambiguous conversations remain unassigned.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldHistoryBulkUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const OPTIONS=[['','Επίλεξε Director'],['workshop','Luna'],['pokemon','Joey'],
  ['studio','Crow'],['wellbeing','Dave']];
 function createView({document,router,parser,upload,confirm,afterImport=()=>{}}={}){
  if(typeof document?.createElement!=='function'||
   typeof router?.suggest!=='function'||typeof parser?.prepare!=='function'||
   typeof upload!=='function'||typeof confirm!=='function')
   throw Error('Bulk import dependencies required');
  let source=null,items=[],choices=new Map(),page=0,busy=false,status='';
  const PAGE=40,MAX_CONVERSATIONS=15,MAX_PARTS=30;
  let host=null;
  const el=(tag,text)=>{const n=document.createElement(tag);
   if(text!==undefined)n.textContent=text;return n};
  function setSource(next){
   source=next;items=next?router.suggest(next,parser):[];
   choices=new Map();page=0;
   status=next?'Βρέθηκαν '+items.length+' συνομιλίες. Καμία δεν έχει επιλεγεί για αποστολή.':'';
   draw();
  }
  function selected(){return items.filter(x=>choices.get(x.index));}
  function draw(target=host){
   if(!target)return;host=target;
   target.replaceChildren();
   if(!source)return;
   const section=el('section');section.className='director-history-bulk';
   section.append(el('h3','Μαζική ταξινόμηση συνομιλιών'),
    el('p','Οι προτάσεις γίνονται μόνο στη συσκευή. Καμία συνομιλία δεν επιλέγεται '+
     'αυτόματα. Έλεγξε τον Director και επίλεξε τις συνομιλίες που θέλεις να εισαγάγεις.'));
   const total=selected().length;
   section.append(el('p','Επιλεγμένες: '+total+'/'+MAX_CONVERSATIONS+
    ' · Η κάθε εισαγωγή περιορίζεται σε '+MAX_PARTS+' τμήματα.'));
   const start=page*PAGE;
   const rows=items.slice(start,start+PAGE);
   const list=el('div');list.className='director-bulk-list';
   for(const item of rows){
    const line=el('div');line.className='director-bulk-row';
    const checked=el('input');checked.type='checkbox';
    checked.setAttribute('aria-label','Επίλεξε: '+item.title);
    checked.checked=choices.has(item.index);
    checked.disabled=busy;
    const label=el('span',item.title+' · '+item.count+' μηνύματα');
    const project=el('select');project.setAttribute('aria-label','Director για '+item.title);
    const choice=choices.get(item.index);
    for(const [id,name] of OPTIONS){
     const opt=el('option',name);
     opt.value=id;opt.selected=(choice||item.projectId||'')===id;
     project.append(opt);
    }
    project.disabled=busy;
    const reason=el('small',(item.confidence==='suggested'?'Πρόταση: ':'Έλεγχος: ')+
     item.reason);
    function chosenProject(){return project.value}
    checked.addEventListener('change',()=>{
     if(!checked.checked){choices.delete(item.index)}
     else if(!chosenProject()){checked.checked=false;
      status='Διάλεξε πρώτα Director για αυτή τη συνομιλία.'}
     else if(choices.size>=MAX_CONVERSATIONS){checked.checked=false;
      status='Μέχρι '+MAX_CONVERSATIONS+' συνομιλίες ανά παρτίδα.'}
     else choices.set(item.index,chosenProject());
     draw();
    });
    project.addEventListener('change',()=>{
     if(choices.has(item.index)){
      if(project.value)choices.set(item.index,project.value);
      else choices.delete(item.index);
     }
     draw();
    });
    line.append(checked,label,project,reason);list.append(line);
   }
   section.append(list);
   const controls=el('div');
   const prev=el('button','Προηγούμενες');
   prev.type='button';prev.disabled=busy||page===0;
   prev.addEventListener('click',()=>{page--;draw()});
   const next=el('button','Επόμενες');
   next.type='button';next.disabled=busy||(page+1)*PAGE>=items.length;
   next.addEventListener('click',()=>{page++;draw()});
   controls.append(prev,el('span',' '+(page+1)+'/'+Math.max(1,Math.ceil(items.length/PAGE))+' '),next);
   section.append(controls);
   const suggested=el('button','Επίλεξε τις ξεκάθαρες προτάσεις αυτής της σελίδας');
   suggested.type='button';suggested.disabled=busy;
   suggested.addEventListener('click',()=>{
    for(const item of rows){
     if(choices.size>=MAX_CONVERSATIONS)break;
     if(item.confidence==='suggested'&&item.projectId&&!choices.has(item.index))
      choices.set(item.index,item.projectId);
    }
    draw();
   });
   section.append(suggested);
   const submit=el('button','Προεπισκόπηση και εισαγωγή επιλεγμένων');
   submit.type='button';submit.disabled=busy||!total;
   submit.addEventListener('click',async()=>{
    if(busy)return;
    const selection=selected();
    if(!selection.length||selection.length>MAX_CONVERSATIONS)return;
    const plans=[],all=[];
    try{
     for(const item of selection){
      const projectId=choices.get(item.index);
      if(!OPTIONS.some(([id])=>id===projectId&&id!==''))
       throw Error('Άγνωστος Director');
      const plan=parser.prepare(source,item.index,projectId,{offset:0,limit:40});
      // Do not silently truncate a conversation or switch to a wrong Director.
      if(plan.total>MAX_PARTS)
       throw Error('Η συνομιλία "'+item.title+
        '" είναι πολύ μεγάλη. Χρησιμοποίησε τη μεμονωμένη εισαγωγή.');
      if(all.length+plan.records.length>MAX_PARTS)
       throw Error('Πάνω από '+MAX_PARTS+
        ' τμήματα. Διάλεξε λιγότερες συνομιλίες.');
      plans.push({id:item.id,title:item.title,projectId,parts:plan.records.length});
      all.push(...plan.records);
     }
     if(!all.length)return;
     const approved=await confirm({conversations:plans,parts:all.length,private:true});
     if(approved!==true)return;
     busy=true;status='Εισαγωγή στην ιδιωτική μνήμη…';draw();
     let imported=0,skipped=0;
     try{
      // Owner confirmation covers an exact frozen selection. Supabase
      // still rechecks authentication and project for every bounded upload.
      for(const plan of plans){
       const records=all.filter(x=>x.project_id===plan.projectId&&
        x.source_ref.startsWith('chatgpt-export:'+plan.id+':'));
       const result=await upload({projectId:plan.projectId,records});
       if(!result||result.imported+result.skipped!==records.length)
        throw Error('Ανεπιβεβαίωτη αποθήκευση');
       imported+=result.imported;skipped+=result.skipped;
      }
      for(const item of selection)choices.delete(item.index);
      status='Αποθηκεύτηκαν '+imported+' νέα ιδιωτικά τμήματα ('+
       skipped+' ήδη υπήρχαν). Απαιτείται έγκριση μνήμης.';
      await afterImport();
     }catch(_){
      status='Η παρτίδα διακόπηκε μετά από '+imported+' νέες εγγραφές και '+
       skipped+' ήδη υπάρχουσες. Επανάλαβε με την ίδια επιλογή: τα ήδη '+
       'αποθηκευμένα τμήματα αναγνωρίζονται από την πηγή τους.';
     }finally{busy=false;draw()}
    }catch(error){status=error.message;draw()}
   });
   section.append(submit);
   const info=el('p',status);info.className='room-footnote';section.append(info);
   target.append(section);
  }
  return Object.freeze({setSource,draw});
 }
 return Object.freeze({createView});
});