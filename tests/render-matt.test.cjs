'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {createRenderMattServer}=require('../server/render-matt.cjs');
function request(port,p,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,path:p,method},res=>{
   let raw='';res.on('data',chunk=>raw+=chunk);
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:raw?JSON.parse(raw):null}));
  });req.on('error',reject);req.end();
 });
}
test('Render bootstrap is a real HTTP listener and never invokes AI',async()=>{
 const app=createRenderMattServer();
 const address=await app.listen({port:0,host:'127.0.0.1'});
 try{
  const health=await request(address.port,'/health');
  assert.equal(health.status,200);
  assert.equal(health.body.aiEnabled,true);
  assert.equal(health.headers['cache-control'],'no-store');
  const chat=await request(address.port,'/chat/matt','POST');
  assert.equal(chat.status,403);
  assert.deepEqual(chat.body,{error:'origin_denied'});
  assert.equal(chat.headers['access-control-allow-origin'],undefined);
  const callback=await request(address.port,'/auth/github/callback');
  assert.equal(callback.status,302);
  assert.equal(callback.body,null);
  assert.match(callback.headers.location||'',/github_link=failed/);
  assert.equal((await request(address.port,'/')).status,404);
 }finally{await app.close()}
});
test('Render blueprint pins free tier and blocks autodeploys',()=>{
 const config=fs.readFileSync(path.join(__dirname,'../render.yaml'),'utf8');
 assert.match(config,/plan: free/);
 assert.match(config,/autoDeployTrigger: 'off'/);
 assert.match(config,/healthCheckPath: \/health/);
 assert.match(config,/startCommand: node server\/render-matt\.cjs/);
 assert.match(config,/npm install --omit=dev/);
 assert.doesNotMatch(config,/sync: false|generateValue|paid|postgres|creditCard|copilot-requests: write/i);
});
test('Server has no embedded GitHub secrets or unguarded tool execution',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server/render-matt.cjs'),'utf8');
 assert.doesNotMatch(source,/GITHUB_TOKEN|service_role|client_secret|access_token|sendAndWait\(/);
 assert.match(source,/aiEnabled:true/);
 assert.match(source,/chatFactory/);
});

test('Pokémon Worker HTTP route is isolated, POST-only, origin-checked and dispatches to explicit gateway',async()=>{
 let used=0;
 const app=createRenderMattServer({
  oauth:{callback:async()=>({status:302,headers:{Location:'/'}})},
  pokemonWorkerFactory:()=>({handle:async()=>{used++;return {
   status:200,body:{executed:true,delegated:true,directorId:'pokemon-director',
    workerId:'pokemon-developer',content:'Synthetic read-only report',persisted:false}
  }}})
 });
 const address=await app.listen({port:0,host:'127.0.0.1'});
 const call=(origin,method)=>new Promise((resolve,reject)=>{
  const request=http.request({host:'127.0.0.1',port:address.port,
   path:'/delegate/matt/pokemon/worker',method,headers:origin?{Origin:origin}:{}
  },res=>{let raw='';res.on('data',x=>raw+=x);
   res.on('end',()=>resolve({status:res.statusCode,
    body:raw?JSON.parse(raw):null}))});
  request.on('error',reject);request.end('{}');
 });
 try{
  assert.equal((await call(null,'POST')).status,403);
  assert.equal((await call('https://mr-tanq.github.io','GET')).status,405);
  const result=await call('https://mr-tanq.github.io','POST');
  assert.equal(result.status,200);
  assert.equal(result.body.workerId,'pokemon-developer');
  assert.equal(result.body.persisted,false);
  assert.equal(used,1);
 }finally{await app.close()}
});

test('Verified Matt route is streamed using original authenticated POST without model polling',async()=>{
 const fake={callback:async()=>({status:302,headers:{Location:'/'}})};
 const app=createRenderMattServer({oauth:fake,
  delegationFactory:()=>({handle:async({onProgress})=>{
   onProgress({stage:'routed',directorId:'studio-director'});
   onProgress({stage:'director_reported',directorId:'studio-director'});
   return {status:200,body:{executed:true,delegated:true,
    directorId:'studio-director',content:'Synthetic answer'}};
  }})
 });
 const addr=await app.listen({port:0,host:'127.0.0.1'});
 const call=accept=>new Promise((resolve,reject)=>{
  const rq=http.request({host:'127.0.0.1',port:addr.port,
   path:'/delegate/matt',method:'POST',
   headers:{Origin:'https://mr-tanq.github.io',...(accept?{Accept:accept}:{})}},
   response=>{let raw='';response.on('data',chunk=>raw+=chunk);
    response.on('end',()=>resolve({status:response.statusCode,
     contentType:response.headers['content-type'],raw}))});
  rq.on('error',reject);rq.end('{}');
 });
 try{
  const stream=await call('application/x-ndjson');
  assert.equal(stream.status,200);
  const events=stream.raw.trim().split('\n').map(x=>JSON.parse(x));
  assert.deepEqual(events.map(x=>x.type),['progress','progress','result']);
  assert.equal(events[0].stage,'routed');
  assert.equal(events[0].directorId,'studio-director');
  assert.equal(events[2].body.content,'Synthetic answer');
  const legacy=await call(null);
  assert.match(legacy.contentType,/application\/json/);
  assert.equal(JSON.parse(legacy.raw).content,'Synthetic answer');
 }finally{await app.close()}
});
