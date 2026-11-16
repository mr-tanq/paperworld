'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fromMatt}=require('../js/crow-studio-draft.js');
const requestId='11111111-1111-4111-8111-111111111111';
const request='I want an intimate dark acoustic song with nylon guitar';
const report='Keep the verse soft and organic. Add muted trumpet and natural drums.';
test('Matt delegates to Crow and produces a local editable music draft',()=>{
 const r=fromMatt({delegated:true,directorId:'studio-director',
  requestId,request,directorReport:report});
 assert.equal(r.title,'New Lost Wanderer Song');
 assert.equal(r.style,report);
 assert.equal(r.originalRequest,request);
 assert.equal(r.lyrics,''); // Never fabricate lyrics from an analysis.
 assert.equal(r.source,'matt_to_crow');
 assert.ok(Object.isFrozen(r));
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
test('Long reports are bounded to Suno-compatible style length',()=>{
 const r=fromMatt({delegated:true,directorId:'studio-director',
  requestId,request,directorReport:'Guitar and warm analog tape. '.repeat(50)});
 assert.ok(r.style.length<=1000);
});
test('Messenger offers one-click Crow studio and no disabled preview dependency',()=>{
 const src=fs.readFileSync('js/world-dialogue.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert.match(src,/latestStudioHandoff=result\.delegated===true/);
 assert.match(src,/directorReport:result\.directorReport/);
 assert.match(src,/PaperworldCrowStudioDraft\?\.fromMatt/);
 assert.match(src,/♫ Συνέχεια στο Music Studio/);
 assert.match(src,/openStudio\.hidden=!isMatt/);
 assert.match(src,/musicForm\.addEventListener\('submit',e=>/);
 assert.doesNotMatch(src,/musicForm\.addEventListener\('submit',async/);
 assert.doesNotMatch(src,/previewId/);
 assert.match(html,/crow-studio-draft\.js\?v=1/);
 assert.ok(html.indexOf('crow-studio-draft.js')<html.indexOf('world-dialogue.js'));
});
