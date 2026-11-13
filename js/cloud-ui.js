(()=>{'use strict';
const host=document.querySelector('#project-room'),model=window.PaperworldProjects,client=window.PaperworldCloud.createClient();
let room='town',tasks=[],allTasks=[],missions=[],busy=false,message='',edit=null,active=false;
const el=(tag,text,cls)=>{let e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const btn=(text,fn,cls)=>{let b=el('button',text,cls);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b};
const note=(s,isError=false)=>{message=(isError?'Error: ':'')+s;render()};
async function work(fn){if(busy)return;busy=true;message='';render();try{await fn()}catch(e){message='Error: '+e.message}finally{busy=false;render()}}
async function reload(){[allTasks,missions]=await Promise.all([client.list(),client.listMissions()]);tasks=allTasks.filter(t=>t.room===room)}
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
function render(){if(!active)return;host.hidden=false;host.replaceChildren();let head=el('div',undefined,'room-heading');head.append(el('h2','PAPERWORLD Cloud'),btn('Back to local',()=>{active=false;window.PaperworldRooms.open(room,true)}));host.append(head,el('p','Private task board. No AI agents or purchases.','room-subtitle'));
if(message)host.append(el('p',message,message.startsWith('Error:')?'room-error':'room-notice'));if(busy)host.append(el('p','Loading…'));
if(!client.signedIn()){host.append(loginForm());return}
let bar=el('div',undefined,'room-ops');bar.append(el('small',client.identity()),btn('Refresh',()=>work(reload)),btn('Sign out',()=>work(async()=>{await client.signout();tasks=[];allTasks=[];missions=[];edit=null})));host.append(bar);
const overview=el('section',undefined,'village-overview');
overview.append(el('h3','Village overview'));
const total=allTasks.length,done=allTasks.filter(t=>t.status==='done').length,doing=allTasks.filter(t=>t.status==='doing').length;
overview.append(el('p',total+' tasks · '+doing+' in progress · '+done+' completed','room-stats'));
const summary=el('div',undefined,'overview-projects');
for(const r of model.ROOMS){
 const per=allTasks.filter(t=>t.room===r.id);
 const item=btn(r.name+' · '+per.filter(t=>t.status!=='done').length+' open',()=>work(async()=>{room=r.id;edit=null;await reload()}),'overview-project');
 if(r.id===room)item.classList.add('selected');
 summary.append(item)
}
overview.append(summary);host.append(overview);
const chief=window.PaperworldChief;
if(chief){
 const report=chief.summarize(allTasks);
 const desk=el('section',undefined,'chief-desk');
 const heading=el('div',undefined,'chief-heading');
 heading.append(el('h3','Chief of Staff'),el('span','RULE-BASED · NO AI','chief-tag'));
 desk.append(heading);
 desk.append(el('p',report.guidance,'room-description'));
 if(!report.review.length)desk.append(el('p','Create a cloud task to begin planning.','room-footnote'));
 for(const proposal of report.review){
   const original=allTasks.find(t=>t.id===proposal.id);
   if(!original)continue;
   const card=el('article',undefined,'chief-item');
   const label=el('strong',original.title);
   const meta=el('p',chief.PROJECTS[original.room]+' · '+proposal.reason,'room-footnote');
   card.append(label,meta);
   const controls=el('div',undefined,'room-ops');
   controls.append(btn('Open project',()=>work(async()=>{room=original.room;edit=null;await reload()})));
   if(original.status==='todo')controls.append(btn('Start task',()=>work(async()=>{
     await client.update(original.id,{status:'doing'});await reload();message='Marked in progress by you. No agent has been started.'
   }),'primary'));
   controls.append(btn('Copy brief',()=>{
     const content=chief.brief(original);
     if(navigator.clipboard?.writeText)navigator.clipboard.writeText(content).then(()=>note('Task brief copied.')).catch(()=>note('Clipboard unavailable — use your browser to copy the task.',true));
     else note('Clipboard unavailable in this browser.',true);
   }));
   const link=chief.issueDraftUrl(original);
   if(link)controls.append(btn('Draft GitHub issue',()=>{window.open(link,'_blank','noopener,noreferrer')}));
   if(original.status!=='done'&&chief.REPOS[original.room]){
     controls.append(btn('Prepare worker mission',()=>work(async()=>{
       const draft=chief.missionFor(original);
       await client.createMission(draft);
       await reload();
       message='Mission brief saved for your review. No worker has started and no code was changed.'
     }),'primary'))
   }
   card.append(controls);desk.append(card)
 }
 const missionPanel=el('div',undefined,'chief-missions');
 missionPanel.append(el('h4','Worker mission drafts · '+missions.length));
 if(!missions.length)missionPanel.append(el('p','No mission drafts yet. Choose Prepare worker mission on an open task.','room-footnote'));
 for(const mission of missions.slice(0,30)){
   const card=el('article',undefined,'chief-item');
   card.append(el('strong',mission.title));
   card.append(el('p',mission.repository+' · '+mission.status.replaceAll('_',' ')+' · investigation only','room-footnote'));
   const buttons=el('div',undefined,'room-ops');
   buttons.append(btn('Read brief',()=>{
     const details=card.querySelector('.mission-brief');
     if(details){details.remove();return}
     const pre=el('pre',mission.brief,'mission-brief');card.append(pre)
   }));
   buttons.append(btn('Copy handoff',()=>{
     if(navigator.clipboard?.writeText)navigator.clipboard.writeText(mission.brief).then(()=>note('Review brief copied. No worker started.')).catch(()=>note('Clipboard unavailable.',true));
     else note('Clipboard unavailable.',true)
   }));
   if(mission.status==='ready_for_review' && mission.repository==='mr-tanq/concerts' && /ticketswap/i.test(mission.title)){
     buttons.append(btn('Prepare-only in GitHub',()=>work(async()=>{
       if(!confirm('Request the TicketSwap prepare-only workflow? This creates a scope artifact without running AI or consuming AI inference credits.')){
         message='Prepare-only request cancelled.';return
       }
       const response=await client.prepareWorkerMission(mission.id);
       message=response.accepted?'GitHub accepted the prepare-only job. Use Check worker run to see the latest status.':'No workflow was started.'
     }),'primary'))
   }
   if(mission.status!=='cancelled'){
     buttons.append(btn('Check worker run',()=>work(async()=>{
       const status=await client.workerStatus();
       const run=status.latestRun;
       message=(status.connected?'Secure bridge connected. ':'Secure bridge not connected. ')+
         (run?'Latest workflow: '+run.status+(run.conclusion?' / '+run.conclusion:'')+' · '+run.url:
           'No manual worker workflow runs found.')+
         ' This is the latest repository run, not proof of this mission being executed.'
     })))
   }
   if(mission.status==='draft')buttons.append(btn('Ready for MY review',()=>work(async()=>{
     await client.setMissionStatus(mission.id,'ready_for_review');await reload();
     message='Marked ready for your review only. This does not authorize execution.'
   }),'primary'));
   if(mission.status!=='cancelled')buttons.append(btn('Cancel draft',()=>work(async()=>{
     await client.setMissionStatus(mission.id,'cancelled');await reload();message='Mission cancelled; no changes were made.'
   })));
   card.append(buttons);missionPanel.append(card)
 }
 missionPanel.append(el('p','These are planning records, not queued or running agents. No GitHub writes, paid API calls, deployments or approvals are executed.','room-footnote'));
 desk.append(missionPanel);
 desk.append(el('p','Suggestions come from task status and creation order only. Opening a GitHub draft does not submit it. No autonomous work is running.','room-footnote'));
 host.append(desk)
}
let tabs=el('div',undefined,'room-tabs');for(const r of model.ROOMS)tabs.append(btn(r.name,()=>work(async()=>{room=r.id;edit=null;await reload()}),room===r.id?'selected':''));host.append(tabs,el('h3',model.ROOMS.find(r=>r.id===room).name,'room-title'),el('p',tasks.length+' cloud tasks · '+tasks.filter(t=>t.status==='done').length+' done','room-stats'));
host.append(edit?form(edit===true?null:edit):btn('+ New cloud task',()=>{edit=true;render()},'primary'));
for(const s of ['doing','todo','done']){let entries=tasks.filter(t=>t.status===s);if(entries.length){host.append(el('h4',({doing:'In progress',todo:'To do',done:'Completed'})[s],'room-group-label'));for(const t of entries)host.append(taskRow(t))}}
if(!tasks.length)host.append(el('p','No cloud tasks in this room yet.'));
host.append(migration(),el('p','Cloud tasks sync across devices. Local tasks remain safe unless you explicitly copy them.','room-footnote'))}
function open(id='town'){if(model.ROOMS.some(r=>r.id===id))room=id;active=true;edit=null;message='';render();if(client.signedIn())work(reload)}
function focusChief(){
 const item=host.querySelector('.chief-desk');
 if(item){item.scrollIntoView({behavior:'smooth',block:'start'});item.classList.add('chief-focused')}
}
function openChief(){
 open('town');
 if(client.signedIn())setTimeout(focusChief,350);
}
window.PaperworldCloudUI={open,openChief,isActive:()=>active,signedIn:()=>client.signedIn()};
})();
