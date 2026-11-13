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
 const nodes=[[535,520],[515,575],[520,625],[395,720],[430,760],[520,797],[670,846],[835,854],[1000,846],[1155,797],[1270,738],[1400,700],[1110,690],[1080,610],[1125,515],[620,530],[700,570],[835,575],[955,570],[1040,534],[500,685],[1420,680]];
 const connections=[[0,1],[1,2],[2,20],[20,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,21],[21,12],[12,13],[13,14],[0,15],[15,16],[16,17],[17,18],[18,19],[19,14]];
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
 return {nodes,connections,obstacles,safeConnections,blockedPoint,clearSegment,nearestNode,findRoute,snapToPath,routeBetween,distance};
});
