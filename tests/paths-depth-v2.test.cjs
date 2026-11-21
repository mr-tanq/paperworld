'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const nav=require('../js/navigation.js'),depth=require('../js/depth.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const buildings=[
 {id:'pokemon',bottom:586},
 {id:'wellbeing',bottom:577},
 {id:'studio',bottom:757},
 {id:'workshop',bottom:399}
];

test('all published walkable links are obstacle-free and connected',()=>{
 assert.equal(nav.safeConnections.length,nav.connections.length,'do not silently discard a blocked path');
 for(const [a,b] of nav.connections)assert.ok(nav.clearSegment(nav.nodes[a],nav.nodes[b]),'edge '+a+'-'+b+' must stay on pavement');
 const hubs=[[612,551],[1110,558],[385,665],[1238,640],[822,861]];
 for(const a of hubs)for(const b of hubs){
  const start=nav.snapToPath(a,12),end=nav.snapToPath(b,12);
  assert.ok(start&&end,'home approaches must be on mapped paths');
  assert.ok(nav.routeBetween(start,end).length>1,'all project homes must be mutually reachable');
 }
});
test('route around the central blossom uses checked pavement or hidden rear alley',()=>{
 const start=nav.snapToPath([612,551],2),end=nav.snapToPath([1110,558],2);
 const route=nav.routeBetween(start,end);
 assert.ok(route.length>1,'Town Hall and Listening Mirror remain connected');
 for(let i=1;i<route.length;i++)assert.ok(nav.clearSegment(route[i-1],route[i]),'do not cross a ground-level obstruction');
 assert.equal(nav.isHiddenEdge(16,37),true,'inner hidden rear route is declared');
 assert.equal(nav.clearSegment([700,560],[755,562]),true,'rear path clears ground collision');
});
test('front public walkway wins over building overhang only on mapped path',()=>{
 const besidePokemon={x:415,y:625};
 assert.ok(nav.snapToPath([besidePokemon.x,besidePokemon.y],17),'test actor is on a sidewalk');
 assert.ok(depth.actorWalkwayDepth(besidePokemon,nav,buildings)>=586,'visible sidewalk actor stays in front of pokemon roof');
 assert.equal(depth.actorWalkwayDepth({x:340,y:575},nav,buildings),575,'off-road actor must not be floated over a roof');
 assert.equal(depth.actorWalkwayDepth({x:700,y:390},nav,buildings),390,'plaza actor keeps real feet-based depth');
});
test('map overlay is opt-in and displays only checked segments',()=>{
 const html=read('index.html'),js=read('js/app.js');
 assert.match(html,/id="walkway-overlay"/);
 assert.match(js,/showSurveyedPaths=false/);
 assert.match(js,/navigation\.safeConnections/);
 assert.match(js,/depth\.actorWalkwayDepth\(a,navigation,defs\)/);
 assert.match(js,/depth\.actorWalkwayDepth\(w,navigation,defs\)/);
 assert.doesNotMatch(read('js/navigation.js'),/fetch\(/);
});

test('tablet navigation keeps Paths toggle in the visible Work Desk, not overflowing top controls',()=>{
 const html=read('index.html');
 const start=html.indexOf('<div class="workspace-actions">');
 const end=html.indexOf('</div>',start);
 assert.ok(start>0&&end>start);
 assert.match(html.slice(start,end),/id="walkway-overlay"/);
 const controls=html.slice(html.indexOf('<div class="controls">'),html.indexOf('</div>',html.indexOf('<div class="controls">')));
 assert.doesNotMatch(controls,/id="walkway-overlay"/);
 assert.equal((html.match(/id="walkway-overlay"/g)||[]).length,1);
});

test('annotated red routes are curved and visible at the correct locations',()=>{
 const expected=[[612,551],[385,665],[822,861],[1238,640],[1110,558],[720,480],[850,365],[950,500]];
 for(const point of expected){
  assert.ok(nav.nodes.some(n=>n[0]===point[0]&&n[1]===point[1]),'missing annotated waypoint '+point);
 }
 const app=read('js/app.js');
 assert.match(app,/strokeStyle='rgba\(229,48,53,\.92\)'/);
 assert.ok(nav.nodes.length>=35,'curve should have intermediate steps, not shortcuts');
 assert.equal(nav.safeConnections.length,nav.connections.length,'all edges must remain safe');
});

test('removed Listening Mirror bypass does not reappear in live navigation',()=>{
 assert.equal(nav.nodes.length,71,'71 connected safe waypoints; three unsafe leaf spurs excluded');
 assert.equal(nav.safeConnections.length,nav.connections.length,'all hidden alleys must be ground-safe');
 assert.equal(nav.hiddenConnections.length,7,'only Studio rear path stays hidden');
 const removed=[[950,355],[988,320],[1040,305],[1120,300],[1210,305],[1270,335]];
 for(const p of removed)assert.equal(nav.nodes.some(n=>n[0]===p[0]&&n[1]===p[1]),false,
   'right-hand purple bypass waypoint '+p+' must not exist');
 const studio=nav.routeBetween(nav.snapToPath([700,560],2),nav.snapToPath([990,540],2));
 assert.ok(studio.length>2,'Studio rear hidden path remains connected');
 assert.equal(nav.isHiddenEdge(16,37),true);
 const app=read('js/app.js');
 assert.match(app,/navigation\.isHiddenEdge\(i,j\)\)continue/,'do not draw hidden paths over roofs');
 assert.match(app,/hiddenNodes\.has\(i\)/);
 const dep=depth.actorWalkwayDepth({x:820,y:560},nav,[{id:'studio',bottom:757}]);
 assert.ok(dep<757,'Studio rear passage stays behind its artwork');
});
