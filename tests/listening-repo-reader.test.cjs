'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRepoReader,FILES}=require('../server/listening-repo-reader.cjs');
function mockRead(){
 const urls=[],requests=[];
 const fetcher=async(url,opts)=>{
  urls.push(url);requests.push(opts);
  const p=new URL(url).pathname.split('/contents/')[1];
  const path=decodeURIComponent(p);
  const source='// SOURCE for '+path+'\nconst answer = 42;\n';
  return {ok:true,json:async()=>({
   type:'file',path,encoding:'base64',size:Buffer.byteLength(source),
   sha:'a'.repeat(40),content:Buffer.from(source).toString('base64')
  })};
 };
 return {reader:createRepoReader({fetcher}),urls,requests};
}
test('Worker reads exactly fixed Listening Mirror files using GET, public and no token',async()=>{
 const {reader,urls,requests}=mockRead();
 const result=await reader.read('ticketing');
 assert.equal(result.repository,'mr-tanq/concerts');
 assert.equal(result.ref,'main');
 assert.equal(result.readOnly,true);
 assert.equal(result.files.length,3);
 assert.deepEqual(result.files.map(x=>x.path),FILES.ticketing);
 assert.match(result.files[0].lines,/L1 \/\/ SOURCE/);
 assert.match(result.files[0].url,/github.com\/mr-tanq\/concerts\/blob\/main/);
 assert.equal(urls.length,3);
 urls.forEach(u=>assert.match(u,/^https:\/\/api.github.com\/repos\/mr-tanq\/concerts\/contents\//));
 requests.forEach(r=>{
  assert.equal(r.method,'GET');
  assert.equal(r.redirect,'error');
  assert.equal(r.headers.Authorization,undefined);
  assert.equal(r.headers.authorization,undefined);
 });
});
test('Only preapproved categories and exact allowlisted file paths',async()=>{
 const {reader,urls}=mockRead();
 for(const category of ['../../other','hack','__proto__','constructor','']){
  await assert.rejects(reader.read(category),/Unknown allowlisted category/);
 }
 assert.equal(urls.length,0);
 for(const category of ['artwork','general']){
  const result=await reader.read(category);
  assert.deepEqual(result.files.map(f=>f.path),FILES[category]);
 }
});
test('Reader fails closed on wrong path, oversized source, HTTP denial and altered metadata',async()=>{
 const name=FILES.artwork[0];
 for(const data of [
  {type:'dir',path:name,encoding:'base64',content:'YQ==',size:1},
  {type:'file',path:'../secrets',encoding:'base64',content:'YQ==',size:1},
  {type:'file',path:name,encoding:'utf-8',content:'secret',size:6},
  {type:'file',path:name,encoding:'base64',content:'YQ==',size:12001}
 ]){
  const reader=createRepoReader({fetcher:async()=>({ok:true,json:async()=>data})});
  await assert.rejects(reader.read('artwork'));
 }
 const unavailable=createRepoReader({fetcher:async()=>({ok:false,status:404})});
 await assert.rejects(unavailable.read('artwork'),/repository_read_unavailable/);
});
test('No mutable repository paths, branch selection or GitHub writes exposed',()=>{
 for(const paths of Object.values(FILES)){
  for(const p of paths){
   assert.ok(!p.startsWith('/')&&!p.includes('..')&&!p.includes('?'));
   assert.ok(!p.includes('://'));
  }
 }
 const {reader}=mockRead();
 assert.equal(typeof reader.read,'function');
 assert.equal(typeof reader.write,'undefined');
 assert.equal(typeof reader.delete,'undefined');
});

test('Linked GitHub OAuth is used only for fixed Contents API GETs',async()=>{
 const {reader,urls,requests}=mockRead();
 await reader.read('ticketing',{token:'gho_SAFE_TEST_TOKEN'});
 assert.equal(urls.length,3);
 for(const request of requests){
  assert.equal(request.method,'GET');
  assert.equal(request.redirect,'error');
  assert.equal(request.headers.Authorization,'Bearer gho_SAFE_TEST_TOKEN');
 }
 assert.deepEqual(urls.map(u=>new URL(u).host),['api.github.com','api.github.com','api.github.com']);
});
test('GitHub failures have safe discriminated reason codes with no response text',async()=>{
 const cases=[
  [401,{},'github_auth_rejected'],
  [403,{'x-ratelimit-remaining':'0'},'github_rate_limited'],
  [403,{'x-ratelimit-remaining':'42'},'github_forbidden'],
  [404,{},'github_file_missing_or_inaccessible'],
  [429,{},'github_rate_limited'],
  [503,{},'github_upstream_unavailable']
 ];
 for(const [status,headers,code] of cases){
  const reader=createRepoReader({fetcher:async()=>({
   ok:false,status,headers:{get:key=>headers[key]},
   text:async()=>'SECRET_RESPONSE_MUST_NEVER_APPEAR'
  })});
  await assert.rejects(reader.read('ticketing',{token:'gho_SAFE_TEST_TOKEN'}),error=>{
   assert.equal(error.code,code);
   assert.equal(error.message,'repository_read_unavailable');
   assert.doesNotMatch(String(error),/SECRET_RESPONSE|SAFE_TEST_TOKEN/);
   return true;
  });
 }
});
test('Network and invalid GitHub credential errors fail closed',async()=>{
 const reader=createRepoReader({fetcher:async()=>{throw Error('SECRET_TOKEN_NETWORK_FAILURE')}});
 await assert.rejects(reader.read('ticketing',{token:'gho_SAFE_TEST_TOKEN'}),error=>{
  assert.equal(error.code,'github_network_unavailable');
  assert.doesNotMatch(String(error),/SECRET_TOKEN/);
  return true;
 });
 await assert.rejects(reader.read('ticketing',{token:'\nunsafe'}),error=>{
  assert.equal(error.code,'github_auth_invalid');return true;
 });
});

test('Server-selected festival artwork subset reads one exact file with no write access',async()=>{
 const {reader,urls,requests}=mockRead();
 const result=await reader.read('artwork',{selectedPaths:['js/festival-artwork.js']});
 assert.deepEqual(result.files.map(f=>f.path),['js/festival-artwork.js']);
 assert.equal(urls.length,1);
 assert.equal(requests[0].method,'GET');
 assert.equal(requests[0].headers.Authorization,undefined);
});
test('Selected subset rejects arbitrary, duplicate, out-of-category and empty paths before any fetch',async()=>{
 const {reader,urls}=mockRead();
 for(const selectedPaths of [[],['../secrets'],['js/festival-artwork.js','js/festival-artwork.js'],
  ['js/ticketswap-check.js'],['https://example.org'],['js/festival-artwork.js','other.js']]){
  await assert.rejects(reader.read('artwork',{selectedPaths}),/repository_selection_not_allowed/);
 }
 assert.equal(urls.length,0);
});
