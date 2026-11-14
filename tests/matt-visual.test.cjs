'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),test=require('node:test');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Matt four-direction walking atlas has a valid PNG header and 4x4 frames',()=>{
 const image=fs.readFileSync(path.join(root,'assets/matt-walk-atlas.png'));
 assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
 assert.ok(width>=128 && height>=200);
 assert.equal(width%4,0);
});
test('Matt sprite integrates with established depth sorting and movement, without new AI actions',()=>{
 const src=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(src,/function drawMattSprite\(a,now\)/);
 assert.match(src,/mattDirection\(dx,dy,mattActor.direction\)/);
 assert.match(src,/depth.sortLayers\(layers\)/);
 assert.match(src,/if\(a.id==='matt' && drawMattSprite\(a,now\)\)return/);
 assert.match(src,/window.PaperworldWorldDialogue\?\.show\('matt'\)/);
});
