'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/world-dialogue.js'),'utf8');
const world=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cloud=fs.readFileSync(path.join(__dirname,'../js/cloud-ui.js'),'utf8');
test('World conversation uses real Matt session, never a fake AI provider',()=>{
 assert.match(source,/cloud\(\)\.sendMattMessage\(text\)/);
 assert.match(source,/mattMessages\?\.\(\)/);
 assert.match(source,/χωρίς πραγματικό AI/);
 assert.doesNotMatch(source,/fetch\s*\(|dispatchWorker|workerDispatch|copilot|apiKey/);
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
 assert.match(source,/isMatt&&active/);
 assert.match(source,/privateAgentMessages/);
 assert.match(source,/sendPrivateAgentMessage/);
 assert.match(source,/if\(!openId\|\|!cloud\(\)\?\.signedIn\(\)/);
 assert.match(cloud,/sendMattMessage/);
 assert.match(cloud,/privateAgentMessages/);
});
test('overlay stays inside map and is loaded after world and cloud',()=>{
 assert.match(html,/id="view"/);
 const app=html.indexOf('js/app.js?'),overlay=html.indexOf('js/world-dialogue.js?');
 assert.ok(app>=0&&overlay>app);
 assert.match(source,/world-talk-actions/);
});

test('Visible human-confirmed Matt handoff routes to an actual existing mission',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/world-dialogue.js'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'../js/cloud-ui.js'),'utf8');
 assert.match(source,/openMattHandoff\(proposedHandoff\)/);
 assert.match(source,/proposedHandoff=response\?\.proposal\|\|null/);
 assert.match(ui,/handoff\.state!=='proposed'/);
 assert.match(ui,/open\('workshop'\)/);
 assert.match(ui,/existingTicketSwap\(missions\)/);
 assert.doesNotMatch(ui.slice(ui.indexOf('function openMattHandoff'),ui.indexOf("function open(id='town')")),/runApprovedAiMission\(|createMission\(|prepareWorkerMission\(/);
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
 assert.match(source,/if\(isMatt&&localMatt&&localMattEntries\(\)\.length\)return/);
 assert.doesNotMatch(source,/world-dialogue-private/);
 assert.match(style,/background:#101216/);
 assert.match(style,/world-chat-composer/);
 assert.match(style,/world-chat-message/);
 assert.match(style,/@media\(max-width:640px\)/);
});
