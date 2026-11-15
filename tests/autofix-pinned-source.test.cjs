'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPinnedTicketSwapSource,gitBlobSha}=
 require('../server/autofix-pinned-source.cjs');
const ownerId='22222222-2222-4222-8222-222222222222';
const base='a'.repeat(40);
const paths=['js/ticketswap-check.js','js/concert-ticketswap.js'];
const files=Object.fromEntries(paths.map(p=>[p,"import {ok} from './module.js';\n// "+p+"\nexport const ok=true;\n"]));
function fake({token='gho_SAFE_FAKE_TOKEN_123456',refChange=false,
 malformed=false,tamperBlob=false,httpStatus=200,networkFail=false}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(networkFail)throw Error('SECRET_PRIVATE_NETWORK_DIAGNOSTIC');
  if(httpStatus!==200)return {status:httpStatus,json:async()=>({message:'SECRET_GITHUB_RESPONSE'})};
  if(url.endsWith('/git/ref/heads/main'))
   return {status:200,json:async()=>({ref:refChange?'refs/heads/other':'refs/heads/main',
    object:{type:'commit',sha:base}})};
  const p=paths.find(path=>url.includes('/contents/'+path+'?ref='+base));
  if(!p)throw Error('unexpected request');
  const bytes=Buffer.from(files[p]);
  return {status:200,json:async()=>malformed?{path:p,type:'dir'}:{
   type:'file',path:p,encoding:'base64',size:bytes.length,
   sha:tamperBlob?'f'.repeat(40):gitBlobSha(bytes),
   content:bytes.toString('base64')
  }};
 };
 const reader=createPinnedTicketSwapSource({
  getOwnerToken:async({ownerId:id})=>id===ownerId?token:null,fetcher
 });
 return {reader,calls};
}
test('Uses linked OAuth only for immutable fixed GETs and verifies Git blob bytes',async()=>{
 const f=fake();
 const data=await f.reader.readSources({ownerId,repository:'mr-tanq/concerts'});
 assert.equal(data.baseCommitSha,base);
 assert.equal(data.readOnly,true);
 assert.deepEqual(data.files,paths);
 assert.deepEqual(Object.keys(data.trustedSources),paths);
 for(const p of paths)assert.equal(data.trustedSources[p].content,files[p]);
 assert.equal(f.calls.length,3);
 assert.ok(f.calls[0].url.endsWith('/git/ref/heads/main'));
 assert.ok(f.calls.slice(1).every(x=>x.url.endsWith('?ref='+base)));
 for(const call of f.calls){
  assert.equal(new URL(call.url).host,'api.github.com');
  assert.equal(call.options.method,'GET');
  assert.equal(call.options.redirect,'error');
  assert.equal(call.options.headers.Authorization,'Bearer gho_SAFE_FAKE_TOKEN_123456');
 }
 assert.equal('write' in f.reader,false);
});
test('Refuses wrong repository, malformed owner or missing OAuth before network',async()=>{
 const f=fake();
 for(const input of [{ownerId,repository:'other/concerts'},
  {ownerId:'not-uuid',repository:'mr-tanq/concerts'}]){
  await assert.rejects(f.reader.readSources(input),/source_scope_denied/);
 }
 assert.equal(f.calls.length,0);
 const other=fake({token:null});
 await assert.rejects(other.reader.readSources({ownerId,repository:'mr-tanq/concerts'}),
  /github_reconnect_required/);
 assert.equal(other.calls.length,0);
});
test('Fail closed on unexpected main ref, altered source blob or invalid metadata',async()=>{
 for(const options of [{refChange:true},{tamperBlob:true},{malformed:true}]){
  const f=fake(options);
  await assert.rejects(f.reader.readSources({ownerId,repository:'mr-tanq/concerts'}));
 }
});
test('Does not return server response bodies, source or tokens in errors',async()=>{
 for(const options of [{httpStatus:403},{httpStatus:401},{networkFail:true}]){
  const f=fake(options);
  await assert.rejects(f.reader.readSources({ownerId,repository:'mr-tanq/concerts'}),err=>{
   assert.doesNotMatch(String(err),/SECRET|SAFE_FAKE_TOKEN/);
   return true;
  });
 }
});
test('No reader without trusted owner-specific token broker',()=>{
 assert.throws(()=>createPinnedTicketSwapSource({}),/trusted_reader_dependencies_required/);
 assert.throws(()=>createPinnedTicketSwapSource({getOwnerToken:null}),
  /trusted_reader_dependencies_required/);
});
