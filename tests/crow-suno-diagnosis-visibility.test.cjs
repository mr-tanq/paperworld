'use strict';
const fs=require('node:fs'),path=require('node:path');
const test=require('node:test'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('Crow Suno diagnostic is first visible action in mobile composer',()=>{
 const dialog=read('js/world-dialogue.js');
 const append=dialog.match(/musicPanel\.append\(([\s\S]*?)\);/)?.[1];
 assert.ok(append,'music panel append must exist');
 assert.ok(append.indexOf('sunoCheck')>=0,'diagnostic should be in music panel');
 assert.ok(append.indexOf('sunoCheck')<append.indexOf('musicForm'),
  'diagnostic must be visible without scrolling past the whole song form');
 assert.ok(append.indexOf('sunoCheck')<append.indexOf('sunoConnect'));
 assert.match(dialog,/musicToggle\.hidden=openId!=='studio-director'\|\|!active/);
 assert.match(dialog,/diagnoseSunoConnection/);
});
test('GitHub Pages invalidates stale cached Messenger and Suno cloud API',()=>{
 const html=read('index.html');
 assert.match(html,/world-dialogue\.js\?v=matt-crow-studio-v2/);
 assert.match(html,/cloud\.js\?v=suno-diagnosis-v2/);
 assert.match(html,/cloud-ui\.js\?v=suno-diagnosis-v2/);
 assert.match(html,/style\.css\?v=suno-diagnosis-visible-v2/);
 assert.doesNotMatch(html,/world-dialogue\.js\?v=crow-transfer-v1/);
});
