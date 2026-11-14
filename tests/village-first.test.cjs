'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('Village is fullscreen; old admin sidebar is an opt-in drawer, not permanent',()=>{
 const html=read('index.html'),css=read('style.css');
 assert.match(html,/id="world-drawer" hidden/);
 assert.match(html,/id="world-work-panel"/);
 assert.match(html,/id="close-world-drawer"/);
 assert.match(css,/\.layout>aside#world-drawer\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.layout\{position:fixed;inset:0;display:block/);
 assert.match(css,/#world-drawer \.room-tabs/);
 assert.match(css,/display:none!important/);
});
test('Tapping a building talks to its agent, not an automatic task tab',()=>{
 const app=read('js/app.js');
 const start=app.indexOf('function inspect(d){'),end=app.indexOf('function tap(p){',start);
 assert.ok(start>0&&end>start);
 const block=app.slice(start,end);
 assert.match(block,/PaperworldWorldDialogue\?\.show/);
 assert.match(block,/listening-director/);
 assert.match(block,/studio-director/);
 assert.doesNotMatch(block,/PaperworldRooms\?\.open/);
});
test('Work desk and sign-in remain reachable; Matt accessible directly',()=>{
 const app=read('js/app.js');
 assert.match(app,/function openWorkDesk\(\)/);
 assert.match(app,/PaperworldCloudUI\?\.openChief\(\)/);
 assert.match(app,/PaperworldWorldDialogue\?\.show\('matt'\)/);
 assert.match(app,/drawer\.hidden=true/);
 assert.match(read('js/world-dialogue.js'),/privateAgentMessages/);
});
test('Game redesign does not hardcode TicketSwap or claim AI enabled',()=>{
 const html=read('index.html'),app=read('js/app.js');
 assert.doesNotMatch(html+app,/ticketswap|ticket swap/i);
 assert.match(read('server/render-matt.cjs'),/aiEnabled:false/);
});
