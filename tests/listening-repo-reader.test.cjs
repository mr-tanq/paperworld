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
