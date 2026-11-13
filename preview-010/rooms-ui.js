/* PAPERWORLD Project Rooms UI. A usable task board, not simulated AI activity. */
(()=>{'use strict';
const api=window.PaperworldProjects;
const host=document.querySelector('#project-room');
if(!api||!host)throw Error('Project Rooms module or mount missing');
const make=(tag,cls,content)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(content!==undefined)el.textContent=String(content);
 return el;
};
const button=(label,handler,cls='')=>{const el=make('button',cls,label);el.type='button';el.addEventListener('click',handler);return el};
let store=null;
try{store=api.createStore(localStorage)}catch(e){store=null}
let active='town',showEditor=false,notice='',error='';
const roomById=id=>api.ROOMS.find(r=>r.id===id);
function report(message,failed=false){notice=failed?'':message;error=failed?message:'';render()}
function doAction(fn){try{fn();notice='Saved on this device.';error=''}catch(e){notice='';error=e.message||'Cannot save changes'}render()}
const roomSelect=()=>{const wrap=make('div','room-tabs');for(const room of api.ROOMS){
 const b=button(room.name,()=>open(room.id),room.id===active?'selected':'');b.setAttribute('aria-pressed',String(room.id===active));wrap.append(b)
}return wrap};
function taskRow(t){
 const row=make('article','room-task');
 const top=make('div','room-task-top'),title=make('strong','',t.title);
 const status=make('select','room-status');status.setAttribute('aria-label','Status for '+t.title);
 for(const [value,label] of [['todo','To do'],['doing','In progress'],['done','Done']]){const opt=make('option','',label);opt.value=value;opt.selected=value===t.status;status.append(opt)}
 status.addEventListener('change',()=>doAction(()=>store.update(t.id,{status:status.value})));
 top.append(title,status);row.append(top);
 if(t.notes)row.append(make('p','room-task-notes',t.notes));
 const ops=make('div','room-ops');
 ops.append(button('Edit',()=>editTask(t)));
 ops.append(button('Delete',()=>{if(window.confirm('Delete this task?'))doAction(()=>store.remove(t.id))},'danger'));
 row.append(ops);return row;
}
function editor(current){
 const form=make('form','room-task-form');
 const heading=make('h3','',current?'Edit task':'New task');form.append(heading);
 const title=make('input');title.name='taskTitle';title.type='text';title.required=true;title.maxLength=160;title.placeholder='What needs to be done?';title.value=current?.title||'';title.setAttribute('aria-label','Task title');form.append(title);
 const notes=make('textarea');notes.name='taskNotes';notes.rows=3;notes.maxLength=1500;notes.placeholder='Notes (optional)';notes.value=current?.notes||'';notes.setAttribute('aria-label','Task notes');form.append(notes);
 const actions=make('div','room-ops');
 const save=make('button','primary',current?'Save changes':'Add task');save.type='submit';
 actions.append(save,button('Cancel',()=>{showEditor=false;render()}));form.append(actions);
 form.addEventListener('submit',e=>{e.preventDefault();doAction(()=>{if(current)store.update(current.id,{title:title.value,notes:notes.value});else store.add(active,title.value,notes.value);showEditor=false})});
 return form;
}
function editTask(t){showEditor=t;render()}
function exportTasks(){
 if(!store)return report('Local storage is not available.',true);
 try{const data=store.exportJSON();
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=make('a');a.href=url;a.download='paperworld-tasks-backup.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  notice='Backup downloaded.';error='';render();
 }catch(e){report(e.message,true)}
}
function importTasks(){
 const input=make('input');input.type='file';input.accept='.json,application/json';
 input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;
  if(file.size>1500000){report('The backup is too large.',true);return}
  try{const text=await file.text();doAction(()=>store.importJSON(text,{replace:false}))}
  catch(e){report('Import failed: '+e.message,true)}
 });
 input.click();
}
function render(){
 host.replaceChildren();host.hidden=false;
 const header=make('div','room-heading');
 header.append(make('h2','','Project Rooms'),button('Back to village',()=>close()));
 host.append(header);
 const subtitle=make('p','room-subtitle','Real, editable task lists saved only in this browser. No AI agents or online sync.');
 host.append(subtitle,roomSelect());
 const r=roomById(active);if(!r){host.append(make('p','','Unknown room'));return}
 host.append(make('h3','room-title',r.name),make('p','room-description',r.description));
 if(!store){host.append(make('p','room-error','Browser storage is unavailable. This workspace cannot save tasks.'));return}
 if(store.warning){host.append(make('p','room-error',store.warning));host.append(button('Download raw recovery info',()=>{report('Please avoid editing until your original browser data is recovered.',true)}));return}
 const tasks=store.list(active);
 const counts=make('p','room-stats',tasks.length+' tasks · '+tasks.filter(t=>t.status==='done').length+' completed');
 host.append(counts);
 if(notice)host.append(make('p','room-notice',notice));
 if(error)host.append(make('p','room-error',error));
 if(showEditor)host.append(editor(typeof showEditor==='object'?showEditor:null));
 else host.append(button('+ New task',()=>{showEditor=true;render()},'primary'));
 if(!tasks.length)host.append(make('p','room-empty','No tasks yet. Add one to start tracking real progress.'));
 else{
  const groups=[['doing','In progress'],['todo','To do'],['done','Completed']];
  for(const [status,label] of groups){const items=tasks.filter(t=>t.status===status);if(!items.length)continue;
   host.append(make('h4','room-group-label',label));for(const t of items)host.append(taskRow(t))
  }
 }
 const tips=make('details','room-suggestions');const summary=make('summary','','Suggested starters (not actual tasks)');tips.append(summary);
 for(const text of r.suggestions){tips.append(button('+ '+text,()=>doAction(()=>store.add(active,text)),'room-suggestion'))}
 host.append(tips);
 const backups=make('div','room-backup');
 backups.append(button('Export backup',exportTasks),button('Import backup',importTasks));
 host.append(backups);
 host.append(make('p','room-footnote','Tasks are private to this browser/device. Export a backup before clearing browser data or switching devices.'));
}
function open(id='town'){if(!roomById(id))id='town';active=id;showEditor=false;notice='';error='';render();host.scrollIntoView?.({behavior:'smooth',block:'nearest'})}
function close(){host.hidden=true;host.replaceChildren();showEditor=false}
window.PaperworldRooms={open,close};
})();
