'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('entrypoint references local offline assets',()=>{
 const html=read('index.html');
 for(const name of ['style.css','village.js','manifest.webmanifest']) assert.ok(html.includes(name),name);
 for(const name of ['style.css','village.js','manifest.webmanifest']) assert.ok(fs.existsSync(path.join(root,name)),name);
 assert.doesNotMatch(html,/<script[^>]+src=["']https?:/i);
 assert.doesNotMatch(html,/<link[^>]+href=["']https?:/i);
});
test('all required controls exist',()=>{
 const html=read('index.html');
 for(const id of ['scene','title','dialog','zoom-in','zoom-out','reset','chief','workshop','town']) assert.ok(html.includes('id="'+id+'"'),id);
});
test('no network integrations in prototype JavaScript',()=>{
 const js=read('village.js');
 assert.doesNotMatch(js,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\s*\(/);
 assert.doesNotMatch(js,/\bgithub\.com\b|\bsupabase\.co\b|\bopenrouter\.ai\b/i);
});
test('village includes collision and route-finding logic',()=>{
 const js=read('village.js');
 assert.match(js,/blocked=new Set/);
 assert.match(js,/function bfs\(/);
 assert.match(js,/walkable\(/);
 assert.match(js,/pointercancel/);
});
test('manifest is valid JSON and stays local',()=>{
 const m=JSON.parse(read('manifest.webmanifest'));
 assert.ok(m.name.includes('PAPERWORLD'));
 assert.ok(m.start_url.startsWith('./'));
});

test('interaction uses projected screen-space hit areas',()=>{
 const js=read('village.js');
 assert.match(js,/function hitObject\(/);
 assert.match(js,/const p=project\(c\.x,c\.y\)/);
 assert.match(js,/const p=project\(b\.x,b\.y\)/);
 assert.match(js,/if\(item\)inspect\(item\)/);
 assert.match(js,/state\.selection/);
});

test('landmarks have distinct visual identities and gentle lighting',()=>{
 const js=read('village.js');
 assert.match(js,/name==='TOWN HALL'/);
 assert.match(js,/name==='WORKSHOP'/);
 assert.match(js,/function lantern\(/);
 assert.match(js,/draw\(now\)/);
});
