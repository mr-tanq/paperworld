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
 assert.match(source,/cloud\(\)\.sendMattMessage\(field\.value\)/);
 assert.match(source,/cloud\(\)\.mattMessages\(\)/);
 assert.match(source,/δεν είναι ακόμη AI/);
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
 assert.match(source,/openId==='matt'&&active/);
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
