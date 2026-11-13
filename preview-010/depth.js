/* PAPERWORLD 011 — 2.5D scene painter and first foreground cutout.
   Pure ordering helpers are CommonJS testable. No network or side effects.
   Buildings remain transparent sprites. Background vegetation still needs
   proper masks; the central tree canopy is an explicitly traced first layer. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldDepth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const tree={id:'plaza-cherry-tree',depth:505,polygon:[
  [821,364],[849,359],[878,373],[895,392],[900,419],
  [882,439],[857,453],[824,455],[789,443],[760,420],
  [766,391],[787,375]
 ]};
 function sortLayers(layers){
  return layers.map((layer,index)=>({...layer,_seq:index}))
   .sort((a,b)=>(a.depth-b.depth)||(a._seq-b._seq));
 }
 function drawSourcePolygon(ctx,image,polygon,width,height){
  if(!image||!polygon||polygon.length<3)return;
  ctx.save();ctx.beginPath();ctx.moveTo(...polygon[0]);
  for(let i=1;i<polygon.length;i++)ctx.lineTo(...polygon[i]);
  ctx.closePath();ctx.clip();ctx.drawImage(image,0,0,width,height);ctx.restore();
 }
 // The same source pixels are redrawn only inside the manually traced canopy,
 // after any actor walking behind the tree. This avoids a new image upload.
 // A separate alpha PNG is still needed for production-grade silhouettes.
 function foregroundLayers(ctx,backgroundReady,image,w,h){
  if(!backgroundReady)return[];
  return [{id:tree.id,depth:tree.depth,paint:()=>drawSourcePolygon(ctx,image,tree.polygon,w,h)}];
 }
 return {tree,sortLayers,drawSourcePolygon,foregroundLayers};
});
