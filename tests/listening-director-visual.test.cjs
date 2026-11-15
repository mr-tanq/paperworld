'use strict';
const assert=require('node:assert/strict');
const test=require('node:test'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Listening Mirror Director uses a transparent 4x4 sprite atlas',()=>{
 const png=fs.readFileSync(path.join(root,'assets/listening-director-walk-v1.png'));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),128);
 assert.equal(png.readUInt32BE(20),192);
 assert.ok(png.includes(Buffer.from('tRNS')),'sprite palette must have transparency');
});
test('Listening Mirror Director is rendered as sprite with fallback; agent identity unchanged',()=>{
 const s=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(s,/a.id==='listening-director' && drawListeningDirectorSprite\(a\)/);
 assert.match(s,/listeningDirectorVisual.src='\.\/assets\/listening-director-walk-v1.png'/);
 assert.match(s,/a\.moving\?Math\.floor\(\(a\.walkDistance\|\|0\)\/14\)%4:1/);
 assert.match(s,/a\.moving=traveled>0\.25/);
 assert.match(s,/depth\.sortLayers\(layers\)/);
 assert.match(s,/id:'listening-director'/);
});
