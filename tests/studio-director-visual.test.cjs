'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'..');
test('Studio Director visual sheet is transparent, 4x4 and source-scale',()=>{
 const buf=fs.readFileSync(path.join(root,'assets/studio-director-hooded-v1.png'));
 assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(buf.readUInt32BE(16),256);
 assert.equal(buf.readUInt32BE(20),352);
 assert.ok(buf.includes(Buffer.from('tRNS')),'indexed PNG must have transparency');
});
test('Existing studio-director uses hooded art, distance-driven poses and fallback',()=>{
 const s=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(s,/studio:'studio-director'/);
 assert.match(s,/studioDirectorVisual.src='\.\/assets\/studio-director-hooded-v2\.png'/);
 assert.match(s,/a.id==='studio-director' && drawStudioDirectorSprite\(a\)/);
 assert.match(s,/Math\.floor\(\(a\.walkDistance\|\|0\)\/14\)%4:1/);
 assert.match(s,/a\.moving=traveled>0\.25/);
 assert.match(s,/depth\.sortLayers\(layers\)/);
});

test('Studio v2 contains an upgraded transparent 4x4 animation atlas',()=>{
 const buf=fs.readFileSync(path.join(root,'assets/studio-director-hooded-v2.png'));
 assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(buf.readUInt32BE(16),384);
 assert.equal(buf.readUInt32BE(20),528);
 assert.ok(buf.includes(Buffer.from('tRNS')),'v2 palette must preserve transparent background');
 const s=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(s,/studioDirectorVisual.naturalWidth!==384 \|\| studioDirectorVisual.naturalHeight!==528/);
 assert.match(s,/const row=\{down:0,right:1,up:2,left:3\}\[a.direction\]\?\?0/);
 assert.match(s,/const sw=96,sh=132,dw=60,dh=88/);
});
