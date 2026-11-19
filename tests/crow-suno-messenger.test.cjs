'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(base,file),'utf8');
test('Crow Messenger offers a functional local draft without Suno generation',()=>{
 const dialog=read('js/world-dialogue.js');
 const cloud=read('js/cloud-ui.js');
 const client=read('js/cloud.js');
 assert.match(dialog,/musicToggle\.hidden=openId!=='studio-director'/);
 assert.ok(dialog.includes("musicForm.addEventListener('submit',e=>"));
 assert.ok(dialog.includes("musicCancel.addEventListener('click'"));
 assert.match(dialog,/function resetMusic\(\)/);
 assert.ok(dialog.includes("musicForm.addEventListener('submit',e=>"));
 assert.doesNotMatch(dialog,/GENERATE_WITH_SUNO_CREDITS|\/suno\/crow\/execute/);
 assert.match(cloud,/crowSunoPreview:\(brief\)=>client\.crowSunoPreview\(brief\)/);
 assert.match(client,/\/suno\/crow\/propose/);
 assert.match(client,/\/suno\/crow\/cancel/);
 assert.doesNotMatch(client,/\/suno\/crow\/execute/);
});
test('Suno preview panel is bounded and hides when not in Crow chat',()=>{
 // The studio is its own workspace: hidden attribute always wins and it
 // scrolls internally instead of squeezing the composer.
 const css=read('messenger.css');
 assert.match(css,/#view \.pw-messenger \[hidden\]\{display:none!important\}/);
 assert.match(css,/\.pw-studio-body\{flex:1;min-height:0;overflow-y:auto/);
});
