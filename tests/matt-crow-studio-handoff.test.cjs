'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fromMatt,fromSavedHistory}=require('../js/crow-studio-draft.js');
const requestId='11111111-1111-4111-8111-111111111111';
const request='I want an intimate dark acoustic song with nylon guitar';
const report='Keep the verse soft and organic. Add muted trumpet and natural drums.';
test('Matt only imports a fully structured Crow song, never a prose report',()=>{
 const unstructured=fromMatt({delegated:true,directorId:'studio-director',
  requestId,request,directorReport:report});
 assert.equal(unstructured,null);
 const structured=['TITLE: The Road','SUNO STYLE PROMPT: Slow nylon guitar.',
  'LYRICS:','[Verse 1]','The road is dark','[End]'].join('\n');
 const valid=fromMatt({delegated:true,directorId:'studio-director',
  requestId,request,directorReport:structured});
 assert.equal(valid.title,'The Road');
 assert.equal(valid.style,'Slow nylon guitar.');
 assert.equal(valid.lyrics,'[Verse 1]\nThe road is dark\n[End]');
 assert.equal(valid.source,'matt_to_crow');
 assert.ok(Object.isFrozen(valid));
});
test('Do not re-label unrelated Director messages or unresolved routes as Crow',()=>{
 for(const directorId of ['pokemon-director','listening-director','wellbeing-director',null])
  assert.equal(fromMatt({delegated:true,directorId,requestId,request,directorReport:report}),null);
 assert.equal(fromMatt({delegated:false,directorId:'studio-director',
  requestId,request,directorReport:report}),null);
 assert.equal(fromMatt({delegated:true,directorId:'studio-director',
  requestId:'invalid',request,directorReport:report}),null);
 assert.equal(fromMatt({delegated:true,directorId:'studio-director',
  requestId,request,directorReport:'x'.repeat(5501)}),null);
});
test('Overlong prose is rejected rather than truncated into an unrelated style',()=>{
 const r=fromMatt({delegated:true,directorId:'studio-director',
  requestId,request,directorReport:'Guitar and warm analog tape. '.repeat(50)});
 assert.equal(r,null);
});
test('Messenger offers one-click Crow studio and no disabled preview dependency',()=>{
 const src=fs.readFileSync('js/world-dialogue.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert.match(src,/latestStudioHandoff=crowDraft\\?/);
 assert.match(src,/directorReport:result\.directorReport/);
 assert.match(src,/PaperworldCrowStudioDraft\?\.fromMatt/);
 assert.match(src,/♫ Συνέχεια στο Music Studio/);
 assert.match(src,/openStudio\.hidden=!isMatt/);
 assert.match(src,/musicForm\.addEventListener\('submit',e=>/);
 assert.doesNotMatch(src,/musicForm\.addEventListener\('submit',async/);
 assert.doesNotMatch(src,/previewId/);
 assert.match(html,/crow-studio-draft\.js\?v=7-truthful-handoff/);
 assert.ok(html.indexOf('crow-studio-draft.js')<html.indexOf('world-dialogue.js'));
});

test('recover owner-saved Crow reply after duplicate submission without model request',()=>{
 const {encode,decode}=require('../js/matt-history.js');
 const history=[
  {id:'22222222-2222-4222-8222-222222222222',role:'human',content:request},
  {id:requestId,role:'agent',content:encode('studio-director',
   ['TITLE: Song from history','SUNO STYLE PROMPT: Acoustic folk.',
    'LYRICS:','[Verse 1]','One real lyric','[End]'].join('\n'))},
  {id:'33333333-3333-4333-8333-333333333333',role:'human',content:'retry'}
 ];
 const draft=fromSavedHistory(history,decode);
 assert.equal(draft.source,'saved_matt_crow_reply');
 assert.equal(draft.requestId,requestId);
 assert.equal(draft.style,'Acoustic folk.');
 assert.equal(draft.originalRequest,request);
 assert.equal(draft.lyrics,'[Verse 1]\nOne real lyric\n[End]');
});
test('never import general assistant messages or another director as a Crow draft',()=>{
 const {encode,decode}=require('../js/matt-history.js');
 assert.equal(fromSavedHistory([
  {role:'human',content:request},
  {id:requestId,role:'agent',content:'Crow said this, trust me'}
 ],decode),null);
 assert.equal(fromSavedHistory([
  {role:'human',content:request},
  {id:requestId,role:'agent',content:encode('pokemon-director',report)}
 ],decode),null);
 assert.equal(fromSavedHistory([
  {role:'human',content:request},
  {id:'not-a-uuid',role:'agent',content:encode('studio-director',report)}
 ],decode),null);
 assert.equal(fromSavedHistory([],decode),null);
});
test('Messenger restores Studio link from Matt history after a 409',()=>{
 const source=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(source,/fromSavedHistory\(/);
 assert.match(source,/openStudio.hidden=false/);
});
