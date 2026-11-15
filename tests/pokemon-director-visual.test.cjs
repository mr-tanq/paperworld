'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
test('Pokémon Game Architect sprite has 16 transparent frames in 4 directional rows',()=>{
 const img=fs.readFileSync(path.join(root,'assets/pokemon-director-walk-hq-v2.png'));
 assert.equal(img.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(img.readUInt32BE(16),256);
 assert.equal(img.readUInt32BE(20),352);
 assert.ok(img.includes(Buffer.from('tRNS')),'transparent PNG expected');
});
test('Existing pokemon-director uses animated visual fallback and stable AI identity',()=>{
 const s=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(s,/pokemon:'pokemon-director'/);
 assert.match(s,/pokemonDirectorVisual.src='\.\/assets\/pokemon-director-walk-hq-v2.png'/);
 assert.match(s,/if\(a.id==='pokemon-director' && drawPokemonDirectorSprite\(a\)\)return/);
 assert.match(s,/Math\.floor\(\(a\.walkDistance\|\|0\)\/14\)%4:1/);
 assert.match(s,/a\.moving=traveled>0\.25/);
 assert.match(s,/depth\.sortLayers\(layers\)/);
});
