'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('main entrypoint runs the promoted village with local assets',()=>{
 const html=read('index.html');
 const scripts=['navigation.js','depth.js','projects.js','rooms-ui.js','cloud.js','cloud-ui.js','app.js'];
 for(const name of scripts){
  assert.ok(new RegExp('src="\\./js/'+name.replaceAll('.','\\.')+'(?:\\?v=[^\"]+)?"').test(html),name);
  assert.ok(fs.existsSync(path.join(root,'js',name)),'missing js/'+name);
 }
 for(const id of ['map','name','desc','project-room','open-projects','depth-demo'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/href="\.\/style\.css\?v=[^"]+"/);
 assert.doesNotMatch(html,/<script[^>]+src=["']https?:/i);
 assert.doesNotMatch(html,/<link[^>]+href=["']https?:/i);
});
test('previous main entrypoint stays available under archive',()=>{
 const html=read('archive/prototype-002/index.html');
 for(const id of ['scene','title','dialog','zoom-in','zoom-out','reset','chief','workshop','town'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const name of ['style.css','village.js'])assert.ok(fs.existsSync(path.join(root,'archive/prototype-002',name)));
});
test('promoted app uses correct root-relative assets and shares local task state with preview',()=>{
 const main=read('js/app.js'),preview=read('preview-010/app.js');
 const cloud=read('js/cloud.js'),projects=read('js/projects.js');
 assert.ok(main.includes("file:'./assets/town-hall.png'"));
 assert.ok(main.includes("file:'./assets/lost-wanderer-studio.png'"));
 assert.ok(!main.includes("../assets/"));
 assert.ok(preview.includes("../assets/"));
 assert.match(cloud,/const TOKEN_STORAGE='paperworld-cloud-session-v1'/);
 assert.match(read('preview-010/cloud.js'),/const TOKEN_STORAGE='paperworld-cloud-session-v1'/);
 assert.equal(projects,read('preview-010/projects.js'));
 assert.match(main,/PaperworldRooms\?\.open\('town'\)/);
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
 assert.match(js,/building\(x,y,'#c8866c','WORKSHOP'\)/);
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
 assert.match(js,/building\(x,y,'#c8866c','WORKSHOP'\)/);
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
 assert.match(js,/depth\.sortLayers\(layers\)/);
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

test('prototype 011 depth layers sort actors against buildings by foot depth',()=>{
 const depth=require('../preview-010/depth.js');
 const layers=depth.sortLayers([{id:'studio',depth:801},{id:'walker-back',depth:705},{id:'walker-front',depth:854}]);
 assert.deepEqual(layers.map(x=>x.id),['walker-back','studio','walker-front']);
 const same=depth.sortLayers([{id:'a',depth:505},{id:'b',depth:505}]);
 assert.deepEqual(same.map(x=>x.id),['a','b'],'same-depth order must be stable');
 assert.ok(depth.tree.polygon.length>=8,'tree crown should be a traced shape');
});
test('prototype 011 preview has foreground tree and isolated depth-demo controls',()=>{
 const js=read('preview-010/app.js'),html=read('preview-010/index.html'),depth=read('preview-010/depth.js');
 assert.ok(html.indexOf('depth.js')<html.indexOf('app.js'),'depth module must load first');
 assert.match(html,/id="depth-demo"/);
 assert.match(js,/depth\.sortLayers\(layers\)/);
 assert.match(js,/depth\.foregroundLayers\(ctx,scene\.ready,scene\.image,W,H\)/);
 assert.match(js,/id:'depth-demo'/);
 assert.match(depth,/ctx\.clip\(\)/);
 assert.match(depth,/ctx\.drawImage\(image,0,0,width,height\)/);
 assert.match(js,/calibrate-marker/);
 assert.match(js,/navigation\.routeBetween\(/);
});

test('project rooms store persists real task CRUD and offline JSON backups',()=>{
 const {createStore,ROOMS,KEY}=require('../preview-010/projects.js');
 assert.equal(ROOMS.length,5);
 const disk=new Map(),adapter={getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v)};
 const store=createStore(adapter);
 assert.equal(store.list().length,0);
 const task=store.add('pokemon','Build next Echoes map','Godot 4');
 assert.equal(task.status,'todo');
 store.update(task.id,{status:'doing',notes:'Route 2 draft'});
 assert.equal(createStore(adapter).list('pokemon')[0].status,'doing');
 assert.equal(store.list('studio').length,0);
 const backup=store.exportJSON();
 const after=store.add('studio','Write next Lost Wanderer track');
 assert.equal(store.list().length,2);
 store.remove(after.id);
 assert.equal(store.list().length,1);
 const emptyDisk=new Map(),newStore=createStore({getItem:k=>emptyDisk.get(k)||null,setItem:(k,v)=>emptyDisk.set(k,v)});
 newStore.importJSON(backup);
 assert.equal(newStore.list('pokemon')[0].notes,'Route 2 draft');
 newStore.importJSON(backup);
 assert.equal(newStore.list().length,1,'re-import must not duplicate tasks');
 assert.ok(disk.has(KEY));
 assert.throws(()=>store.add('invalid','task'));
 assert.throws(()=>store.update(task.id,{status:'not-real'}));
 assert.throws(()=>newStore.importJSON(JSON.stringify({version:1,tasks:[{id:'x',room:'fake',title:'unsafe',status:'todo',created:1}]})));
});
test('project room UI is attached to each building, is editable, and warns about local-only data',()=>{
 const html=read('preview-010/index.html'),js=read('preview-010/app.js'),ui=read('preview-010/rooms-ui.js');
 assert.ok(html.indexOf('projects.js')<html.indexOf('rooms-ui.js'));
 assert.ok(html.indexOf('rooms-ui.js')<html.indexOf('app.js'));
 assert.match(html,/id="project-room"/);
 assert.match(html,/id="open-projects"/);
 assert.match(js,/PaperworldRooms\?\.open\(d\.id\)/);
 assert.match(ui,/store\.add\(/);
 assert.match(ui,/store\.update\(/);
 assert.match(ui,/store\.remove\(/);
 assert.match(ui,/store\.exportJSON\(/);
 assert.match(ui,/store\.importJSON\(/);
 assert.match(ui,/saved only in this browser/i);
 assert.match(ui,/window\.confirm\(/);
});

test('cloud schema is owner-scoped and leaves approval writes unavailable to browser clients',()=>{
 const sql=read('supabase/paperworld_schema_draft.sql');
 for(const table of ['paperworld_tasks','paperworld_approval_requests'])assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
 assert.match(sql,/grant select,insert,update,delete on table public\.paperworld_tasks to authenticated/i);
 assert.match(sql,/revoke all on table public\.paperworld_tasks from anon/i);
 assert.match(sql,/revoke all on table public\.paperworld_approval_requests from anon/i);
 assert.match(sql,/grant select on table public\.paperworld_approval_requests to authenticated/i);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete|all) on table public\.paperworld_approval_requests to authenticated/i);
 for(const cmd of ['select','insert','update','delete'])assert.match(sql,new RegExp('for '+cmd+' to authenticated'));
 assert.match(sql,/with check \(\(select auth\.uid\(\)\) = owner_id\)/);
 assert.match(sql,/using \(\(select auth\.uid\(\)\) = owner_id\)/);
 assert.doesNotMatch(sql,/security definer/i);
});

test('live cloud rooms keep local tasks separate and include auth plus import controls',()=>{
 const html=read('preview-010/index.html');
 const base=read('preview-010/rooms-ui.js');
 const cloud=read('preview-010/cloud.js');
 const ui=read('preview-010/cloud-ui.js');
 for(const p of ['cloud.js','cloud-ui.js'])assert.ok(html.includes(p));
 assert.ok(html.indexOf('rooms-ui.js') < html.indexOf('cloud.js'));
 assert.ok(html.indexOf('cloud.js') < html.indexOf('cloud-ui.js'));
 assert.match(base,/Open cloud workspace/);
 assert.match(base,/PaperworldCloudUI\.open/);
 assert.match(ui,/Create account/);
 assert.match(ui,/Preview and copy/);
 assert.match(ui,/Originals will remain/);
 assert.match(ui,/confirm\(/);
 assert.match(cloud,/sb_publishable_/);
 assert.doesNotMatch(cloud,/service_role|sb_secret_/);
});
test('cloud client validates rooms and avoids duplicate local import IDs',()=>{
 const cloud=require('../preview-010/cloud.js');
 const requests=[];
 const storage=new Map();
 const adapter={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const fetcher=async (url,options)=>{
  requests.push({url,options});
  let data={};
  if(url.includes('grant_type=password'))data={access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{email:'test@example.invalid'}};
  if(url.includes('/rest/v1/'))data=options.method==='POST'?[{id:'11111111-1111-4111-8111-111111111111',...JSON.parse(options.body)}]:[];
  return {ok:true,status:200,text:async()=>JSON.stringify(data)};
 };
 return (async()=>{
  const c=cloud.createClient({fetcher,storage:adapter});
  assert.equal(c.signedIn(),false);
  await c.login('test@example.invalid','example-password');
  assert.equal(c.signedIn(),true);
  await c.list('studio');
  await c.add('studio','An original song');
  const plan=c.prepareImport([{id:'local-1',title:'Work',room:'studio'}],[{local_task_id:'local-1'}]);
  assert.equal(plan.incoming.length,0);
  assert.equal(plan.duplicates,1);
  await assert.rejects(()=>c.add('invalid','bad'));
  assert.ok(requests.slice(1).every(r=>r.options.headers.Authorization==='Bearer test-access'));
  await c.signout();
  assert.equal(c.signedIn(),false);
 })();
});

test('tablet orientation keeps map next to independent scrollable project panel',()=>{
 const html=read('index.html'),css=read('style.css');
 assert.match(html,/<style id="paperworld-critical-layout">/);
 assert.match(html,/@media \(orientation:landscape\) and \(min-width:641px\)/);
 assert.match(html, /\.layout>aside\{height:100%;overflow-y:auto\}/);
 assert.match(css, /@media \(orientation:portrait\), \(max-width:640px\)/);
 assert.match(css, /#view\{flex:none;height:clamp\(280px,52dvh,550px\)/);
 assert.match(html, /style\.css\?v=[^\"]+/);
});

test('main PAPERWORLD prioritizes cloud workspaces and hides diagnostics',()=>{
 const page=read('index.html'),local=read('js/rooms-ui.js'),cloud=read('js/cloud-ui.js'),css=read('style.css');
 assert.match(page,/Open village dashboard/);
 assert.match(page,/Map calibration tools/);
 assert.match(page,/Technical asset status/);
 assert.match(page,/<details class="dev-tools">/);
 assert.match(css,/\.controls \.depth-demo\{display:none\}/);
 assert.match(local,/PaperworldCloudUI\?\.signedIn\(\)/);
 assert.match(local,/function open\(id='town',forceLocal=false\)/);
 assert.match(cloud,/window\.PaperworldRooms\.open\(room,true\)/);
 assert.match(cloud,/\[allTasks,missions\]=await Promise\.all\(\[client\.list\(\),client\.listMissions\(\)\]\)/);
 assert.match(cloud,/renderChiefOrRoom/);
 assert.match(cloud,/PaperworldCloudUI=\{open,openChief,isActive:\(\)=>active,signedIn:\(\)=>client\.signedIn\(\)\}/);
 assert.match(cloud,/Preview and copy/);
 assert.match(cloud,/Originals will remain on this device/);
});

test('Chief of Staff makes transparent, safe recommendations without side effects',()=>{
 const engine=require('../js/chief.js');
 const tasks=[
  {id:'a',title:'Fix setlist',room:'workshop',status:'todo',created_at:'2026-11-12T00:00:00Z'},
  {id:'b',title:'Review PAPERWORLD map',room:'town',status:'doing',created_at:'2026-11-13T00:00:00Z'},
  {id:'c',title:'Finish song',room:'studio',status:'done',created_at:'2026-11-10T00:00:00Z'},
  {id:'d',title:'Route 2',room:'pokemon',status:'todo',created_at:'2026-11-11T00:00:00Z'}
 ];
 const result=engine.summarize(tasks);
 assert.equal(result.open,3);assert.equal(result.doing,1);assert.equal(result.done,1);
 assert.equal(result.review[0].id,'b','in progress reviewed first');
 assert.equal(result.review[1].id,'d','oldest todo reviewed before newer todo');
 assert.match(result.guidance,/Review/);
 assert.match(engine.brief(tasks[0]),/No automatic code changes are authorized/);
 assert.match(engine.issueDraftUrl(tasks[0]),/^https:\/\/github.com\/mr-tanq\/concerts\/issues\/new\?/);
 assert.equal(engine.issueDraftUrl(tasks[3]),null);
 assert.deepEqual(tasks[0],{id:'a',title:'Fix setlist',room:'workshop',status:'todo',created_at:'2026-11-12T00:00:00Z'});
});
test('Chief is oversight, Workshop is the hands-on Developer',()=>{
 const html=read('index.html'),ui=read('js/cloud-ui.js'),css=read('style.css');
 assert.ok(html.indexOf('js/chief.js')<html.indexOf('js/cloud-ui.js'));
 for(const label of ['Chief of Staff','Listening Mirror Workshop','renderWorkshop','renderChiefOrRoom'])assert.ok(ui.includes(label),label);
 assert.ok(ui.includes("if(room==='workshop')"));
 assert.ok(ui.includes('one mission')===false);
 assert.match(css,/\.chief-desk/);
});

test('Chief is immediately discoverable and cache-busted on tablet',()=>{
 const html=read('index.html'),app=read('js/app.js'),ui=read('js/cloud-ui.js'),css=read('style.css');
 assert.match(html,/id="open-chief"/);
 assert.match(html,/chief\.js\?v=\d+/);
 assert.match(html,/cloud-ui\.js\?v=\d+/);
 assert.match(html,/app\.js\?v=\d+/);
 assert.match(html,/style\.css\?v=[^\"]+/);
 assert.match(app,/PaperworldCloudUI\?\.openChief\(\)/);
 assert.match(ui,/function openChief\(\)/);
 assert.match(ui,/querySelector\('\.chief-desk'\)/);
 assert.match(css,/\.chief-launch/);
});

test('human-review TicketSwap mission brief references real repository paths',()=>{
 const chief=require('../js/chief.js');
 const task={id:'11111111-1111-4111-8111-111111111111',title:'Ticketswap fix',room:'workshop',status:'todo',notes:'check failing'};
 const draft=chief.missionFor(task);
 assert.equal(draft.repository,'mr-tanq/concerts');
 assert.equal(draft.mode,'analysis_only');
 for(const file of ['js/concert-ticketswap.js','js/ticketswap-check.js','scripts/lib/ticketswap-matching.mjs','scripts/lib/ticketswap-going.mjs','scripts/test-ticketswap.mjs'])assert.ok(draft.brief.includes(file),file);
 assert.ok(draft.brief.includes('DO NOT modify files'));
 assert.ok(draft.brief.includes('NOT STARTED'));
 assert.throws(()=>chief.missionFor({room:'pokemon',title:'Task'}));
});
test('cloud mission UI does not execute workers and retains privacy',()=>{
 const html=read('index.html'),cloud=read('js/cloud.js'),ui=read('js/cloud-ui.js'),sql=read('supabase/paperworld_missions_reference.sql');
 for(const src of ['cloud.js?v=32','cloud-ui.js?v=34','chief.js?v=28'])assert.ok(html.includes(src),src);
 for(const phrase of ['workerStatus(current.id)','runApprovedAiMission(current.id','workshop.existingTicketSwap(missions)','Παλαιότερες αποστολές'])assert.ok(ui.includes(phrase),phrase);
 for(const fn of ['listMissions','createMission','setMissionStatus','deleteMission'])assert.ok(cloud.includes(fn),fn);
 assert.ok(cloud.includes("mode:'analysis_only'"));
 assert.ok(cloud.includes("['draft','ready_for_review','cancelled']"));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('revoke all privileges on table public.paperworld_missions from public, anon, authenticated'));
 assert.ok(sql.includes('(select auth.uid())=owner_id'));
 assert.doesNotMatch(sql,/service_role|security definer/i);
});

test('first AI Worker requires explicit credit approval and cannot push or deploy',()=>{
 const workflow=read('.github/workflows/worker-review.yml');
 const runner=read('scripts/worker/worker.mjs');
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^\s+push:|^\s+schedule:/m);
 assert.match(workflow,/approve_credits:/);
 assert.match(workflow,/I_APPROVE_AI_CREDITS/);
 assert.match(workflow,/if: inputs.mode == 'run-ai'/);
 assert.match(workflow,/copilot-requests: write/);
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/contents: write|--allow-all|--yolo|git push|gh pr create/i);
 assert.match(workflow,/available-tools='view,grep,glob,edit,create,apply_patch'/);
 assert.match(workflow,/--deny-tool=shell/);
 assert.match(workflow,/--deny-tool=url/);
 assert.match(workflow,/upload-artifact/);
 assert.match(runner,/forbidden path/);
 assert.match(runner,/worker\.patch/);
 assert.match(runner,/remoteWrites:false/);
});

test('authenticated prepare-only bridge wiring',()=>{
 const cloud=read('js/cloud.js'),ui=read('js/cloud-ui.js'),html=read('index.html');
 for(const part of ['workerStatus','prepareWorkerMission','confirm_prepare_only:true'])assert.ok(cloud.includes(part));
 for(const label of ['Έλεγχος προόδου','Δες την αναφορά','Ξεκίνα έρευνα AI'])assert.ok(ui.includes(label));
 assert.ok(html.includes('cloud.js?v=32'));
 assert.ok(html.includes('cloud-ui.js?v=34'));
});
test('bridge only dispatches review-ready mission with explicit per-run authorization',()=>{
 const code=read('supabase/functions/worker-bridge/index.ts');
 for(const part of ['/auth/v1/user','paperworld_missions','owner_id!==userId','confirm_prepare_only','I_APPROVE_INCLUDED_AI_CREDITS','if(!TOKEN)','Origin denied','mission.status!=="ready_for_review"'])assert.ok(code.includes(part),part);
 assert.ok(code.includes('ai?"run-ai":"prepare-only"'));
 assert.ok(code.includes('ai?24*60*60*1000:10*60*1000'));
 assert.ok(code.includes('approve_credits:ai?"I_APPROVE_AI_CREDITS":""'));
});

test('Each GitHub run is tagged to one PAPERWORLD mission, never another task',()=>{
 const workflow=read('.github/workflows/worker-review.yml');
 const edge=read('supabase/functions/worker-bridge/index.ts');
 const client=read('js/cloud.js');
 const ui=read('js/cloud-ui.js');
 assert.ok(workflow.includes('run-name: PAPERWORLD'));
 assert.ok(workflow.includes('inputs.mission_id'));
 assert.ok(workflow.includes('mission_id:'));
 assert.ok(edge.includes('r.display_title.endsWith(" | "+id)'));
 assert.ok(edge.includes('ownedMission(missionId,userId,auth)'));
 assert.ok(edge.includes('ai?"run-ai":"prepare-only"'));
 assert.ok(edge.includes('mission_id:data.mission_id'));
 assert.ok(edge.includes('10*60*1000'));
 assert.ok(edge.includes('readReport(run.id)'));
 assert.ok(edge.includes('I_APPROVE_INCLUDED_AI_CREDITS'));
 assert.ok(edge.includes('24*60*60*1000'));
 assert.ok(edge.includes('readReport(run.id)'));
 assert.ok(client.includes('async function workerStatus(id,includeReport=false)'));
 assert.ok(ui.includes('client.workerStatus(current.id,true)'));
 assert.ok(ui.includes('Άνοιξε την εκτέλεση στο GitHub'));
 assert.ok(ui.includes('workerReports=new Map()'));
});

test('AI execution is a one-shot human-only Copilot Free credit opt-in',()=>{
 const edge=read('supabase/functions/worker-bridge/index.ts');
 const ui=read('js/cloud-ui.js');
 const client=read('js/cloud.js');
 const workflow=read('.github/workflows/worker-review.yml');
 assert.ok(ui.includes('Ξεκίνα έρευνα AI'));
 assert.ok(ui.includes('confirm(explanation)'));
 assert.ok(ui.includes('I_APPROVE_INCLUDED_AI_CREDITS'));
 assert.ok(ui.includes("client.runApprovedAiMission(current.id,'I_APPROVE_INCLUDED_AI_CREDITS')"));
 assert.ok(client.includes('runApprovedAiMission'));
 assert.ok(client.includes('confirm_ai_credits:approval'));
 assert.ok(edge.includes('keys==="confirm_ai_credits,mission_id"'));
 assert.ok(edge.includes('mission.status!=="ready_for_review"'));
 assert.ok(edge.includes('mode=ai?"run-ai":"prepare-only"'));
 assert.ok(edge.includes('approve_credits:ai?"I_APPROVE_AI_CREDITS":""'));
 assert.ok(edge.includes('cooldown=ai?24*60*60*1000'));
 assert.ok(workflow.includes('--max-ai-credits=30'));
 assert.ok(workflow.includes('--model=auto'));
 assert.ok(!workflow.includes('contents: write'));
});

test('Workshop dialogue routes everyday requests to existing task instead of duplicates',()=>{
 const workshop=require('../js/workshop-dialogue.js');
 assert.equal(workshop.classify('Φίλε, δεν δουλεύει το TicketSwap.').type,'ticketswap');
 assert.equal(workshop.classify('Ticket Swap check failing').type,'ticketswap');
 assert.equal(workshop.classify('Improve festival photos').type,'other');
 assert.equal(workshop.classify('   ').type,'empty');
 const records=[
  {id:'cancelled',project_room:'workshop',repository:'mr-tanq/concerts',title:'TicketSwap fix',status:'cancelled'},
  {id:'draft',project_room:'workshop',repository:'mr-tanq/concerts',title:'TicketSwap fix',status:'draft'},
  {id:'ready',project_room:'workshop',repository:'mr-tanq/concerts',title:'TicketSwap fix',status:'ready_for_review'}
 ];
 assert.equal(workshop.existingTicketSwap(records).id,'ready');
 assert.equal(workshop.existingTicketSwap(records.slice(0,1)),null);
});
test('Listening Mirror dialogue does not quietly start agents or write code',()=>{
 const ui=read('js/cloud-ui.js'),html=read('index.html');
 assert.ok(html.includes('workshop-dialogue.js?v=33'));
 assert.ok(html.includes('cloud-ui.js?v=34'));
 assert.ok(ui.includes('function renderWorkshop()'));
 assert.ok(ui.includes("workshop.existingTicketSwap(missions)"));
 assert.ok(ui.includes('workshop.existingTicketSwap(missions)'));
 assert.ok(ui.includes('Αποθήκευση αιτήματος'));
 assert.ok(ui.includes("confirm('Να αποθηκεύσω το αίτημα"));
 assert.ok(!read('js/workshop-dialogue.js').includes('fetch('));
});

test('one TicketSwap mission is visible while old drafts stay archived',()=>{
 const ui=read('js/cloud-ui.js'),workshop=require('../js/workshop-dialogue.js');
 assert.ok(ui.includes('const current=workshop.existingTicketSwap(missions)'));
 assert.ok(ui.includes('m.id!==current?.id'));
 assert.ok(ui.includes('Παλαιότερες αποστολές'));
 assert.ok(ui.includes("el('details',undefined,'developer-archive')"));
 assert.ok(!ui.includes('Worker mission drafts · '+"'")); 
 const records=[
 {id:'1',title:'TicketSwap fix',repository:'mr-tanq/concerts',project_room:'workshop',status:'cancelled'},
 {id:'2',title:'TicketSwap fix',repository:'mr-tanq/concerts',project_room:'workshop',status:'draft'},
 {id:'3',title:'TicketSwap fix',repository:'mr-tanq/concerts',project_room:'workshop',status:'ready_for_review'}];
 assert.equal(workshop.existingTicketSwap(records).id,'3');
});
test('natural-language request can start AI only after a separate explicit confirmation',()=>{
 const ui=read('js/cloud-ui.js'),html=read('index.html'),workshop=require('../js/workshop-dialogue.js');
 assert.ok(ui.includes('confirm(explanation)'));
 assert.ok(ui.includes("client.runApprovedAiMission(current.id,'I_APPROVE_INCLUDED_AI_CREDITS')"));
 assert.ok(ui.includes('Το αίτημα αποθηκεύτηκε. Δεν ξεκίνησε AI.'));
 assert.ok(html.includes('style.css?v=workspace-034'));
 assert.equal(workshop.classify('Δεν δουλεύει το τικετσουατ').type,'ticketswap');
});

test('Copilot Free workflow uses valid minimum credit cap and auto model selection',()=>{
 const workflow=read('.github/workflows/worker-review.yml');
 assert.match(workflow,/--model=auto --max-ai-credits=30/);
 assert.doesNotMatch(workflow,/--max-ai-credits=0\\.50/);
 assert.match(workflow,/if: inputs.mode == 'run-ai'/);
 assert.match(workflow,/I_APPROVE_AI_CREDITS/);
});
