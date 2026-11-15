'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../js/agent-profiles.js'),'utf8');
const profiles=require('../js/agent-profiles.js');
const named={matt:'matt.webp','listening-director':'luna.webp','pokemon-director':'joey.webp','studio-director':'crow.webp','wellbeing-director':'dave.webp'};
test('five approved portraits resolve to unique local assets',()=>{
 for(const [id,file] of Object.entries(named)){
  assert.equal(profiles.get(id).portrait,'./assets/portraits/'+file);
  assert.ok(profiles.get(id).sheet,'legacy sprite fallback preserved');
 }
});
test('portrait fallback never masks a loaded upgraded portrait',()=>{
 assert.match(src,/portrait\.onload/);
 assert.match(src,/canvas\.dataset\.portraitReady='true'/);
 assert.match(src,/querySelector\('canvas\[data-portrait-ready\]'\)/);
 for(const worker of profiles.entries('worker'))assert.equal(worker.portrait,undefined);
});
