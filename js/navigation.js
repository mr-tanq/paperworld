/* PAPERWORLD user-annotated path survey v4: conservative, explicit walking network.
   The map is artwork, not walkable terrain; these are reviewed sidewalk waypoints.
   No automated movement may enter a building's ground footprint. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldNavigation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 // Operational network derived from the owner's 2026-11-17 survey.
 // Nodes 83 (inside Studio's building footprint) and 84 (x=23, isolated map edge)
 // remain in owner-path-survey.js for editing, but are not navigable roads.
 const survey=(typeof module==='object'&&module.exports)
  ?require('./owner-path-survey.js'):root.PaperworldOwnerPathSurvey;
 if(!survey||survey.nodes.length!==85)throw new Error('Owner path survey missing');
 const nodes=survey.nodes.slice(0,83).map(p=>[...p]);
 // Five short links restore the survey's interrupted upper road and connect the
 // right-hand raised terrace. No new crossing through the garden or water.
 const repairedConnections=Object.freeze([[45,46],[46,47],[47,48],[48,49],[49,78]]);
 const connections=[...survey.connections.map(e=>[...e]),...repairedConnections.map(e=>[...e])];
 const edgeKey=(a,b)=>[Math.min(a,b),Math.max(a,b)].join(':');
 const hiddenConnections=Object.freeze([
  ...survey.hiddenConnections.map(e=>[...e]),
  [45,46],[46,47],[47,48],[48,49]
 ]);
 const hiddenEdgeKeys=new Set(hiddenConnections.map(([a,b])=>edgeKey(a,b)));
 const isHiddenEdge=(a,b)=>hiddenEdgeKeys.has(edgeKey(a,b));
 // Collision bases calibrated for the owner's CURRENT building placement, not
 // the old artwork coordinates. Roof overhang is handled separately by depth.
 const obstacles=[
  {name:'Town Hall',x:594,y:365,rx:108,ry:23},
  {name:'Listening Mirror Workshop',x:1107,y:382,rx:104,ry:24},
  {name:'Pokémon Hub',x:338,y:574,rx:83,ry:21},
  {name:'Wellbeing & Training Center',x:1361,y:564,rx:82,ry:20},
  {name:'The Lost Wanderer Studio',x:835,y:741,rx:162,ry:25},
  {name:'Central cherry tree and raised planter',x:830,y:475,rx:60,ry:34}
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
 if(safeConnections.length!==connections.length)
  throw new Error('Owner paths intersect a building: refusing unsafe navigation graph');
 // Every navigable waypoint must belong to the same reachable network.
 const visited=new Set([0]),queue=[0];
 for(let q=0;q<queue.length;q++)for(const [a,b] of safeConnections){
  const next=a===queue[q]?b:b===queue[q]?a:-1;
  if(next>=0&&!visited.has(next)){visited.add(next);queue.push(next)}
 }
 if(visited.size!==nodes.length)throw new Error('Owner walking network is disconnected');
 
 function snapToPath(p,maxDistance=Infinity){
  let best=null;
  for(const [a,b] of safeConnections){
   const A=nodes[a],B=nodes[b],dx=B[0]-A[0],dy=B[1]-A[1];
   const t=Math.max(0,Math.min(1,((p[0]-A[0])*dx+(p[1]-A[1])*dy)/(dx*dx+dy*dy||1)));
   const point=[A[0]+t*dx,A[1]+t*dy],d=distance(p,point);
   if(!best||d<best.distance)best={a,b,t,point,distance:d};
  }
  return best&&best.distance<=maxDistance?best:null;
 }
 const nearestNode=(p,maxDistance=85)=>{
  let best=-1,dist=Infinity;nodes.forEach((n,i)=>{const d=distance(p,n);if(d<dist&&!blockedPoint(n)){best=i;dist=d}});
  return dist<=maxDistance?best:-1;
 };
 function findRoute(start,end){
  if(!Number.isInteger(start)||!Number.isInteger(end)||!nodes[start]||!nodes[end])return[];
  const queue=[start],prev=new Map([[start,null]]);
  for(let i=0;i<queue.length;i++){const v=queue[i];if(v===end)break;
   for(const [a,b] of safeConnections){const next=a===v?b:b===v?a:null;if(next!==null&&!prev.has(next)){prev.set(next,v);queue.push(next)}}
  }
  if(!prev.has(end))return[];
  const result=[];for(let at=end;at!==null;at=prev.get(at))result.unshift([...nodes[at]]);
  return result;
 }
 function routeBetween(start,end){
  if(!start||!end)return[];
  const startId=nodes.length,endId=nodes.length+1,N=nodes.length+2;
  const adj=Array.from({length:N},()=>[]);
  const add=(i,j,w)=>{adj[i].push([j,w]);adj[j].push([i,w])};
  for(const [a,b] of safeConnections)add(a,b,distance(nodes[a],nodes[b]));
  function insertVirtual(s,index){const len=distance(nodes[s.a],nodes[s.b]);add(index,s.a,len*s.t);add(index,s.b,len*(1-s.t))}
  insertVirtual(start,startId);insertVirtual(end,endId);
  if(start.a===end.a&&start.b===end.b)add(startId,endId,distance(start.point,end.point));
  const ds=Array(N).fill(Infinity),prev=Array(N).fill(-1),visited=Array(N).fill(false);ds[startId]=0;
  for(let k=0;k<N;k++){let cur=-1;for(let i=0;i<N;i++)if(!visited[i]&&(cur<0||ds[i]<ds[cur]))cur=i;
   if(cur<0||ds[cur]===Infinity||cur===endId)break;visited[cur]=true;
   for(const [to,w] of adj[cur])if(ds[cur]+w<ds[to]){ds[to]=ds[cur]+w;prev[to]=cur}
  }
  if(!Number.isFinite(ds[endId]))return[];
  const ids=[];for(let at=endId;at!==-1;at=prev[at])ids.unshift(at);
  return ids.map(i=>i===startId?[...start.point]:i===endId?[...end.point]:[...nodes[i]]);
 }
 return {nodes,connections,hiddenConnections,isHiddenEdge,obstacles,safeConnections,blockedPoint,clearSegment,nearestNode,findRoute,snapToPath,routeBetween,distance,operationalExcludedNodes:Object.freeze([83,84]),repairedConnections};
});
