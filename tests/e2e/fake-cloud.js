// Injected before page scripts. Fake owner data only; no network.
window.__installFakeCloud=function(){
 const now=Date.now(),iso=m=>new Date(now-m*60000).toISOString();
 const U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const tasks=[
  {id:'t1',room:'studio',title:'Τελικό mix για το «Ash on the Windowsill»',notes:'',status:'doing',created:now-86400000},
  {id:'t2',room:'pokemon',title:'Σχέδιο για τον επόμενο χάρτη',notes:'',status:'todo',created:now-3600000},
  {id:'t3',room:'wellbeing',title:'Εβδομαδιαίο πρόγραμμα προπόνησης',notes:'',status:'done',created:now-7200000}];
 const missions=[
  {id:U(1),projectId:'listening',status:'running',goal:'Διόρθωση εικόνων που λείπουν από τις συναυλίες'},
  {id:U(2),projectId:'pokemon',status:'needs_you',lastError:'agent_no_changes',goal:'Ρύθμιση δυσκολίας στη μάχη του Alder'},
  {id:U(3),projectId:'listening',status:'completed',goal:'Βελτίωση φόρτωσης λίστας συναυλιών',report:{headStillCurrent:true,requiredTests:['npm test'],prUrl:'https://github.com/mr-tanq/concerts/pull/42'}}];
 const teamJobs=[{id:U(10),requestId:U(11),project:'pokemon',directorId:'pokemon-director',workerId:'pokemon-developer',status:'awaiting_consent',summary:'Ο Joey προτείνει έλεγχο του player.gd για το κόλλημα στην κίνηση',createdAt:iso(40)}];
 // Routine fakes: the slot rule mirrors the database (Europe/Amsterdam local time).
 const routines=[];
 const dismissed=new Set();
 const slot=(day,hour,minute)=>{const d=new Date();for(let i=0;i<8;i++){const c=new Date(d);c.setDate(d.getDate()+i);
  if(c.getDay()===day){c.setHours(hour,minute,0,0);if(c>d)return c.toISOString()}}return new Date(d.getTime()+7*864e5).toISOString()};
 const client={
  previewRoutine:async p=>({reviewOnly:true,enabled:false,aiCalls:0,additionalSpendUsd:0,projectId:p.projectId,goal:p.goal,
   dayOfWeek:p.dayOfWeek,hour:p.hour,minute:p.minute,timezone:p.timezone||'Europe/Amsterdam',nextReviewAt:slot(p.dayOfWeek,p.hour,p.minute)}),
  createRoutine:async p=>{const id=U(500+routines.length);routines.push({id,...p,timezone:p.timezone||'Europe/Amsterdam',enabled:false,nextReviewAt:null});
   return {routineId:id,enabled:false,requiresActivation:true}},
  listRoutines:async()=>routines.map(r=>({...r})),
  changeRoutine:async(id,enabled)=>{const r=routines.find(x=>x.id===id);r.enabled=enabled;
   r.nextReviewAt=enabled?slot(r.dayOfWeek,r.hour,r.minute):null;return {routineId:id,enabled,aiCalls:0,execution:'review_drafts_only'}},
  updateRoutine:async(id,ch)=>{const r=routines.find(x=>x.id===id);Object.assign(r,ch);
   if(r.enabled)r.nextReviewAt=slot(r.dayOfWeek,r.hour,r.minute);return {routineId:id,...r,aiCalls:0,execution:'review_drafts_only'}},
  systemHealth:async()=>({overall:'attention',aiCalls:0,heartbeat:{state:'ok',minutes:3},work:{state:'ok',stalled:0,uncertain:0},
   routines:{state:'not_installed'},config:{database:true,aiBudgetVerified:true}}),
  signedIn:()=>true,identity:()=>'owner@example.test',ownerId:()=>U(99),
  list:async()=>tasks.map(t=>({...t})),
  add:async(room,title,notes)=>{tasks.push({id:'t'+(tasks.length+1),room,title,notes,status:'todo',created:Date.now()})},
  update:async(id,patch)=>{Object.assign(tasks.find(t=>t.id===id),patch)},
  remove:async id=>{tasks.splice(tasks.findIndex(t=>t.id===id),1)},
  mattJobHistory:async()=>({jobs:[]}),
  teamHandoffHistory:async()=>({jobs:teamJobs,workerRuns:[]}),
  listPokemonProposals:async()=>[],listListeningProposals:async()=>[],
  listAutonomousMissions:async()=>missions,autonomousControllerStatus:async()=>null,
  listDismissed:async()=>[...dismissed],dismissItem:async k=>{dismissed.add(k);return true},restoreItem:async k=>{dismissed.delete(k);return true},
  agentMessages:async()=>[],githubLinkStatus:async()=>({connected:true,login:'owner'}),
  sunoLinkStatus:async()=>({oauthAuthorized:false,canGenerate:false,ephemeral:true}),
  listDirectorMemory:async()=>[],signout:async()=>{},beginGithubLink:async()=>'https://github.com/login/oauth/authorize?x=1',
 };
 return new Proxy(client,{get:(t,k)=>k in t?t[k]:async()=>({})});
};
(()=>{let real;Object.defineProperty(window,'PaperworldCloud',{configurable:true,
 get(){return real&&{...real,createClient:()=>window.__installFakeCloud()}},set(v){real=v}})})();
