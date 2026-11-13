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
 assert.match(js,/navigation\.routeBetween\(/);
 assert.match(js,/navigation\.snapToPath\(/);
 assert.match(js,/walker:\{x:835,y:854\}/);
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

test('touch input can snap to mid-path instead of narrow graph waypoints',()=>{
 const nav=require('../preview-010/navigation.js');
 const target=nav.snapToPath([870,827],200);
 assert.ok(target&&target.point,'a nearby tap snaps to paved road');
 assert.ok(nav.clearSegment(nav.nodes[target.a],target.point));
 const start=nav.snapToPath([835,854],1);
 assert.ok(start,'walker begins on a route');
 const route=nav.routeBetween(start,target);
 assert.ok(route.length>=2,'a valid route is generated');
 for(let i=1;i<route.length;i++)assert.ok(nav.clearSegment(route[i-1],route[i]),'no off-road shortcut');
 assert.ok(nav.nodes.every(p=>!nav.blockedPoint(p)),'route nodes are clear of buildings and planter');
 assert.equal(nav.safeConnections.length,nav.connections.length,'every mapped segment is clear');
});
test('building selection uses alpha hit areas and compact entrance markers',()=>{
 const js=read('preview-010/app.js');
 assert.match(js,/hitMask/);
 assert.match(js,/navigation\.snapToPath\(/);
 assert.match(js,/navigation\.routeBetween\(/);
 assert.doesNotMatch(js,/d\.width\*\.35/);
 assert.match(js,/d\.entrance\[0\]/);
 assert.doesNotMatch(js,/d\.bottom\+5/);
});

test('all five buildings define separate door and road approach positions',()=>{
 const js=read('preview-010/app.js');
 const nav=require('../preview-010/navigation.js');
 const entrances=[
  ['town',355,547,535,520],
  ['workshop',1153,358,1125,515],
  ['pokemon',343,561,385,665],
  ['wellbeing',1330,574,1240,690],
  ['studio',872,679,835,854]
 ];
 for(const [id,x,y,ax,ay] of entrances){
  assert.ok(js.includes("id:'"+id+"'"),'building '+id+' missing');
  assert.ok(js.includes('entrance:['+x+','+y+']'),'door '+id+' missing');
  assert.ok(js.includes('approach:['+ax+','+ay+']'),'walkway approach '+id+' missing');
  const snapped=nav.snapToPath([ax,ay],1);
  assert.ok(snapped&&snapped.distance<1,'approach for '+id+' is not on a safe path');
  assert.equal(nav.blockedPoint([ax,ay]),false,'approach is obstructed for '+id);
 }
 assert.match(js,/touchTolerance=/);
 assert.doesNotMatch(js,/snapToPath\(\[p\.x,p\.y\],190\)/);
});

test('entrance calibration editor supports tap placement without changing navigation',()=>{
 const js=read('preview-010/app.js'),html=read('preview-010/index.html');
 assert.match(html,/id="calibrate-marker"/);
 assert.match(html,/id="reset-marker"/);
 assert.match(html,/id="marker-status"/);
 assert.match(js,/if\(calibrating&&state\.chosen\)/);
 assert.match(js,/saveMarker\(state\.chosen\)/);
 assert.match(js,/localStorage\.setItem\(markerKey/);
 assert.match(js,/localStorage\.getItem\(markerKey/);
 assert.match(js,/defaultEntrances=/);
 assert.match(js,/updateMarkerControls\(\)/);
});

test('tablet calibration positions can be exported without writing to a remote service',()=>{
 const js=read('preview-010/app.js'),html=read('preview-010/index.html');
 assert.match(html,/id="export-markers"/);
 assert.match(html,/id="marker-export-output"/);
 assert.match(js,/function exportCalibration\(/);
 assert.match(js,/Object\.fromEntries\(defs\.map/);
 assert.match(js,/navigator\.clipboard\.writeText/);
 assert.match(js,/markerExportOutput\.select\(\)/);
 assert.match(js,/format:'paperworld-entrance-calibration-v1'/);
});
