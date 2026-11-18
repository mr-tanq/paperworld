'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeChatCredential}=require('../server/matt-durable-credential.cjs');
const {createSafeSessionConfig}=require('../server/matt-session-config.cjs');
const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const PAT='github_pat_'+'T'.repeat(40);
test('owner-only durable PAT survives a fresh process construction and needs no OAuth cache',async()=>{
 const oauth={getLinkedToken:()=>null};
 for(let i=0;i<2;i++){
  const resolver=makeChatCredential({oauth,ownerId:OWNER,token:PAT});
  assert.equal(resolver.enabled,true);
  assert.equal(resolver.getLinkedToken({ownerId:OWNER}),PAT);
  assert.equal(resolver.getLinkedToken({ownerId:OTHER}),null);
  assert.equal(resolver.getLinkedToken({ownerId:null}),null);
  const config=createSafeSessionConfig({model:'gpt-4.1',gitHubToken:PAT,probeMinimal:true});
  assert.deepEqual(config.availableTools,[]);
  assert.equal((await resolver.chatStatus({headers:{authorization:'Bearer fake'},
   authenticate:async()=>OWNER})),true);
  assert.equal((await resolver.chatStatus({authenticate:async()=>OTHER})),false);
 }
});
test('bad, classic or mismatched credentials fail closed to ordinary OAuth only',async()=>{
 const oauth={getLinkedToken:({ownerId})=>ownerId===OWNER?'gho_EXISTING_OAUTH_TOKEN':null};
 for(const token of ['',undefined,'ghp_classic_personal_token','github_pat_short']){
  const resolver=makeChatCredential({oauth,ownerId:OWNER,token});
  assert.equal(resolver.enabled,false);
  assert.equal(resolver.getLinkedToken({ownerId:OWNER}),'gho_EXISTING_OAUTH_TOKEN');
  assert.equal(await resolver.chatStatus({authenticate:async()=>OWNER}),false);
 }
 assert.throws(()=>createSafeSessionConfig({model:'gpt-4.1',
  gitHubToken:'ghp_CLASSIC_TOKEN',probeMinimal:true}),/Invalid trusted session/);
});
test('durable chat permission never creates a repository write token',()=>{
 const source=require('node:fs').readFileSync('server/render-matt.cjs','utf8');
 assert.match(source,/chatFactory\(\{oauth:getChatCredential\(\)\}\)/);
 assert.match(source,/directorChatFactory\(\{oauth:getChatCredential\(\)\}\)/);
 assert.match(source,/delegationFactory\(\{oauth:getChatCredential\(\)\}\)/);
 assert.match(source,/pokemonWorkerFactory\(\{oauth,pokemonProposalStore/);
 assert.match(source,/proposalApiFactory\(\{oauth,/);
 assert.doesNotMatch(source,/workerFactory\(\{oauth:getChatCredential/);
 const ui=require('node:fs').readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/link\.chatConnected===true/);
});
