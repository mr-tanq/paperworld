'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {makeSunoMcpToolProbe,VERSION}=require('../server/suno-mcp-tool-probe.cjs');
const {makeLegacySunoMcpProbe,validSessionId,parseMessage}=
 require('../server/suno-mcp-legacy-probe.cjs');
const credential='test-bearer-token-0123456';
const ok=(body,session)=>({status:200,headers:{get:key=>
 key==='content-type'?'application/json':
 key==='mcp-session-id'?session||null:null},text:async()=>JSON.stringify(body)});
const init={jsonrpc:'2.0',id:0,result:{protocolVersion:'2025-11-25',
 capabilities:{tools:{}},serverInfo:{name:'Test Suno',version:'1'}}};
const tools={jsonrpc:'2.0',id:1,result:{tools:[{name:'create_song',
 description:'private',inputSchema:{type:'object'}}]}};
test('modern request includes protocol client info/capabilities and stays read only',async()=>{
 const seen=[];
 const probe=makeSunoMcpToolProbe({fetcher:async(_url,options)=>{
  seen.push(options);return ok(tools);
 }});
 const result=await probe.inspect({accessToken:credential});
 assert.equal(result.available,true);
 assert.equal(seen.length,1);
 const body=JSON.parse(seen[0].body);
 assert.equal(body.method,'tools/list');
 assert.equal(body.params._meta['io.modelcontextprotocol/protocolVersion'],VERSION);
 assert.deepEqual(body.params._meta['io.modelcontextprotocol/clientCapabilities'],{});
 assert.equal(body.params._meta['io.modelcontextprotocol/clientInfo'].name,'Paperworld Crow');
});
test('explicit modern rejection triggers legacy initialize, initialized then tools/list',async()=>{
 const seen=[];
 const responses=[
  {status:400,headers:{get:()=>null}},
  ok(init,'TEST-SESSION_123'),
  {status:202},
  ok(tools)
 ];
 const probe=makeSunoMcpToolProbe({fetcher:async(url,options)=>{
  seen.push({url,options});
  return responses[seen.length-1];
 }});
 const result=await probe.inspect({accessToken:credential});
 assert.deepEqual(result,{available:true,reason:'read_only_legacy_tools_verified',
  toolCount:1,tools:['create_song']});
 assert.deepEqual(seen.map(x=>JSON.parse(x.options.body).method),
  ['tools/list','initialize','notifications/initialized','tools/list']);
 assert.equal(seen[2].options.headers['Mcp-Session-Id'],'TEST-SESSION_123');
 assert.equal(seen[3].options.headers['Mcp-Session-Id'],'TEST-SESSION_123');
 assert.ok(seen.every(x=>x.url==='https://api.suno.com/mcp'));
 assert.ok(seen.every(x=>x.options.redirect==='manual'));
 assert.doesNotMatch(JSON.stringify(result),/private|test-bearer-token/);
});
test('no legacy fallback on auth rejection, redirect, or malformed success',async()=>{
 for(const first of [
  {status:401,headers:{get:()=>null}},
  {status:302,headers:{get:()=>null}},
  ok({jsonrpc:'2.0',id:1,result:{other:true}})
 ]){
  let count=0;
  const probe=makeSunoMcpToolProbe({fetcher:async()=>{
   count++;return first;
  }});
  assert.equal((await probe.inspect({accessToken:credential})).available,false);
  assert.equal(count,1);
 }
});
test('legacy handshake rejects forged sessions and fails closed',async()=>{
 assert.equal(validSessionId('good_123'),true);
 assert.equal(validSessionId('bad\nSession'),false);
 assert.equal(validSessionId('bad\r\nHeader'),false);
 assert.equal(validSessionId(''),false);
 assert.equal(validSessionId('a'.repeat(129)),false);
 let count=0;
 const legacy=makeLegacySunoMcpProbe({fetcher:async()=>{
  count++;return ok(init,'header\ninjection');
 }});
 assert.equal((await legacy.inspect({accessToken:credential})).reason,'legacy_session_invalid');
 assert.equal(count,1);
});
test('legacy SSE handshake accepts matching response, rejects other ids',async()=>{
 const raw='event: message\ndata: '+JSON.stringify(init)+'\n\n';
 assert.deepEqual(parseMessage(raw,0),init);
 assert.equal(parseMessage(raw,1),null);
 assert.equal(parseMessage(raw+raw,0),null);
 assert.equal(parseMessage('data: not-json\n\n',0),null);
});
test('legacy tool probe does not enable generation or expose token',()=>{
 const src=fs.readFileSync('server/suno-mcp-legacy-probe.cjs','utf8');
 const routes=fs.readFileSync('server/render-matt.cjs','utf8');
 assert.doesNotMatch(src,/method:'tools\/call'/);
 assert.doesNotMatch(routes,/\/suno\/crow\/execute/);
 assert.match(src,/method:'initialize'/);
 assert.match(src,/method:'tools\/list'/);
});

test('HTTP 200 JSON-RPC invalid-params error triggers safe initialized MCP fallback',async()=>{
 const seen=[];
 const responses=[
  ok({jsonrpc:'2.0',id:1,error:{code:-32602,message:'invalid params'}}),
  ok(init,'SESSION-PROTOCOL-ONLY'),
  {status:202},
  ok(tools)
 ];
 const probe=makeSunoMcpToolProbe({fetcher:async(url,options)=>{
  seen.push({url,options});
  return responses[seen.length-1];
 }});
 const result=await probe.inspect({accessToken:credential});
 assert.equal(result.available,true);
 assert.equal(result.reason,'read_only_legacy_tools_verified');
 assert.deepEqual(seen.map(x=>JSON.parse(x.options.body).method),
  ['tools/list','initialize','notifications/initialized','tools/list']);
 assert.ok(seen.every(x=>x.url==='https://api.suno.com/mcp'));
 assert.ok(seen.every(x=>!JSON.stringify(x.options.body).includes('tools/call')));
});
test('Unrelated JSON-RPC errors must not trigger a second MCP request',async()=>{
 for(const code of [-32001,-32000,-32700]){
  let count=0;
  const probe=makeSunoMcpToolProbe({fetcher:async()=>{
   count++;
   return ok({jsonrpc:'2.0',id:1,error:{code,message:'opaque provider error'}});
  }});
  const result=await probe.inspect({accessToken:credential});
  assert.equal(result.available,false);
  assert.equal(result.reason,'provider_rpc_rejected');
  assert.equal(count,1);
  assert.doesNotMatch(JSON.stringify(result),/opaque|test-bearer/);
 }
});
test('Malformed success is not a protocol rejection and must not trigger fallback',async()=>{
 let count=0;
 const probe=makeSunoMcpToolProbe({fetcher:async()=>{
  count++;return ok({jsonrpc:'2.0',id:1,result:{unexpected:true}});
 }});
 const result=await probe.inspect({accessToken:credential});
 assert.equal(result.reason,'unverified_mcp_response');
 assert.equal(count,1);
});
