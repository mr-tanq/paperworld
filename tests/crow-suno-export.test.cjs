'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {format}=require('../js/crow-suno-prompt.js');
test('Crow export explicitly requires user approval before any Suno credits',()=>{
 const request=format({title:'Smoky Dreams',style:'Nylon guitar, muted trumpet',
  lyrics:'Original line'});
 assert.match(request,/Smoky Dreams/);
 assert.match(request,/Nylon guitar, muted trumpet/);
 assert.match(request,/Original line/);
 assert.match(request,/FIRST show the credit cost and ASK ME/);
 assert.match(request,/Do not generate, extend, cover or use credits/);
 assert.match(request,/actual Suno library link/);
});
test('No invented vocals for instrumental music; invalid drafts fail safely',()=>{
 const result=format({title:'Moonlight',style:'Instrumental guitar'});
 assert.match(result,/Lyrics: instrumental/);
 assert.throws(()=>format({title:'',style:'Guitar'}));
 assert.throws(()=>format({title:'Song',style:''}));
 assert.throws(()=>format({title:'Song',style:'Guitar',lyrics:'x'.repeat(8001)}));
});
test('Existing Crow Messenger can export manually but cannot invoke MCP or spend',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const dialogue=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.ok(html.indexOf('js/crow-suno-prompt.js')<html.indexOf('js/world-dialogue.js'));
 assert.match(dialogue,/musicFromCrow\.addEventListener\('click'/);
 assert.match(dialogue,/musicCopy\.addEventListener\('click'/);
 assert.match(dialogue,/navigator\.clipboard\.writeText\(text\)/);
 assert.match(dialogue,/musicCopy\.addEventListener\('click'/);
 assert.doesNotMatch(dialogue,/\/suno\/crow\/execute|GENERATE_WITH_SUNO_CREDITS/);
});
