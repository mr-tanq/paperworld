'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const nav=require('../js/navigation.js'),depth=require('../js/depth.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const buildings=[
 {id:'pokemon',bottom:646},
 {id:'wellbeing',bottom:645},
 {id:'studio',bottom:801},
 {id:'workshop',bottom:468}
];

test('all published walkable links are obstacle-free and connected',()=>{
 assert.equal(nav.safeConnections.length,nav.connections.length,'do not silently discard a blocked path');
 for(const [a,b] of nav.connections)assert.ok(nav.clearSegment(nav.nodes[a],nav.nodes[b]),'edge '+a+'-'+b+' must stay on pavement');
 const hubs=[[535,520],[1125,515],[385,665],[1240,690],[835,854]];
 for(const a of hubs)for(const b of hubs){
  const start=nav.snapToPath(a,12),end=nav.snapToPath(b,12);
  assert.ok(start&&end,'home approaches must be on mapped paths');
  assert.ok(nav.routeBetween(start,end).length>1,'all project homes must be mutually reachable');
 }
});
test('central shortcut no longer crosses the Lost Wanderer Studio roof',()=>{
 const start=nav.snapToPath([535,520],15),end=nav.snapToPath([1125,515],15);
 const route=nav.routeBetween(start,end);
 assert.ok(route.some(([x,y])=>x>=710&&x<=960&&y<=395),'upper plaza path should loop behind the blossom tree');
 assert.ok(!route.some(([x,y])=>x>=745&&x<940&&y>=490&&y<=700),'no waypoints on studio roof');
 assert.equal(nav.clearSegment([720,480],[720,385]),true);
});
test('front public walkway wins over building overhang only on mapped path',()=>{
 const besidePokemon={x:415,y:625};
 assert.ok(nav.snapToPath([besidePokemon.x,besidePokemon.y],17),'test actor is on a sidewalk');
 assert.ok(depth.actorWalkwayDepth(besidePokemon,nav,buildings)>646,'visible sidewalk actor stays in front of pokemon roof');
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
