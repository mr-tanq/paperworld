'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const test=require('node:test');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Matt v2 uses a valid exactly 4x4 transparent PNG atlas',()=>{
 const png=fs.readFileSync(path.join(root,'assets/matt-walk-v2.png'));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),128);
 assert.equal(png.readUInt32BE(20),176);
 assert.equal(png[25],3); // indexed PNG; palette transparency in tRNS
 assert.ok(png.includes(Buffer.from('tRNS')));
});
test('Matt walking uses actual distance and holds a static pose at rest',()=>{
 const src=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(src,/matt-walk-v2\.png/);
 assert.match(src,/Math\.floor\(\(a\.walkDistance\|\|0\)\/16\)%4/);
 assert.match(src,/mattActor\.walkDistance\+=move/);
 assert.match(src,/mattActor\.moving=move>0\.25/);
 assert.doesNotMatch(src,/Math\.floor\(now\/145\)%4/);
 assert.match(src,/depth\.sortLayers\(layers\)/);
});
