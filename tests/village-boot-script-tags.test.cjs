'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
test('Every script tag is properly closed; external script has no nested tags',()=>{
 const opening=(html.match(/<script\b/g)||[]).length;
 const closing=(html.match(/<\/script>/g)||[]).length;
 const complete=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
 assert.ok(opening>0);
 assert.equal(opening,closing,'unclosed or mismatched script tags');
 assert.equal(complete.length,opening,'all scripts have matching close tag');
 for(const m of complete) {
  assert.doesNotMatch(m[2],/<script\b|<\/script>/i,'nested script start/end');
  if(/\bsrc=/.test(m[1]))assert.equal(m[2].trim(),'','external script body must be empty');
 }
});
test('Village Life and its dependencies load before the game renderer',()=>{
 const tags=[...html.matchAll(/<script\b([^>]*)>\s*<\/script>/g)].map(m=>m[1]);
 const names=tags.map(t=>t.match(/\bsrc="([^"]+)"/)?.[1]||'');
 for(const name of ['js/navigation.js','js/depth.js','js/director-movement.js','js/village-life.js','js/app.js']){
  assert.ok(names.some(n=>n.includes(name)),name+' script missing');
 }
 const index=n=>names.findIndex(s=>s.includes(n));
 assert.ok(index('js/navigation.js')<index('js/village-life.js'));
 assert.ok(index('js/director-movement.js')<index('js/village-life.js'));
 assert.ok(index('js/village-life.js')<index('js/app.js'));
});
test('An optional ambient module failure cannot prevent the village renderer boot',()=>{
 assert.match(app,/window\.PaperworldVillageLife\?\.create\(navigation,actors\)\|\|/);
 assert.match(app,/greetings:\(\)=>\[\],homeOf:\(\)=>null/);
 assert.doesNotMatch(app,/throw new Error\('PAPERWORLD Village Life module not loaded'\)/);
});
