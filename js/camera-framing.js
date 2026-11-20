/* PAPERWORLD village camera framing — pure math, no DOM, no world changes.
 *
 * The world image (W×H) and every world coordinate stay exactly as approved;
 * only the camera (scale + translation) is chosen here:
 *  - Landscape (or square-ish) viewports: the whole image, centred ("contain"),
 *    exactly as before.
 *  - Portrait viewports: the buildings' content box fills the width, so all
 *    five houses stay fully visible and larger; only decorative margin is cut.
 *  - Resizes (rotation, address bar, keyboard) keep the user's zoom ratio and
 *    the world point at the centre once they have panned or zoomed.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldCameraFraming=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const EDGE=14;          // legacy contain padding (unchanged landscape look)
 const CONTENT_PAD=24;   // breathing room around the buildings in portrait
 const PORTRAIT=1.0;     // width/height below this counts as portrait
 const TOP=60;           // header height kept clear above a lifted village
 const finite=n=>Number.isFinite(n);
 // Union of the building sprites (x = centre, bottom = base, width) plus the
 // walkable apron in front of them. Building art is roughly as tall as wide.
 function contentBox(defs,W,H){
  const list=(Array.isArray(defs)?defs:[]).filter(d=>finite(d?.x)&&finite(d?.bottom)&&finite(d?.width));
  if(!list.length)return {x:0,y:0,w:W,h:H};
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const d of list){
   minX=Math.min(minX,d.x-d.width/2);maxX=Math.max(maxX,d.x+d.width/2);
   minY=Math.min(minY,d.bottom-d.width);maxY=Math.max(maxY,d.bottom+120);
  }
  minX=Math.max(0,minX-28);maxX=Math.min(W,maxX+40);
  minY=Math.max(0,minY);maxY=Math.min(H,maxY);
  return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
 }
 function isPortrait(width,height){return height>0&&width/height<PORTRAIT}
 // Default framing for a viewport. Returns scale plus the world point that
 // should sit at the centre of the screen.
 function frame({width,height,W,H,content}){
  if(!(width>0&&height>0&&W>0&&H>0))return {scale:1,cx:W/2,cy:H/2,mode:'contain'};
  const contain=Math.min((width-EDGE)/W,(height-EDGE)/H);
  if(!isPortrait(width,height)||!content)
   return {scale:contain,cx:W/2,cy:H/2,mode:'contain'};
  const fitContent=Math.min((width-CONTENT_PAD)/content.w,(height-CONTENT_PAD)/content.h);
  // Never smaller than before, never larger than "cover" (no blank zooming).
  const cover=Math.max(width/W,height/H);
  const scale=Math.min(cover,Math.max(contain,fitContent));
  // Tall screens: lift the village to just under the header so the free space
  // gathers below it, where the village board lives (no building is cut).
  const spare=height-TOP-content.h*scale;
  if(spare>140){
   return {scale,cx:content.x+content.w/2,cy:content.y+(height/2-TOP)/scale,mode:'content',
    boardTop:Math.round(TOP+content.h*scale+6)};
  }
  return {scale,cx:content.x+content.w/2,cy:content.y+content.h/2,mode:'content'};
 }
 function place({width,height},scale,cx,cy){
  return {scale,x:width/2-cx*scale,y:height/2-cy*scale};
 }
 // Camera for a new viewport size. `prev` is the camera before the resize.
 // Untouched cameras simply re-frame for the new orientation.
 function resize({prev,next,W,H,content}){
  const fresh=frame({width:next.width,height:next.height,W,H,content});
  const known=prev&&prev.width>0&&prev.height>0&&prev.scale>0&&prev.fit>0;
  // Same width, modest height change: browser chrome or on-screen keyboard.
  // Keep the exact zoom and centre so nothing jumps, touched or not.
  if(known&&Math.abs(next.width-prev.width)<1&&Math.abs(next.height-prev.height)/prev.height<.3){
   const cx=(prev.width/2-prev.x)/prev.scale,cy=(prev.height/2-prev.y)/prev.scale;
   return {...place(next,prev.scale,cx,cy),fit:prev.adjusted?fresh.scale:prev.fit,
    adjusted:prev.adjusted===true};
  }
  if(!known||!prev.adjusted)
   return {...place(next,fresh.scale,fresh.cx,fresh.cy),fit:fresh.scale,adjusted:false};
  // World point currently at the centre of the screen.
  const cx=(prev.width/2-prev.x)/prev.scale,cy=(prev.height/2-prev.y)/prev.scale;
  // Rotation or window resize: keep the zoom relative to the fitted size.
  const ratio=prev.scale/prev.fit;
  const scale=Math.max(fresh.scale*.7,Math.min(fresh.scale*3,fresh.scale*ratio));
  return {...place(next,scale,cx,cy),fit:fresh.scale,adjusted:true};
 }
 // Pan (never zoom) so the content centre sits in the region a panel leaves
 // visible: to its left (docked) or above it (bottom sheet).
 function frameAround({width,height,scale,content,W,H,panelWidth=0,panelHeight=0,top=0}){
  const cx=content?content.x+content.w/2:W/2,cy=content?content.y+content.h/2:H/2;
  const visibleW=Math.max(280,width-Math.min(Math.max(0,panelWidth),width-280));
  const visibleBottom=Math.max(top+160,height-Math.max(0,panelHeight));
  return {x:visibleW/2-cx*scale,y:(top+visibleBottom)/2-cy*scale};
 }
 return Object.freeze({contentBox,frame,place,resize,frameAround,isPortrait,EDGE,CONTENT_PAD});
});
