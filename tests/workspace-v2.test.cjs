'use strict';
// Workspace V2 (Team · Work · Settings): behavioural tests running the REAL
// modules in a small DOM, plus static safety guarantees.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createDocument}=require('./helpers/mini-dom.cjs');
const U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const flush=async(n=6)=>{for(let i=0;i<n;i++)await new Promise(r=>setTimeout(r,0))};

function rawData(){
 return {jobs:[],proposals:[],pokemonProposals:[],autonomyReports:[],workerRuns:[],
  tasks:[{id:'t1',room:'studio',title:'Τελικό mix',status:'doing',created:Date.now()},
   {id:'t2',room:'pokemon',title:'Νέος χάρτης',status:'todo',created:Date.now()}],
  teamJobs:[{id:U(10),requestId:U(11),project:'pokemon',directorId:'pokemon-director',
   workerId:'pokemon-developer',status:'awaiting_consent',summary:'Έλεγχος player.gd',createdAt:new Date().toISOString()}]};
}
const MISSIONS=[
 {id:U(1),projectId:'listening',status:'running',goal:'Εικόνες συναυλιών'},
 {id:U(2),projectId:'pokemon',status:'needs_you',goal:'Δυσκολία μάχης'},
 {id:U(3),projectId:'listening',status:'completed',goal:'Γρηγορότερη λίστα',
  report:{headStillCurrent:true,requiredTests:['npm test'],prUrl:'https://github.com/mr-tanq/concerts/pull/42'}},
 {id:U(4),projectId:'studio',status:'completed',goal:'Καταγεγραμμένο χωρίς απόδειξη'}];

function boot({signedIn=true,fail=false,github='connected',suno='disconnected',confirm=()=>false,extraRaw=null}={}){
 const doc=createDocument(),calls=[];
 const view=doc.createElement('div');view.id='view';doc.body.append(view);
 const controls=doc.createElement('div');controls.className='controls';view.append(controls);
 const work=doc.createElement('button');work.id='world-work-panel';controls.append(work);
 const hall=doc.createElement('button');hall.id='call-visual-meeting';doc.body.append(hall);
 hall.addEventListener('click',()=>calls.push(['townHall']));
 const raw=rawData();
 if(extraRaw)for(const [k,v] of Object.entries(extraRaw)){
  if(Array.isArray(raw[k])&&Array.isArray(v))raw[k].push(...v);
 }
 const spy=(name,ret)=>async(...a)=>{calls.push([name,...a]);return typeof ret==='function'?ret(...a):ret};
 const cloud={signedIn:()=>signedIn,identity:()=>'owner@example.test',
  loadHumanWork:async()=>{calls.push(['loadHumanWork']);if(fail)throw Error('offline');return JSON.parse(JSON.stringify(raw))},
  listAutonomousMissions:async()=>fail?Promise.reject(Error('x')):MISSIONS,
  prepareHumanSolution:spy('approve'),discardHumanSolution:spy('reject'),
  preparePokemonSolution:spy('publishPokemon'),discardPokemonSolution:spy('rejectPokemon'),
  runApprovedHandoff:spy('runWorker'),runApprovedSourceFact:spy('runSourceFact'),
  addTask:spy('addTask'),updateTask:spy('updateTask'),removeTask:spy('removeTask'),
  githubLinkStatus:async()=>{if(github==='not_configured')throw Error('oauth_not_configured (HTTP 503)');
   if(github==='down')throw Error('Failed to fetch');return {connected:github==='connected',ephemeral:true}},
  sunoLinkStatus:async()=>{if(suno==='down')throw Error('suno_oauth_unavailable (HTTP 503)');
   return {oauthAuthorized:suno==='connected',canGenerate:false,ephemeral:true}},
  beginGithubLink:spy('beginGithubLink','https://github.com/login/oauth/authorize?x'),
  beginSunoLink:spy('beginSunoLink','https://auth.suno.com/x'),
  signOut:spy('signOut'),signIn:spy('signIn'),openClassicDesk:spy('openClassicDesk')};
 let chatOpen=null;
 const dialogue={open:(id,o)=>{calls.push(['chat',id,o?.draft||'']);chatOpen=id},
  show:id=>{calls.push(['chat',id,''])},showMemory:id=>{calls.push(['memory',id])},
  close:()=>{chatOpen=null},isOpen:()=>!!chatOpen};
 const win={document:doc,console,setTimeout,clearTimeout,Promise,Date,JSON,Math,Object,Array,Set,Map,
  String,Number,Error,URL,
  requestAnimationFrame:f=>setTimeout(f,0),matchMedia:()=>({matches:false}),
  localStorage:{_s:{},getItem(k){return this._s[k]??null},setItem(k,v){this._s[k]=String(v)}},
  confirm:(...a)=>{calls.push(['confirm',...a]);return confirm(...a)},
  location:{assign:u=>calls.push(['navigate',u])},
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
  innerWidth:1280,innerHeight:800,
  Image:class{set src(_){}},PaperworldCloudUI:cloud,PaperworldWorldDialogue:dialogue,
  PaperworldWorld:{focusAgent:(id)=>{calls.push(['locate',id]);return true}}};
 win.window=win;win.globalThis=win;
 const ctx=vm.createContext(win);
 for(const f of ['js/agent-profiles.js','js/village-activity.js','js/human-first-hub.js','js/team-panel.js','js/connection-status.js','js/workspace.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
 const shell=doc.querySelector('.pw-workspace');
 const text=()=>shell.textContent;
 const button=label=>shell.querySelectorAll('button').find(b=>b.textContent.includes(label));
 return {doc,win,ws:win.PaperworldWorkspace,shell,calls,text,button,dialogue};
}

test('Work answers "what needs me?" from real data, with decisions in the audited hub',async()=>{
 const t=boot();t.ws.open('work');await flush();
 assert.equal(t.shell.hidden,false);
 assert.match(t.shell.querySelector('.pw-hero-title').textContent,/2 θέματα περιμένουν εσένα/);
 // 2 need you (hub decision + blocked mission) · 1 running · 2 recorded complete.
 assert.deepEqual(t.shell.querySelectorAll('.pw-stat strong').map(s=>s.textContent),['2','1','2']);
 // The awaiting-consent hand-off is rendered ONLY by the Human-First hub.
 assert.equal(t.shell.querySelectorAll('.pw-decisions .human-hub-item').length,1);
 assert.ok(!t.ws.items().some(i=>i.key.startsWith('handoff:')),'no duplicate of a hub decision');
 // Honest completion: only the verified mission carries a link.
 const done=t.ws.items().filter(i=>i.bucket==='done');
 assert.equal(done.find(i=>i.title==='Γρηγορότερη λίστα').link,'https://github.com/mr-tanq/concerts/pull/42');
 const unverified=done.find(i=>i.title==='Καταγεγραμμένο χωρίς απόδειξη');
 assert.equal(unverified.link,null);
 assert.match(unverified.label,/Δεν υπάρχει εδώ επαληθευμένο αποτέλεσμα/);
 // Personal notes are labelled as the owner's, never as agent work.
 assert.ok(t.ws.items().filter(i=>i.note).every(i=>i.label));
 assert.doesNotMatch(t.text(),/[0-9a-f]{8}-[0-9a-f]{4}-4000/,'no internal IDs in the normal view');
});
test('Approving from Work goes through the hub confirmation and runs nothing on cancel',async()=>{
 const t=boot({confirm:()=>false});t.ws.open('work');await flush();
 t.shell.querySelector('.pw-decisions .human-hub-yes').click();await flush(10);
 assert.ok(t.calls.some(c=>c[0]==='confirm'&&/Εγκρίνεις ΜΙΑ εκτέλεση του Worker/.test(c[1])));
 assert.ok(!t.calls.some(c=>c[0]==='runWorker'),'cancelled approval must not execute');
});
test('Unavailable data fails closed: no decisions, no guessed counts or activity',async()=>{
 const t=boot({fail:true});t.ws.open('work');await flush();
 assert.equal(t.shell.querySelectorAll('.human-hub-item').length,0);
 assert.deepEqual(t.shell.querySelectorAll('.pw-stat strong').map(s=>s.textContent),['–','–','–']);
 assert.match(t.text(),/Δεν ήταν δυνατή η ενημέρωση/);
 t.button('Ομάδα').click();await flush();
 assert.match(t.text(),/Η δραστηριότητα δεν είναι διαθέσιμη/);
});
test('Team shows every Director with grounded activity and routes Workers to their Director',async()=>{
 const t=boot();t.ws.open('team');await flush();
 const names=t.shell.querySelectorAll('.pw-agent-name').map(n=>n.textContent);
 assert.deepEqual(names,['Matt','Luna','Joey','Crow','Dave']);
 const joey=t.shell.querySelector('.pw-agent-card[data-agent="pokemon-director"]');
 assert.match(joey.querySelector('.pw-agent-activity').textContent,/2 χρειάζονται εσένα/);
 const crow=t.shell.querySelector('.pw-agent-card[data-agent="studio-director"]');
 assert.match(crow.querySelector('.pw-agent-activity').textContent,/Καμία ενεργή εργασία · 1 ολοκληρώθηκαν/);
 assert.doesNotMatch(t.text(),/online|σε σύνδεση|διαθέσιμος τώρα/i);
 // Worker → responsible Director, then back to Team when the chat closes.
 t.shell.querySelectorAll('.pw-worker .pw-chip')[1].click();
 assert.deepEqual(t.calls.filter(c=>c[0]==='chat').at(-1),['chat','pokemon-director','']);
 assert.equal(t.shell.hidden,true);
 t.doc.dispatchEvent(new t.win.CustomEvent('paperworld:chat-closed',{detail:{id:'pokemon-director'}}));
 await flush();
 assert.equal(t.shell.hidden,false);assert.equal(t.ws.view(),'team');
 assert.match(t.shell.querySelectorAll('.pw-worker')[1].textContent,/περιμένει την έγκρισή σου/);
});
test('Team actions: chat, project, village location and Town Hall all work',async()=>{
 const t=boot();t.ws.open('team');await flush();
 const crow=t.shell.querySelector('.pw-agent-card[data-agent="studio-director"]');
 crow.querySelector('.pw-agent-locate').click();
 assert.deepEqual(t.calls.find(c=>c[0]==='locate'),['locate','studio-director']);
 crow.querySelectorAll('button').find(b=>b.textContent==='Εργασίες').click();await flush();
 assert.equal(t.ws.view(),'work');
 assert.equal(t.shell.querySelector('#pw-ws-title').textContent,'The Lost Wanderer');
 t.ws.open('team');await flush();
 t.button('Town Hall').click();
 assert.ok(t.calls.some(c=>c[0]==='townHall'));assert.equal(t.shell.hidden,true);
});
test('Project view: notes are created, advanced and deleted only with confirmation',async()=>{
 const t=boot({confirm:()=>false});t.ws.open('work',{project:'studio'});await flush();
 const input=t.shell.querySelector('.pw-note-form input');input.value='Ιδέα για ρεφρέν';
 t.shell.querySelector('.pw-note-form').dispatch('submit');await flush();
 assert.deepEqual(t.calls.find(c=>c[0]==='addTask'),['addTask','studio','Ιδέα για ρεφρέν','']);
 t.shell.querySelector('.pw-note-status').click();await flush();
 assert.equal(JSON.stringify(t.calls.find(c=>c[0]==='updateTask')),JSON.stringify(['updateTask','t1',{status:'done'}]));
 t.shell.querySelector('.pw-note-remove').click();await flush();
 assert.ok(!t.calls.some(c=>c[0]==='removeTask'),'delete needs confirmation');
 // Back returns to the overview, not out of the app.
 t.shell.querySelector('.pw-ws-back').click();await flush();
 assert.equal(t.shell.querySelector('#pw-ws-title').textContent,'Οι εργασίες μου');
});
test('"Ask the team" pre-fills Matt and never sends or calls AI by itself',async()=>{
 const t=boot();t.ws.open('work');await flush();
 const form=t.shell.querySelector('.pw-ask');form.querySelector('textarea').value='Νέο τραγούδι';
 form.dispatch('submit');
 assert.deepEqual(t.calls.filter(c=>c[0]==='chat').at(-1),['chat','matt','Νέο τραγούδι']);
 assert.ok(!t.calls.some(c=>/askDirector|delegate|approve|runWorker/.test(c[0])));
});
test('Settings centralises account, connections, memory and advanced tools',async()=>{
 const t=boot({github:'disconnected',suno:'disconnected',confirm:()=>false});
 t.ws.open('settings');await flush();
 assert.match(t.text(),/owner@example\.test/);
 assert.match(t.text(),/GitHub · Δεν έχει συνδεθεί/);
 const rows=t.shell.querySelectorAll('.pw-setting');
 rows.find(r=>/GitHub/.test(r.textContent)).querySelector('button').click();await flush();
 assert.ok(t.calls.some(c=>c[0]==='navigate'&&c[1].startsWith('https://github.com/')));
 rows.find(r=>/Suno/.test(r.textContent)).querySelector('button').click();await flush();
 assert.ok(!t.calls.some(c=>c[0]==='beginSunoLink'),'Suno link needs explicit confirmation');
 rows.find(r=>/Τι γνωρίζει ο Crow/.test(r.textContent)).querySelector('button').click();
 assert.deepEqual(t.calls.find(c=>c[0]==='memory'),['memory','studio-director']);
 t.ws.open('settings');await flush();
 t.shell.querySelector('.pw-switch').click();
 assert.equal(t.doc.documentElement.classList.contains('pw-reduce-motion'),true);
 assert.match(t.text(),/Για προχωρημένους/);
 assert.doesNotMatch(t.text(),/token|secret|Bearer/i);
});
test('Signed out: sign-in instead of data; nothing is loaded',async()=>{
 const t=boot({signedIn:false});t.ws.open('work');await flush();
 assert.match(t.text(),/Συνδέσου στο PAPERWORLD Cloud/);
 assert.ok(!t.calls.some(c=>c[0]==='loadHumanWork'));
});
test('Keyboard: arrow keys move between tabs, Escape goes back then closes',async()=>{
 const t=boot();t.ws.open('work',{project:'pokemon'});await flush();
 t.shell.querySelector('.pw-ws-tabs').dispatch('keydown',{key:'ArrowLeft'});await flush();
 assert.equal(t.ws.view(),'team');
 t.ws.open('work',{project:'pokemon'});await flush();
 const esc=()=>t.doc.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){}});
 esc();await flush();assert.equal(t.shell.hidden,false);assert.equal(t.shell.querySelector('#pw-ws-title').textContent,'Οι εργασίες μου');
 esc();await flush();assert.equal(t.shell.hidden,true);
 assert.equal(t.shell.querySelector('#pw-ws-tab-work').getAttribute('aria-selected'),'true');
});
test('Static guarantees: no innerHTML, no fabricated presence, shared design tokens',()=>{
 const ws=fs.readFileSync('js/workspace.js','utf8'),team=fs.readFileSync('js/team-panel.js','utf8');
 const css=fs.readFileSync('workspace.css','utf8'),tokens=fs.readFileSync('messenger.css','utf8');
 const html=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('js/app.js','utf8');
 for(const src of [ws,team])assert.doesNotMatch(src,/\.innerHTML\s*=|insertAdjacentHTML/);
 assert.doesNotMatch(team,/["']Online["']|status-dot|green-dot/i);
 assert.match(tokens,/:root\{\n --pw-bg:#101216/);
 assert.match(tokens,/:is\(\.pw-messenger,\.pw-workspace\) \.pw-btn-primary/);
 assert.doesNotMatch(css,/--pw-bg:/,'Workspace reuses tokens, it does not redefine them');
 assert.match(css,/@media \(min-width:900px\) and \(max-width:1099px\)\{#view \.pw-workspace\{width:min\(620px,52vw\)\}\}/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(app,/focusAgent:\(id,\{panelWidth=0\}=\{\}\)=>/);
 assert.match(app,/if\(window\.PaperworldWorkspace\?\.open\)\{window\.PaperworldWorkspace\.open\('work'\);return\}/);
 assert.ok(html.indexOf('js/workspace.js')>html.indexOf('js/world-dialogue.js'));
 assert.ok(html.indexOf('js/workspace.js')>html.indexOf('js/human-first-hub.js'));
 assert.match(html,/workspace\.css\?v=responsive-1/);
});

test('Finished investigations and unstarted notes do not inflate active work',async()=>{
 const long='Έλεγχος ήδη ολοκληρωμένος: '+('προηγούμενες πληροφορίες '.repeat(8));
 const t=boot({extraRaw:{
  jobs:[{id:U(40),project:'Listening Mirror',summary:long,
   createdAt:new Date().toISOString(),
   events:[{state:'reported',actor:'studio-director',createdAt:new Date().toISOString()}]}],
  workerRuns:[{id:U(41),requestId:U(42),project:'listening',
   directorId:'listening-director',workerId:'listening-developer',
   status:'reported',summary:'Διερεύνηση τελείωσε',
   createdAt:new Date().toISOString()}]
 }});
 t.ws.open('work');await flush();
 const all=t.ws.items();
 const old=all.filter(i=>i.bucket==='reviewed');
 assert.equal(old.length,2);
 assert.ok(old.every(i=>i.bucket!=='active'));
 assert.deepEqual(t.shell.querySelectorAll('.pw-stat strong').map(x=>x.textContent),['2','1','2']);
 assert.match(t.text(),/Έτοιμα για ματιά/);
 const cards=t.shell.querySelectorAll('.pw-item-details');
 assert.ok(cards.length>0,'long archived descriptions should start folded');
 assert.ok(!cards[0].open);
 assert.equal(cards[0].querySelector('.pw-item-full').textContent,long.trim());
 assert.ok(all.some(i=>i.bucket==='waiting'&&i.note===true));
});
test('Workspace opens camera framing and restores it on close without modifying data',async()=>{
 const t=boot();t.win.PaperworldWorld.frameForWorkspace=payload=>{t.calls.push(['frame',payload])};
 t.ws.open('work');await flush();
 assert.ok(t.calls.some(x=>x[0]==='frame'&&x[1].open===true));
 t.ws.close();
 assert.ok(t.calls.some(x=>x[0]==='frame'&&x[1].open===false));
 const app=fs.readFileSync('js/app.js','utf8');
 // Docked panel on a 1280×800 tablet: pan beside it, never zoom.
 const frame=t.calls.find(x=>x[0]==='frame'&&x[1].open===true)[1];
 assert.ok(frame.panelWidth>0);assert.equal(frame.panelHeight,0);
 assert.match(app,/frameForWorkspace:\(\{open=false,panelWidth=0,panelHeight=0\}/);
 assert.match(app,/framing\.frameAround\(/);
});

test('Settings names unavailable and unconfigured services and offers a retry',async()=>{
 const t=boot({github:'not_configured',suno:'down'});t.ws.open('settings');await flush(10);
 assert.match(t.text(),/GitHub · Δεν έχει ρυθμιστεί/);
 assert.match(t.text(),/Suno · Μη διαθέσιμο τώρα/);
 assert.doesNotMatch(t.text(),/Έλεγχος…|Συνδεδεμένο/);
 const row=t.shell.querySelectorAll('.pw-setting').find(r=>/Suno/.test(r.textContent));
 assert.equal(row.querySelector('.pw-dot').dataset.state,'unavailable');
 assert.ok(row.querySelectorAll('button').some(b=>b.textContent==='Δοκίμασε ξανά'));
});
test('A temporary GitHub link is labelled as temporary, never as permanent',async()=>{
 const t=boot({github:'connected'});t.ws.open('settings');await flush(10);
 assert.match(t.text(),/GitHub · Συνδεδεμένο/);
 assert.match(t.text(),/προσωρινή και χάνεται αν γίνει επανεκκίνηση/);
});
test('Portrait-tablet bottom sheet frames the village above it; Messenger is framed too',async()=>{
 const t=boot();t.win.innerWidth=800;t.win.innerHeight=1280;
 t.shell.getBoundingClientRect=()=>({x:0,y:563,top:563,width:800,height:717});
 t.win.PaperworldWorld.frameForWorkspace=payload=>{t.calls.push(['frame',payload])};
 t.ws.open('work');await flush();
 const sheet=t.calls.find(c=>c[0]==='frame'&&c[1].open)[1];
 assert.equal(sheet.panelWidth,0);assert.ok(sheet.panelHeight>=700);
 // Messenger opening (event) frames beside/above the chat panel as well.
 const chat=t.doc.createElement('section');chat.className='pw-messenger';t.doc.body.append(chat);
 chat.getBoundingClientRect=()=>({top:64,width:420,height:700});
 t.calls.length=0;
 t.doc.dispatchEvent(new t.win.CustomEvent('paperworld:chat-opened',{detail:{id:'matt'}}));await flush();
 assert.ok(t.calls.some(c=>c[0]==='frame'&&c[1].open&&c[1].panelWidth>0));
 t.doc.dispatchEvent(new t.win.CustomEvent('paperworld:chat-closed',{detail:{id:'matt'}}));await flush();
 assert.ok(t.calls.some(c=>c[0]==='frame'&&c[1].open===false));
});
test('Everyday wording avoids internal jargon; technical detail stays collapsed',async()=>{
 const t=boot();t.ws.open('work');await flush();
 const card=t.shell.querySelector('.pw-decisions .human-hub-item');
 const visible=card.querySelectorAll('button').map(b=>b.textContent).join(' | ')+' '+
  card.querySelector('.human-hub-summary').textContent+' '+card.querySelector('.human-hub-status').textContent;
 assert.doesNotMatch(visible,/Worker|Director|AI|διερεύνηση από/);
 assert.match(visible,/Έγκριση ελέγχου/);assert.match(visible,/Περιμένει την έγκρισή σου/);
 const hub=fs.readFileSync('js/human-first-hub.js','utf8');
 assert.match(hub,/STEP\[event\.state\]\|\|'Ενημέρωση'/);
 assert.doesNotMatch(hub,/human\(event\.state,35\)/,'raw step IDs are not shown');
 t.button('Ομάδα').click();await flush();
 assert.doesNotMatch(t.shell.querySelector('.pw-workers .pw-section-title').textContent,/Workers/);
});
