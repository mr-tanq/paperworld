'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {createSunoOAuthClient}=require('../server/suno-oauth-client.cjs');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer abcdefghijklmnop'};
const body=JSON.stringify({agentId:'studio-director',threadId});
const identity={authenticate:async()=>({ownerId}),
 ownsThread:async q=>q.ownerId===ownerId&&q.threadId===threadId&&q.agentId==='studio-director'};
const issuer='https://accounts.suno.com';
const metadata={issuer,client_id_metadata_document_supported:true,
 response_types_supported:['code'],code_challenge_methods_supported:['S256'],
 authorization_endpoint:issuer+'/oauth/authorize',token_endpoint:issuer+'/oauth/token'};
const discovery={inspect:async()=>({metadataAvailable:true,authorizationServers:[issuer]})};
function setup({metadataResponse=metadata,discover=discovery,toolResponse,
 claimReady={ready:true,reason:'claim_storage_ready'}}={}){
 let reads=0,toolCalls=0;
 const client=createSunoOAuthClient({identity,discovery:discover,
  sunoClaim:{ready:async()=>claimReady,reserve:async()=>{throw Error('no paid call in diagnostics')}},
  fetcher:async(url,options)=>{
   if(options.method==='GET'){reads++;return {
    status:200,headers:{get:()=> 'application/json'},
    text:async()=>JSON.stringify(metadataResponse)};}
   if(options.method==='POST')return {
    status:200,headers:{get:()=> 'application/json'},
    text:async()=>JSON.stringify({access_token:'super-secret-test-token-123',
      token_type:'Bearer',expires_in:600})};
   throw Error('unexpected request');
  },toolProbe:{inspect:async ({accessToken})=>{
   assert.equal(accessToken,'super-secret-test-token-123');toolCalls++;
   return toolResponse||{available:true,toolCount:2,tools:['create_song','credits_balance']};
  }}});
 return {client,reads:()=>reads,toolCalls:()=>toolCalls};
}
test('diagnosis shows provider metadata and registration without pretending user is connected',async()=>{
 const x=setup(),result=await x.client.diagnose({headers,body});
 assert.deepEqual(result.body,{service:'suno_mcp',resourceAvailable:true,
  clientRegistrationSupported:true,oauthAuthorized:false,
  toolsListed:false,toolCount:0,toolTransport:'unverified',toolReason:'not_authorized',
  audioCreate:{compatible:false,reason:'not_authorized',paramHeaders:[]},
  createClaimReady:true,createClaimReason:'claim_storage_ready',
  canGenerate:false,nextStep:'owner_oauth_required'});
 assert.equal(x.toolCalls(),0);
 assert.ok(x.reads()>0);
 assert.doesNotMatch(JSON.stringify(result),/secret/);
});
test('after simulated OAuth diagnosis verifies tool list but never enables generation',async()=>{
 const x=setup();
 const start=await x.client.start({headers,body});
 const state=new URL(start.body.authorizationUrl).searchParams.get('state');
 assert.equal((await x.client.callback({url:'/auth/suno/callback?state='+state+
  '&code=abcdefghi12345'})).status,302);
 const response=await x.client.diagnose({headers,body});
 assert.deepEqual(response.body,{service:'suno_mcp',resourceAvailable:true,
  clientRegistrationSupported:true,oauthAuthorized:true,
  toolsListed:true,toolCount:2,toolTransport:'unverified',toolReason:'read_only_tools_verified',
  audioCreate:{compatible:false,reason:'audio_create_not_listed',paramHeaders:[]},
  createClaimReady:true,createClaimReason:'claim_storage_ready',
  canGenerate:false,nextStep:'audio_create_contract_unverified'});
 assert.equal(x.toolCalls(),1);
 assert.doesNotMatch(JSON.stringify(response),/super-secret/);
});
test('unsafe metadata and unauthorized user fail closed',async()=>{
 const x=setup({metadataResponse:{...metadata,client_id_metadata_document_supported:false}});
 const response=await x.client.diagnose({headers,body});
 assert.equal(response.body.clientRegistrationSupported,false);
 assert.equal(response.body.nextStep,'client_registration_unverified');
 assert.equal((await x.client.diagnose({headers:{...headers,origin:'https://evil.example'},body})).status,403);
 assert.equal(x.toolCalls(),0);
});
test('diagnostic UI never exposes any generation or tool-call route',()=>{
 const router=fs.readFileSync('server/render-matt.cjs','utf8');
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(router,/\/auth\/suno\/diagnose/);
 assert.match(ui,/diagnoseSunoConnection/);
 assert.doesNotMatch(router,/\/suno\/crow\/execute/);
 assert.doesNotMatch(ui,/GENERATE_WITH_SUNO_CREDITS/);
});

test('diagnose preserves only allowlisted failure categories after OAuth',async()=>{
 const x=setup({toolResponse:{available:false,reason:'authorization_rejected',
  providerPayload:'secret-provider-payload'}});
 const start=await x.client.start({headers,body});
 const state=new URL(start.body.authorizationUrl).searchParams.get('state');
 await x.client.callback({url:'/auth/suno/callback?state='+state+'&code=abcdefghi12345'});
 const result=await x.client.diagnose({headers,body});
 assert.equal(result.body.toolReason,'authorization_rejected');
 assert.equal(result.body.toolsListed,false);
 assert.equal(result.body.canGenerate,false);
 assert.doesNotMatch(JSON.stringify(result.body),/secret-provider-payload|access.token/i);
});
test('unknown error reasons are never echoed into the browser',async()=>{
 const x=setup({toolResponse:{available:false,
  reason:'SECRET provider token=1234567890'}});
 const start=await x.client.start({headers,body});
 const state=new URL(start.body.authorizationUrl).searchParams.get('state');
 await x.client.callback({url:'/auth/suno/callback?state='+state+'&code=abcdefghi12345'});
 const result=await x.client.inspectTools({headers,body});
 assert.equal(result.body.reason,'mcp_capability_unverified');
 assert.doesNotMatch(JSON.stringify(result.body),/SECRET|1234567890/);
});
