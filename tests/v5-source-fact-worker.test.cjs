'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeSourceFactWorker,CONSENT,listeningCategory}=require('../server/v5-source-fact-worker.cjs');
const ownerId='11111111-1111-4111-8111-111111111111',
 threadId='22222222-2222-4222-8222-222222222222',
 requestId='33333333-3333-4333-8333-333333333333';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer '+('a'.repeat(32))};
const makeBody=(project='pokemon')=>JSON.stringify({threadId,requestId,project,
 consent:CONSENT,message:'Check project files'});
function harness({matched=true,throwRead=false,configured=true}={}){
 const calls={ai:0,listing:0,pokemon:0,claim:0,finish:0,verify:0};
 const worker=makeSourceFactWorker({
  oauth:{getLinkedToken:({ownerId:o})=>o===ownerId?'gho_testingtokenxxxxxxxxxxxx':null},
  guard:{authenticate:async()=>({ownerId}),ownsThread:async()=>true},
  handoffs:{configured,verifyWorkerRequest:async()=>{calls.verify++;return {matched}}},
  journal:{configured,claim:async()=>{calls.claim++},finish:async()=>{calls.finish++}},
  listing:{FILES:{general:['README.md'],artwork:[],ticketing:[]},
   read:async()=>{calls.listing++;return {repository:'mr-tanq/concerts',
    ref:'main',readOnly:true,files:[{path:'README.md',sha:'a'.repeat(40)}]}}},
  pokemon:{readProjectConfig:async()=>{
   calls.pokemon++;if(throwRead)throw Error('read failed');
   return {repository:'mr-tanq/pokemon-echoes',ref:'main',
    path:'project.godot',sha:'b'.repeat(40),readOnly:true};
  }}
 });
 return {worker,calls};
}
test('Pokémon zero-model worker completes real fixed GitHub read with durable receipt',async()=>{
 const {worker,calls}=harness();
 const result=await worker.handle({headers,body:makeBody()});
 assert.equal(result.status,200);
 assert.equal(result.body.modelCalls,0);
 assert.equal(result.body.changedFiles,0);
 assert.equal(result.body.createdPR,false);
 assert.equal(result.body.evidence.files[0].path,'project.godot');
 assert.equal(calls.claim,1);assert.equal(calls.finish,1);
 assert.equal(calls.pokemon,1);assert.equal(calls.listing,0);
});
test('Listening Worker reads only pre-allowlisted source category, with no Copilot',async()=>{
 const {worker,calls}=harness();
 const result=await worker.handle({headers,body:makeBody('listening')});
 assert.equal(result.status,200);
 assert.equal(result.body.modelCalls,0);
 assert.equal(result.body.evidence.files[0].path,'README.md');
 assert.equal(calls.listing,1);
});
test('Cannot read without real saved handoff, durable store or exact owner consent',async()=>{
 for(const opts of [{matched:false},{configured:false}]){
  const {worker,calls}=harness(opts);
  const r=await worker.handle({headers,body:makeBody()});
  assert.notEqual(r.status,200);
  assert.equal(calls.claim,0);assert.equal(calls.pokemon,0);
 }
 const {worker,calls}=harness();
 const bad=JSON.parse(makeBody());bad.consent='none';
 assert.equal((await worker.handle({headers,body:JSON.stringify(bad)})).status,400);
 assert.equal((await worker.handle({headers:{...headers,origin:'https://evil.invalid'},
  body:makeBody()})).status,403);
 assert.equal(calls.claim,0);
});
test('Failed source read has a failure receipt; never retries, writes or invokes a model',async()=>{
 const {worker,calls}=harness({throwRead:true});
 assert.equal((await worker.handle({headers,body:makeBody()})).status,503);
 assert.equal(calls.claim,1);assert.equal(calls.finish,1);
 const s=fs.readFileSync('server/v5-source-fact-worker.cjs','utf8');
 assert.doesNotMatch(s,/sendAndWait\(|createPullRequest\(|writeFile\(|tools\/call/);
});
test('No browser/model-controlled repository URL, host, branch or file path',()=>{
 assert.equal(listeningCategory('Festival poster'), 'artwork');
 assert.equal(listeningCategory('Ticketswap API'), 'ticketing');
 assert.equal(listeningCategory('Change a battle scene'), 'general');
 const api=fs.readFileSync('server/v5-source-fact-worker.cjs','utf8');
 assert.match(api,/await journal\.claim/);
 assert.match(api,/existing\?\.matched!==true/);
 assert.match(api,/listing\.FILES\[category\]\.includes/);
 assert.match(api,/unverified_pokemon_source/);
});
test('A real owner-authenticated API route and both Work Hub and Messenger actions are wired',()=>{
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 const browser=fs.readFileSync('js/cloud.js','utf8');
 const ui=fs.readFileSync('js/cloud-ui.js','utf8');
 const hub=fs.readFileSync('js/human-first-hub.js','utf8');
 const dialog=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(server,/\/delegate\/matt\/source-facts/);
 assert.match(browser,/V5_ONE_READ_ONLY_SOURCE_CHECK_NO_AI/);
 assert.match(ui,/runApprovedSourceFact/);
 assert.match(hub,/Έλεγχος πηγών · χωρίς AI/);
 assert.match(dialog,/runSourceFact:async item=>/);
});
