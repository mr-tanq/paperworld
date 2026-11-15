'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Shared HD trio atlas has exact 4x12 geometry and palette transparency',()=>{
 const b=fs.readFileSync(path.join(root,'assets/characters-hq-v2.png'));
 assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(b.readUInt32BE(16),256);assert.equal(b.readUInt32BE(20),1056);
 assert.ok(b.includes(Buffer.from('tRNS')),'Atlas must use alpha transparency');
 assert.ok(b.length>35000,'Do not replace detailed atlas with tiny placeholder');
});
test('All three retain movement, visual fallbacks and stable identities',()=>{
 const s=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(s,/charactersHD\.src='\.\/assets\/characters-hq-v1\.png'/);
 assert.match(s,/drawHDCharacter\(p,0,'You'\)/);
 assert.match(s,/drawHDCharacter\(a,1,'Matt'\)/);
 assert.match(s,/drawHDCharacter\(a,2,'Director'\)/);
 assert.match(s,/Math\.floor\(\(a\.walkDistance\|\|0\)\/14\)%4/);
 assert.match(s,/ctx\.imageSmoothingQuality='high'/);
 assert.match(s,/if\(a\.id==='listening-director' && drawListeningDirectorSprite\(a\)\)return/);
 assert.match(s,/if\(a\.id==='matt' && drawMattSprite\(a,now\)\)return/);
 assert.match(s,/if\(!drawPlayerSprite\(w\)\)drawFigure\(w\)/);
 assert.match(s,/depth\.sortLayers\(layers\)/);
});
