/* PAPERWORLD Workspace V2 — one home for Team · Work · Settings.
 *
 * Shares the Messenger V2 design system. Reads ONLY owner-scoped data through
 * the existing Cloud UI facade (Supabase RLS); every decision still goes
 * through the audited Human-First hub with its own confirmation dialogs.
 * Nothing here starts AI work, spends credits or invents progress.
 */
(()=>{'use strict';
const view=document.querySelector('#view');
if(!view)return;
const cloud=()=>window.PaperworldCloudUI;
const chat=()=>window.PaperworldWorldDialogue;
const profiles=()=>window.PaperworldProfiles;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
function button(label,cls,handler,aria){
 const b=el('button',cls,label);b.type='button';if(aria)b.setAttribute('aria-label',aria);
 b.addEventListener('click',handler);return b;
}
// One registry of projects, their owners and the names each data source uses.
const PROJECTS=Object.freeze([
 {id:'workshop',mission:'listening',hub:'Listening Mirror',name:'Listening Mirror',owner:'listening-director',
  blurb:'Ανακάλυψη συναυλιών και η εφαρμογή'},
 {id:'pokemon',mission:'pokemon',hub:'Pokémon: Echoes',name:'Pokémon: Echoes',owner:'pokemon-director',
  blurb:'Το παιχνίδι σε Godot 4'},
 {id:'studio',mission:'studio',hub:'The Lost Wanderer',name:'The Lost Wanderer',owner:'studio-director',
  blurb:'Σύνθεση και παραγωγή μουσικής'},
 {id:'wellbeing',mission:'wellbeing',hub:'Wellbeing',name:'Wellbeing & Training',owner:'wellbeing-director',
  blurb:'Προπόνηση, διατροφή και συνήθειες'},
 {id:'shop',mission:'shop',hub:'Digital Shop',name:'Digital Shop',owner:'shop-director',
  blurb:'Ο James: ψηφιακά προϊόντα και έσοδα'},
 {id:'town',mission:null,hub:'Paperworld',name:'Paperworld',owner:'matt',
  blurb:'Συντονισμός και αποφάσεις για όλο το χωριό'}
]);
const byId=id=>PROJECTS.find(p=>p.id===id)||null;
const byHub=name=>PROJECTS.find(p=>p.hub===name)||null;
const byMission=id=>PROJECTS.find(p=>p.mission===id)||null;
const ownerName=id=>profiles()?.get(id)?.name||'Matt';
const withArticle=id=>(id==='listening-director'?'τη ':'τον ')+ownerName(id);

// ---------- Shell ----------------------------------------------------------
const shell=el('section','pw-workspace');shell.hidden=true;shell.lang=window.PaperworldI18n?.ui?.()||'el';
shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','false');
shell.setAttribute('aria-labelledby','pw-ws-title');
const head=el('header','pw-ws-head');
const back=button('‹','pw-icon-btn pw-ws-back',()=>goBack(),'Πίσω');
const titles=el('div','pw-ws-titles');
const title=el('h1','pw-ws-title','Εργασίες');title.id='pw-ws-title';title.tabIndex=-1;
const subtitle=el('p','pw-ws-subtitle','');
titles.append(title,subtitle);
const refresh=button('↻','pw-icon-btn pw-ws-refresh',()=>void load(true),'Ανανέωση');
const closeBtn=button('×','pw-icon-btn pw-ws-close',()=>close(),'Κλείσιμο');
head.append(back,titles,refresh,closeBtn);
const nav=el('nav','pw-ws-nav');nav.setAttribute('aria-label','Περιοχές');
const tabs=el('div','pw-ws-tabs');tabs.setAttribute('role','tablist');
const TABS=[['team','Ομάδα','♟'],['work','Εργασίες','✓'],['settings','Ρυθμίσεις','⚙']];
const tabButtons={};
for(const [id,label,icon] of TABS){
 const t=el('button','pw-ws-tab');t.type='button';t.setAttribute('role','tab');
 t.id='pw-ws-tab-'+id;t.setAttribute('aria-controls','pw-ws-body');
 t.append(el('span','pw-ws-tab-icon',icon),el('span','pw-ws-tab-label',label));
 t.addEventListener('click',()=>go(id));tabButtons[id]=t;tabs.append(t);
}
tabs.addEventListener('keydown',e=>{
 if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
 e.preventDefault();const ids=TABS.map(t=>t[0]);
 const next=ids[(ids.indexOf(state.view)+(e.key==='ArrowRight'?1:-1)+ids.length)%ids.length];
 go(next);tabButtons[next].focus();
});
nav.append(tabs);
const body=el('div','pw-ws-body');body.id='pw-ws-body';body.setAttribute('role','tabpanel');
const toast=el('p','pw-ws-toast');toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.hidden=true;
shell.append(head,nav,body,toast);view.append(shell);

const state={view:'work',project:null,raw:null,missions:[],loadedAt:0,loading:false,error:'',
 dismissed:new Set(),memory:null,memoryRows:null,memoryQuery:'',memoryBusy:false,memoryError:'',
 settings:{github:{state:'checking'},suno:{state:'checking'}}};
let opener=null,handoff=null,suppressChatEvent=false,toastTimer=null;
function say(text){
 toast.textContent=text;toast.hidden=!text;clearTimeout(toastTimer);
 if(text)toastTimer=setTimeout(()=>{toast.hidden=true},4200);
}

// ---------- Data (real, owner-scoped) -------------------------------------
function signedIn(){return cloud()?.signedIn?.()===true}
async function load(force=false){
 if(!signedIn()||state.loading)return;
 if(!force&&Date.now()-state.loadedAt<20000)return;
 state.loading=true;state.error='';paintChrome();
 try{
  const [raw,missions,dismissed,proposals]=await Promise.all([cloud().loadHumanWork(),
   cloud().listAutonomousMissions().catch(()=>null),
   typeof cloud().listDismissed==='function'?cloud().listDismissed().catch(()=>null):null,
   typeof cloud().listProposals==='function'?cloud().listProposals().catch(()=>[]):[]]);
  state.proposals=Array.isArray(proposals)?proposals:[];
  state.raw=raw;state.missions=Array.isArray(missions)?missions:[];
  // Items the owner removed from their lists (records stay in the database).
  if(Array.isArray(dismissed)){state.dismissed=new Set(dismissed);
   window.PaperworldDismissedKeys=state.dismissed}
  state.missionsUnavailable=missions===null;state.loadedAt=Date.now();
 }catch(_){
  // Fail closed: never keep showing actionable items we could not re-verify.
  state.raw=null;state.missions=[];state.error='Δεν ήταν δυνατή η ενημέρωση. Δοκίμασε ξανά.';
 }finally{state.loading=false;render()}
}
// Normalised, read-only items. Actionable decisions are NOT here: they stay
// in the Human-First hub, which owns every approval flow and confirmation.
function items(){
 const hub=window.PaperworldHumanFirstHub,activity=window.PaperworldVillageActivity;
 const out=[];
 if(state.raw&&hub?.project){
  for(const row of hub.project(state.raw).rows){
   if(row.stage==='decision'||(row.kind==='handoff'&&row.status==='awaiting_consent')||
      row.stage==='rejected'||state.dismissed.has(row.kind+':'+row.id))continue;
   const project=byHub(row.project)||byId('town');
   // Finished investigations and planned tasks must never look like live work.
   const bucket=['review_required','needs_attention'].includes(row.stage)?'attention':
    row.stage==='in_progress'?'active':row.stage==='planned'?'waiting':
    ['diagnosed','prepared'].includes(row.stage)?'reviewed':
    ['completed','checked'].includes(row.stage)?'done':'reviewed';
   out.push({key:row.kind+':'+row.id,project:project.id,title:row.kind==='proposal'&&row.request?
     row.request:row.summary,label:hub.stateLabel(row.stage),bucket,note:row.kind==='manual',
    link:row.draftUrl||row.issueUrl||null,linkLabel:row.draftUrl?'Δες την προετοιμασμένη αλλαγή':
     row.issueUrl?'Δες την αναφορά':null,at:Date.parse(row.createdAt||0)||0});
  }
 }
 if(activity?.summary){
  for(const m of activity.summary(state.missions).items){
   const project=byMission(m.projectId);if(!project||state.dismissed.has('mission:'+m.id))continue;
   out.push({key:'mission:'+m.id,project:project.id,title:m.title,label:m.message,
    bucket:m.stage==='attention'?'attention':m.stage==='finished'?'done':
     m.stage==='active'?'active':'waiting',
    link:m.resultLink,linkLabel:m.resultLabel,note:false,at:0});
  }
 }
 return out;
}
function decisionsCount(){
 const hub=window.PaperworldHumanFirstHub;
 if(!state.raw||!hub?.project)return 0;
 return hub.project(state.raw).rows.filter(r=>(r.stage==='decision'||
  (r.kind==='handoff'&&r.status==='awaiting_consent'))&&!state.dismissed.has(r.kind+':'+r.id)).length;
}
function decisionsFor(projectId){
 const hub=window.PaperworldHumanFirstHub;
 if(!state.raw||!hub?.project)return 0;
 return hub.project(state.raw).rows.filter(r=>(r.stage==='decision'||
  (r.kind==='handoff'&&r.status==='awaiting_consent'))&&!state.dismissed.has(r.kind+':'+r.id)&&
  (byHub(r.project)||byId('town')).id===projectId).length;
}
// Per-project counts for Team cards. null = data unavailable (never guessed).
function stats(projectId,all=false){
 if(!signedIn()||!state.raw)return null;
 const list=items().filter(i=>all||i.project===projectId);
 return {attention:list.filter(i=>i.bucket==='attention').length+
   (all?decisionsCount():decisionsFor(projectId)),
  active:list.filter(i=>i.bucket==='active'&&!i.note).length,
  waiting:list.filter(i=>i.bucket==='waiting'&&!i.note).length,
  done:list.filter(i=>i.bucket==='done'&&!i.note).length};
}

// ---------- Navigation ----------------------------------------------------
const VIEW_TITLE={team:'Η ομάδα σου',work:'Οι εργασίες μου',settings:'Ρυθμίσεις'};
function go(id,{project=null}={}){
 state.view=id;state.project=id==='work'?project:null;state.memory=null;
 render();body.scrollTop=0;
 if(id==='work'||id==='team'||id==='settings')void load();
 if(id==='settings')void refreshConnections();
}
function goBack(){
 if(state.view==='work'&&state.project){state.project=null;render();return}
 if(state.view==='settings'&&state.memory){state.memory=null;render();body.scrollTop=0;return}
 close();
}
// How much of the village a panel covers: a docked panel covers the right,
// a portrait-tablet bottom sheet covers the bottom; full-screen needs nothing.
function panelCover(node){
 const r=node?.getBoundingClientRect?.();
 const vw=window.innerWidth||0,vh=window.innerHeight||0;
 if(!r||!r.width||!vw||!vh)return null;
 if(r.width>=vw*.9&&r.top<=vh*.12)return null;              // full screen
 if(r.width>=vw*.9)return {panelWidth:0,panelHeight:Math.max(0,vh-r.top+8)}; // sheet
 return {panelWidth:r.width+12,panelHeight:0};             // docked
}
// Portrait-tablet sheets size themselves to the visible viewport so the
// on-screen keyboard never covers inputs.
const vv=window.visualViewport;
function fitViewport(){
 if(!vv)return;
 shell.style.setProperty('--pw-vvh',Math.round(vv.height)+'px');
 shell.style.setProperty('--pw-vvtop',Math.round(vv.offsetTop)+'px');
}
if(vv){vv.addEventListener('resize',fitViewport);vv.addEventListener('scroll',fitViewport);fitViewport()}
function frameVillage(node){
 const cover=panelCover(node);
 if(cover)window.PaperworldWorld?.frameForWorkspace?.({open:true,...cover});
}
function open(id='work',opts={}){
 if(!['team','work','settings'].includes(id))id='work';
 if(chat()?.isOpen?.()){suppressChatEvent=true;chat().close();suppressChatEvent=false}
 if(shell.hidden)opener=document.activeElement;
 shell.hidden=false;document.documentElement.classList.add('pw-workspace-open');
 go(id,opts);
 requestAnimationFrame(()=>{
  frameVillage(shell);
  title.focus({preventScroll:true});
 });
}
function close({restoreFocus=true}={}){
 if(shell.hidden)return;
 shell.hidden=true;document.documentElement.classList.remove('pw-workspace-open');
 window.PaperworldWorld?.frameForWorkspace?.({open:false});
 if(restoreFocus&&opener?.isConnected&&opener!==document.body)opener.focus?.();
}
// Workspace → Messenger, and back again when the chat closes.
function talk(agentId,{draft='',memory=false,context=null}={}){
 handoff={view:state.view,project:state.project};
 close({restoreFocus:false});
 if(memory&&chat()?.showMemory)chat().showMemory(agentId);
 else if(chat()?.open)chat().open(agentId,{draft,context});
 else chat()?.show?.(agentId);
}
document.addEventListener('paperworld:work-changed',()=>{if(!shell.hidden)render()});
document.addEventListener('paperworld:chat-closed',()=>{
 if(suppressChatEvent)return;
 if(!handoff){window.PaperworldWorld?.frameForWorkspace?.({open:false});return}
 const back=handoff;handoff=null;
 // Defer: the same Escape keypress must not also close the reopened view.
 setTimeout(()=>open(back.view,{project:back.project}),0);
});
document.addEventListener('paperworld:chat-opened',()=>{
 // Pressing M / T or tapping an agent in the village while Work is open.
 if(!shell.hidden)close({restoreFocus:false});
 // The Messenger gets the same village framing as the Workspace.
 requestAnimationFrame(()=>frameVillage([...document.querySelectorAll('.pw-messenger')].find(n=>!n.hidden)));
});
function narrow(){return window.matchMedia?.('(max-width: 760px)')?.matches===true}
function locate(agentId){
 const width=narrow()?0:shell.getBoundingClientRect().width+24;
 if(narrow())close({restoreFocus:false});
 const ok=window.PaperworldWorld?.focusAgent?.(agentId,{panelWidth:width});
 if(!ok)say('Δεν βρέθηκε η θέση στο χωριό.');
}
function townHall(){
 const trigger=document.querySelector('#call-visual-meeting');
 if(!trigger)return;
 close({restoreFocus:false});trigger.click();
}
const ctx={chat:id=>talk(id),project:id=>go('work',{project:id}),locate,townHall,
 stats,get raw(){return state.raw}};

// ---------- Shared pieces -------------------------------------------------
function portrait(agentId,cls='pw-mini-portrait'){
 const span=el('span',cls);span.setAttribute('aria-hidden','true');
 profiles()?.paintAvatar(span,agentId);return span;
}
function empty(text){return el('p','pw-empty',text)}
function signInCard(){
 const card=el('section','pw-card pw-signin');
 card.append(el('h2','pw-card-title','Συνδέσου στο PAPERWORLD Cloud'),
  el('p','pw-section-hint','Οι εργασίες, οι αποφάσεις και οι συνδέσεις σου είναι ιδιωτικές στον λογαριασμό σου.'));
 const form=el('form','pw-form');
 const email=el('input');email.type='email';email.required=true;email.autocomplete='email';email.placeholder='Email';
 email.setAttribute('aria-label','Email');
 const password=el('input');password.type='password';password.required=true;password.minLength=6;
 password.autocomplete='current-password';password.placeholder='Κωδικός';password.setAttribute('aria-label','Κωδικός');
 const submit=el('button','pw-btn-primary','Σύνδεση');submit.type='submit';
 const create=button('Δημιουργία λογαριασμού','pw-btn-ghost',async()=>{
  if(!email.reportValidity()||!password.reportValidity())return;
  try{const ready=await cloud().signUp(email.value.trim(),password.value);
   say(ready?'Ο λογαριασμός δημιουργήθηκε.':'Έλεγξε το email σου για επιβεβαίωση και μετά συνδέσου.');
   if(ready){await load(true)}
  }catch(_){say('Η δημιουργία λογαριασμού δεν ολοκληρώθηκε.')}
 });
 form.append(email,password,submit,create);
 form.addEventListener('submit',async e=>{
  e.preventDefault();submit.disabled=true;
  try{await cloud().signIn(email.value.trim(),password.value);await load(true);render()}
  catch(_){say('Η σύνδεση απέτυχε. Έλεγξε email και κωδικό.')}
  finally{submit.disabled=false}
 });
 card.append(form);return card;
}
function itemCard(item,{showProject=true}={}){
 const project=byId(item.project);
 const card=el('article','pw-item');card.dataset.bucket=item.bucket;
 const top=el('div','pw-item-top');
 if(showProject&&project){
  const chip=el('span','pw-item-project');chip.append(portrait(project.owner),el('span','',project.name));
  top.append(chip);
 }
 if(item.note)top.append(el('span','pw-item-tag','Δική σου σημείωση'));
 // Older long requests expand on demand instead of filling the timeline.
 const titleText=String(item.title||'').trim();
 if(titleText.length>110){
  const details=el('details','pw-item-details');
  const excerpt=titleText.slice(0,110).replace(/\s+\S*$/,'')+'…';
  details.append(el('summary','pw-item-preview',excerpt),
   el('p','pw-item-full',titleText));
  card.append(top,details);
 }else card.append(top,el('h3','pw-item-title',titleText));
 card.append(el('p','pw-item-state',item.label));
 const actions=el('div','pw-item-actions');
 if(item.link&&/^https:\/\/github\.com\//.test(item.link)){
  const a=el('a','pw-link',item.linkLabel||'Λεπτομέρειες');a.href=item.link;a.target='_blank';a.rel='noopener noreferrer';
  actions.append(a);
 }
 // A stopped coding task: one tap hands it back to the Developer (no re-explaining).
 const mission=String(item.key||'').startsWith('mission:')?
  (state.missions||[]).find(m=>'mission:'+m.id===item.key):null;
 if(mission&&['needs_you','failed'].includes(mission.status)&&mission.lastError!=='agent_no_changes'&&
  ['listening','pokemon'].includes(mission.projectId)&&typeof cloud()?.redoMission==='function'){
  const again=button('🔁 Ξαναδοκίμασε','pw-chip pw-chip-accent',async()=>{
   again.disabled=true;again.textContent='Το ξαναδίνω…';
   try{await cloud().redoMission(mission.id);
    try{await cloud().dismissItem?.(item.key);state.dismissed.add(item.key)}catch(_){}
    say('✓ Το ξαναδίνω στον Developer. Θα σου πω το αποτέλεσμα.');state.loadedAt=0;void load(true);
    window.PaperworldResidentFeed?.refresh?.()}
   catch(_){again.disabled=false;again.textContent='🔁 Ξαναδοκίμασε';say('Δεν ξεκίνησε. Δοκίμασε ξανά σε λίγο.')}
  });
  actions.append(again);
 }
 // The conversation opens about THIS item, so the resident knows what you mean.
 if(project&&!item.note)actions.append(button('Μίλα με '+withArticle(project.owner),'pw-chip',
  ()=>talk(project.owner,{draft:'Για την εργασία «'+titleText.slice(0,90)+'»: ',
   context:{title:titleText.slice(0,140),state:String(item.label||'').slice(0,240)}})));
 if(!item.note&&item.key&&typeof cloud()?.dismissItem==='function')
  actions.append(button('✕','pw-icon-btn pw-item-remove',()=>void removeItem(item,titleText),
   'Αφαίρεση από τη λίστα'));
 if(actions.childNodes.length)card.append(actions);
 return card;
}
// Hide an item from the owner's lists. The record itself is kept, and an
// "Αναίρεση" in the toast brings it straight back.
async function removeItem(item,titleText){
 if(!window.confirm('Να αφαιρεθεί «'+titleText.slice(0,80)+'» από τη λίστα;\n'+
  'Η καταγραφή μένει στο ιστορικό· απλώς δεν θα την βλέπεις εδώ.'))return;
 try{
  await cloud().dismissItem(item.key);state.dismissed.add(item.key);render();
  undoToast(item.key);
 }catch(_){say('Η αφαίρεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.')}
}
function undoToast(key){
 toast.replaceChildren(el('span','','Αφαιρέθηκε από τη λίστα. '),
  button('Αναίρεση','pw-btn-ghost',async()=>{
   try{await cloud().restoreItem(key);state.dismissed.delete(key);toast.hidden=true;render()}
   catch(_){say('Η αναίρεση απέτυχε.')}
  }));
 toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true},7000);
}
function section(titleText,hint,children,{id,count}={}){
 const s=el('section','pw-section');if(id)s.id=id;
 const h=el('h2','pw-section-title',titleText);
 if(Number.isInteger(count))h.append(el('span','pw-count',String(count)));
 s.append(h);if(hint)s.append(el('p','pw-section-hint',hint));
 s.append(...children);return s;
}
// The audited approval hub, embedded: approvals keep their exact flows.
// Restrict hub data to one project (Listening proposals/jobs belong to
// Listening Mirror; Pokémon proposals to Pokémon; hand-offs by project key).
function scope(raw,projectId){
 if(!projectId||!raw)return raw;
 return {...raw,proposals:projectId==='workshop'?raw.proposals:[],
  jobs:projectId==='workshop'?raw.jobs:[],
  pokemonProposals:projectId==='pokemon'?raw.pokemonProposals:[],
  teamJobs:(raw.teamJobs||[]).filter(j=>byMission(j?.project)?.id===projectId),
  workerRuns:(raw.workerRuns||[]).filter(j=>byMission(j?.project)?.id===projectId)};
}
function decisionsMount(filterProject=null){
 const mount=el('div','pw-decisions');
 const hub=window.PaperworldHumanFirstHub,ui=cloud();
 if(!hub?.create||!ui||!state.raw)return mount;
 const load=async()=>{const raw=await ui.loadHumanWork();
  if(!filterProject)return raw;
  return scope(raw,filterProject);
 };
 const view=hub.create(mount,{compact:true,load,
  approve:item=>ui.prepareHumanSolution(item),reject:item=>ui.discardHumanSolution(item),
  publishPokemon:item=>ui.preparePokemonSolution(item),rejectPokemon:item=>ui.discardPokemonSolution(item),
  runWorker:item=>ui.runApprovedHandoff(item),runSourceFact:item=>ui.runApprovedSourceFact(item),
  onChanged:()=>{state.loadedAt=0;void load(true)},onError:()=>{}});
 // Render from the data we already verified; actions re-load fresh state
 // themselves before any confirmation (hub safety contract).
 try{view.setData(scope(state.raw,filterProject))}catch(_){void view.refresh()}
 return mount;
}

// ---------- Work ----------------------------------------------------------
function greeting(){
 const h=new Date().getHours();
 return h<5?'Καλό βράδυ':h<12?'Καλημέρα':h<18?'Καλό απόγευμα':'Καλησπέρα';
}
// "Ναι" hands the idea to its Director in the normal chat (they decide how:
// Developer task, a song, a plan); "Όχι" just closes it.
const IDEA_ASK={'listening-director':'Ναι, προχώρα: ανάθεσέ το στον Developer.','pokemon-director':'Ναι, προχώρα: ανάθεσέ το στον Developer.',
 'studio-director':'Ναι, προχώρα: φτιάξ\' το.','wellbeing-director':'Ναι, προχώρα.','shop-director':'Ναι, προχώρα.'};
function proposalCard(p){
 const card=el('article','pw-item pw-idea');
 const head=el('div','pw-idea-head');head.append(portrait(p.directorId),el('strong','',p.title));
 card.append(head,el('p','pw-idea-why',p.why));
 const row=el('div','pw-idea-actions');
 const answer=async accept=>{
  row.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   const r=await cloud().decideProposal(p.id,accept);
   state.proposals=state.proposals.filter(x=>x.id!==p.id);render();
   // James's shop ideas go straight to his production line (no chat needed).
   if(accept&&r?.state==='accepted'&&p.directorId==='shop-director'&&typeof cloud().shopBuild==='function'){
    say('🛍️ Ο James ξεκινά: φτιάχνει το προϊόν και θα το βάλει στη βιτρίνα. Θα σου πει ο Matt.');
    cloud().shopBuild(p.id).then(b=>say(b?.title?'🛍️ Ο James σχεδίασε: «'+b.title+'» ('+String(b.price_eur).replace('.',',')+' €). Το φτιάχνει τώρα.':
     '🛍️ Ο James το έχει ήδη σε εξέλιξη.')).catch(()=>say('Ο James δεν μπόρεσε να ξεκινήσει τώρα. Θα το ξαναδοκιμάσει.'));
    return}
   if(accept&&r?.state==='accepted'){close({restoreFocus:false});
    window.PaperworldWorldDialogue?.open?.(p.directorId,{context:{title:p.title,state:'Πρόταση που δέχτηκες'},
     draft:'Για την πρότασή σου «'+p.title+'»: '+p.task+' '+(IDEA_ASK[p.directorId]||'Ναι, προχώρα.'),send:true})}
  }catch(_){row.querySelectorAll('button').forEach(b=>b.disabled=false)}
 };
 row.append(button('Ναι, προχώρα','pw-btn-primary',()=>answer(true)),button('Όχι','pw-btn-ghost',()=>answer(false)));
 card.append(row);return card;
}
function renderWork(){
 if(!signedIn()){body.append(signInCard());return}
 if(state.project){renderProject(byId(state.project));return}
 const list=items(),decisions=decisionsCount();
 const attention=list.filter(i=>i.bucket==='attention');
 const active=list.filter(i=>i.bucket==='active');
 const waiting=list.filter(i=>i.bucket==='waiting');
 const reviewed=list.filter(i=>i.bucket==='reviewed');
 const done=list.filter(i=>i.bucket==='done');
 // 1) Three-second summary.
 const hero=el('section','pw-hero');
 hero.append(el('p','pw-hero-kicker',greeting()));
 const needs=decisions+attention.length;
 hero.append(el('h2','pw-hero-title',!state.raw?(state.loading?'Ενημερώνομαι για την ομάδα…':
  'Δεν έχω ενημέρωση αυτή τη στιγμή.'):needs?(needs===1?'Ένα θέμα περιμένει εσένα.':needs+' θέματα περιμένουν εσένα.'):
  active.length?'Κάτι είναι σε εξέλιξη· τίποτα δεν περιμένει εσένα.':'Τίποτα σε εξέλιξη αυτή τη στιγμή.'));
 const stats=el('div','pw-stats');
 for(const [n,label,target] of [[needs,'Χρειάζονται εσένα','pw-sec-attention'],
  [active.filter(i=>!i.note).length,'Σε εξέλιξη','pw-sec-active'],[done.filter(i=>!i.note).length,'Ολοκληρώθηκαν','pw-sec-done']]){
  const b=el('button','pw-stat');b.type='button';b.dataset.tone=target==='pw-sec-attention'&&n?'attention':'';
  b.append(el('strong','',state.raw?String(n):'–'),el('span','',label));
  b.addEventListener('click',()=>body.querySelector('#'+target)?.scrollIntoView({behavior:'smooth',block:'start'}));
  stats.append(b);
 }
 hero.append(stats);body.append(hero);
 if(state.error)body.append(el('p','pw-error',state.error));
 // 2) Needs you: real decisions (hub) + blocked work.
 const needsChildren=[decisionsMount(),...attention.map(i=>itemCard(i))];
 if(!needs&&state.raw)needsChildren.push(empty('Τίποτα δεν περιμένει την απόφασή σου.'));
 body.append(section('Χρειάζονται εσένα',null,needsChildren,{id:'pw-sec-attention',count:state.raw?needs:undefined}));
 // 2b) Ideas the Directors had on their own: the owner answers Ναι / Όχι.
 if(state.proposals?.length)body.append(section('💡 Προτάσεις της ομάδας','Τίποτα δεν ξεκινά χωρίς το «Ναι» σου.',
  state.proposals.map(proposalCard),{id:'pw-sec-ideas',count:state.proposals.length}));
 // 3) In progress.
 body.append(section('Σε εξέλιξη',null,active.length?active.slice(0,8).map(i=>itemCard(i)):
  [empty(state.raw?'Καμία ενεργή εργασία αυτή τη στιγμή.':'—')],{id:'pw-sec-active'}));
 // Plans and completed investigations must not inflate live progress.
 if(waiting.length)body.append(section('Για αργότερα','Δεν έχουν ξεκινήσει ακόμη.',
  waiting.slice(0,6).map(i=>itemCard(i)),{id:'pw-sec-waiting',count:waiting.length}));
 if(reviewed.length)body.append(section('Έτοιμα για ματιά',
  'Ελέγχθηκαν ή ετοιμάστηκαν· τίποτα δεν έχει εφαρμοστεί.',
  reviewed.slice(0,6).map(i=>itemCard(i)),{id:'pw-sec-reviewed',count:reviewed.length}));
 // 4) Recently completed — only with honest labels/evidence.
 const doneSection=section('Ολοκληρώθηκαν πρόσφατα','Σύνδεσμος εμφανίζεται μόνο όταν υπάρχει επαληθευμένο αποτέλεσμα.',
  done.length?done.slice(0,5).map(i=>itemCard(i)):[empty('Δεν υπάρχουν ολοκληρωμένες εργασίες ακόμη.')],{id:'pw-sec-done'});
 body.append(doneSection);
 // 5) Projects.
 const grid=el('div','pw-project-grid');
 for(const p of PROJECTS){
  const open=list.filter(i=>i.project===p.id&&
   ['attention','active','waiting'].includes(i.bucket)).length+decisionsFor(p.id);
  const tile=el('button','pw-project-tile');tile.type='button';tile.dataset.project=p.id;
  const meta=el('span','pw-project-meta');
  meta.append(el('strong','',p.name),el('span','',p.blurb));
  tile.append(portrait(p.owner,'pw-project-portrait'),meta,
   el('span','pw-project-count',state.raw?(open?open+' ανοιχτά':'Ήσυχα'):'—'));
  tile.setAttribute('aria-label',p.name+' · '+ownerName(p.owner)+(state.raw?' · '+open+' ανοιχτά':''));
  tile.addEventListener('click',()=>go('work',{project:p.id}));
  grid.append(tile);
 }
 body.append(section('Projects',null,[grid]));
 // 6) Ask the team — prefilled to Matt, never auto-sent.
 const ask=el('form','pw-ask');
 const field=el('textarea');field.rows=2;field.maxLength=1200;field.placeholder='Τι θέλεις να γίνει; Ο Matt θα βρει ποιος μπορεί να βοηθήσει.';
 field.setAttribute('aria-label','Ζήτα κάτι από την ομάδα');
 const go2=el('button','pw-btn-primary','Συνέχεια με τον Matt');go2.type='submit';
 ask.append(field,go2);
 ask.addEventListener('submit',e=>{e.preventDefault();talk('matt',{draft:field.value})});
 body.append(section('Ζήτα κάτι από την ομάδα',null,[ask]));
}
function renderProject(p){
 if(!p){state.project=null;renderWork();return}
 const list=items().filter(i=>i.project===p.id);
 const hero=el('section','pw-project-hero');hero.dataset.agent=p.owner;
 hero.append(portrait(p.owner,'pw-project-hero-portrait'));
 const meta=el('div','pw-project-hero-meta');
 meta.append(el('h2','pw-hero-title',p.name),el('p','pw-section-hint',p.blurb+' · '+
  (p.owner==='matt'?'Matt, Chief of Staff':ownerName(p.owner)+', Director')));
 const actions=el('div','pw-agent-actions');
 actions.append(button('Μίλα με '+withArticle(p.owner),'pw-btn-primary',()=>talk(p.owner)),
  button('Τι θυμάται','pw-btn-secondary',()=>openMemory(p.owner)),
  button('⌖','pw-icon-btn',()=>locate(p.owner),'Δες στο χωριό'));
 meta.append(actions);hero.append(meta);body.append(hero);
 const decisions=decisionsFor(p.id);
 const attention=list.filter(i=>i.bucket==='attention');
 if(decisions||attention.length)body.append(section('Χρειάζονται εσένα',null,
  [decisions?decisionsMount(p.id):el('span'),...attention.map(i=>itemCard(i,{showProject:false}))]));
 const active=list.filter(i=>i.bucket==='active'&&!i.note);
 body.append(section('Σε εξέλιξη',null,active.length?active.map(i=>itemCard(i,{showProject:false})):
  [empty('Καμία ενεργή εργασία σε αυτό το project.')]));
 const waiting=list.filter(i=>i.bucket==='waiting'&&!i.note);
 if(waiting.length)body.append(section('Για αργότερα',null,waiting.map(i=>itemCard(i,{showProject:false}))));
 const reviewed=list.filter(i=>i.bucket==='reviewed'&&!i.note);
 if(reviewed.length)body.append(section('Έτοιμα για ματιά',null,
  reviewed.map(i=>itemCard(i,{showProject:false}))));
 const done=list.filter(i=>i.bucket==='done'&&!i.note);
 if(done.length)body.append(section('Ολοκληρώθηκαν',null,done.map(i=>itemCard(i,{showProject:false}))));
 if(p.id==='shop')body.append(...shopSections());
 body.append(notesSection(p));
}
// James's page: what he researched each day and where each product is.
const SHOP_STATUS={spec:'Σχεδιάζεται',listing:'Μπαίνει στη βιτρίνα',listed:'Στη βιτρίνα · Coming soon',live:'Πωλείται',failed:'Σταμάτησε'};
const CHANNEL={etsy:'Etsy',own_shop:'Δικό μας site',other:'Άλλη αγορά'};
function shopSections(){
 const ui=cloud();
 if(typeof ui?.listShopResearch==='function'&&Date.now()-(state.shopAt||0)>60000){
  state.shopAt=Date.now();
  Promise.all([ui.listShopResearch().catch(()=>null),ui.listShopProducts().catch(()=>null)]).then(([r,p])=>{
   state.shopResearch=r;state.shopProducts=p;if(state.view==='work'&&state.project==='shop')render()});
 }
 const prods=state.shopProducts,notes=state.shopResearch;
 const shelf=prods?.length?prods.map(p=>{const row=el('article','pw-item');row.dataset.bucket=p.status==='failed'?'attention':'done';
   row.append(el('h3','pw-item-title',p.title+(p.price?' · '+String(p.price).replace('.',',')+' €':'')),el('p','pw-item-state',SHOP_STATUS[p.status]));
   if(['listed','live'].includes(p.status)){const a=el('a','pw-link','Δες το στη βιτρίνα');a.href='https://mr-tanq.github.io/paperworld-shop/';
    a.target='_blank';a.rel='noopener noreferrer';const act=el('div','pw-item-actions');act.append(a);row.append(act)}
   return row}):[empty(prods?'Κανένα προϊόν ακόμα. Ο James φτιάχνει ό,τι εγκρίνεις στις Προτάσεις.':'Φόρτωση…')];
 const journal=notes?.length?notes.map(n=>{const c=el('article','pw-item pw-research');
   c.append(el('p','pw-item-state',n.day+' · '+'●'.repeat(n.confidence)+'○'.repeat(5-n.confidence)+' · '+CHANNEL[n.channel]),
    el('h3','pw-item-title',n.niche+' → '+n.product),el('p','pw-section-hint',n.why));
   if(n.evidence.length){const d=el('details','pw-item-details');d.append(el('summary','pw-item-preview','Στοιχεία'),
    ...n.evidence.map(e=>el('p','pw-item-full','“'+e+'”')));c.append(d)}
   return c}):[empty(notes?'Η πρώτη έρευνα γίνεται το πρωί.':'Φόρτωση…')];
 return [section('Τα προϊόντα του James',null,shelf,{count:prods?.length}),
  section('Ημερολόγιο έρευνας','Τι βρίσκει κάθε μέρα και πόσο σίγουρος είναι (●○ = βεβαιότητα 1–5).',journal,{count:notes?.length})];
}
// Personal notes for a project (the owner's own cloud tasks).
function notesSection(p){
 const wrap=el('div','pw-notes');
 const tasks=(state.raw?.tasks||[]).filter(t=>t.room===p.id);
 const form=el('form','pw-note-form');
 const input=el('input');input.type='text';input.maxLength=160;input.required=true;
 input.placeholder='Πρόσθεσε μια σημείωση…';input.setAttribute('aria-label','Νέα σημείωση για '+p.name);
 const add=el('button','pw-btn-secondary','Προσθήκη');add.type='submit';
 form.append(input,add);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!input.value.trim())return;add.disabled=true;
  try{await cloud().addTask(p.id,input.value.trim(),'');input.value='';await load(true)}
  catch(_){say('Η σημείωση δεν αποθηκεύτηκε.')}finally{add.disabled=false}
 });
 wrap.append(form);
 const NEXT={todo:'doing',doing:'done',done:'todo'};
 const LABEL={todo:'Για αργότερα',doing:'Σε εξέλιξη',done:'Έγινε'};
 if(!tasks.length)wrap.append(empty('Καμία σημείωση. Οι σημειώσεις είναι δικές σου· δεν αναθέτουν εργασία σε agent.'));
 for(const t of tasks){
  const row=el('div','pw-note');row.dataset.status=t.status;
  const status=button(LABEL[t.status]||t.status,'pw-note-status',async()=>{
   status.disabled=true;
   try{await cloud().updateTask(t.id,{status:NEXT[t.status]||'todo'});await load(true)}
   catch(_){say('Η αλλαγή δεν αποθηκεύτηκε.');status.disabled=false}
  },'Κατάσταση: '+(LABEL[t.status]||t.status)+'. Πάτησε για αλλαγή.');
  const remove=button('×','pw-icon-btn pw-note-remove',async()=>{
   if(!window.confirm('Οριστική διαγραφή της σημείωσης «'+t.title+'»;'))return;
   try{await cloud().removeTask(t.id);await load(true)}catch(_){say('Η διαγραφή απέτυχε.')}
  },'Διαγραφή σημείωσης');
  row.append(status,el('span','pw-note-title',t.title),remove);
  wrap.append(row);
 }
 return section('Οι σημειώσεις σου',null,[wrap]);
}

// ---------- Settings ------------------------------------------------------
// Honest service status: only a successful authenticated answer can say
// "connected"; failures are named (unavailable / not set up / signed out)
// and a slow server can never leave the row stuck on "checking".
async function refreshConnections(){
 const status=window.PaperworldConnectionStatus,ui=cloud();
 if(!status||!ui)return;
 state.settings={github:{state:'checking'},suno:{state:'checking'}};
 if(state.view==='settings'&&!shell.hidden)render();
 const opts={signedIn:signedIn()};
 const [gh,sn]=await Promise.all([status.read('github',ui.githubLinkStatus,opts),
  status.read('suno',ui.sunoLinkStatus,opts)]);
 state.settings={github:gh,suno:sn};
 if(state.view==='settings'&&!shell.hidden)render();
}
function settingRow(label,hint,trailing,{state:s}={}){
 const row=el('div','pw-setting');
 const text=el('div','pw-setting-text');
 text.append(el('strong','',label));if(hint)text.append(el('span','',hint));
 if(s){const dot=el('span','pw-dot');dot.dataset.state=s;row.append(dot)}
 row.append(text);if(trailing)row.append(trailing);return row;
}
function prefs(){try{return window.localStorage.getItem('paperworld-pref-reduce-motion')==='1'}catch(_){return false}}
function applyPrefs(){document.documentElement.classList.toggle('pw-reduce-motion',prefs())}
applyPrefs();
// Plain-language health lines; only facts the server confirmed.
function healthLines(h){
 const line=(state,text)=>{const p=el('p','pw-health-line',text);p.dataset.state=state;return p};
 const out=[];
 const hb=h.heartbeat||{};
 out.push(line(hb.state==='ok'?'ok':hb.state==='late'?'attention':'problem',
  hb.state==='ok'?'Ο αυτόματος έλεγχος εργασιών τρέχει κανονικά.':
  hb.state==='late'?'Ο αυτόματος έλεγχος καθυστερεί ('+hb.minutes+' λεπτά).':
  hb.state==='stopped'?'Ο αυτόματος έλεγχος έχει σταματήσει.':'Η κατάσταση του αυτόματου ελέγχου δεν είναι γνωστή.'));
 if(hb.hasError)out.push(line('problem','Ο τελευταίος αυτόματος έλεγχος ανέφερε σφάλμα.'));
 const w=h.work||{};
 if(w.state==='ok')out.push(line('ok','Καμία εργασία δεν έχει κολλήσει.'));
 else if(w.state==='attention')out.push(line('attention',
  (w.stalled?w.stalled+' εργασίες χωρίς νέα πάνω από 2 ώρες. ':'')+
  (w.uncertain?w.uncertain+' ενέργειες με αβέβαιο αποτέλεσμα — δεν επαναλαμβάνονται αυτόματα.':'')));
 const r=h.routines||{};
 out.push(line(r.state==='ok'?'ok':'attention',r.state==='ok'?
  'Εβδομαδιαία προγράμματα: '+(r.enabled||0)+' ενεργά από '+(r.total||0)+'.':
  r.state==='not_installed'?'Τα εβδομαδιαία προγράμματα δεν έχουν εγκατασταθεί ακόμη στη βάση.':
  'Η κατάσταση των προγραμμάτων δεν είναι γνωστή.'));
 if(h.config&&!h.config.aiBudgetVerified)out.push(line('attention','Οι AI συνομιλίες είναι κλειδωμένες μέχρι να επιβεβαιωθεί το όριο κόστους.'));
 if(h.config&&!h.config.database)out.push(line('problem','Ο server δεν έχει πρόσβαση στη βάση.'));
 return out;
}
function renderSettings(){
 const ui=cloud();
 // Language preferences are local UI settings, independent of sign-in.
 const i18n=window.PaperworldI18n;let languageSection=null;
 if(i18n){
  const createChoice=(labelText,values,current,onChange)=>{
   const select=el('select','pw-language-select');
   select.setAttribute('aria-label',labelText);
   for(const [value,text] of values){const option=el('option','',text);option.value=value;select.append(option)}
   select.value=current;
   select.addEventListener('change',()=>onChange(select.value));
   return settingRow(labelText,null,select);
  };
  const interfaceChoice=createChoice('Γλώσσα εφαρμογής',
   [['el','🇬🇷 Ελληνικά'],['en','🇬🇧 English']],i18n.ui(),v=>i18n.setUI(v));
  const conversationChoice=createChoice('Γλώσσα συνομιλιών',
   [['auto','Αυτόματα — απάντηση στη γλώσσα μου'],['el','Πάντα ελληνικά'],['en','Πάντα αγγλικά']],
   i18n.chat(),v=>i18n.setChat(v));
  languageSection=section('Γλώσσα',null,[interfaceChoice,conversationChoice]);
 }

 // «Απόδειξη»: what the team really did on its own (last 30 days, real records).
 let proofBox=null;const P=window.PaperworldProof;
 if(P&&signedIn()){
  const sum=P.summary(state.missions||[]);
  const proof=[];
  const stat=(n,label)=>{const b=el('div','pw-stat');b.append(el('strong','',n===null?'–':String(n)),el('span','',label));return b};
  const grid=el('div','pw-stats');
  grid.append(stat(sum.alone,'Μόνοι τους'),stat(sum.neededYou,'Χρειάστηκε εσένα'),stat(sum.rate===null?null:sum.rate+'%','Ποσοστό αυτονομίας'));
  proof.push(grid);
  proof.push(el('p','pw-section-hint',(sum.medianMinutes===null?'':'Συνήθης χρόνος μέχρι τη διόρθωση: '+sum.medianMinutes+' λεπτά. ')+
   'Πρωτοβουλίες: '+sum.initiatives+'. Σε εξέλιξη: '+sum.running+'.'));
  for(const r of sum.recent){const row=el('div','pw-proof-row');
   row.append(el('span','pw-proof-out',P.LABEL[r.outcome]),el('span','pw-proof-title',r.who+' · '+r.title),
    el('span','pw-proof-meta',r.source+(r.minutes!==null&&r.outcome!=='running'?' · '+r.minutes+'′':'')));proof.push(row)}
  if(!sum.total)proof.push(empty('Καμία εργασία τις τελευταίες 30 μέρες.'));
  const box=el('details','pw-advanced pw-proof');
  box.append(el('summary','','Απόδειξη αυτονομίας'+(sum.rate===null?'':' · '+sum.rate+'% μόνοι τους')),
   el('p','pw-section-hint','Μόνο από πραγματικές εργασίες των τελευταίων 30 ημερών (Luna και Joey).'),...proof);
  proofBox=box;
 }
 // Account
 const account=[];
 if(signedIn()){
  account.push(settingRow(ui.identity?.()||'Συνδεδεμένος λογαριασμός','PAPERWORLD Cloud · ιδιωτικά δεδομένα',
   button('Αποσύνδεση','pw-btn-ghost',async()=>{
    if(!window.confirm('Να γίνει αποσύνδεση από το PAPERWORLD Cloud;'))return;
    try{await ui.signOut();state.raw=null;state.loadedAt=0;render()}catch(_){say('Η αποσύνδεση απέτυχε.')}
   })));
 }else account.push(signInCard());
 body.append(section('Λογαριασμός',null,account));
 if(signedIn()){
  // Connected services — the single place for connection controls.
  const gh=state.settings.github,sn=state.settings.suno;
  const retry=()=>button('Δοκίμασε ξανά','pw-btn-ghost',()=>void refreshConnections());
  const ghAction=gh.state==='disconnected'?button('Σύνδεση','pw-btn-secondary',async()=>{
   try{const url=await ui.beginGithubLink();window.location.assign(url)}catch(_){say('Η σύνδεση GitHub δεν ξεκίνησε.')}
  }):gh.state==='unavailable'?retry():null;
  const snAction=sn.state==='disconnected'?button('Σύνδεση','pw-btn-secondary',async()=>{
   if(!window.confirm('Θα μεταφερθείς στη σελίδα εξουσιοδότησης του Suno. Δεν θα δημιουργηθεί τραγούδι και δεν θα καταναλωθούν credits. Συνέχεια;'))return;
   try{const url=await ui.beginSunoLink();window.location.assign(url)}catch(_){say('Η σύνδεση Suno δεν ξεκίνησε.')}
  }):sn.state==='unavailable'?retry():sn.state==='connected'?
   button('Music Studio','pw-btn-ghost',()=>talk('studio-director')):null;
  const ghHint=gh.state==='connected'?(gh.temporary?'Συνδεδεμένο, αλλά προσωρινά: θα χαθεί αν γίνει επανεκκίνηση του server.':
    'Συνδεδεμένο μόνιμα· οι AI συνομιλίες και οι Developers είναι έτοιμοι.'):
   gh.state==='not_configured'?'Η σύνδεση GitHub δεν έχει ρυθμιστεί στον server.':
   gh.state==='unavailable'?'Ο server δεν απάντησε. Η κατάσταση δεν είναι γνωστή.':
   'Για AI συνομιλίες και προετοιμασία αλλαγών κώδικα.';
  const snHint=sn.state==='connected'?(sn.temporary?'Συνδεδεμένο προσωρινά (λήγει σε περίπου μία ώρα).':
   'Συνδεδεμένο μόνιμα· ανανεώνεται μόνο του. Όριο 50 τραγούδια τον μήνα.'):
   sn.state==='unavailable'?'Ο server δεν απάντησε. Η κατάσταση δεν είναι γνωστή.':
   'Για δημιουργία τραγουδιών από το Music Studio του Crow.';
  const status=window.PaperworldConnectionStatus;
  body.append(section('Συνδεδεμένες υπηρεσίες','Χρησιμοποιούνται μόνο όταν το εγκρίνεις.',[
   settingRow('GitHub · '+status.label(gh.state),ghHint,ghAction,{state:gh.state}),
   settingRow('Suno · '+status.label(sn.state),snHint,snAction,{state:sn.state})]));
  // Memory: one tidy entry; the page itself shows each member.
  const faces=el('span','pw-mem-faces');for(const [id] of MEMBERS)faces.append(portrait(id));
  const memRow=settingRow('Μνήμη της ομάδας','Τι θυμάται ο καθένας και τι περιμένει την έγκρισή σου',
   button('Άνοιγμα ›','pw-btn-ghost',()=>openMemory('listening-director')));
  memRow.prepend(faces);
  body.append(section('Μνήμη',null,[memRow]));
 }
 // Preferences
 const sw=el('button','pw-switch');sw.type='button';sw.setAttribute('role','switch');
 sw.setAttribute('aria-checked',String(prefs()));sw.setAttribute('aria-label','Λιγότερη κίνηση');
 sw.addEventListener('click',()=>{
  try{window.localStorage.setItem('paperworld-pref-reduce-motion',prefs()?'0':'1')}catch(_){}
  applyPrefs();sw.setAttribute('aria-checked',String(prefs()));
 });
 // Village sounds: optional, off by default, synthesized in the browser.
 const sound=window.PaperworldSound;
 const snd=el('button','pw-switch');snd.type='button';snd.setAttribute('role','switch');
 snd.setAttribute('aria-checked',String(sound?.enabled?.()===true));snd.setAttribute('aria-label','Ήχοι του χωριού');
 snd.disabled=!sound;
 snd.addEventListener('click',()=>{
  const on=!(sound?.enabled?.()===true);sound?.setEnabled?.(on);
  snd.setAttribute('aria-checked',String(sound?.enabled?.()===true));
  if(on)sound?.chime?.();
 });
 // Phone notifications: Matt's updates reach this device even when the app is closed.
 const push=window.PaperworldPush;
 const ntf=el('button','pw-switch');ntf.type='button';ntf.setAttribute('role','switch');
 ntf.setAttribute('aria-checked','false');ntf.setAttribute('aria-label','Ειδοποιήσεις στο κινητό');
 ntf.disabled=!push||typeof cloud()?.savePushSubscription!=='function';
 const ntfNote=el('p','pw-section-hint','');ntfNote.hidden=true;
 if(push)void push.enabled().then(on=>ntf.setAttribute('aria-checked',String(on)));
 ntf.addEventListener('click',async()=>{
  ntf.disabled=true;ntfNote.hidden=true;
  const on=ntf.getAttribute('aria-checked')==='true';
  const r=on?await push.disable(cloud()):await push.enable(cloud()).catch(()=>({ok:false,reason:'save_failed'}));
  ntf.setAttribute('aria-checked',String(await push.enabled()));ntf.disabled=false;
  if(!r.ok){ntfNote.textContent=push.REASONS[r.reason]||push.REASONS.save_failed;ntfNote.hidden=false}
 });
 const keys=el('p','pw-section-hint pw-keys-hint','Συντομεύσεις: M · Matt, T · κοντινός agent, Esc · κλείσιμο.');
 body.append(section('Προτιμήσεις',null,[settingRow('Λιγότερη κίνηση','Απενεργοποιεί τις μεταβάσεις και τις κινήσεις διεπαφής',sw),
  settingRow('Ήχοι του χωριού','Ρυάκι, πουλιά τη μέρα, γρύλοι το βράδυ και ένα απαλό «ντινγκ» όταν σου απαντούν',snd),
  settingRow('Ειδοποιήσεις στο κινητό','Ο Matt σε ειδοποιεί όταν τελειώνει ή σταματά μια εργασία, και για την πρωινή σύνοψη',ntf),ntfNote,keys]));
 if(languageSection)body.append(languageSection);
 if(proofBox)body.append(proofBox);
 // Advanced (clearly separated from everyday settings)
 const adv=el('details','pw-advanced');
 adv.append(el('summary','','Για προχωρημένους'));
 // Low-cost, read-only health report (owner only, no AI).
 const healthOut=el('div','pw-health');healthOut.setAttribute('aria-live','polite');
 const healthBtn=button('Έλεγχος','pw-btn-ghost',async()=>{
  if(typeof ui?.systemHealth!=='function'){healthOut.replaceChildren(el('p','pw-section-hint','Δεν είναι διαθέσιμο.'));return}
  healthBtn.disabled=true;healthOut.replaceChildren(el('p','pw-section-hint','Έλεγχος…'));
  try{healthOut.replaceChildren(...healthLines(await ui.systemHealth()))}
  catch(_){healthOut.replaceChildren(el('p','pw-section-hint','Ο server δεν απάντησε. Δοκίμασε ξανά σε λίγο.'))}
  finally{healthBtn.disabled=false}
 });
 adv.append(settingRow('Κατάσταση συστήματος','Γρήγορος έλεγχος χωρίς AI και χωρίς κόστος',healthBtn),healthOut);
 const maint=el('a','pw-link','Άνοιγμα');maint.href='?maintenance=1';
 adv.append(settingRow('Λειτουργία συντήρησης','Εργαλεία χάρτη, διαδρομών και διαγνωστικά',maint));
 body.append(adv);
}

// ---------- Memory (native page, replaces the old memory desk) -------------
const MEMBERS=[['matt','town'],['listening-director','workshop'],['pokemon-director','pokemon'],
 ['studio-director','studio'],['wellbeing-director','wellbeing'],['shop-director','shop']];
const KIND={project_bible:'Βασικά',decision:'Απόφαση',preference:'Προτίμηση',current_state:'Κατάσταση',work_history:'Από εργασία'};
const memberName=id=>id==='matt'?'Matt':ownerName(id);
function openMemory(agentId){
 const m=MEMBERS.find(x=>x[0]===agentId)||MEMBERS[1];
 if(state.view!=='settings')go('settings');
 state.memory=m[0];state.memoryRows=null;state.memoryQuery='';state.memoryError='';render();body.scrollTop=0;
 void loadMemory();
}
async function loadMemory(){
 const agent=state.memory,project=MEMBERS.find(x=>x[0]===agent)?.[1];
 if(!project||typeof cloud()?.listDirectorMemory!=='function')return;
 state.memoryBusy=true;render();
 const first=state.memoryRows===null;
 try{const rows=await cloud().listDirectorMemory(project);if(state.memory===agent){state.memoryRows=rows;state.memoryError=''}}
 catch(_){if(state.memory===agent)state.memoryError='Δεν μπόρεσα να φορτώσω τη μνήμη. Δοκίμασε ξανά.'}
 finally{state.memoryBusy=false;render();if(first)body.scrollTop=0}
}
function memoryCard(row,{review=false}={}){
 const card=el('article','pw-mem');
 const meta=el('div','pw-mem-meta');
 meta.append(el('span','pw-chip',KIND[row.kind]||'Σημείωση'));
 if(row.sensitivity==='private')meta.append(el('span','pw-chip pw-chip-private','🔒 Ιδιωτική'));
 const when=Date.parse(row.observed_at);
 if(Number.isFinite(when))meta.append(el('span','pw-mem-date',new Date(when).toLocaleDateString('el-GR',{day:'numeric',month:'short'})));
 const text=el('p','pw-mem-body',String(row.body||''));
 text.addEventListener('click',()=>text.classList.toggle('pw-open'));
 card.append(el('strong','pw-mem-title',String(row.title||'')),text,meta);
 if(review){
  const project=MEMBERS.find(x=>x[0]===state.memory)?.[1];
  const act=el('div','pw-mem-actions');
  const decide=async decision=>{
   act.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{await cloud().reviewDirectorMemory({projectId:project,entryId:row.id,decision});
    say(decision==='approved'?'Εγκρίθηκε: θα το θυμάται.':'Απορρίφθηκε.');await loadMemory()}
   catch(_){say('Δεν εφαρμόστηκε. Ανανέωσε και δοκίμασε ξανά.');act.querySelectorAll('button').forEach(b=>b.disabled=false)}
  };
  act.append(button('Να το θυμάται','pw-btn-primary',()=>decide('approved')),button('Όχι','pw-btn-ghost',()=>decide('rejected')));
  card.append(act);
 }
 return card;
}
function renderMemory(){
 // Who: one row of portraits, the selected member highlighted.
 const who=el('div','pw-mem-who');who.setAttribute('role','tablist');
 for(const [id] of MEMBERS){
  const b=el('button','pw-mem-person');b.type='button';b.setAttribute('role','tab');
  b.setAttribute('aria-selected',String(state.memory===id));
  b.append(portrait(id,'pw-mem-face'),el('span','',memberName(id)));
  b.addEventListener('click',()=>{if(state.memory!==id)openMemory(id)});who.append(b);
 }
 body.append(who);
 if(state.memoryError){body.append(el('p','pw-error',state.memoryError));return}
 const rows=state.memoryRows;
 if(!rows){body.append(empty(state.memoryBusy?'Φορτώνω…':'—'));return}
 const pending=rows.filter(r=>r.status==='proposed');
 const approved=rows.filter(r=>r.status==='approved');
 const older=rows.filter(r=>r.status==='rejected'||r.status==='superseded');
 body.append(el('p','pw-section-hint',approved.length+' πράγματα θυμάται'+(pending.length?' · '+pending.length+' περιμένουν την έγκρισή σου':'')+
  (state.memory==='wellbeing-director'?' · τα προσωπικά μένουν μόνο στον Dave':'')));
 if(pending.length)body.append(section('Περιμένουν την έγκρισή σου','Χωρίς το «Να το θυμάται» δεν χρησιμοποιείται.',
  pending.map(r=>memoryCard(r,{review:true})),{count:pending.length}));
 const search=el('input','pw-mem-search');search.type='search';search.placeholder='Αναζήτηση στη μνήμη…';
 search.value=state.memoryQuery;search.setAttribute('aria-label','Αναζήτηση στη μνήμη');
 const list=el('div','pw-mem-list');
 const paint=()=>{const q=state.memoryQuery.trim().toLowerCase();
  const shown=approved.filter(r=>!q||(String(r.title)+' '+String(r.body)).toLowerCase().includes(q));
  list.replaceChildren(...(shown.length?shown.map(r=>memoryCard(r)):[empty(q?'Δεν βρέθηκε κάτι.':'Δεν θυμάται τίποτα ακόμα.')]))};
 search.addEventListener('input',()=>{state.memoryQuery=search.value;paint()});
 paint();
 body.append(section('Τι θυμάται',null,[search,list]));
 if(older.length){const d=el('details','pw-advanced');d.append(el('summary','','Απορριφθείσες και παλιές ('+older.length+')'),...older.map(r=>memoryCard(r)));body.append(d)}
}

// ---------- Render --------------------------------------------------------
function paintChrome(){
 for(const [id] of TABS){
  const selected=state.view===id;
  tabButtons[id].setAttribute('aria-selected',String(selected));tabButtons[id].tabIndex=selected?0:-1;
 }
 body.setAttribute('aria-labelledby','pw-ws-tab-'+state.view);
 const project=state.view==='work'&&state.project?byId(state.project):null;
 const memoryPage=state.view==='settings'&&state.memory;
 title.textContent=project?project.name:memoryPage?'Μνήμη της ομάδας':VIEW_TITLE[state.view];
 subtitle.textContent=project?'Project':state.view==='team'?'Ποιος βοηθά σε τι':
  state.view==='work'?(state.loading?'Ενημέρωση…':signedIn()?'Τι γίνεται και τι χρειάζεται εσένα':''):
  'Λογαριασμός, συνδέσεις και μνήμη';
 if(memoryPage)subtitle.textContent='Τι θυμάται κάθε μέλος · μόνο ό,τι εγκρίνεις';
 back.hidden=!project&&!memoryPage;shell.dataset.view=state.view;
 refresh.hidden=state.view==='settings'||!signedIn();
 refresh.classList.toggle('pw-spin',state.loading);
}
function render(){
 if(shell.hidden)return;
 paintChrome();
 const keep=body.scrollTop;body.replaceChildren();
 if(state.view==='team'){
  const host=el('div','pw-team');
  window.PaperworldTeamView?.render(host,ctx);body.append(host);
 }else if(state.view==='settings')(state.memory?renderMemory():renderSettings());
 else renderWork();
 body.scrollTop=keep;
}
document.addEventListener('keydown',e=>{
 if(shell.hidden||e.key!=='Escape'||e.defaultPrevented)return;
 e.preventDefault();goBack();
});
// Entry points: the village controls.
const controls=document.querySelector('.controls');
const launch=document.querySelector('.team-launch');
function wire(btn,id){btn?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();
 if(!shell.hidden&&state.view===id&&!state.project)close();else open(id)},true)}
let teamLaunch=launch;
if(!teamLaunch&&controls){
 teamLaunch=el('button','team-launch','♟');teamLaunch.type='button';
 controls.insertBefore(teamLaunch,controls.querySelector('#world-work-panel'));
}
if(teamLaunch){teamLaunch.title='Η ομάδα σου';teamLaunch.setAttribute('aria-label','Η ομάδα σου')}
wire(teamLaunch,'team');
wire(document.querySelector('#world-work-panel'),'work');
if(controls){
 const gear=el('button','settings-launch','⚙');gear.type='button';gear.title='Ρυθμίσεις';
 gear.setAttribute('aria-label','Ρυθμίσεις');
 const after=document.querySelector('#world-work-panel');
 if(after)after.after(gear);else controls.append(gear);
 wire(gear,'settings');
}
// Every top button says what it does (a short word under the icon).
const LABELS=[['#world-talk-matt','Matt'],['.controls .team-launch','Ομάδα'],['#world-work-panel','Εργασίες'],
 ['.controls .settings-launch','Ρυθμίσεις'],['#home','Χωριό']];
for(const [sel,label] of LABELS){const b=document.querySelector(sel);if(b)b.dataset.label=label}
controls?.classList.add('controls-labeled');
document.addEventListener('paperworld:language-change',()=>{shell.lang=window.PaperworldI18n?.ui?.()||'el'});
window.PaperworldWorkspace=Object.freeze({open,close,openMemory:id=>{if(shell.hidden)open('settings');openMemory(id)},isOpen:()=>!shell.hidden,
 view:()=>state.view,items,stats,PROJECTS});
})();
