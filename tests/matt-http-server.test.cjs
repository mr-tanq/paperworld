'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createMattHttpServer}=require('../server/matt-http-server.cjs');
function ask(port,path,method='GET',body=''){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path,method,headers:{'Content-Type':'application/json'}},res=>{
   let chunks='';res.on('data',c=>chunks+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(chunks)}));
  });req.on('error',reject);req.end(body);
 });
}
test('Real HTTP listener binds only to loopback and rejects AI by default',async()=>{
 const app=createMattHttpServer();
 const address=await app.listen();
 try{
  assert.equal(address.address,'127.0.0.1');
  const health=await ask(address.port,'/health');
  assert.equal(health.status,200);assert.equal(health.body.aiEnabled,false);
  const chat=await ask(address.port,'/chat/matt','POST',JSON.stringify({message:'Hello'}));
  assert.equal(chat.status,503);assert.equal(chat.body.error,'ai_not_configured');
  assert.equal(chat.headers['cache-control'],'no-store');
  assert.equal((await ask(address.port,'/chat/matt')).status,405);
  assert.equal((await ask(address.port,'/unlisted')).status,404);
 }finally{await app.close()}
});
test('No injected gateway can create successful AI response through this status-only listener',async()=>{
 let calls=0;
 const app=createMattHttpServer({gateway:{handle:async()=>{calls++;return {status:200,body:'{"content":"fake"}'}}}});
 const address=await app.listen();
 try{
  const response=await ask(address.port,'/chat/matt','POST','{"message":"hello"}');
  assert.equal(response.status,503);assert.equal(response.body.error,'ai_not_enabled');
  assert.equal(calls,1);assert.ok(!JSON.stringify(response).includes('fake'));
 }finally{await app.close()}
});
test('Oversized requests are denied before gateway and invalid ports reject',async()=>{
 let calls=0;
 const app=createMattHttpServer({gateway:{handle:async()=>{calls++;return {status:403}}}});
 await assert.rejects(app.listen({port:-1}),/Invalid port/);
 const address=await app.listen();
 try{
  const response=await ask(address.port,'/chat/matt','POST','x'.repeat(6000));
  assert.equal(response.status,413);assert.equal(calls,0);
 }finally{await app.close()}
});
