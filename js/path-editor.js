/* Owner-authored, local-only walking-path survey. Does NOT change live navigation. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldPathEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MODES=['draw','move','erase','hidden'];
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const key=(a,b)=>[Math.min(a,b),Math.max(a,b)].join(':');
 const validPoint=(p,w,h)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&
   p[0]>=0&&p[0]<=w&&p[1]>=0&&p[1]<=h;
 const copy=o=>JSON.parse(JSON.stringify(o));
 function create({nodes,connections,hiddenConnections=[],width,height,storage=null,storageKey='paperworld-path-draft-v1'}){
  const starter={
   nodes:copy(nodes),
   connections:copy(connections),
   hidden:hiddenConnections.map(([a,b])=>key(a,b))
  };
  let draft=copy(starter),mode='draw',showHidden=true,selected=null,pending=null,dragging=null;
  const history=[];
  const valid=src=>{
   if(!src||!Array.isArray(src.nodes)||!Array.isArray(src.connections)||
    !Array.isArray(src.hidden)||src.nodes.length>500||src.connections.length>1500)return false;
   if(!src.nodes.every(p=>validPoint(p,width,height)))return false;
   const seen=new Set();
   for(const e of src.connections){
    if(!Array.isArray(e)||e.length!==2||!e.every(Number.isInteger)||
     e.some(i=>i<0||i>=src.nodes.length)||e[0]===e[1]||seen.has(key(...e)))return false;
    seen.add(key(...e));
   }
   return src.hidden.every(k=>typeof k==='string'&&seen.has(k));
  };
  try{
   const stored=storage&&JSON.parse(storage.getItem(storageKey)||'null');
   if(valid(stored))draft=copy(stored);
  }catch(_){}
  const save=()=>{try{storage?.setItem(storageKey,JSON.stringify(draft))}catch(_){}};
  const remember=()=>{history.push(copy(draft));if(history.length>30)history.shift()};
  const nearestNode=(p,limit)=>{
   let best=-1,dist=limit;
   draft.nodes.forEach((n,i)=>{const d=distance(n,p);if(d<=dist){dist=d;best=i}});
   return best;
  };
  const edgeDistance=(p,a,b)=>{
   const A=draft.nodes[a],B=draft.nodes[b];
   const dx=B[0]-A[0],dy=B[1]-A[1],den=dx*dx+dy*dy;
   const t=clamp(((p[0]-A[0])*dx+(p[1]-A[1])*dy)/(den||1),0,1);
   return distance(p,[A[0]+dx*t,A[1]+dy*t]);
  };
  const nearestEdge=(p,limit)=>{
   let result=-1,dist=limit;
   draft.connections.forEach(([a,b],i)=>{const d=edgeDistance(p,a,b);if(d<=dist){dist=d;result=i}});
   return result;
  };
  const point=p=>[Math.round(clamp(p[0],0,width)),Math.round(clamp(p[1],0,height))];
  const nodeAt=(p,tolerance)=>nearestNode(p,clamp(tolerance,9,42));
  const edgeAt=(p,tolerance)=>nearestEdge(p,clamp(tolerance,9,36));
  const getNode=(p,tolerance)=>{
   let i=nodeAt(p,tolerance);
   if(i<0){i=draft.nodes.length;draft.nodes.push(point(p))}
   return i;
  };
  function pointerDown(p,tolerance=20){
   selected=null;dragging=null;
   if(!validPoint(p,width,height))return;
   if(mode==='move'){
    const i=nodeAt(p,tolerance);
    if(i>=0){selected=i;dragging={i,origin:copy(draft.nodes[i]),changed:false};remember()}
   }else if(mode==='erase'){
    const i=edgeAt(p,tolerance);
    if(i>=0){
     remember();const [a,b]=draft.connections.splice(i,1);
     draft.hidden=draft.hidden.filter(k=>k!==key(a,b));save()
    }
   }else if(mode==='hidden'){
    const i=edgeAt(p,tolerance);
    if(i>=0){
     remember();const k=key(...draft.connections[i]);
     draft.hidden=draft.hidden.includes(k)?draft.hidden.filter(v=>v!==k):[...draft.hidden,k];
     save();
    }
   }
  }
  function pointerMove(p){
   if(!dragging||!validPoint(p,width,height))return;
   const next=point(p),i=dragging.i;
   if(distance(next,draft.nodes[i])>0){draft.nodes[i]=next;dragging.changed=true}
  }
  function pointerUp(p,tolerance=20){
   if(mode==='move'){
    if(dragging&&!dragging.changed)history.pop();
    if(dragging?.changed)save();
    dragging=null;return;
   }
   if(mode!=='draw'||!validPoint(p,width,height))return;
   const i=nodeAt(p,tolerance);
   if(pending===null){
    if(i<0){remember();pending=getNode(p,tolerance);save()}else pending=i;
    selected=pending;return;
   }
   const proposed=i<0?draft.nodes.length:i;
   if(proposed===pending){selected=pending;return}
   if(draft.connections.some(e=>key(...e)===key(pending,proposed))){pending=proposed;selected=proposed;return}
   remember();
   const next=getNode(p,tolerance);
   if(next!==pending)draft.connections.push([pending,next]);
   pending=next;selected=next;save();
  }
  function cancelPointer(){dragging=null}
  function setMode(m){if(!MODES.includes(m))return;mode=m;selected=null;pending=null;dragging=null}
  function undo(){const previous=history.pop();if(previous){draft=previous;save()}pending=null;selected=null;dragging=null}
  function reset(){remember();draft=copy(starter);pending=null;selected=null;dragging=null;save()}
  function setShowHidden(v){showHidden=!!v}
  function exportJSON(){return JSON.stringify({
    format:'paperworld-path-survey-v1',scene:{width,height},
    nodes:draft.nodes,connections:draft.connections,
    hiddenConnections:draft.connections.filter(([a,b])=>draft.hidden.includes(key(a,b))),
    note:'Local visual survey only. Requires route safety and connectivity review before activating.'
   },null,2)}
  function summary(){return draft.nodes.length+' σημεία · '+draft.connections.length+' συνδέσεις · '+draft.hidden.length+' κρυφές'}
  function modeLabel(){return {draw:'Σχεδίαση: πάτα σημεία διαδοχικά',move:'Μετακίνηση: σύρε έναν κόμβο',erase:'Διαγραφή: πάτα μια γραμμή',hidden:'Κρυφό: πάτα μια γραμμή'}[mode]}
  function draw(ctx){
   ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
   for(const [a,b] of draft.connections){
    const hidden=draft.hidden.includes(key(a,b));
    if(hidden&&!showHidden)continue;
    ctx.beginPath();ctx.moveTo(...draft.nodes[a]);ctx.lineTo(...draft.nodes[b]);
    ctx.lineWidth=hidden?5:7;
    ctx.strokeStyle=hidden?'#b883f4':'#25e1cf';
    ctx.setLineDash(hidden?[11,9]:[]);
    ctx.stroke();
   }
   ctx.setLineDash([]);
   for(let i=0;i<draft.nodes.length;i++){
    const [x,y]=draft.nodes[i];
    ctx.beginPath();ctx.arc(x,y,i===selected?11:6,0,Math.PI*2);
    ctx.fillStyle=i===selected?'#ffe39d':'#fbfcf7';ctx.fill();
    ctx.strokeStyle='#163638';ctx.lineWidth=2;ctx.stroke();
   }
   ctx.restore();
  }
  return {pointerDown,pointerMove,pointerUp,cancelPointer,setMode,setShowHidden,
   undo,reset,exportJSON,summary,modeLabel,draw,
   snapshot:()=>copy(draft),get mode(){return mode}};
 }
 return {create};
});
