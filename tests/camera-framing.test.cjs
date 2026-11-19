'use strict';
// Responsive village camera: framing per orientation, rotation, keyboard and
// panel framing. The world image and coordinates must never change.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const F=require('../js/camera-framing.js');
const W=1671,H=941;
// Building definitions exactly as in js/app.js (x = centre, bottom, width).
const DEFS=[{x:594,bottom:381,width:356},{x:1107,bottom:399,width:358},{x:338,bottom:586,width:370},
 {x:1361,bottom:577,width:366},{x:835,bottom:757,width:438}];
const content=F.contentBox(DEFS,W,H);
const legacy=(w,h)=>Math.min((w-14)/W,(h-14)/H);
const camAt=(w,h)=>{const f=F.frame({width:w,height:h,W,H,content});return {...F.place({width:w,height:h},f.scale,f.cx,f.cy),fit:f.scale,mode:f.mode}};
const screenX=(cam,x)=>cam.x+x*cam.scale,screenY=(cam,y)=>cam.y+y*cam.scale;

test('World image size and building coordinates are unchanged',()=>{
 const app=fs.readFileSync('js/app.js','utf8');
 assert.match(app,/^const W=1671,H=941;/m);
 const defs=app.slice(app.indexOf('const defs=['),app.indexOf('];',app.indexOf('const defs=['))+2);
 for(const d of DEFS)assert.ok(defs.includes('x:'+d.x+',bottom:'+d.bottom+',width:'+d.width),JSON.stringify(d));
 // Paths, collision and depth modules are not part of this change.
 for(const f of ['js/navigation.js','js/depth.js'])assert.ok(fs.existsSync(f));
 assert.equal(crypto.createHash('sha256').update(defs).digest('hex').length,64);
});
test('Landscape and desktop keep exactly the previous whole-village framing',()=>{
 for(const [w,h] of [[1280,800],[1440,900],[915,412],[1920,1080]]){
  const cam=camAt(w,h);
  assert.equal(cam.mode,'contain');
  assert.ok(Math.abs(cam.scale-legacy(w,h))<1e-12,w+'x'+h);
  assert.ok(Math.abs(cam.x-(w-W*cam.scale)/2)<1e-9);
  assert.ok(Math.abs(cam.y-(h-H*cam.scale)/2)<1e-9);
 }
});
test('Portrait shows every building fully and larger than before',()=>{
 for(const [w,h] of [[800,1280],[412,915],[360,740],[600,960]]){
  const cam=camAt(w,h);
  assert.equal(cam.mode,'content');
  assert.ok(cam.scale>legacy(w,h)*1.1,`${w}x${h} must be noticeably larger`);
  assert.ok(cam.scale<=Math.max(w/W,h/H)+1e-12,'never beyond cover');
  for(const d of DEFS){
   assert.ok(screenX(cam,d.x-d.width/2)>=0&&screenX(cam,d.x+d.width/2)<=w,`${w}x${h} building ${d.x} horizontally`);
   assert.ok(screenY(cam,d.bottom-d.width)>=0&&screenY(cam,d.bottom)<=h,`${w}x${h} building ${d.x} vertically`);
  }
 }
});
test('Untouched camera re-frames for the new orientation',()=>{
 const before={...camAt(1280,800),width:1280,height:800,adjusted:false};
 const after=F.resize({prev:before,next:{width:800,height:1280},W,H,content});
 const fresh=camAt(800,1280);
 assert.equal(after.adjusted,false);
 assert.ok(Math.abs(after.scale-fresh.scale)<1e-12&&Math.abs(after.x-fresh.x)<1e-9);
});
test('Rotation keeps the user zoom ratio and centre, and rotating back restores it',()=>{
 const land=camAt(1280,800);
 // User zoomed to 1.44× and panned.
 const scale=land.fit*1.44,cx=930,cy=520;
 const user={...F.place({width:1280,height:800},scale,cx,cy),scale,fit:land.fit,width:1280,height:800,adjusted:true};
 const portrait=F.resize({prev:user,next:{width:800,height:1280},W,H,content});
 const centre=c=>[(c.width/2-c.x)/c.scale,(c.height/2-c.y)/c.scale];
 const p={...portrait,width:800,height:1280};
 assert.equal(portrait.adjusted,true);
 assert.ok(Math.abs(portrait.scale/portrait.fit-1.44)<1e-9);
 assert.deepEqual(centre(p).map(Math.round),[cx,cy]);
 const back=F.resize({prev:p,next:{width:1280,height:800},W,H,content});
 assert.ok(Math.abs(back.scale-scale)<1e-9&&Math.abs(back.x-user.x)<1e-6&&Math.abs(back.y-user.y)<1e-6);
});
test('Keyboard / browser chrome (height-only) never moves the camera',()=>{
 for(const adjusted of [false,true]){
  const cam={...camAt(800,1280),width:800,height:1280,adjusted};
  if(adjusted)cam.scale*=1.3;
  const next=F.resize({prev:cam,next:{width:800,height:900},W,H,content});
  assert.equal(next.scale,cam.scale);
  const cy=(1280/2-cam.y)/cam.scale,ny=(900/2-next.y)/next.scale;
  assert.ok(Math.abs(cy-ny)<1e-9);
  assert.equal(next.adjusted,adjusted);
 }
});
test('Zoom stays within the existing limits after rotation',()=>{
 const land=camAt(1280,800);
 const huge={...F.place({width:1280,height:800},land.fit*10,800,400),scale:land.fit*10,fit:land.fit,width:1280,height:800,adjusted:true};
 const r=F.resize({prev:huge,next:{width:800,height:1280},W,H,content});
 assert.ok(r.scale<=r.fit*3+1e-12);
});
test('Panels only pan the village: beside a docked panel, above a bottom sheet',()=>{
 const scale=.6;
 const docked=F.frameAround({width:1280,height:800,scale,content,W,H,panelWidth:632,top:56});
 const cx=content.x+content.w/2,cy=content.y+content.h/2;
 assert.ok(Math.abs(docked.x+cx*scale-(1280-632)/2)<1e-9);
 const sheet=F.frameAround({width:800,height:1280,scale,content,W,H,panelHeight:716,top:56});
 assert.ok(Math.abs(sheet.y+cy*scale-(56+(1280-716))/2)<1e-9);
 assert.ok(Math.abs(sheet.x+cx*scale-400)<1e-9);
});
test('app.js wires framing to resize, Home, pan and zoom without new gestures',()=>{
 const app=fs.readFileSync('js/app.js','utf8');
 assert.match(app,/framing\.resize\(\{prev,next:\{width:r\.width,height:r\.height\},W,H,content:villageContent\(\)\}\)/);
 assert.match(app,/state\.x\+=p\.x-v\.x;state\.y\+=p\.y-v\.y;state\.adjusted=true/);
 assert.match(app,/function zoom\(delta\)\{state\.adjusted=true;/);
 assert.match(app,/#home'\)\.onclick=\(\)=>\{resetCamera\(\);/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('js/camera-framing.js')<html.indexOf('js/app.js'));
});
