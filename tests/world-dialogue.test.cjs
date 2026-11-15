'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('js/world-dialogue.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const cloud=fs.readFileSync('js/cloud-ui.js','utf8');
test('Messenger is one unified in-world conversation with Matt, not a technical task selector',()=>{
 for(const x of ['world-chat-veil','world-dialogue-messages','world-chat-avatar',
  'world-chat-composer','role\x27,\x27dialog','function bubble(','messages.replaceChildren(',
  "composer.append(connectGithub,form)"])
  assert.ok(source.includes(x),x);
 for(const control of ['modePicker','askMode','workMode','projectSelect','workerSelect',
  'projectTarget','workerTarget','historyBtn','diagnoseBtn','setWorkflowMode'])
  assert.ok(!source.includes(control),control);
 for(const caption of ['Ρώτα τον Director','Ανάθεσε σε Worker','Project Director για ερωτήσεις'])
  assert.ok(!source.includes(caption),caption);
});
test('Every Matt message starts with owner-approved, model-driven, non-sensitive Director routing',()=>{
 assert.match(source,/runMattWorkflow\(text\)/);
 assert.match(source,/window\.confirm\(/);
 assert.match(source,/delegateMatt\(text,\{targetDirector:'auto'\}\)/);
 assert.match(source,/έως 3 GitHub Copilot|Έως 3 GitHub Copilot/);
 assert.doesNotMatch(source,/targetDirector:'wellbeing-director'/);
 assert.match(source,/result\.workProposal/);
 assert.match(source,/requiresSeparateConsent===true/);
 assert.match(source,/plan\.execution==='none'/);
});
test('Worker proposal requires a separate human approval with private Pokémon disclosure',()=>{
 assert.match(source,/if\(window\.confirm\(consent\)\)/);
 assert.match(source,/delegatePokemonWorker\(text,\{saveNote:false\}\)/);
 assert.match(source,/delegateMattWorker\(text,\{saveNote:false,onStart:id=>\{/);
 assert.match(source,/ΜΟΝΟ το ιδιωτικό project\.godot/);
 assert.match(source,/έως 5 AI κλήσεις/);
 assert.match(source,/επιπλέον χρέωση \$0/);
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
