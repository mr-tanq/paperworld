'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createPokemonRepoReader}=require('../server/pokemon-repo-reader.cjs');
const {sourceCategory}=require('../server/pokemon-worker-delegation.cjs');
const TOKEN='gho_SyntheticPrivateOauthOnly1234',SHA='a'.repeat(40);
const godot='config_version=5\n[application]\nconfig/name="Pokemon Echoes"\n';
const gd='extends Node\nfunc inspect():\n\tpass\n';
function readerWithFixture(mutator){
 const calls=[];
 const reader=createPokemonRepoReader({fetcher:async(url,opts)=>{
  const file=decodeURIComponent(url.split('/contents/')[1].split('?')[0]);
  calls.push({file,url,opts});
  const content=file==='project.godot'?godot:gd;
  const item={type:'file',path:file,encoding:'base64',
   content:Buffer.from(content,'utf8').toString('base64'),
   size:Buffer.byteLength(content),sha:SHA};
  return {ok:true,json:async()=>mutator?mutator(item,file):item};
 }});
 return {reader,calls};
}
test('Pokémon Worker reads actual allowlisted GDScripts, not only project.godot',async()=>{
 const {reader,calls}=readerWithFixture();
 for(const category of ['core','battle','dialogue','map']){
  calls.length=0;
  const packet=await reader.readProjectFiles({token:TOKEN,category});
  assert.equal(packet.repository,'mr-tanq/pokemon-echoes');
  assert.equal(packet.ref,'main');assert.equal(packet.readOnly,true);
  assert.equal(packet.sourceUntrusted,true);
  assert.deepEqual(packet.files.map(x=>x.path),reader.GROUPS[category]);
  assert.ok(packet.files.some(x=>x.path.endsWith('.gd')));
  assert.ok(packet.files.every(x=>x.sha===SHA&&x.lines.startsWith('L1 ')));
  assert.equal(calls.length,reader.GROUPS[category].length);
  assert.ok(calls.every(x=>x.opts.method==='GET'&&x.opts.redirect==='error'&&
   x.url.startsWith('https://api.github.com/repos/mr-tanq/pokemon-echoes/contents/')&&
   x.opts.headers.Authorization==='Bearer '+TOKEN));
  assert.doesNotMatch(JSON.stringify(packet),/SyntheticPrivateOauthOnly/);
 }
});
test('No model/browser path injection or unregistered category is accepted',async()=>{
 const {reader,calls}=readerWithFixture();
 for(const category of ['../../.env','main','scripts/all.gd','wellbeing']){
  await assert.rejects(()=>reader.readProjectFiles({token:TOKEN,category}),
   /pokemon_source_unavailable/);
 }
 assert.equal(calls.length,0);
 await assert.rejects(()=>reader.readProjectFiles({token:'bad',category:'core'}),
  /pokemon_source_unavailable/);
});
test('Forged paths and malformed source fail before returning trusted packet',async()=>{
 for(const mutate of [
  item=>({...item,path:'../../secrets.env'}),
  item=>({...item,sha:'x'}),
  item=>({...item,size:30000}),
  item=>({...item,content:'not-base64'}),
  (item,file)=>file.endsWith('.gd')?{
   ...item,content:Buffer.from('not Godot script').toString('base64'),
   size:16}:item
 ]){
  const {reader}=readerWithFixture(mutate);
  await assert.rejects(()=>reader.readProjectFiles({token:TOKEN,category:'core'}),
   /pokemon_source_unavailable/);
 }
});
test('Request classification selects fixed code families without selecting arbitrary filenames',()=>{
 assert.equal(sourceCategory('Review battle catching'), 'battle');
 assert.equal(sourceCategory('Fix dialogue choices'), 'dialogue');
 assert.equal(sourceCategory('Improve Alder Town collisions'), 'map');
 assert.equal(sourceCategory('Improve player speed'), 'core');
 assert.equal(sourceCategory('Έλεγξε τις μάχες'), 'battle');
 const worker=fs.readFileSync('server/pokemon-worker-delegation.cjs','utf8');
 assert.match(worker,/readProjectFiles\(\{token:githubToken,category\}\)/);
 assert.match(worker,/files\.map\(f=>\(\{path:f\.path,sha:f\.sha/);
 assert.match(worker,/!reader\.GROUPS\[category\]\.includes\(f\.path\)/);
 assert.match(worker,/budgetVerified/);
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/έως τρία προκαθορισμένα/);
 assert.match(ui,/GDScript/);
});
