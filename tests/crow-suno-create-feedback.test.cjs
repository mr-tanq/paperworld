'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const script=()=>fs.readFileSync('js/world-dialogue.js','utf8');
test('Suno create feedback appears directly below Create button in scrollable mobile Studio',()=>{
 const source=script();
 assert.match(source,/const sunoCreateStatus=make\('p','crow-suno-create-status'/);
 // Create sits in the studio's sticky action bar; its outcome directly follows.
 assert.match(source,/studioActions\.append\(musicCancel,musicCopy,musicSave,sunoGenerate\)/);
 assert.match(source,/studioBody\.append\(studioSource,musicForm,sunoCreateStatus,studioTools\)/);
 assert.match(source,/sunoCreateStatus\.scrollIntoView\?\.\(\{block:'nearest'\}\)/);
 const style=fs.readFileSync('messenger.css','utf8');
 assert.match(style,/\.crow-suno-create-status\[data-state="error"\]/);
 assert.match(style,/\.crow-suno-create-status\[data-state="success"\]/);
});
test('Create button shows immediate progress, validation failures and unverified delivery separately',()=>{
 const source=script().split("sunoGenerate.addEventListener('click',async()=>{")[1]
  ?.split("const musicCancel=make(")[0];
 assert.ok(source);
 assert.match(source,/showSunoCreateStatus\('Έλεγχος του τραγουδιού/);
 assert.match(source,/sunoGenerate\.textContent='Αποστολή…'/);
 assert.match(source,/sunoGenerate\.textContent='Δημιουργία στο Suno'/);
 assert.match(source,/status==='blocked_before_submission'/);
 assert.match(source,/lastSunoSubmission=null/);
 assert.match(source,/Έλεγξε τη Suno Library/);
 assert.match(source,/window\.confirm\(/);
});
test('Suno client describes known pre-provider errors without equating them to credit use',()=>{
 const source=fs.readFileSync('js/cloud.js','utf8');
 const part=source.split('async function createSunoSong(')[1].split('async function sunoLinkStatus(')[0];
 assert.match(part,/safePreflight/);
 assert.match(part,/status:'blocked_before_submission'/);
 assert.match(part,/if\(result\.service!=='suno_mcp'/);
});
