'use strict';
// MCP 2026-07-28 audio-create contract: Mcp-Param headers, live-schema
// argument validation, protocol-ladder errors, input_required results, and the
// durable-claim preflight. No test performs a real network call.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeSunoAudioCreate,buildAudioCreateCall,encodeParamHeader}=
 require('../server/suno-audio-create.cjs');
const {toolContract}=require('../server/suno-mcp-tool-probe.cjs');
const {createSunoOAuthClient}=require('../server/suno-oauth-client.cjs');
const {makeSunoClaim}=require('../server/suno-durable-claim.cjs');
const key='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222';
const threadId='33333333-3333-4333-8333-333333333333';
const brief={title:'Ο Χαμένος Ταξιδιώτης',style:'soft dark acoustic folk',
 lyrics:'[Verse]\nPRIVATE ORIGINAL LYRIC LINE'};
const token='secret-token-123456';
const schema=(props={},extra={})=>({jsonrpc:'2.0',id:1,result:{tools:[
 {name:'credits-balance',inputSchema:{type:'object',properties:{}}},
 {name:'audio-create',inputSchema:{type:'object',properties:{
  title:{type:'string'},style:{type:'string'},lyrics:{type:'string'},
  instrumental:{type:'boolean'},idempotency_key:{type:'string'},...props},...extra}}]}});
const contractOf=(props,extra)=>toolContract(schema(props,extra),'audio-create');
const ok=(body,type='application/json')=>({status:200,
 headers:{get:k=>k==='content-type'?type:null},text:async()=>body});
function recorder(reply){
 const calls=[];
 return {calls,fetcher:async(url,opts)=>{calls.push({url,opts});return reply()}};
}

test('x-mcp-header properties are mirrored as Mcp-Param headers (SEP-2243)',async()=>{
 const contract=contractOf({idempotency_key:{type:'string','x-mcp-header':'Idempotency-Key'},
  title:{type:'string','x-mcp-header':'Title'}});
 assert.equal(contract.valid,true);
 const r=recorder(()=>ok(JSON.stringify({jsonrpc:'2.0',id:2,
  result:{resultType:'complete',content:[]}})));
 const verdict=await makeSunoAudioCreate({fetcher:r.fetcher})
  .submit({accessToken:token,brief,idempotencyKey:key,contract});
 assert.equal(verdict.accepted,true);
 assert.equal(r.calls.length,1);
 const h=r.calls[0].opts.headers;
 assert.equal(h['Mcp-Param-Idempotency-Key'],key);
 // Non-ASCII values use the Base64 sentinel and decode to the exact argument.
 assert.match(h['Mcp-Param-Title'],/^=\?base64\?[A-Za-z0-9+/=]+\?=$/);
 assert.equal(Buffer.from(h['Mcp-Param-Title'].slice(9,-2),'base64').toString('utf8'),brief.title);
 const body=JSON.parse(r.calls[0].opts.body);
 assert.equal(body.params.arguments.title,brief.title);
 assert.equal(h['Mcp-Name'],body.params.name);
 assert.equal(h['Mcp-Method'],body.method);
 assert.equal(h['MCP-Protocol-Version'],
  body.params._meta['io.modelcontextprotocol/protocolVersion']);
 assert.doesNotMatch(JSON.stringify(verdict),/PRIVATE ORIGINAL|secret-token|Χαμένος/);
});
test('Mcp-Param value encoding follows the spec rules',()=>{
 assert.equal(encodeParamHeader('plain-ascii 1'),'plain-ascii 1');
 assert.equal(encodeParamHeader(false),'false');
 assert.match(encodeParamHeader(' padded'),/^=\?base64\?/);
 assert.match(encodeParamHeader(''),/^=\?base64\?/);
 assert.match(encodeParamHeader('=?base64?abc?='),/^=\?base64\?(?!abc)/);
});
test('Only schema-declared arguments are sent; undeclared optional controls are dropped',()=>{
 const contract=toolContract({jsonrpc:'2.0',id:1,result:{tools:[{name:'audio-create',
  inputSchema:{type:'object',additionalProperties:false,properties:{
   title:{type:'string'},style:{type:'string'},lyrics:{type:'string'}}}}]}},'audio-create');
 const call=buildAudioCreateCall({brief,idempotencyKey:key,contract});
 assert.equal(call.ok,true);
 assert.deepEqual(Object.keys(call.args).sort(),['lyrics','style','title']);
 assert.deepEqual(call.paramHeaders,{});
});
test('Schema incompatibilities block BEFORE any provider request',async()=>{
 const cases=[
  [toolContract(schema({},{required:['model']}),'audio-create'),
   'audio_create_required_field_unsupported','model'],
  [toolContract({jsonrpc:'2.0',id:1,result:{tools:[{name:'audio-create',inputSchema:{
   type:'object',properties:{prompt:{type:'string'}}}}]}},'audio-create'),
   'audio_create_schema_mismatch','title'],
  [contractOf({lyrics:{type:'string',maxLength:10}}),'audio_create_field_too_long','lyrics'],
  [contractOf({instrumental:{type:'string'}}),'audio_create_schema_mismatch','instrumental'],
  [null,'audio_create_schema_unverified',undefined],
  [toolContract(schema(),'some-other-tool'),'audio_create_schema_unverified',undefined]
 ];
 for(const [contract,reason,field] of cases){
  const r=recorder(()=>{throw Error('must not be called')});
  const verdict=await makeSunoAudioCreate({fetcher:r.fetcher})
   .submit({accessToken:token,brief,idempotencyKey:key,contract});
  assert.equal(verdict.accepted,false);
  assert.equal(verdict.reason,reason);
  assert.equal(verdict.status,'blocked_before_submission');
  assert.equal(verdict.field,field);
  assert.equal(r.calls.length,0);
  assert.doesNotMatch(JSON.stringify(verdict),/PRIVATE ORIGINAL/);
 }
});
test('Invalid x-mcp-header declarations fail closed',()=>{
 for(const bad of [{type:'string','x-mcp-header':'Bad Header'},
  {type:'object','x-mcp-header':'Obj'},{type:'string','x-mcp-header':''}]){
  const contract=contractOf({title:bad});
  assert.equal(contract.valid,false);
  assert.equal(buildAudioCreateCall({brief,idempotencyKey:key,contract}).ok,false);
 }
});
test('2026-07-28 protocol-ladder 400 errors are classified by numeric code only',async()=>{
 const scenarios=[
  [400,{code:-32020,message:'SECRET header detail'},'provider_header_mismatch'],
  [400,{code:-32021,message:'SECRET',data:{requiredCapabilities:{elicitation:{},
   'evil secret':{}}}},'provider_client_capability_required'],
  [400,{code:-32022,message:'SECRET'},'provider_protocol_version_unsupported'],
  [400,{code:-32602,message:'SECRET'},'provider_invalid_tool_arguments'],
  [404,{code:-32601,message:'SECRET'},'provider_method_not_found']
 ];
 for(const [status,error,reason] of scenarios){
  const r=recorder(()=>({status,headers:{get:k=>k==='content-type'?'application/json':null},
   text:async()=>JSON.stringify({jsonrpc:'2.0',id:2,error})}));
  const verdict=await makeSunoAudioCreate({fetcher:r.fetcher})
   .submit({accessToken:token,brief,idempotencyKey:key,contract:contractOf()});
  assert.equal(verdict.accepted,false);
  assert.equal(verdict.reason,reason);
  assert.equal(verdict.rpcCode,error.code);
  assert.equal(verdict.httpStatus,status);
  if(error.code===-32021)assert.deepEqual(verdict.requiredCapabilities,['elicitation']);
  assert.equal(r.calls.length,1);
  assert.doesNotMatch(JSON.stringify(verdict),/SECRET|secret/);
 }
});
test('input_required results are not reported as an accepted song',async()=>{
 const r=recorder(()=>ok(JSON.stringify({jsonrpc:'2.0',id:2,result:{
  resultType:'input_required',inputRequests:{a:{method:'elicitation/create',
   params:{message:'PRIVATE confirm spend'}}}}})));
 const verdict=await makeSunoAudioCreate({fetcher:r.fetcher})
  .submit({accessToken:token,brief,idempotencyKey:key,contract:contractOf()});
 assert.equal(verdict.accepted,false);
 assert.equal(verdict.reason,'provider_input_required');
 assert.deepEqual(verdict.inputKinds,['elicitation/create']);
 assert.equal(r.calls.length,1);
 assert.doesNotMatch(JSON.stringify(verdict),/PRIVATE/);
 const other=await makeSunoAudioCreate({fetcher:async()=>ok(JSON.stringify({
  jsonrpc:'2.0',id:2,result:{resultType:'mystery'}}))})
  .submit({accessToken:token,brief,idempotencyKey:key,contract:contractOf()});
 assert.equal(other.reason,'provider_result_type_unsupported');
});
test('SSE progress notifications before the final result are tolerated',async()=>{
 const frames=Array.from({length:150},(_,i)=>'event: message\ndata: '+JSON.stringify({
  jsonrpc:'2.0',method:'notifications/progress',params:{progress:i}})).join('\n\n')+
  '\n\nevent: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:2,
   result:{resultType:'complete',content:[{type:'text',text:'PRIVATE'}]}})+'\n\n';
 const verdict=await makeSunoAudioCreate({fetcher:async()=>ok(frames,'text/event-stream')})
  .submit({accessToken:token,brief,idempotencyKey:key,contract:contractOf()});
 assert.equal(verdict.accepted,true);
 assert.equal(verdict.status,'submitted_unverified');
});

// ---- Owner route: preflight ordering and durable claim -------------------
const issuer='https://accounts.suno.com';
const metadata={issuer,client_id_metadata_document_supported:true,
 code_challenge_methods_supported:['S256'],response_types_supported:['code'],
 authorization_endpoint:issuer+'/oauth/authorize',token_endpoint:issuer+'/oauth/token'};
const reqHeaders={origin:'https://mr-tanq.github.io',authorization:'Bearer abcdefghijklmnop'};
async function linkedClient({sunoClaim,verdict}){
 let providerCalls=0;
 const fetcher=async(url,opts)=>{
  if(opts.method==='GET')return {status:200,headers:{get:()=>'application/json'},
   text:async()=>JSON.stringify(metadata)};
  if(url==='https://api.suno.com/mcp'){providerCalls++;
   return ok(JSON.stringify({jsonrpc:'2.0',id:2,result:{content:[]}}))}
  return {status:200,headers:{get:()=>'application/json'},
   text:async()=>JSON.stringify({access_token:'access-token-12345678',
    token_type:'Bearer',expires_in:600})};
 };
 const client=createSunoOAuthClient({fetcher,sunoClaim,
  identity:{authenticate:async()=>({ownerId}),ownsThread:async()=>true},
  discovery:{inspect:async()=>({metadataAvailable:true,authorizationServers:[issuer]})},
  toolProbe:{inspect:async()=>verdict}});
 const start=await client.start({headers:reqHeaders,
  body:JSON.stringify({agentId:'studio-director',threadId})});
 const state=new URL(start.body.authorizationUrl).searchParams.get('state');
 await client.callback({url:'/auth/suno/callback?state='+state+'&code=abcdefghi12345'});
 return {client,providerCalls:()=>providerCalls};
}
const payload=JSON.stringify({agentId:'studio-director',threadId,brief,idempotencyKey:key});
const modern=(contract=contractOf())=>({available:true,reason:'read_only_tools_verified',
 toolCount:1,tools:['audio-create'],toolContract:contract});
test('Missing claim storage is reported as a pre-Suno block, not a Suno failure',async()=>{
 const sunoClaim=makeSunoClaim({secret:'sb_secret_test_value',fetcher:async url=>{
  assert.match(url,/paperworld_suno_claim_create$/);
  return {ok:false,status:404,json:async()=>({message:'PGRST202'})};
 }});
 const x=await linkedClient({sunoClaim,verdict:modern()});
 const r=await x.client.createSong({headers:reqHeaders,body:payload});
 assert.equal(r.status,503);
 assert.equal(r.body.error,'suno_claim_storage_missing');
 assert.equal(x.providerCalls(),0);
});
test('Schema mismatch and legacy-only transport block before claim and credits',async()=>{
 for(const verdict of [modern(contractOf({},{required:['model']})),
  {...modern(),reason:'read_only_legacy_tools_verified'}]){
  let claims=0;
  const x=await linkedClient({verdict,sunoClaim:{reserve:async()=>{claims++;return true}}});
  const r=await x.client.createSong({headers:reqHeaders,body:payload});
  assert.equal(r.status,409);
  assert.match(r.body.error,/^audio_create_(required_field_unsupported|transport_unsupported)$/);
  assert.equal(claims,0);
  assert.equal(x.providerCalls(),0);
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE ORIGINAL|access-token/);
 }
});
test('Diagnostic reports schema compatibility and claim readiness without tools/call',async()=>{
 const x=await linkedClient({verdict:modern(contractOf({
  idempotency_key:{type:'string','x-mcp-header':'Idempotency-Key'}})),
  sunoClaim:{ready:async()=>({ready:false,reason:'claim_storage_missing'}),
   reserve:async()=>{throw Error('diagnostic must not reserve')}}});
 const r=await x.client.diagnose({headers:reqHeaders,
  body:JSON.stringify({agentId:'studio-director',threadId})});
 assert.equal(r.body.canGenerate,false);
 assert.equal(r.body.audioCreate.compatible,true);
 assert.deepEqual(r.body.audioCreate.paramHeaders,['Mcp-Param-Idempotency-Key']);
 assert.equal(r.body.createClaimReady,false);
 assert.equal(r.body.createClaimReason,'claim_storage_missing');
 assert.equal(r.body.nextStep,'create_claim_storage_not_ready');
 assert.equal(x.providerCalls(),0);
});
test('Claim readiness check is a zero-row GET and maps a missing table',async()=>{
 const seen=[];
 const claim=makeSunoClaim({secret:'sb_secret_test_value',fetcher:async(url,opts)=>{
  seen.push([url,opts.method]);return {ok:false,status:404}}});
 assert.deepEqual(await claim.ready(),{ready:false,reason:'claim_storage_missing'});
 assert.deepEqual(seen,[['https://jrevhzvrgenucuozjowm.supabase.co/rest/v1/'+
  'paperworld_suno_create_claims?select=owner_id&limit=0','GET']]);
 assert.equal((await makeSunoClaim({secret:undefined}).ready()).reason,'claim_secret_missing');
});
test('Browser treats every server-side pre-Suno block as no-credit preflight',()=>{
 const cloud=fs.readFileSync('js/cloud.js','utf8');
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 for(const reason of ['suno_claim_storage_missing','suno_claim_unavailable',
  'audio_create_schema_mismatch','audio_create_field_too_long',
  'audio_create_required_field_unsupported','audio_create_transport_unsupported']){
  assert.match(cloud,new RegExp("'"+reason+"'"));
  assert.match(ui,new RegExp(reason+':'));
 }
 for(const reason of ['provider_header_mismatch','provider_client_capability_required',
  'provider_input_required','provider_protocol_version_unsupported'])
  assert.match(ui,new RegExp(reason+':'));
});
