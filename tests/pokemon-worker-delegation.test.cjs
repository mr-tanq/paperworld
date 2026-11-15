'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makePokemonWorkerDelegation,CONSENT}=require('../server/pokemon-worker-delegation.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer aaaaa.bbbbb.ccccc'};
const payload={threadId,requestId,message:'Review current Godot project and recommend next safe step',
 projectDirector:'pokemon-director',consent:CONSENT};
const mockSource={
 repository:'mr-tanq/pokemon-echoes',ref:'main',path:'project.godot',
 readOnly:true,sourceUntrusted:true,sha:'a'.repeat(40),
 lines:'L1 config_version=5\nL2 [application]\nL3 config/name="Pokemon Echoes"'
};
function fixture({owns=true,budget=true,linked=true,failTurn=0,source=mockSource,
 memoryFail=false,readFail=false}={}){
 const seen={prompts:[],turns:0,reads:0,configs:[],stopped:0,identities:[]};
 const gateway=makePokemonWorkerDelegation({
  oauth:{getLinkedToken:()=>linked?'gho_SYNTHETIC_TOKEN_ONLY':null},
  guard:{authenticate:async token=>{seen.identities.push(token);return {ownerId:owner}},
   ownsThread:async()=>owns},
  budgetVerified:async()=>budget,
  reader:{readProjectConfig:async({token})=>{
   seen.reads++;seen.readerToken=token;
   if(readFail)throw Error('PRIVATE_REPO_NOT_ACCESSIBLE');
   return source;
  }},
  memoryLoader:{load:async args=>{
   seen.memoryArgs=args;
   if(memoryFail)throw Error('SENSITIVE_OTHER_PROJECT');
   return {actor:'pokemon-director',projectId:'pokemon',included:1,
    text:'OWNER_APPROVED_POKEMON_NOTE',capabilitiesGranted:[],untrustedContent:true};
  }},
  clientFactory:async args=>{
   seen.options=args;
   return {
    start:async()=>{},
    listModels:async()=>[{id:'model-x',billing:{tokenPrices:{
     inputPrice:1,outputPrice:2,batchSize:1000}}}],
    createSession:async config=>{
     seen.configs.push(config);
     return {sendAndWait:async({prompt})=>{
      seen.turns++;seen.prompts.push(prompt);
      if(failTurn===seen.turns)throw Error('PRIVATE_TOKEN_EXCEPTION');
      return {data:{content:['Matt: scope only Godot config',
       'Director: project.godot only','Worker observed L1 and L2 from project.godot',
       'Director verifies L1, L2; no scenes inspected',
       'Matt: read-only review, no code changes'][seen.turns-1]}};
     },disconnect:async()=>{}};
    },stop:async()=>{seen.stopped++}
   }
  },
  diagnostic:stage=>seen.diagnostic=stage
 });
 return {gateway,seen};
}
const body=data=>JSON.stringify(data);
test('Owner-approved Pokémon worker chain uses five tool-free turns and scoped private source',async()=>{
 const {gateway,seen}=fixture();
 const result=await gateway.handle({headers,body:body(payload)});
 assert.equal(result.status,200);
 assert.equal(result.body.delegated,true);
 assert.equal(result.body.attemptedAiTurns,5);
 assert.equal(result.body.directorId,'pokemon-director');
 assert.equal(result.body.workerId,'pokemon-developer');
 assert.equal(result.body.execution,'read_only_analysis');
 assert.equal(result.body.persisted,false);
 assert.equal(result.body.evidence.repository,'mr-tanq/pokemon-echoes');
 assert.deepEqual(result.body.evidence.files.map(f=>f.path),['project.godot']);
 assert.equal(seen.turns,5);
 assert.equal(seen.reads,1);
 assert.equal(seen.readerToken,'gho_SYNTHETIC_TOKEN_ONLY');
 assert.equal(seen.memoryArgs.actor,'pokemon-director');
 assert.equal(seen.memoryArgs.ownerId,owner);
 assert.match(seen.prompts[1],/OWNER_APPROVED_POKEMON_NOTE/);
 assert.doesNotMatch(seen.prompts[2],/OWNER_APPROVED_POKEMON_NOTE/);
 assert.match(seen.prompts[2],/L1 config_version=5/);
 assert.match(seen.prompts[2],/UNTRUSTED DATA/);
 assert.match(seen.prompts[3],/OWNER_APPROVED_POKEMON_NOTE/);
 assert.doesNotMatch(seen.prompts[0],/OWNER_APPROVED_POKEMON_NOTE/);
 assert.doesNotMatch(JSON.stringify(result.body),/gho_SYNTHETIC_TOKEN_ONLY/);
 for(const c of seen.configs){
  assert.deepEqual(c.availableTools,[]);
  assert.deepEqual(await c.onPermissionRequest(),{kind:'reject'});
 }
});
test('No OAuth, auth, budget or exact consent means zero AI calls and no source reads',async()=>{
 for(const opts of [{owns:false},{budget:false},{linked:false}]){
  const {gateway,seen}=fixture(opts);
  const response=await gateway.handle({headers,body:body(payload)});
  assert.ok([403,404,409].includes(response.status));
  assert.equal(seen.turns,0);assert.equal(seen.reads,0);
 }
 for(const changes of [
  {projectDirector:'listening-director'},
  {projectDirector:'auto'},{consent:'MATT_DIRECTOR_WORKER_UP_TO_FIVE_AI_TURNS'},
  {consent:undefined},{threadId:'invalid'}
 ]){
  const {gateway,seen}=fixture();
  const r=await gateway.handle({headers,body:body({...payload,...changes})});
  assert.equal(r.status,400);assert.equal(seen.turns,0);assert.equal(seen.reads,0);
 }
});
test('Source errors fail closed before Worker model, without private content leaks',async()=>{
 for(const opts of [{readFail:true},{source:{...mockSource,repository:'mr-tanq/concerts'}},
  {source:{...mockSource,path:'secrets.env'}},{source:{...mockSource,sha:'invalid'}}]){
  const {gateway,seen}=fixture(opts);
  const r=await gateway.handle({headers,body:body(payload)});
  assert.equal(r.status,503);
  assert.equal(r.body.stage,'repository_read');
  assert.equal(r.body.attemptedAiTurns,2);
  assert.equal(seen.turns,2);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_REPO|secrets.env|gho_/);
 }
});
test('Memory lookup errors fail before any model calls; source and other projects remain private',async()=>{
 const {gateway,seen}=fixture({memoryFail:true});
 const r=await gateway.handle({headers,body:body(payload)});
 assert.equal(r.status,503);
 assert.equal(r.body.stage,'approved_memory_read');
 assert.equal(r.body.attemptedAiTurns,0);
 assert.equal(seen.turns,0);assert.equal(seen.reads,0);
 assert.doesNotMatch(JSON.stringify(r),/SENSITIVE_OTHER_PROJECT/);
});
test('Replay and origin checks, no automatic second charge',async()=>{
 const {gateway,seen}=fixture();
 const first=await gateway.handle({headers,body:body(payload)});
 assert.equal(first.status,200);
 const again=await gateway.handle({headers,body:body(payload)});
 assert.equal(again.status,409);
 assert.equal(seen.turns,5);
 const wrong=await gateway.handle({headers:{...headers,origin:'https://evil.example'},body:body(payload)});
 assert.equal(wrong.status,403);
});
