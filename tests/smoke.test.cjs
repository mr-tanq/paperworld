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

test('papercraft redesign keeps interactions and draws labels only for selection',()=>{
 const js=read('village.js');
 assert.match(js,/function selectedLabel\(/);
 assert.match(js,/selectedLabel\(\)/);
 assert.match(js,/if\(!state\.selection\)return/);
 assert.match(js,/function hitObject\(/);
 assert.match(js,/function bfs\(/);
 assert.match(js,/name==='TOWN HALL'/);
 assert.match(js,/name==='WORKSHOP'/);
 assert.doesNotMatch(js,/label\(name,p\.x,p\.y\+/);
});

test('town hall supports a local high-quality asset and safe offline fallback',()=>{
 const js=read('village.js');
 assert.match(js,/townHallArt\.src='\.\/assets\/town-hall\.png'/);
 assert.match(js,/townHallArt\.onerror=/);
 assert.match(js,/function townHall\(/);
 assert.match(js,/if\(!townHallReady\)\{building/);
 assert.match(js,/ctx\.drawImage\(townHallArt/);
 assert.match(js,/function hitObject\(/);
 assert.match(js,/function bfs\(/);
});

test('listening mirror workshop loads local artwork with a procedural fallback',()=>{
 const js=read('village.js');
 assert.match(js,/workshopArt\.src='\.\/assets\/listening-mirror-workshop\.png'/);
 assert.match(js,/workshopArt\.onerror=/);
 assert.match(js,/function workshop\(/);
 assert.match(js,/if\(!workshopReady\)\{building/);
 assert.match(js,/ctx\.drawImage\(workshopArt/);
 assert.match(js,/function hitObject\(/);
});

test('preview path graph excludes building bases and connects all five entrances',()=>{
 const nav=require('../preview-010/navigation.js');
 for(const [a,b] of nav.safeConnections){
  assert.ok(nav.clearSegment(nav.nodes[a],nav.nodes[b]),'unsafe edge '+a+'-'+b);
 }
 assert.ok(nav.safeConnections.length>=12,'too many edges removed by collision detection');
 for(const endpoint of [3,4,7,8,13]){
  assert.ok(nav.findRoute(13,endpoint).length>0,'no safe path to entrance '+endpoint);
 }
 for(const obstacle of nav.obstacles){
  assert.ok(nav.blockedPoint([obstacle.x,obstacle.y]),'building center must be blocked');
 }
});
test('preview controls load collision rules and place walker on studio entrance path',()=>{
 const html=read('preview-010/index.html'),js=read('preview-010/app.js');
 assert.ok(html.indexOf('navigation.js')<html.indexOf('app.js'));
 assert.match(js,/navigation\.findRoute\(/);
 assert.match(js,/navigation\.clearSegment\(/);
 assert.match(js,/walker:\{x:835,y:870\}/);
 assert.match(js,/layers\.sort\(/);
});

test('plaza tree planter is blocked and cannot serve as a path shortcut',()=>{
 const nav=require('../preview-010/navigation.js');
 assert.ok(nav.blockedPoint([830,476]),'central planter should be blocked');
 assert.ok(!nav.nodes.some(p=>p[0]===830&&p[1]===550),'old route through planter must not return');
 assert.ok(nav.nodes.every(p=>!nav.blockedPoint(p)),'no waypoints may be inside obstacles');
 assert.equal(nav.safeConnections.length,nav.connections.length,'every proposed path must pass clearance test');
 for(const goal of [3,4,7,8]){
  const path=nav.findRoute(13,goal);
  assert.ok(path.length,'all five building approach paths remain connected');
  assert.ok(path.every(p=>!nav.blockedPoint(p)),'route cannot cross planter/building');
 }
});
