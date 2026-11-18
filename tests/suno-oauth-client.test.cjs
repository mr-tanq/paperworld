'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {createSunoOAuthClient,isSunoOrigin,validServerMeta,serverMetadataUrls,CLIENT_ID,CALLBACK}
 =require('../server/suno-oauth-client.cjs');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const headers={origin:'https://mr-tanq.github.io',
 authorization:'Bearer abcdefghijklmnop'};
const body=JSON.stringify({agentId:'studio-director',threadId});
const identity={authenticate:async()=>({ownerId}),
 ownsThread:async x=>x.ownerId===ownerId&&x.agentId==='studio-director'&&x.threadId===threadId};
const issuer='https://accounts.suno.com';
const discovery={inspect:async()=>({metadataAvailable:true,authorizationServers:[issuer]})};
const metadata={issuer,client_id_metadata_document_supported:true,
 code_challenge_methods_supported:['S256'],response_types_supported:['code'],
 authorization_endpoint:issuer+'/oauth/authorize',
 token_endpoint:issuer+'/oauth/token'};
function mock(){
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  if(opts.method==='GET')return {status:200,headers:{get:()=> 'application/json'},
   text:async()=>JSON.stringify(metadata)};
  if(opts.method==='POST')return {status:200,headers:{get:()=> 'application/json'},
   text:async()=>JSON.stringify({access_token:'mock-access-token-123456',
    token_type:'Bearer',expires_in:600})};
  throw Error('unexpected');
 };
 return {client:createSunoOAuthClient({identity,discovery,fetcher}),calls};
}
test('Suno OAuth PKCE links only after real owner authorization, never enables generation',async()=>{
 const {client,calls}=mock();
 const before=await client.status({headers,body});
 assert.equal(before.body.oauthAuthorized,false);
 const start=await client.start({headers,body});
 assert.equal(start.status,200);
 const uri=new URL(start.body.authorizationUrl);
 assert.equal(uri.origin,issuer);
 assert.equal(uri.searchParams.get('client_id'),CLIENT_ID);
 assert.equal(uri.searchParams.get('redirect_uri'),CALLBACK);
 assert.equal(uri.searchParams.get('resource'),'https://api.suno.com/mcp');
 assert.equal(uri.searchParams.get('code_challenge_method'),'S256');
 assert.ok(uri.searchParams.get('code_challenge').length>=43);
 assert.ok(uri.searchParams.get('state').length>=40);
 const callback=await client.callback({url:'/auth/suno/callback?state='+
  encodeURIComponent(uri.searchParams.get('state'))+'&code=abcdefghi12345'});
 assert.equal(callback.status,302);
 assert.match(callback.headers.Location,/suno_link=connected/);
 const exchange=calls.find(x=>x.opts.method==='POST');
 assert.ok(exchange);
 const params=new URLSearchParams(exchange.opts.body);
 const challenge=createHash('sha256').update(params.get('code_verifier')).digest('base64url');
 assert.equal(challenge,uri.searchParams.get('code_challenge'));
 assert.equal(params.get('resource'),'https://api.suno.com/mcp');
 assert.equal(params.get('client_id'),CLIENT_ID);
 const status=await client.status({headers,body});
 assert.deepEqual(status.body,{oauthAuthorized:true,canGenerate:false,ephemeral:true});
 assert.ok(!JSON.stringify(status).includes('mock-access-token'));
 const replay=await client.callback({url:'/auth/suno/callback?state='+
  encodeURIComponent(uri.searchParams.get('state'))+'&code=abcdefghi12345'});
 const replayUrl=new URL(replay.headers.Location);
 assert.equal(replayUrl.searchParams.get('suno_link'),'failed');
 assert.equal(replayUrl.searchParams.get('suno_reason'),'authorization_expired');
 assert.equal(calls.filter(x=>x.opts.method==='POST').length,1);
});
test('Disallowed registration and unsafe metadata fail closed without redirect',async()=>{
 const client=createSunoOAuthClient({identity,discovery,fetcher:async()=>({
  status:200,headers:{get:()=> 'application/json'},
  text:async()=>JSON.stringify({...metadata,client_id_metadata_document_supported:false})
 })});
 const r=await client.start({headers,body});
 assert.equal(r.status,503);
 assert.equal(r.body.error,'suno_client_registration_not_verified');
 assert.equal(isSunoOrigin('https://evil.example'),false);
 assert.equal(isSunoOrigin('https://accounts.suno.com'),true);
 assert.equal(validServerMeta({...metadata,token_endpoint:'https://evil.example/token'},issuer),null);
 assert.equal(validServerMeta({...metadata,code_challenge_methods_supported:['plain']},issuer),null);
});
test('Must authenticate Crow owner before OAuth metadata requests',async()=>{
 const {client,calls}=mock();
 assert.equal((await client.start({headers:{...headers,origin:'https://evil.example'},body})).status,403);
 assert.equal((await client.start({headers,body:JSON.stringify({
  agentId:'matt',threadId
 })})).status,400);
 assert.equal((await client.start({headers,body:JSON.stringify({
  agentId:'studio-director',threadId:'33333333-3333-4333-8333-333333333333'
 })})).status,404);
 assert.equal(calls.length,0);
});
test('Serves public CIMD without private secrets and no Suno generation API',()=>{
 const {client}=mock();
 const doc=client.clientMetadata();
 assert.equal(doc.client_id,CLIENT_ID);
 assert.deepEqual(doc.redirect_uris,[CALLBACK]);
 assert.equal(doc.token_endpoint_auth_method,'none');
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 const messenger=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(server,/\/auth\/suno\/start/);
 assert.match(server,/\/auth\/suno\/callback/);
 assert.match(server,/\/auth\/suno\/client-metadata/);
 assert.doesNotMatch(server,/\/suno\/crow\/execute/);
 assert.doesNotMatch(messenger,/GENERATE_WITH_SUNO_CREDITS/);
});

test('Path-based Suno OAuth issuer uses RFC 8414 discovery and PKCE without unsafe redirect',async()=>{
 const nestedIssuer='https://studio-api-prod.suno.com/api/v2/external/oauth';
 const nestedMeta={...metadata,issuer:nestedIssuer,
  authorization_endpoint:nestedIssuer+'/authorize',
  token_endpoint:nestedIssuer+'/token'};
 const fetched=[];
 const c=createSunoOAuthClient({identity,
  discovery:{inspect:async()=>({metadataAvailable:true,authorizationServers:[nestedIssuer]})},
  fetcher:async(url,opts)=>{
   fetched.push({url,opts});
   return {status:200,headers:{get:()=> 'application/json'},
    text:async()=>JSON.stringify(nestedMeta)};
  }});
 const check=await c.start({headers,body});
 assert.equal(check.status,200);
 assert.equal(new URL(check.body.authorizationUrl).origin,'https://studio-api-prod.suno.com');
 assert.equal(fetched[0].url,
  'https://studio-api-prod.suno.com/.well-known/oauth-authorization-server/api/v2/external/oauth');
 assert.equal(fetched[0].opts.redirect,'manual');
 assert.equal(serverMetadataUrls(nestedIssuer)[1],
  nestedIssuer+'/.well-known/openid-configuration');
 assert.equal(isSunoOrigin(nestedIssuer),true);
 assert.equal(isSunoOrigin('https://evil.test/api/v2/external/oauth'),false);
 assert.equal(validServerMeta({...nestedMeta,token_endpoint:'https://evil.test/token'},nestedIssuer),null);
});

test('Suno owner consent requests advertised scopes including credits spend',async()=>{
 const client=createSunoOAuthClient({identity,discovery:{
  inspect:async()=>({metadataAvailable:true,authorizationServers:[issuer],
   requestedScopes:['api:v0','profile:read','library:read','credits:spend','library:write']})
 },fetcher:async()=>({
  status:200,headers:{get:()=> 'application/json'},
  text:async()=>JSON.stringify(metadata)
 })});
 const response=await client.start({headers,body});
 assert.equal(response.status,200);
 const url=new URL(response.body.authorizationUrl);
 assert.equal(url.searchParams.get('scope'),'api:v0 profile:read library:read credits:spend');
 assert.equal(url.searchParams.get('resource'),'https://api.suno.com/mcp');
 assert.doesNotMatch(response.body.authorizationUrl,/create%3Agenerate|library%3Awrite/);
});

test('Suno callback distinguishes consent denial from expired OAuth without leaking provider details',async()=>{
 const {client}=mock();
 const start=await client.start({headers,body});
 const state=new URL(start.body.authorizationUrl).searchParams.get('state');
 const denied=await client.callback({url:'/auth/suno/callback?state='+encodeURIComponent(state)+
  '&error=access_denied&error_description=private_provider_message'});
 assert.equal(denied.status,302);
 assert.equal(new URL(denied.headers.Location).searchParams.get('suno_reason'),'authorization_denied');
 assert.doesNotMatch(denied.headers.Location,/private_provider_message|access_denied/);
 const replay=await client.callback({url:'/auth/suno/callback?state='+encodeURIComponent(state)+
  '&code=abcdefghi12345'});
 assert.equal(new URL(replay.headers.Location).searchParams.get('suno_reason'),'authorization_expired');
});
test('Suno callback reports a rejected token exchange without exposing tokens',async()=>{
 const fetcher=async(url,opts)=>opts.method==='GET'?
  {status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(metadata)}:
  {status:403,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({error:'sensitive'})};
 const client=createSunoOAuthClient({identity,discovery,fetcher});
 const start=await client.start({headers,body});
 const state=new URL(start.body.authorizationUrl).searchParams.get('state');
 const callback=await client.callback({url:'/auth/suno/callback?state='+encodeURIComponent(state)+
  '&code=abcdefghi12345'});
 assert.equal(new URL(callback.headers.Location).searchParams.get('suno_reason'),'token_exchange_rejected');
 assert.doesNotMatch(callback.headers.Location,/sensitive/);
 assert.equal((await client.status({headers,body})).body.oauthAuthorized,false);
});
