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
test('Refuses redirects, empty SSE streams, malformed JSON or unauthorized access',async()=>{
 for(const status of [302,401,500]){
  const probe=makeSunoMcpToolProbe({fetcher:async()=>({status,headers:{get:()=>null}})});
  assert.equal((await probe.inspect({accessToken:'valid-access-token-1234'})).available,false);
 }
 const emptySse=makeSunoMcpToolProbe({fetcher:async()=>({
  status:200,headers:{get:key=>key==='content-type'?'text/event-stream':null},
  text:async()=>': heartbeat\n\n'})});
 assert.equal((await emptySse.inspect({accessToken:'valid-access-token-1234'})).reason,
  'mcp_invalid_sse');
 assert.equal((await emptySse.inspect({accessToken:''})).reason,'not_authorized');
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
   return {available:true,toolCount:1,tools:['music/create_song']};
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
   toolsListed:true,canGenerate:false,toolCount:1,creationTools:[],
   reason:'read_only_tools_verified'});
 assert.equal(inspections,1);
 const doctor=await client.diagnose({headers,body});
 assert.equal(doctor.body.toolsListed,true);
 assert.equal(doctor.body.nextStep,'generation_not_enabled');
 assert.equal(doctor.body.toolCount,1);
 assert.equal((await client.inspectTools({headers:{...headers,origin:'https://evil.example'},
  body})).status,403);
 assert.equal(inspections,2);
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
 assert.equal(parseRequestSse('x'.repeat(512*1024+1)),null);
 assert.equal(summarize({jsonrpc:'2.0',id:1,result:{tools:[],nextCursor:'next'}}),null);
 const probe=makeSunoMcpToolProbe({fetcher:async()=>({
  status:200,headers:{get:()=> 'text/event-stream'},
  text:async()=>good+good
 })});
 assert.equal((await probe.inspect({accessToken:'valid-access-token-1234'})).available,false);
});

test('Categorizes invalid JSON-RPC without leaking provider content',async()=>{
 const samples=[
  ['not-json','mcp_invalid_json'],
  [JSON.stringify({jsonrpc:'2.0',id:7,result:{tools:[]}}),'mcp_invalid_envelope'],
  [JSON.stringify({jsonrpc:'2.0',id:1,result:{unexpected:'secret'}}),'mcp_tools_missing'],
  [JSON.stringify({jsonrpc:'2.0',id:1,result:{tools:[{name:'invalid name'}]}}),'mcp_invalid_tool_definition']
 ];
 for(const [payload,reason] of samples){
  const probe=makeSunoMcpToolProbe({fetcher:async()=>({
   status:200,headers:{get:k=>k==='content-type'?'application/json':null},
   text:async()=>payload
  })});
  const result=await probe.inspect({accessToken:'valid-access-token-1234'});
  assert.equal(result.reason,reason);
  assert.doesNotMatch(JSON.stringify(result),/secret|valid-access-token/);
 }
});

test('Accepts legitimate 70 KiB Suno tool schemas but returns names only',async()=>{
 const privateSchema='private music schema content '.repeat(2700);
 const payload=JSON.stringify({jsonrpc:'2.0',id:1,result:{tools:[
  {name:'music/create_song',description:privateSchema,inputSchema:{type:'object'}}
 ]}});
 assert.ok(Buffer.byteLength(payload,'utf8')>32000);
 assert.ok(Buffer.byteLength(payload,'utf8')<512*1024);
 const probe=makeSunoMcpToolProbe({fetcher:async()=>({
  status:200,headers:{get:k=>k==='content-type'?'application/json':
   k==='content-length'?String(Buffer.byteLength(payload,'utf8')):null},
  text:async()=>payload
 })});
 const result=await probe.inspect({accessToken:'valid-access-token-1234'});
 assert.deepEqual(result,{available:true,reason:'read_only_tools_verified',
  toolCount:1,tools:['music/create_song']});
 assert.doesNotMatch(JSON.stringify(result),/private music schema content|valid-access-token/);
});
test('Rejects huge declared payloads without reading response body',async()=>{
 let reads=0;
 const probe=makeSunoMcpToolProbe({fetcher:async()=>({
  status:200,headers:{get:k=>k==='content-type'?'application/json':
   k==='content-length'?String(512*1024+1):null},
  text:async()=>{reads++;throw Error('must not read')}
 })});
 const result=await probe.inspect({accessToken:'valid-access-token-1234'});
 assert.equal(result.reason,'mcp_response_oversized');
 assert.equal(reads,0);
});
test('Streaming MCP response enforces actual byte limit when header is absent',async()=>{
 const huge=new Uint8Array(512*1024+1).fill(65);
 let cancelled=false,position=0;
 const reader={
  async read(){
   if(position>=huge.length)return {done:true};
   const end=Math.min(position+65536,huge.length);
   const value=huge.slice(position,end);position=end;
   return {done:false,value};
  },
  async cancel(){cancelled=true},
  releaseLock(){}
 };
 const probe=makeSunoMcpToolProbe({fetcher:async()=>({
  status:200,headers:{get:k=>k==='content-type'?'application/json':null},
  body:{getReader:()=>reader},
  text:async()=>{throw Error('must stream')}
 })});
 const result=await probe.inspect({accessToken:'valid-access-token-1234'});
 assert.equal(result.reason,'mcp_response_oversized');
 assert.equal(cancelled,true);
});

test('Live creation signature discovery exposes only field names and types, never provider text',async()=>{
 const payload={jsonrpc:'2.0',id:1,result:{tools:[
  {name:'audio-create',description:'secret description',inputSchema:{
   type:'object',required:['style','lyrics'],properties:{
    title:{type:'string',description:'private title'},
    style:{type:'string',description:'private style'},
    lyrics:{type:'string'},clip_count:{type:'integer'},instrumental:{type:'boolean'}
   }}},
  {name:'library-list',inputSchema:{properties:{secret:{type:'string'}}}}
 ]}};
 const probe=makeSunoMcpToolProbe({fetcher:async()=>({
  status:200,headers:{get:key=>key==='content-type'?'application/json':null},
  text:async()=>JSON.stringify(payload)
 })});
 const result=await probe.inspect({accessToken:'valid-access-token-1234',includeCreationSchema:true});
 assert.equal(result.available,true);
 assert.equal(result.toolCount,2);
 assert.deepEqual(result.creationTools,[{
  name:'audio-create',required:['style','lyrics'],
  fields:[{name:'title',type:'string'},{name:'style',type:'string'},
   {name:'lyrics',type:'string'},{name:'clip_count',type:'integer'},
   {name:'instrumental',type:'boolean'}]
 }]);
 assert.doesNotMatch(JSON.stringify(result),/secret description|private title|private style|valid-access-token/);
 assert.ok(!JSON.stringify(result).includes('tools/call'));
});
