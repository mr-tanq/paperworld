/* PAPERWORLD Project Rooms v1: browser-only task store.
   No network, credentials, AI actions, background work or GitHub writes. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldProjects=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION=1,KEY='paperworld-project-rooms-v1';
 const ROOMS=[
  {id:'town',name:'Town Hall',description:'Overview and decisions for the village',suggestions:['Review this week’s priorities','Write the next PAPERWORLD milestone']},
  {id:'workshop',name:'Listening Mirror',description:'Concert discovery and app development',suggestions:['Review missing concert images','Check upcoming concert listings']},
  {id:'pokemon',name:'Pokémon: Echoes',description:'Godot 4 game development',suggestions:['Plan the next map','Review the battle interface']},
  {id:'wellbeing',name:'Wellbeing & Training',description:'Training, food and personal habits',suggestions:['Plan a weekly activity routine','Make a simple meal plan']},
  {id:'studio',name:'The Lost Wanderer',description:'Music composition and production',suggestions:['Organise song ideas','Review the next recording']},
 ];
 const ROOM_IDS=new Set(ROOMS.map(r=>r.id));
 const STATUSES=['todo','doing','done'];
 const safeText=(x,max=160)=>typeof x==='string'?x.trim().slice(0,max):'';
 const validStatus=s=>STATUSES.includes(s);
 function cleanTask(raw){
  if(!raw||typeof raw!=='object'||!ROOM_IDS.has(raw.room)||!safeText(raw.title)||!validStatus(raw.status))return null;
  const id=safeText(raw.id,80),created=Number(raw.created);
  if(!id||!Number.isFinite(created)||created<0)return null;
  return {id,room:raw.room,title:safeText(raw.title),notes:safeText(raw.notes,1500),status:raw.status,created};
 }
 function makeEmpty(){return {version:VERSION,tasks:[]}}
 function normalize(raw){
  if(!raw||typeof raw!=='object'||raw.version!==VERSION||!Array.isArray(raw.tasks))throw Error('Unsupported PAPERWORLD task backup');
  if(raw.tasks.length>2000)throw Error('Too many tasks in backup');
  const tasks=[],ids=new Set();
  for(const item of raw.tasks){const t=cleanTask(item);if(!t)throw Error('Invalid task in backup');if(ids.has(t.id))throw Error('Duplicate task ID');ids.add(t.id);tasks.push(t)}
  return {version:VERSION,tasks};
 }
 function createStore(adapter){
  if(!adapter||typeof adapter.getItem!=='function'||typeof adapter.setItem!=='function')throw Error('Storage adapter required');
  let state=makeEmpty(),warning='';
  try{const saved=adapter.getItem(KEY);if(saved)state=normalize(JSON.parse(saved))}
  catch(e){warning='Saved tasks could not be loaded. Original data has NOT been overwritten. Export/recover before adding tasks.'}
  let writable=!warning;
  function save(next){if(!writable)throw Error('Stored data needs recovery; no changes saved');
   const valid=normalize(next);
   adapter.setItem(KEY,JSON.stringify(valid));state=valid;return snapshot();
  }
  function snapshot(){return {version:VERSION,tasks:state.tasks.map(t=>({...t}))}}
  const uuid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function add(room,title,notes=''){
   if(!ROOM_IDS.has(room))throw Error('Unknown project');
   title=safeText(title);if(!title)throw Error('Task title is required');
   if(state.tasks.length>=2000)throw Error('Task limit reached');
   const task={id:uuid(),room,title,notes:safeText(notes,1500),status:'todo',created:Date.now()};
   save({version:VERSION,tasks:[...state.tasks,task]});return {...task};
  }
  function update(id,patch){
   if(!patch||typeof patch!=='object')throw Error('Invalid changes');
   const t=state.tasks.find(x=>x.id===id);if(!t)throw Error('Task not found');
   const next={...t};
   if(Object.prototype.hasOwnProperty.call(patch,'title')){next.title=safeText(patch.title);if(!next.title)throw Error('Task title required')}
   if(Object.prototype.hasOwnProperty.call(patch,'notes'))next.notes=safeText(patch.notes,1500);
   if(Object.prototype.hasOwnProperty.call(patch,'status')){if(!validStatus(patch.status))throw Error('Invalid status');next.status=patch.status}
   save({version:VERSION,tasks:state.tasks.map(x=>x.id===id?next:x)});return {...next};
  }
  function remove(id){if(!state.tasks.some(t=>t.id===id))throw Error('Task not found');save({version:VERSION,tasks:state.tasks.filter(t=>t.id!==id)})}
  function list(room){return snapshot().tasks.filter(t=>!room||t.room===room).sort((a,b)=>b.created-a.created)}
  function exportJSON(){return JSON.stringify(snapshot(),null,2)}
  function importJSON(json,{replace=false}={}){
   if(!writable)throw Error('Cannot import into a store with damaged data');
   if(typeof json!=='string'||json.length>1500000)throw Error('Invalid backup size');
   const imported=normalize(JSON.parse(json));
   if(replace)return save(imported);
   const merged=snapshot(),ids=new Set(merged.tasks.map(t=>t.id));
   for(const item of imported.tasks){if(ids.has(item.id))continue;merged.tasks.push(item);ids.add(item.id)}
   if(merged.tasks.length>2000)throw Error('Task limit reached');
   return save(merged);
  }
  return {get warning(){return warning},get writable(){return writable},snapshot,list,add,update,remove,exportJSON,importJSON};
 }
 return {VERSION,KEY,ROOMS,STATUSES,makeEmpty,normalize,createStore};
});
