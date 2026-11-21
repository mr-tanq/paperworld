'use strict';
// Follow camera (close-up on Matt's walk, owner kept in view) and evening light.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const F=require('../js/camera-framing.js'),A=require('../js/village-ambience.js');
test('followStep zooms around the target, centres it in the visible region, never shows beyond the world',()=>{
 let c={x:0,y:0,scale:.5};const view={left:0,top:56,right:800,bottom:700},world={W:1671,H:941};
 for(let i=0;i<200;i++)c=F.followStep({cam:c,target:{x:835,y:850},view,scale:1.1,k:.1,world});
 assert.ok(Math.abs(c.scale-1.1)<.01);
 assert.ok(c.y>=view.bottom-world.H*c.scale-1e-6&&c.y<=view.top+1e-6,'clamped vertically');
 assert.ok(c.x>=view.right-world.W*c.scale-1e-6&&c.x<=view.left+1e-6,'clamped horizontally');
 // Without zoom, a target inside the comfort box does not move the camera.
 const still=F.followStep({cam:{x:-100,y:-100,scale:1},target:{x:500,y:470},view,k:.5});
 assert.deepEqual([still.x,still.y],[-100,-100]);
});
test('the camera close-up yields to the owner and to panels',()=>{
 const app=fs.readFileSync('js/app.js','utf8');
 assert.match(app,/follow\.pausedUntil=performance\.now\(\)\+4000;follow\.cinematic=null/);
 assert.match(app,/follow\.cinematic=null;follow\.restoreAt=0;/);
 assert.match(app,/followCamera\(dt,now\);\n draw\(now\)/);
 assert.match(app,/const JOURNEY_MODES=\['outbound','meeting','returning'\]/);
});
test('evening light follows local time and can be previewed',()=>{
 const at=h=>{const d=new Date('2026-11-21T00:00:00');d.setHours(Math.floor(h),Math.round((h%1)*60));return d};
 assert.equal(A.darkness(at(12)),0);assert.equal(A.darkness(at(22)),1);assert.equal(A.darkness(at(3)),1);
 assert.ok(A.darkness(at(18.25))>.4&&A.darkness(at(18.25))<.6,'dusk ramps');
 assert.ok(A.darkness(at(6.75))>.4&&A.darkness(at(6.75))<.6,'dawn ramps');
 assert.equal(Object.keys(A.WINDOWS).length,5);assert.ok(A.LAMPS.length>=6);
 assert.match(fs.readFileSync('js/app.js','utf8'),/q\.get\('night'\)==='1'\?\{dark:1,night:true\}/);
});
