'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Human visitor has a transparent 4-direction 4-pose PNG sprite',()=>{
 const p=fs.readFileSync(path.join(root,'assets/player-walk-v1.png'));
 assert.equal(p.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(p.readUInt32BE(16),128);
 assert.equal(p.readUInt32BE(20),176);
 assert.ok(p.includes(Buffer.from('tRNS')),'player PNG requires palette alpha');
});
test('Player uses Matt v3 distance gait without interfering with AI orchestration',()=>{
 const js=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(js,/playerVisual.src='\.\/assets\/player-walk-v1\.png'/);
 assert.match(js,/Math\.floor\(p\.walkDistance\/14\)%4/);
 assert.match(js,/player\.walkDistance\+=step/);
 assert.match(js,/player\.direction=mattDirection\(dx,dy,player\.direction\)/);
 assert.match(js,/if\(!drawPlayerSprite\(w\)\)drawFigure\(w\)/);
 assert.match(js,/depth\.sortLayers\(layers\)/);
 assert.match(js,/mattActor\.walkDistance\+=step/);
});
