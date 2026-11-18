'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('js/world-dialogue.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const cloud=fs.readFileSync('js/cloud-ui.js','utf8');
test('Messenger is one unified in-world conversation with Matt, not a technical task selector',()=>{
 for(const x of ['world-chat-veil','world-dialogue-messages','world-chat-avatar',
  'world-chat-composer','role\x27,\x27dialog','function bubble(','messages.replaceChildren(',
  "composer.append(connectGithub,memoryReview,openStudio,musicToggle,musicPanel,form)"])
  assert.ok(source.includes(x),x);
 assert.match(source,/musicToggle\.hidden=openId!=='studio-director'/);
 assert.match(source,/musicPanel\.hidden=true/);
 assert.match(source,/memoryReview\.hidden=!isMatt\|\|!active/);
 for(const control of ['modePicker','askMode','workMode','projectSelect','workerSelect',
  'projectTarget','workerTarget','historyBtn','diagnoseBtn','setWorkflowMode'])
  assert.ok(!source.includes(control),control);
 for(const caption of ['Ρώτα τον Director','Ανάθεσε σε Worker','Project Director για ερωτήσεις'])
  assert.ok(!source.includes(caption),caption);
});
test('Every Matt message starts with owner-approved, model-driven, non-sensitive Director routing',()=>{
 assert.match(source,/runMattWorkflow\(text\)/);
 assert.match(source,/window\.confirm\(/);
 assert.match(source,/delegateMatt\(text,\{targetDirector:'auto',/);
 assert.match(source,/activeMattDirector/);
 assert.match(source,/mattConversation\.slice\(-8\)/);
 assert.doesNotMatch(source,/Να ρωτήσω τον Matt\?|Εγκρίνεις 1 AI κλήση/);
 assert.doesNotMatch(source,/targetDirector:'wellbeing-director'/);
 assert.match(source,/result\.workProposal/);
 assert.match(source,/requiresSeparateConsent===true/);
 assert.match(source,/plan\.execution==='none'/);
});
test('Worker proposal requires a separate human approval with private Pokémon disclosure',()=>{
 assert.match(source,/if\(window\.confirm\(consent\)\)/);
 assert.match(source,/delegatePokemonWorker\(text,\{saveNote:false,requestId:result\.requestId\}\)/);
 assert.match(source,/delegateMattWorker\(text,\{saveNote:false,requestId:result\.requestId,onStart:id=>\{/);
 assert.match(source,/το ιδιωτικό project\.godot/);
 assert.match(source,/GDScript αρχεία/);
 assert.match(source,/έως 5 AI κλήσεις/);
 assert.match(source,/χωρίς πρόσθετη χρέωση/);
 assert.match(source,/Δεν ξεκίνησα τον Worker/);
 assert.doesNotMatch(source,/dispatchWorker|workerDispatch|sendMattMessage/);
});
test('Directors, existing keyboard shortcuts, private notes and OAuth reconnect are preserved',()=>{
 assert.match(source,/sendPrivateAgentMessage\(id,text\)/);
 assert.match(source,/privateAgentMessages\(selected\)/);
 assert.match(source,/nearestAgent\(100\)/);
 assert.match(source,/e\.key\.toLowerCase\(\)==='m'/);
 assert.match(source,/e\.key\.toLowerCase\(\)==='t'/);
 assert.match(source,/closest\?\.\('input,textarea,select/);
 assert.match(source,/githubLinkStatus\(\)/);
 assert.match(source,/beginGithubLink\(\)/);
 assert.match(source,/if\(!openId\|\|!cloud\(\)\?\.signedIn\(\)/);
 assert.match(source,/field\.disabled=!available/);
 const app=html.indexOf('js/app.js?');
 const overlay=html.indexOf('js/world-dialogue.js?');
 assert.ok(app>=0&&overlay>app);
 assert.match(cloud,/delegatePokemonWorker:\(text,opts\)/);
 assert.match(cloud,/delegateMatt:\(text,opts\)/);
});
test('Dark responsive Messenger remains styled',()=>{
 const css=fs.readFileSync('style.css','utf8');
 assert.match(css,/background:#101216/);
 assert.match(css,/world-chat-composer/);
 assert.match(css,/world-chat-message/);
 assert.match(css,/@media\(max-width:640px\)/);
});

test('Persistent Matt history restores active project after reopening the chat',()=>{
 const {encode,recover}=require('../js/matt-history.js');
 const records=[
  {role:'human',content:'Θέλω νέο τραγούδι'},
  {role:'agent',content:encode('studio-director','Τι ατμόσφαιρα;')},
  {role:'human',content:'Θέλω χαλαρό'},
  {role:'agent',content:encode('studio-director','Χαμηλό τέμπο')}
 ];
 const result=recover(records);
 assert.equal(result.activeDirector,'studio-director');
 assert.equal(result.turns.length,4);
 assert.equal(result.display[1].text,'Τι ατμόσφαιρα;');
 assert.equal(recover([{role:'human',content:'hello'}]).activeDirector,null);
});

test('Matt renders the verified response before an owner-history refresh finishes',()=>{
 assert.match(source,/mattReplies\.push\(\{id:result\.persisted===true\?result\.requestId:null/);
 assert.match(source,/if\(active&&isMatt&&\(mattCachedEntries!==null\|\|mattReplies\.length\)\)/);
 assert.match(source,/appendEntries\(mattCachedEntries\|\|\[\]\)/);
 assert.match(source,/historyCodec\(\)\.reconcileReplies\(mattReplies,history\)/);
 assert.match(source,/startMattDirectorJourney\?\.\(result\.directorId\)/);
});
test('Reply reconciliation removes saved bubbles by exact ID, keeps unsaved and unrelated replies',()=>{
 const {reconcileReplies}=require('../js/matt-history.js');
 const pending=[{id:'a',content:'saved'},{id:'b',content:'not yet saved'},
  {id:null,content:'unsaved local'}];
 const actual=[{id:'a',role:'agent'},{id:'b',role:'human'}];
 assert.deepEqual(reconcileReplies(pending,actual),pending.slice(1));
 assert.deepEqual(reconcileReplies(pending,[]),pending);
});

test('Natural language Matt handoff streams progress and holds answer for return',()=>{
 const js=fs.readFileSync('js/cloud.js','utf8');
 assert.match(js,/Accept:'application\/x-ndjson'/);
 assert.match(js,/response\.body\.getReader\(\)/);
 assert.match(js,/event\.type==='progress'/);
 assert.match(js,/event\.type==='result'/);
 assert.match(source,/onProgress:event=>/);
 assert.match(source,/waitMattDirectorReturn\?\.\(\)/);
 assert.ok(source.indexOf('await Promise.race(')<
  source.indexOf('mattReplies.push({id:result.persisted===true'));
 const css=fs.readFileSync('style.css','utf8');
 assert.match(css,/right:12px!important/);
 assert.match(css,/transform:none!important/);
});

test('Maintenance-only controls are absent from the ordinary village, but remain repairable',()=>{
 assert.match(html,/data-paperworld-maintenance="yes"/);
 assert.match(html,/#path-editor-toggle/);
 assert.match(html,/#depth-demo/);
 assert.match(source,/crowTechnical\.append/);
 assert.match(source,/memoryReview\.classList\.add\('village-maintenance-only'\)/);
 assert.doesNotMatch(source,/Chief of Staff · GitHub Copilot/);
 assert.match(source,/Πες μου τι έχεις στο μυαλό σου/);
});
