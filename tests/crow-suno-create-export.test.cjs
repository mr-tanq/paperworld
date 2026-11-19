'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

test('Crow song creation is exported through every browser API layer',()=>{
 const cloud=read('js/cloud.js'),ui=read('js/cloud-ui.js'),dialog=read('js/world-dialogue.js');
 assert.match(cloud,/async function createSunoSong\(brief,idempotencyKey,voiceId=null\)/);
 assert.match(cloud,/createSunoSong,listSunoVoices\};/);
 assert.match(ui,/createSunoSong:\(brief,idempotencyKey,voiceId\)=>client\.createSunoSong\(brief,idempotencyKey,voiceId\)/);
 assert.match(dialog,/typeof cloud\(\)\?\.createSunoSong!=='function'/);
 assert.match(dialog,/cloud\(\)\.createSunoSong\(brief,key,selectedVoiceId\)/);
});
test('Suno create stays behind real user consent, and Cloud UI script cache is bumped',()=>{
 const dialog=read('js/world-dialogue.js'),html=read('index.html');
 const click=dialog.split("sunoGenerate.addEventListener('click',async()=>{")[1]
  ?.split('const musicCancel=make(')[0];
 assert.ok(click);
 assert.match(click,/window\.confirm\('Να στείλω το τραγούδι στο Suno με φωνή/);
 assert.ok(click.indexOf('window.confirm(')<click.indexOf('cloud().createSunoSong('));
 assert.match(html,/cloud-ui\.js\?v=messenger-v2-1/);
});
