'use strict';
// Optional village sounds: off by default, no files or network, chime on replies.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('sounds are off by default and never touch the network',()=>{
 const S=require('../js/village-sound.js');
 assert.equal(S.enabled(),false);
 assert.equal(S.chime(),false,'no sound unless switched on');
 const src=fs.readFileSync('js/village-sound.js','utf8');
 assert.doesNotMatch(src,/fetch\(|new Audio\(|\.mp3|\.ogg|XMLHttpRequest/);
 assert.match(src,/root\.document\.addEventListener\('pointerdown',kick\)/,'audio starts only after a gesture');
});
test('Settings switch and reply chime are wired',()=>{
 assert.match(fs.readFileSync('js/workspace.js','utf8'),/settingRow\('Ήχοι του χωριού'/);
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.equal((ui.match(/window\.PaperworldSound\?\.chime\?\.\(\);/g)||[]).length,2);
 assert.match(fs.readFileSync('index.html','utf8'),/village-sound\.js\?v=1/);
});
