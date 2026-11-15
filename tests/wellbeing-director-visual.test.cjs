'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
test('Wellbeing Director visual is a complete transparent 4x4 sprite atlas',()=>{
 const png=fs.readFileSync(path.join(root,'assets/wellbeing-director-walk-hq-v1.png'));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),128);
 assert.equal(png.readUInt32BE(20),176);
 assert.ok(png.includes(Buffer.from('tRNS')));
});
test('Existing wellbeing-director renders without changing AI identity or creating patrol routes',()=>{
 const src=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(src,/wellbeing:'wellbeing-director'/);
 assert.match(src,/wellbeingDirectorVisual.src='\.\/assets\/wellbeing-director-walk-hq-v1.png'/);
 assert.match(src,/a.id==='wellbeing-director' && drawWellbeingDirectorSprite\(a\)/);
 assert.match(src,/Math\.floor\(\(a\.walkDistance\|\|0\)\/14\)%4:1/);
 assert.match(src,/a\.moving=traveled>0\.25/);
 assert.match(src,/depth\.sortLayers\(layers\)/);
});
