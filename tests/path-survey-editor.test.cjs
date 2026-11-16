'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const PathEditor=require('../js/path-editor.js');
const app=fs.readFileSync('js/app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const memory=new Map();
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const make=()=>PathEditor.create({
 nodes:[[20,20],[120,20],[120,90]],
 connections:[[0,1],[1,2]],hiddenConnections:[[1,2]],
 width:200,height:120,storage
});
test('path editor draws linked nodes without modifying its input network',()=>{
 const original=[[20,20],[120,20],[120,90]];
 const editor=PathEditor.create({nodes:original,connections:[[0,1]],width:200,height:120});
 editor.pointerDown([120,20]);editor.pointerUp([120,20]);
 editor.pointerDown([180,80]);editor.pointerUp([180,80]);
 assert.deepEqual(original,[[20,20],[120,20],[120,90]]);
 assert.equal(editor.snapshot().nodes.length,4);
 assert.ok(editor.snapshot().connections.some(([a,b])=>a===1&&b===3));
 assert.equal(JSON.parse(editor.exportJSON()).format,'paperworld-path-survey-v1');
});
test('move nodes, undo, delete edge, toggle hidden and persist browser draft',()=>{
 const e=make();
 e.setMode('move');e.pointerDown([120,20]);e.pointerMove([130,28]);e.pointerUp([130,28]);
 assert.deepEqual(e.snapshot().nodes[1],[130,28]);
 e.undo();assert.deepEqual(e.snapshot().nodes[1],[120,20]);
 e.setMode('hidden');e.pointerDown([70,20]);assert.equal(e.snapshot().hidden.length,2);
 e.setMode('erase');e.pointerDown([70,20]);assert.equal(e.snapshot().connections.length,1);
 assert.equal(e.snapshot().hidden.length,1);
 assert.equal(make().snapshot().connections.length,1);
 e.reset();assert.equal(e.snapshot().connections.length,2);
});
test('invalid or corrupted local path data fails closed to original network',()=>{
 memory.set('paperworld-path-draft-v1',JSON.stringify({nodes:[[99999,1]],connections:[[0,2]],hidden:[]}));
 const e=make();assert.equal(e.snapshot().nodes.length,3);assert.equal(e.snapshot().connections.length,2);
});
test('live walking network is not overwritten by editing the draft',()=>{
 assert.match(app,/const pathDraft=pathEditor\.create\(/);
 assert.match(app,/if\(editingPaths\)pathDraft\.draw\(ctx\)/);
 assert.match(app,/if\(editingPaths&&v\?\.path\)/);
 assert.doesNotMatch(app,/navigation\s*=\s*pathDraft/);
 assert.ok(html.includes('id="path-editor-toggle"'));
 for(const id of ['path-editor-mode','path-editor-show-hidden','path-editor-undo','path-editor-reset','path-editor-copy','path-editor-export'])
  assert.ok(html.includes('id="'+id+'"'));
});
test('approved owner building positions are the source defaults',()=>{
 for(const [id,x,bottom] of [['town',594,381],['workshop',1107,399],['pokemon',338,586],['wellbeing',1361,577],['studio',835,757]]){
  const match=app.match(new RegExp("\\{id:'"+id+"'[^\\n]+"));
  assert.ok(match,id);assert.ok(match[0].includes('x:'+x+',bottom:'+bottom),id);
 }
 assert.match(app,/paperworld-building-layout-draft-v2/);
});
