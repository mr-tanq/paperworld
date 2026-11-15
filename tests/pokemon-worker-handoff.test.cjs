'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {preparePokemonWorkerHandoff,REPOSITORY}=require('../server/pokemon-worker-handoff.cjs');
const {createPokemonRepoReader}=require('../server/pokemon-repo-reader.cjs');
const {route,agent}=require('../js/agents.js');
const owner='11111111-1111-4111-8111-111111111111';
const task='22222222-2222-4222-8222-222222222222';
test('Only Pokémon Director may propose a Pokémon Worker assignment',()=>{
 assert.equal(route('matt','pokemon-director'),true);
 assert.equal(route('pokemon-director','pokemon-developer'),true);
 assert.equal(route('listening-director','pokemon-developer'),false);
 assert.equal(route('wellbeing-director','pokemon-developer'),false);
 assert.equal(route('pokemon-developer','matt'),false);
 assert.equal(agent('pokemon-developer').project,'pokemon');
 const plan=preparePokemonWorkerHandoff({taskId:task,ownerId:owner,
  request:'Inspect Alder Town and propose next story steps'});
 assert.equal(plan.repository,REPOSITORY);
 assert.equal(plan.projectId,'pokemon');
 assert.equal(plan.handoff.to,'pokemon-developer');
 assert.equal(plan.state,'proposed');
 assert.equal(plan.handoff.execution,'none');
 assert.equal(plan.readOnly,true);
 assert.equal(plan.modelCalls,0);
 assert.equal(plan.requiresHumanApproval,true);
 for(const capability of ['repository_write','draft_pr_create','shell_execution',
  'paid_ai','health_data_access'])assert.ok(plan.blocked.includes(capability));
});
test('Reject cross-project and invalid worker requests before planning',()=>{
 for(const bad of [
  {taskId:'invalid',ownerId:owner,request:'do work'},
  {taskId:task,ownerId:'invalid',request:'do work'},
  {taskId:task,ownerId:owner,request:''},
  {taskId:task,ownerId:owner,request:'x'.repeat(1201)},
  {taskId:task,ownerId:owner,request:'do work',operation:'deploy'}
 ])assert.throws(()=>preparePokemonWorkerHandoff(bad));
});
test('Read-only private repository fetch uses fixed host/path/ref and no token leakage',async()=>{
 let request;
 const token='gho_SYNTHETIC_TEST_OAUTH_ONLY';
 const raw='config_version=5\n\n[application]\nconfig/name="Pokemon Echoes"\n';
 const reader=createPokemonRepoReader({fetcher:async(url,opts)=>{
  request={url,opts};
  return {ok:true,status:200,json:async()=>({
   type:'file',path:'project.godot',encoding:'base64',
   content:Buffer.from(raw).toString('base64'),size:Buffer.byteLength(raw),
   sha:'a'.repeat(40)
  })};
 }});
 const result=await reader.readProjectConfig({token});
 assert.equal(request.opts.method,'GET');
 assert.equal(request.opts.redirect,'error');
 assert.equal(request.url,'https://api.github.com/repos/mr-tanq/pokemon-echoes/contents/project.godot?ref=main');
 assert.equal(request.opts.headers.Authorization,'Bearer '+token);
 assert.equal(result.repository,'mr-tanq/pokemon-echoes');
 assert.equal(result.readOnly,true);
 assert.match(result.lines,/L1 config_version=5/);
 assert.doesNotMatch(JSON.stringify(result),/gho_SYNTHETIC/);
});
test('Bad auth, missing GitHub file, oversized data or forged path fail closed',async()=>{
 const token='gho_SYNTHETIC_TEST_OAUTH_ONLY';
 const mk=(file,ok=true)=>createPokemonRepoReader({
  fetcher:async()=>({ok,status:ok?200:403,json:async()=>file})
 });
 const valid={type:'file',path:'project.godot',encoding:'base64',
  content:Buffer.from('config_version=5\n[application]').toString('base64'),
  size:Buffer.byteLength('config_version=5\n[application]'),sha:'a'.repeat(40)};
 await assert.rejects(mk(valid).readProjectConfig({token:'bad'}),/pokemon_source_unavailable/);
 await assert.rejects(mk(valid,false).readProjectConfig({token}),/pokemon_source_unavailable/);
 await assert.rejects(mk({...valid,path:'../../secret'}).readProjectConfig({token}),/pokemon_source_unavailable/);
 await assert.rejects(mk({...valid,size:9000}).readProjectConfig({token}),/pokemon_source_unavailable/);
 await assert.rejects(mk({...valid,content:'garbage'}).readProjectConfig({token}),/pokemon_source_unavailable/);
});
test('Pokémon Worker is not installed in the existing live API or auto draft PR publisher',()=>{
 const fs=require('node:fs');
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 const worker=fs.readFileSync('server/matt-worker-delegation.cjs','utf8');
 assert.doesNotMatch(server,/pokemon-worker-handoff/);
 assert.doesNotMatch(server,/pokemon-repo-reader/);
 assert.match(worker,/listening-director/);
 assert.doesNotMatch(worker,/pokemon-developer/);
});
