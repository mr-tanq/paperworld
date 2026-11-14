'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),test=require('node:test');
const root=path.join(__dirname,'..');
test('Matt v3 sprite PNG is 4x4 and has transparency',()=>{
 const buf=fs.readFileSync(path.join(root,'assets/matt-walk-v3.png'));
 assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(buf.readUInt32BE(16),128);
 assert.equal(buf.readUInt32BE(20),176);
 assert.ok(buf.includes(Buffer.from('tRNS')));
});
test('Matt v3 has stepping pose and ground-relative timing, preserving depth and chat',()=>{
 const s=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(s,/matt-walk-v3\.png/);
 assert.match(s,/Math\.floor\(\(a\.walkDistance\|\|0\)\/14\)%4/);
 assert.match(s,/mattActor\.walkDistance\+=move/);
 assert.match(s,/a\.moving\?Math\.floor/);
 assert.match(s,/depth\.sortLayers\(layers\)/);
 assert.match(s,/PaperworldWorldDialogue/);
 assert.doesNotMatch(s,/Math\.floor\(now\/145\)%4/);
});
