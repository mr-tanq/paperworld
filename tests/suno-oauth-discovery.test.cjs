'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createSunoOAuthDiscovery,safeMetadata,METADATA_URLS}=
 require('../server/suno-oauth-discovery.cjs');
const {createSunoConnectionStatus}=require('../server/suno-connection-status.cjs');
const owner='owner-1',threadId='11111111-1111-4111-8111-111111111111';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer abcdefghijklmnop'};
const body=JSON.stringify({agentId:'studio-director',threadId});
const identity={authenticate:async()=>({ownerId:owner}),
 ownsThread:async p=>p.ownerId===owner&&p.agentId==='studio-director'&&p.threadId===threadId};
test('Suno discovery is fixed-host read-only metadata and never authenticates',async()=>{
 const called=[];
 const discovery=createSunoOAuthDiscovery({fetcher:async(url,opts)=>{
  called.push({url,opts});
  return {status:200,headers:{get:()=> 'application/json'},
   text:async()=>JSON.stringify({resource:'https://api.suno.com/mcp',
    authorization_servers:['https://accounts.suno.com']})};
 }});
 const r=await discovery.inspect();
 assert.equal(r.metadataAvailable,true);
 assert.equal(r.oauthConnected,false);
 assert.equal(r.canGenerate,false);
 assert.deepEqual(called.map(c=>c.url),[METADATA_URLS[0]]);
 assert.deepEqual(called.map(c=>c.opts.method),['GET']);
 assert.ok(called.every(c=>c.opts.redirect==='manual'));
 assert.ok(called.every(c=>!JSON.stringify(c.opts).includes('Authorization')));
});
test('Reject invalid resource, unsafe metadata, redirects and unsupported responses',async()=>{
 assert.equal(safeMetadata({resource:'https://evil.example/mcp',
  authorization_servers:['https://accounts.suno.com']}),null);
 assert.equal(safeMetadata({resource:'https://api.suno.com/mcp',
  authorization_servers:['http://localhost:9999']}),null);
 const discovery=createSunoOAuthDiscovery({fetcher:async()=>({
  status:302,headers:{get:()=>null},text:async()=>{throw Error('must not read')}
 })});
 assert.equal((await discovery.inspect()).metadataAvailable,false);
});
test('Authenticated owned Crow thread can see only disconnected status',async()=>{
 const api=createSunoConnectionStatus({identity,discovery:{inspect:async()=>({
  metadataAvailable:true,oauthConnected:true,canGenerate:true
 })}});
 const r=await api.handle({headers,body});
 assert.deepEqual(r,{status:200,body:{service:'suno_mcp',metadataAvailable:true,
  oauthConnected:false,canGenerate:false,
  nextStep:'owner_authorized_oauth_not_implemented'}});
 assert.equal((await api.handle({headers:{...headers,origin:'https://evil.example'},body})).status,403);
 assert.equal((await api.handle({headers,body:JSON.stringify({
  agentId:'studio-director',threadId:'22222222-2222-4222-8222-222222222222'
 })})).status,404);
 assert.equal((await api.handle({headers,body:JSON.stringify({
  agentId:'matt',threadId
 })})).status,400);
});
test('Crow browser status cannot spend credits or enable an execution route',()=>{
 const frontend=fs.readFileSync('js/cloud.js','utf8');
 const messenger=fs.readFileSync('js/world-dialogue.js','utf8');
 const router=fs.readFileSync('server/render-matt.cjs','utf8');
 assert.match(frontend,/\/suno\/crow\/connection-status/);
 assert.match(messenger,/sunoCheck\.addEventListener\('click'/);
 assert.match(router,/\/suno\/crow\/connection-status/);
 assert.doesNotMatch(router,/\/suno\/crow\/execute/);
 assert.doesNotMatch(messenger,/GENERATE_WITH_SUNO_CREDITS/);
});

test('Preserves path-qualified Suno OAuth issuer without dropping its path',()=>{
 const issuer='https://studio-api-prod.suno.com/api/v2/external/oauth';
 const parsed=safeMetadata({resource:'https://api.suno.com/mcp',
  authorization_servers:[issuer]});
 assert.deepEqual(parsed.authorizationServers,[issuer]);
});
