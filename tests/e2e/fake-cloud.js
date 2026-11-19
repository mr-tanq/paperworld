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
  {id:U(2),projectId:'pokemon',status:'needs_you',goal:'Ρύθμιση δυσκολίας στη μάχη του Alder'},
  {id:U(3),projectId:'listening',status:'completed',goal:'Βελτίωση φόρτωσης λίστας συναυλιών',report:{headStillCurrent:true,requiredTests:['npm test'],prUrl:'https://github.com/mr-tanq/concerts/pull/42'}}];
 const teamJobs=[{id:U(10),requestId:U(11),project:'pokemon',directorId:'pokemon-director',workerId:'pokemon-developer',status:'awaiting_consent',summary:'Ο Joey προτείνει έλεγχο του player.gd για το κόλλημα στην κίνηση',createdAt:iso(40)}];
 const client={
  signedIn:()=>true,identity:()=>'owner@example.test',ownerId:()=>U(99),
  list:async()=>tasks.map(t=>({...t})),
  add:async(room,title,notes)=>{tasks.push({id:'t'+(tasks.length+1),room,title,notes,status:'todo',created:Date.now()})},
  update:async(id,patch)=>{Object.assign(tasks.find(t=>t.id===id),patch)},
  remove:async id=>{tasks.splice(tasks.findIndex(t=>t.id===id),1)},
  mattJobHistory:async()=>({jobs:[]}),
  teamHandoffHistory:async()=>({jobs:teamJobs,workerRuns:[]}),
  listPokemonProposals:async()=>[],listListeningProposals:async()=>[],
  listAutonomousMissions:async()=>missions,autonomousControllerStatus:async()=>null,
  agentMessages:async()=>[],githubLinkStatus:async()=>({connected:true,login:'owner'}),
  sunoLinkStatus:async()=>({oauthAuthorized:false,canGenerate:false,ephemeral:true}),
  listDirectorMemory:async()=>[],signout:async()=>{},beginGithubLink:async()=>'https://github.com/login/oauth/authorize?x=1',
 };
 return new Proxy(client,{get:(t,k)=>k in t?t[k]:async()=>({})});
};
(()=>{let real;Object.defineProperty(window,'PaperworldCloud',{configurable:true,
 get(){return real&&{...real,createClient:()=>window.__installFakeCloud()}},set(v){real=v}})})();
