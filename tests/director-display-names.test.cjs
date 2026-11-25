'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');

test('four director display names match their existing stable agent ids',()=>{
 const expected={
  'listening-director':'Luna',
  'pokemon-director':'Joey',
  'wellbeing-director':'Dave',
  'studio-director':'Crow'
 };
 for(const [id,label] of Object.entries(expected)){
  assert.ok(script.includes("'"+id+"':'"+label+"'"),id+' should be named '+label);
 }
 assert.match(script,/function actorDisplayName\(actor\)/);
 assert.match(script,/actor\.id==='matt'\?'Matt'/);
});

test('all sprite renderers and fallback use the display name, not generic Director',()=>{
 assert.match(script,/drawHDCharacter\(a,2,actorDisplayName\(a\)\)/);
 const matches=script.match(/ctx\.fillText\(actorDisplayName\(a\),a\.x,a\.y\+14\)/g)||[];
 assert.equal(matches.length,5);
 assert.match(script,/ctx\.fillText\(actorDisplayName\(a\),a\.x,a\.y\+23\)/);
 for(const fn of ['drawListeningDirectorSprite','drawPokemonDirectorSprite','drawWellbeingDirectorSprite','drawStudioDirectorSprite','drawShopDirectorSprite'])assert.ok(script.includes('function '+fn+'(a)'));
});
