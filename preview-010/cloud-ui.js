(()=>{'use strict';
const host=document.querySelector('#project-room'),model=window.PaperworldProjects,client=window.PaperworldCloud.createClient();
let room='town',tasks=[],busy=false,message='',edit=null,active=false;
const el=(tag,text,cls)=>{let e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const btn=(text,fn,cls)=>{let b=el('button',text,cls);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b};
const note=(s,isError=false)=>{message=(isError?'Error: ':'')+s;render()};
async function work(fn){if(busy)return;busy=true;message='';render();try{await fn()}catch(e){message='Error: '+e.message}finally{busy=false;render()}}
async function reload(){tasks=await client.list(room)}
function loginForm(){let f=el('form');let email=el('input'),password=el('input');email.type='email';email.required=true;email.placeholder='Email';email.autocomplete='email';password.type='password';password.required=true;password.minLength=6;password.placeholder='Password';password.autocomplete='current-password';f.append(email,password);
let sign=el('button','Sign in','primary');sign.type='submit';f.append(sign,btn('Create account',()=>work(async()=>{let ready=await client.signup(email.value.trim(),password.value);if(ready)await reload();else message='Check your email for the confirmation message, then sign in.'})));
f.addEventListener('submit',e=>{e.preventDefault();work(async()=>{await client.login(email.value.trim(),password.value);await reload()})});return f}
function form(t){let f=el('form',undefined,'room-task-form');let title=el('input'),notes=el('textarea');title.value=t?.title||'';notes.value=t?.notes||'';title.placeholder='Task title';title.required=true;title.maxLength=160;notes.placeholder='Notes';notes.maxLength=1500;notes.rows=3;
let b=el('button',t?'Save changes':'Add cloud task','primary');b.type='submit';f.append(title,notes,b,btn('Cancel',()=>{edit=null;render()}));
f.addEventListener('submit',e=>{e.preventDefault();work(async()=>{if(t)await client.update(t.id,{title:title.value,notes:notes.value});else await client.add(room,title.value,notes.value);edit=null;await reload()})});return f}
function taskRow(t){let card=el('article',undefined,'room-task'),top=el('div',undefined,'room-task-top'),sel=el('select');for(const [id,label] of [['todo','To do'],['doing','In progress'],['done','Done']]){let o=el('option',label);o.value=id;o.selected=id===t.status;sel.append(o)}sel.disabled=busy;sel.setAttribute('aria-label','Task status: '+t.title);sel.addEventListener('change',()=>work(async()=>{await client.update(t.id,{status:sel.value});await reload()}));top.append(el('strong',t.title),sel);card.append(top);if(t.notes)card.append(el('p',t.notes,'room-task-notes'));let ops=el('div',undefined,'room-ops');ops.append(btn('Edit',()=>{edit=t;render()}),btn('Delete',()=>{if(confirm('Permanently delete this cloud task?'))work(async()=>{await client.remove(t.id);await reload()})},'danger'));card.append(ops);return card}
function migration(){let sec=el('section',undefined,'cloud-import'),store;try{store=model.createStore(localStorage)}catch(_){}
sec.append(el('h4','Copy tasks from this tablet'));
if(!store||store.warning){sec.append(el('p','Local tasks cannot be read safely.'));return sec}
let originals=store.snapshot().tasks;sec.append(el('p',originals.length+' local tasks found. Originals will remain on this device.'));
sec.append(btn('Preview and copy',()=>work(async()=>{const plan=client.prepareImport(originals,await client.list());if(!plan.incoming.length){message='No new local tasks to import.';return}if(!confirm('Copy '+plan.incoming.length+' local tasks into your private cloud? Existing local tasks will be preserved.')){message='Import cancelled.';return}const result=await client.importTasks(originals);await reload();message='Imported '+result.imported+', skipped '+result.skipped+'.'})));return sec}
function render(){if(!active)return;host.hidden=false;host.replaceChildren();let head=el('div',undefined,'room-heading');head.append(el('h2','PAPERWORLD Cloud'),btn('Back to local',()=>{active=false;window.PaperworldRooms.open(room)}));host.append(head,el('p','Private task board. No AI agents or purchases.','room-subtitle'));
if(message)host.append(el('p',message,message.startsWith('Error:')?'room-error':'room-notice'));if(busy)host.append(el('p','Loading…'));
if(!client.signedIn()){host.append(loginForm());return}
let bar=el('div',undefined,'room-ops');bar.append(el('small',client.identity()),btn('Refresh',()=>work(reload)),btn('Sign out',()=>work(async()=>{await client.signout();tasks=[];edit=null})));host.append(bar);
let tabs=el('div',undefined,'room-tabs');for(const r of model.ROOMS)tabs.append(btn(r.name,()=>work(async()=>{room=r.id;edit=null;await reload()}),room===r.id?'selected':''));host.append(tabs,el('h3',model.ROOMS.find(r=>r.id===room).name,'room-title'),el('p',tasks.length+' cloud tasks · '+tasks.filter(t=>t.status==='done').length+' done','room-stats'));
host.append(edit?form(edit===true?null:edit):btn('+ New cloud task',()=>{edit=true;render()},'primary'));
for(const s of ['doing','todo','done']){let entries=tasks.filter(t=>t.status===s);if(entries.length){host.append(el('h4',({doing:'In progress',todo:'To do',done:'Completed'})[s],'room-group-label'));for(const t of entries)host.append(taskRow(t))}}
if(!tasks.length)host.append(el('p','No cloud tasks in this room yet.'));host.append(migration(),el('p','Sign in from another device with the same account to see these cloud tasks.','room-footnote'))}
function open(id='town'){if(model.ROOMS.some(r=>r.id===id))room=id;active=true;edit=null;message='';render();if(client.signedIn())work(reload)}
window.PaperworldCloudUI={open,isActive:()=>active};
})();
