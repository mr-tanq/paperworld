'use strict';
const fs=require('node:fs'),path=require('node:path');
const test=require('node:test'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('Crow diagnostics remain available for maintenance but do not interrupt songwriting',()=>{
 const dialog=read('js/world-dialogue.js');
 const append=dialog.match(/musicPanel\.append\(([\s\S]*?)\);/)?.[1];
 assert.ok(append,'music panel append must exist');
 assert.ok(append.includes('crowTechnical'),'technical controls have a separate home');
 assert.ok(!append.includes('sunoCheck')&&!append.includes('sunoTools'),
  'raw diagnostics should not be front-and-center');
 assert.match(dialog,/crowTechnical\.append\(make\('summary'/);
 assert.match(dialog,/sunoCheck,sunoLinkStatus,sunoTools,sunoInstructions/);
 assert.match(dialog,/musicToggle\.hidden=openId!=='studio-director'\|\|!active/);
 assert.match(dialog,/diagnoseSunoConnection/);
 const html=read('index.html');
 assert.match(html,/html:not\(\[data-paperworld-maintenance="yes"\]\) \.crow-technical-tools/);
});
test('GitHub Pages invalidates stale cached Messenger and Suno cloud API',()=>{
 const html=read('index.html');
 assert.match(html,/world-dialogue\.js\?v=github-status-errors-v12/);
 assert.match(html,/cloud\.js\?v=github-status-auth-v12/);
 assert.match(html,/cloud-ui\.js\?v=oauth-draft-owner-v10/);
 assert.match(html,/style\.css\?v=oauth-status-chips-v1/);
 assert.doesNotMatch(html,/world-dialogue\.js\?v=crow-transfer-v1/);
});

test('Create song button never exits silently or offers a duplicate submission',()=>{
 const dialog=read('js/world-dialogue.js');
 const click=dialog.split("sunoGenerate.addEventListener('click',async()=>{")[1]
  ?.split("const musicCancel=make(")[0];
 assert.ok(click,'Suno create handler must exist');
 assert.match(click,/Η λειτουργία δημιουργίας Suno δεν έχει φορτωθεί/);
 assert.match(click,/Χρειάζεται σύνδεση στο Paperworld Cloud/);
 assert.match(click,/Έχει ήδη επιχειρηθεί υποβολή/);
 assert.match(click,/Υπάρχει ήδη υποβολή σε εξέλιξη/);
 assert.match(click,/cloud\(\)\.createSunoSong\(brief,key\)/);
 assert.match(click,/sunoGenerate\.disabled=false/);
 assert.doesNotMatch(click,/lastSunoSubmission\|\|\s*!cloud\(\)\?\.signedIn\(\).*return/);
});
