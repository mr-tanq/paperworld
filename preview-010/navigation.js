/* PAPERWORLD Preview 010: conservative, explicit walking network.
   The map is artwork, not walkable terrain; these are reviewed sidewalk waypoints.
   No automated movement may enter a building's ground footprint. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldNavigation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const nodes=[
  [700,575], // 0 - west edge of central plaza; never route through tree planter
  [675,530], // 1 - west approach to square
  [1000,530],// 2 - east approach
  [535,520], // 3 - Town Hall entrance path
  [1125,515],// 4 - Workshop entrance path
  [550,670], // 5 - west outer path
  [1115,670],// 6 - east outer path
  [330,695], // 7 - Pokémon Hub front path
  [1325,695],// 8 - Wellbeing Center front path
  [520,790], // 9 - lower-west curve
  [1160,790],// 10 - lower-east curve
  [640,865], // 11 - southwest studio path
  [1020,865],// 12 - southeast studio path
  [835,870]  // 13 - Lost Wanderer Studio entrance
 ];
 const connections=[
  [0,1],[0,5],[1,3],[2,4],
  [1,5],[2,6],[5,7],[6,8],
  [5,9],[6,10],[9,11],[10,12],
  [11,13],[12,13]
 ];
 // Conservative ground-base ellipses: not the roofs, which overhang footpaths.
 const obstacles=[
  {name:'Town Hall',x:535,y:462,rx:155,ry:40},
  {name:'Listening Mirror Workshop',x:1125,y:456,rx:155,ry:40},
  {name:'Pokémon Hub',x:330,y:626,rx:164,ry:39},
  {name:'Wellbeing & Training Center',x:1325,y:626,rx:160,ry:39},
  {name:'The Lost Wanderer Studio',x:835,y:775,rx:195,ry:40},
  {name:'Central cherry tree and raised planter',x:830,y:476,rx:90,ry:68}
 ];
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const inside=(p,o,radius=10)=>Math.pow((p[0]-o.x)/(o.rx+radius),2)+Math.pow((p[1]-o.y)/(o.ry+radius),2)<1;
 const blockedPoint=(p,radius=10)=>obstacles.some(o=>inside(p,o,radius));
 // Segment/ellipse intersection by sampling every <= 4 artwork pixels.
 function clearSegment(a,b){
  const count=Math.max(1,Math.ceil(distance(a,b)/4));
  for(let i=0;i<=count;i++){
   const t=i/count,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   if(blockedPoint(p))return false;
  }
  return true;
 }
 const safeConnections=connections.filter(([a,b])=>clearSegment(nodes[a],nodes[b]));
 const nearestNode=(p,maxDistance=85)=>{
  let best=-1,dist=Infinity;
  nodes.forEach((n,i)=>{if(blockedPoint(n))return;const d=distance(p,n);if(d<dist){dist=d;best=i}});
  return dist<=maxDistance?best:-1;
 };
 function findRoute(start,end){
  if(!Number.isInteger(start)||!Number.isInteger(end)||!nodes[start]||!nodes[end])return[];
  const queue=[start],prev=new Map([[start,null]]);
  for(let i=0;i<queue.length;i++){
   const cur=queue[i];if(cur===end)break;
   for(const [a,b] of safeConnections){
    const next=a===cur?b:b===cur?a:null;
    if(next!==null&&!prev.has(next)){prev.set(next,cur);queue.push(next)}
   }
  }
  if(!prev.has(end))return[];
  const result=[];
  for(let at=end;at!==null;at=prev.get(at))result.unshift([...nodes[at]]);
  return result;
 }
 return {nodes,connections,obstacles,safeConnections,blockedPoint,clearSegment,nearestNode,findRoute,distance};
});
