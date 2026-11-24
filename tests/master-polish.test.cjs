'use strict';
// Master polish: tall screens use the free space for a live village board;
// the chat keeps its space (decisions collapse to one line); Greek plurals.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const F=require('../js/camera-framing.js');
const W=1671,H=941;
const defs=[{x:594,bottom:381,width:356},{x:1107,bottom:399,width:358},{x:338,bottom:586,width:370},
 {x:1361,bottom:577,width:366},{x:835,bottom:757,width:438}];
const content=F.contentBox(defs,W,H);
test('tall screens lift the village under the header and leave room for the board',()=>{
 for(const [w,h] of [[390,844],[412,915],[800,1280]]){
  const f=F.frame({width:w,height:h,W,H,content});
  assert.ok(f.boardTop>=200&&f.boardTop<h-170,w+'x'+h+' board at '+f.boardTop);
  const cam=F.place({width:w,height:h},f.scale,f.cx,f.cy);
  for(const d of defs){const top=cam.y+(d.bottom-d.width)*f.scale,bottom=cam.y+d.bottom*f.scale;
   assert.ok(top>=50&&bottom<=f.boardTop+2,w+'x'+h+' building fully above the board')}
 }
 assert.equal(F.frame({width:1280,height:800,W,H,content}).boardTop,undefined,'landscape unchanged');
});
test('village board: real statuses only, tap to talk, hidden without room',()=>{
 const b=fs.readFileSync('js/village-board.js','utf8');
 assert.match(b,/paperworld:residents/);assert.match(b,/PaperworldWorldDialogue\?\.show\?\.\(id\)/);
 assert.match(b,/show=Number\.isFinite\(top\)&&h-top>=170/);
 assert.doesNotMatch(b,/fetch\(|delegate|askMatt|localStorage/);
 const feed=fs.readFileSync('js/resident-feed.js','utf8');
 assert.match(feed,/new CustomEvent\('paperworld:residents',\{detail:week\?\{\.\.\.map,matt:\{text:week\}\}:map\}\)/);
 assert.match(fs.readFileSync('js/app.js','utf8'),/boardTop:\(\)=>/);
});
test('Matt chat keeps its space: decisions collapse to one line there only',()=>{
 const hub=fs.readFileSync('js/human-first-hub.js','utf8');
 assert.match(hub,/if\(compact&&collapsible&&!expanded&&!error\)/);
 assert.match(hub,/'1 απόφαση περιμένει εσένα'/);
 assert.match(fs.readFileSync('js/world-dialogue.js','utf8'),/compact:true,load:\(\)=>cloud\(\)\.loadHumanWork\(\),collapsible:true,/);
 assert.doesNotMatch(fs.readFileSync('js/workspace.js','utf8'),/collapsible:true/,'Work keeps full cards');
 assert.match(fs.readFileSync('js/world-dialogue.js','utf8'),/needs===1\?'Ένα θέμα περιμένει εσένα\.'/);
});
test('empty chats offer starters that only fill the composer (never send)',()=>{
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/function starters\(id\)/);assert.match(ui,/messages\.append\(starters\(openId\)\)/);
 const fn=ui.slice(ui.indexOf('function starters(id)'),ui.indexOf('function starters(id)')+700);
 assert.match(fn,/field\.value=text;autoGrow\(\);field\.focus\(\)/);
 assert.doesNotMatch(fn,/requestSubmit|runMattWorkflow|submitDirector|delegateMatt/);
});
