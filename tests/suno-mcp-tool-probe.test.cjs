'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {makeSunoMcpToolProbe,summarize,parseRequestSse,ENDPOINT,VERSION}=
 require('../server/suno-mcp-tool-probe.cjs');
const {createSunoOAuthClient}=require('../server/suno-oauth-client.cjs');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const headers={origin:'https://mr-tanq.github.io',
 authorization:'Bearer abcdefghijklmnop'};
const body=JSON.stringify({agentId:'studio-director',threadId});
const identity={authenticate:async()=>({ownerId}),
 ownsThread:async x=>x.ownerId===ownerId&&x.threadId===threadId&&
 x.agentId==='studio-director'};
const issuer='https://accounts.suno.com';
const discovery={inspect:async()=>({metadataAvailable:true,authorizationServers:[issuer]})};
const metadata={issuer,client_id_metadata_document_supported:true,
 code_challenge_methods_supported:['S256'],response_types_supported:['code'],
 authorization_endpoint:issuer+'/oauth/authorize',
 token_endpoint:issuer+'/oauth/token'};
test('tools/list is the only MCP operation and token never reaches browser',async()=>{
 const calls=[];
 const probe=makeSunoMcpToolProbe({fetcher:async(url,opts)=>{
  calls.push({url,opts});
  return {status:200,headers:{get:k=>k==='content-type'?'application/json':null},
   text:async()=>JSON.stringify({jsonrpc:'2.0',id:1,result:{tools:[
    {name:'create_song',description:'private text',inputSchema:{type:'object'}},
    {name:'credits_balance'}]}})};
 }});
 const result=await probe.inspect({accessToken:'valid-access-token-1234'});
 assert.deepEqual(result,{available:true,reason:'read_only_tools_verified',
  toolCount:2,tools:['create_song','credits_balance']});
 assert.equal(calls.length,1);assert.equal(calls[0].url,ENDPOINT);
 assert.equal(calls[0].opts.method,'POST');
 assert.equal(calls[0].opts.redirect,'manual');
 assert.equal(calls[0].opts.headers['MCP-Protocol-Version'],VERSION);
 assert.equal(JSON.parse(calls[0].opts.body).method,'tools/list');
 assert.doesNotMatch(JSON.stringify(result),/private text|valid-access-token/);
 assert.equal(summarize({jsonrpc:'2.0',id:1,result:{tools:[{name:'x'},{name:'x'}]}}),null);
});
test('Refuses redirects, SSE-only servers, malformed JSON or unauthorized access',async()=>{
 for(const status of [302,401,500]){
  const probe=makeSunoMcpToolProbe({fetcher:async()=>({status,headers:{get:()=>null}})});
  assert.equal((await probe.inspect({accessToken:'valid-access-token-1234'})).available,false);
 }
 const emptySse=makeSunoMcpToolProbe({fetcher:async()=>({
  status:200,headers:{get:()=> 'text/event-stream'},
  text:async()=>': heartbeat\n\n'})});
 assert.equal((await emptySse.inspect({accessToken:'valid-access-token-1234'})).reason,
  'unverified_mcp_response');
 assert.equal((await sse.inspect({accessToken:''})).reason,'not_authorized');
});
test('OAuth owner must be linked before MCP tool discovery; never enables generation',async()=>{
 let inspections=0;
 const fetcher=async(url,opts)=>{
  if(opts.method==='GET')return {status:200,headers:{get:()=> 'application/json'},
   text:async()=>JSON.stringify(metadata)};
  return {status:200,headers:{get:()=> 'application/json'},
   text:async()=>JSON.stringify({access_token:'valid-access-token-1234',
    token_type:'Bearer',expires_in:600})};
 };
 const client=createSunoOAuthClient({identity,discovery,fetcher,
  toolProbe:{inspect:async({accessToken})=>{
   assert.equal(accessToken,'valid-access-token-1234');inspections++;
   return {available:true,toolCount:1,tools:['create_song']};
  }}});
 assert.equal((await client.inspectTools({headers,body})).status,409);
 const started=await client.start({headers,body});
 assert.equal(started.status,200);
 const state=new URL(started.body.authorizationUrl).searchParams.get('state');
 const callback=await client.callback({url:'/auth/suno/callback?state='+state+
   '&code=abcdefghi12345'});
 assert.equal(callback.status,302);
 const result=await client.inspectTools({headers,body});
 assert.deepEqual(result.body,{service:'suno_mcp',oauthAuthorized:true,
   toolsListed:true,canGenerate:false,toolCount:1,reason:'read_only_tools_verified'});
 assert.equal(inspections,1);
 assert.equal((await client.inspectTools({headers:{...headers,origin:'https://evil.example'},
  body})).status,403);
 assert.equal(inspections,1);
 assert.doesNotMatch(JSON.stringify(result),/valid-access-token/);
});
test('No execution route or tool calling method is introduced',()=>{
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 const api=fs.readFileSync('server/suno-mcp-tool-probe.cjs','utf8');
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(server,/\/auth\/suno\/inspect-tools/);
 assert.match(ui,/inspectSunoTools/);
 assert.doesNotMatch(server,/\/suno\/crow\/execute/);
 assert.doesNotMatch(api,/method:'tools\/call'/);
 assert.doesNotMatch(ui,/GENERATE_WITH_SUNO_CREDITS/);
});

test('Bounded SSE progress plus one matching response verifies only tool names',async()=>{
 const events=[
  ': keepalive',
  'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":1}}',
  'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"generate_song","description":"private"}]}}'
 ].join('\n\n')+'\n\n';
 const calls=[];
 const probe=makeSunoMcpToolProbe({fetcher:async(url,opts)=>{
  calls.push(opts);
  return {status:200,
   headers:{get:k=>k==='content-type'?'text/event-stream; charset=utf-8':null},
   text:async()=>events};
 }});
 const result=await probe.inspect({accessToken:'valid-access-token-1234'});
 assert.deepEqual(result,{available:true,reason:'read_only_tools_verified',
  toolCount:1,tools:['generate_song']});
 assert.equal(calls[0].opts,undefined);
 assert.equal(calls[0].headers.Accept,'application/json, text/event-stream');
 assert.equal(JSON.parse(calls[0].body).method,'tools/list');
 assert.doesNotMatch(JSON.stringify(result),/private|valid-access-token/);
});
test('Reject truncated, duplicate, mismatched, oversized and paginated SSE',async()=>{
 const good='event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"song"}]}}\n\n';
 assert.deepEqual(parseRequestSse(good)?.result?.tools,[{name:'song'}]);
 assert.equal(parseRequestSse('data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n'),null);
 assert.equal(parseRequestSse(good+good),null);
 assert.equal(parseRequestSse('data: {"jsonrpc":"2.0","id":3,"result":{"tools":[]}}\n\n'),null);
 assert.equal(parseRequestSse('x'.repeat(32001)),null);
 assert.equal(summarize({jsonrpc:'2.0',id:1,result:{tools:[],nextCursor:'next'}}),null);
 const probe=makeSunoMcpToolProbe({fetcher:async()=>({
  status:200,headers:{get:()=> 'text/event-stream'},
  text:async()=>good+good
 })});
 assert.equal((await probe.inspect({accessToken:'valid-access-token-1234'})).available,false);
});
