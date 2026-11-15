'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/world-dialogue.js'),'utf8');
const world=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cloud=fs.readFileSync(path.join(__dirname,'../js/cloud-ui.js'),'utf8');
test('World conversation stores real notes without canned Matt replies',()=>{
 assert.match(source,/sendPrivateAgentMessage\(id,text\)/);
 assert.match(source,/privateAgentMessages\(selected\)/);
 assert.doesNotMatch(source,/sendMattMessage|mattMessages|proposedHandoff/);
 assert.doesNotMatch(source,/fetch\s*\(|dispatchWorker|workerDispatch|apiKey/);
});
test('Keyboard shortcuts respect text inputs and require proximity for T',()=>{
 assert.match(source,/closest\?\.\('input,textarea,select/);
 assert.match(source,/nearestAgent\(100\)/);
 assert.match(source,/e\.key\.toLowerCase\(\)==='m'/);
 assert.match(source,/e\.key\.toLowerCase\(\)==='t'/);
 assert.match(world,/nearestAgent/);
});
test('Only signed-in users can save messages; Directors cannot produce replies',()=>{
 assert.match(source,/field\.disabled=!available/);
 assert.match(source,/const active=cloud\(\)\?\.signedIn\(\)===true/);
 assert.match(source,/privateAgentMessages/);
 assert.match(source,/sendPrivateAgentMessage/);
 assert.match(source,/if\(!openId\|\|!cloud\(\)\?\.signedIn\(\)/);
 assert.doesNotMatch(cloud,/sendMattMessage/);
 assert.match(cloud,/privateAgentMessages/);
});
test('overlay stays inside map and is loaded after world and cloud',()=>{
 assert.match(html,/id="view"/);
 const app=html.indexOf('js/app.js?'),overlay=html.indexOf('js/world-dialogue.js?');
 assert.ok(app>=0&&overlay>app);
 assert.match(source,/world-talk-actions/);
});

test('Dark messenger keeps one unified scroll stream and accessible agent identity',()=>{
 const style=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
 assert.match(source,/world-chat-veil/);
 assert.match(source,/world-chat-avatar/);
 assert.match(source,/world-chat-identity/);
 assert.match(source,/role','dialog/);
 assert.match(source,/role','log/);
 assert.match(source,/function bubble\(/);
 assert.match(source,/messages\.replaceChildren/);
 assert.doesNotMatch(source,/localMattEntries/);
 assert.doesNotMatch(source,/world-dialogue-private/);
 assert.match(style,/background:#101216/);
 assert.match(style,/world-chat-composer/);
 assert.match(style,/world-chat-message/);
 assert.match(style,/@media\(max-width:640px\)/);
});

test('Matt offers OAuth reconnect inside Messenger, including Render Free sleep',()=>{
 assert.match(source,/connectGithub/);
 assert.match(source,/githubLinkStatus\(\)/);
 assert.match(source,/beginGithubLink\(\)/);
 assert.match(source,/runMattWorkflow\(text\)/);
 assert.match(source,/delegateMattWorker\(text,\{onStart/);
 assert.match(source,/delegateMatt\(text\)/);
 assert.match(source,/workflowMode==='work'/);
 assert.match(source,/const isWork=workflowMode==='work'/);
 assert.match(source,/modePicker/);
 assert.match(source,/aria-pressed/);
 assert.match(source,/Έως 3 AI κλήσεις/);
 assert.match(source,/Έως 5 AI κλήσεις/);
 assert.match(source,/setAgentWorkflowStage/);
 assert.match(source,/window\.confirm\(/);
 assert.match(source,/mattReplies\.push/);
});

test('Director questions default to 3-turn path, Worker investigation requires explicit mode',()=>{
 assert.match(source,/workflowMode='ask'/);
 assert.match(source,/setWorkflowMode\('ask'\)/);
 assert.match(source,/setWorkflowMode\('work'\)/);
 assert.match(source,/const result=isWork\?/);
 assert.match(source,/await cloud\(\)\.delegateMatt\(text\)/);
 assert.match(source,/await cloud\(\)\.delegateMattWorker\(text,\{onStart/);
 assert.match(source,/if\(isWork\)await poll\(\)/);
 assert.match(source,/if\(isWork\)showStage\('reported'\)/);
 assert.doesNotMatch(source,/if\(\/festival\//);
});

test('Owner selects a fixed project when asking Director and explicitly consents to sensitive wellbeing',()=>{
 assert.match(source,/projectSelect\.value='auto'/);
 for(const name of ['listening-director','studio-director','pokemon-director','wellbeing-director'])
  assert.ok(source.includes(name));
 assert.match(source,/targetDirector=isWork\?'auto':projectSelect\.value/);
 assert.match(source,/includesWellbeing=targetDirector==='wellbeing-director'/);
 assert.match(source,/SHARE_APPROVED_WELLBEING_MEMORY_FOR_THIS_TURN|ΕΙΔΙΚΗ ΣΥΝΑΙΝΕΣΗ WELLBEING/);
 assert.match(source,/wellbeingConsent:includesWellbeing/);
 assert.match(source,/targetDirector,wellbeingConsent/);
 assert.match(source,/projectTarget\.hidden=!isMatt\|\|workflowMode!=='ask'/);
 assert.match(source,/projectTarget\.hidden=mode!=='ask'/);
 const browser=fs.readFileSync(path.join(__dirname,'../js/cloud.js'),'utf8');
 assert.match(browser,/targetDirector='auto'/);
 assert.match(browser,/targetDirector==='wellbeing-director'&&wellbeingConsent!==true/);
 assert.match(browser,/SHARE_APPROVED_WELLBEING_MEMORY_FOR_THIS_TURN/);
 assert.match(browser,/delegateMattWorker\(message/);
});
