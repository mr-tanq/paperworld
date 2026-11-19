'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const dialogue=fs.readFileSync(require.resolve('../js/world-dialogue.js'),'utf8');
const css=fs.readFileSync(require.resolve('../messenger.css'),'utf8');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
test('Routine list renders compact header, card metadata, and inline action group',()=>{
 assert.match(dialogue,/make\('div','world-routine-list-heading'\)/);
 assert.match(dialogue,/make\('section','world-routine-entry'\)/);
 assert.match(dialogue,/make\('span','world-routine-state'/);
 assert.match(dialogue,/make\('p','world-routine-schedule'/);
 assert.match(dialogue,/make\('p','world-routine-next'/);
 assert.match(dialogue,/make\('div','world-routine-entry-actions'\)/);
 assert.match(dialogue,/actions\.append\(editBtn\)/);
 assert.match(dialogue,/actions\.append\(resume\)/);
 assert.match(dialogue,/actions\.append\(pause\)/);
 assert.match(dialogue,/make\('div','world-routine-list-footer'\)/);
});
test('Manual owner-confirmed actions are retained; no routine backend changed',()=>{
 assert.match(dialogue,/await cloud\(\)\.updateRoutine\(r\.id,changes\)/);
 assert.match(dialogue,/await cloud\(\)\.changeRoutine\(r\.id,true\)/);
 assert.match(dialogue,/await cloud\(\)\.changeRoutine\(r\.id,false\)/);
 assert.match(dialogue,/pause\.addEventListener\('click',async\(\)=>/);
 assert.match(dialogue,/resume\.addEventListener\('click',async\(\)=>/);
 assert.match(dialogue,/save\.addEventListener\('click',async\(\)=>/);
});
test('Compact visual rules are scoped, responsive and honor hidden state',()=>{
 assert.match(css,/\.pw-messenger \.world-routine-review\.world-routine-list/);
 assert.match(css,/\.world-routine-entry-actions\{display:flex;flex-direction:row/);
 assert.match(css,/\.world-routine-entry-actions button\[hidden\]/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.match(dialogue,/routineReview\.classList\.remove\('world-routine-list'\)/);
 assert.match(html,/messenger\.css\?v=routine-cards-v2/);
 assert.match(html,/world-dialogue\.js\?v=routine-cards-v2/);
});