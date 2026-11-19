'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeSunoAudioCreate,validRequest}=require('../server/suno-audio-create.cjs');
const {createSunoOAuthClient}=require('../server/suno-oauth-client.cjs');
const key='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222';
const threadId='33333333-3333-4333-8333-333333333333';
const brief={title:'The Lost Wanderer test',style:'soft dark acoustic folk',lyrics:'[Verse]\nAn original line'};
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer abcdefghijklmnop'};
const identity={authenticate:async()=>({ownerId}),
 ownsThread:async x=>x.ownerId===ownerId&&x.threadId===threadId&&x.agentId==='studio-director'};
const issuer='https://accounts.suno.com';
const discovery={inspect:async()=>({metadataAvailable:true,authorizationServers:[issuer]})};
const metadata={issuer,client_id_metadata_document_supported:true,
 code_challenge_methods_supported:['S256'],response_types_supported:['code'],
 authorization_endpoint:issuer+'/oauth/authorize',token_endpoint:issuer+'/oauth/token'};
test('Uses exactly one credit-spending tool call and never returns private text',async()=>{
 const calls=[];
 const transport=makeSunoAudioCreate({fetcher:async(url,opts)=>{
  calls.push({url,opts});
  return {status:200,headers:{get:k=>k==='content-type'?'application/json':null},
   text:async()=>JSON.stringify({jsonrpc:'2.0',id:2,result:{
    content:[{type:'text',text:'private provider lyrics'}]}})};
 }});
 const r=await transport.submit({accessToken:'secret-token-123456',brief,idempotencyKey:key});
 assert.equal(r.accepted,true);
 assert.equal(r.status,'submitted_unverified');
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.suno.com/mcp');
 const request=JSON.parse(calls[0].opts.body);
 assert.equal(request.method,'tools/call');
 assert.equal(request.params.name,'audio-create');
 assert.equal(request.params.arguments.idempotency_key,key);
 assert.equal(request.params.arguments.title,brief.title);
 assert.equal(request.params.arguments.style,brief.style);
 assert.equal(request.params.arguments.lyrics,brief.lyrics);
 assert.equal(request.params.arguments.instrumental,false);
 assert.doesNotMatch(JSON.stringify(r),/private provider lyrics|secret-token|original line/);
});
test('Invalid briefs do not invoke Suno and failed provider responses remain unconfirmed',async()=>{
 let calls=0;
 const transport=makeSunoAudioCreate({fetcher:async()=>{calls++;
  return {status:500,headers:{get:()=>null}}}});
 assert.equal(validRequest(brief,key),true);
 assert.equal(validRequest({...brief,model:'secret'},key),false);
 assert.equal(validRequest(brief,'bad-key'),false);
 assert.equal((await transport.submit({accessToken:'secret-token-123456',
  brief:{...brief,model:'x'},idempotencyKey:key})).reason,'invalid_audio_create_request');
 assert.equal(calls,0);
 assert.equal((await transport.submit({accessToken:'secret-token-123456',
  brief,idempotencyKey:key})).reason,'submission_unconfirmed');
 assert.equal(calls,1);
});
test('Authenticated Crow create-song claims key before effects and refuses repeats',async()=>{
 let calls=0;
 const fetcher=async(url,opts)=>{
  if(opts.method==='GET')return {status:200,headers:{get:()=> 'application/json'},
   text:async()=>JSON.stringify(metadata)};
  if(url==='https://api.suno.com/mcp'){
   calls++;
   return {status:200,headers:{get:k=>k==='content-type'?'application/json':null},
    text:async()=>JSON.stringify({jsonrpc:'2.0',id:2,result:{content:[]}})};
  }
  return {status:200,headers:{get:()=> 'application/json'},
   text:async()=>JSON.stringify({access_token:'access-token-12345678',
    token_type:'Bearer',expires_in:600})};
 };
 const claimed=new Set();
 const client=createSunoOAuthClient({identity,discovery,fetcher,
  sunoClaim:{reserve:async ({ownerId,idempotencyKey})=>{
   const bound=ownerId+':'+idempotencyKey;
   if(claimed.has(bound))return false;
   claimed.add(bound);return true;
  }},
  toolProbe:{inspect:async()=>({available:true,toolCount:1,tools:['audio-create']})}});
 const start=await client.start({headers,body:JSON.stringify({agentId:'studio-director',threadId})});
 const state=new URL(start.body.authorizationUrl).searchParams.get('state');
 assert.equal((await client.callback({url:'/auth/suno/callback?state='+state+
  '&code=abcdefghi12345'})).status,302);
 const payload=JSON.stringify({agentId:'studio-director',threadId,brief,idempotencyKey:key});
 assert.equal((await client.createSong({headers:{...headers,origin:'https://evil.test'},body:payload})).status,403);
 assert.equal(calls,0);
 const first=await client.createSong({headers,body:payload});
 assert.equal(first.status,202);
 assert.equal(first.body.accepted,true);
 assert.equal(first.body.status,'submitted_unverified');
 assert.equal(calls,1);
 const second=await client.createSong({headers,body:payload});
 assert.equal(second.status,409);
 assert.equal(second.body.error,'audio_create_already_submitted');
 assert.equal(calls,1);
 assert.doesNotMatch(JSON.stringify(first),/access-token-12345678|original line/);
});
