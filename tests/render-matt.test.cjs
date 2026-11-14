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
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(raw)}));
  });req.on('error',reject);req.end();
 });
}
test('Render bootstrap is a real HTTP listener and never invokes AI',async()=>{
 const app=createRenderMattServer();
 const address=await app.listen({port:0,host:'127.0.0.1'});
 try{
  const health=await request(address.port,'/health');
  assert.equal(health.status,200);
  assert.equal(health.body.aiEnabled,false);
  assert.equal(health.headers['cache-control'],'no-store');
  const chat=await request(address.port,'/chat/matt','POST');
  assert.equal(chat.status,503);
  assert.deepEqual(chat.body,{error:'ai_not_connected'});
  assert.equal(chat.headers['access-control-allow-origin'],undefined);
  assert.equal((await request(address.port,'/auth/github/callback')).status,404);
  assert.equal((await request(address.port,'/')).status,404);
 }finally{await app.close()}
});
test('Render blueprint pins free tier and blocks autodeploys',()=>{
 const config=fs.readFileSync(path.join(__dirname,'../render.yaml'),'utf8');
 assert.match(config,/plan: free/);
 assert.match(config,/autoDeployTrigger: 'off'/);
 assert.match(config,/healthCheckPath: \/health/);
 assert.match(config,/startCommand: node server\/render-matt\.cjs/);
 assert.doesNotMatch(config,/sync: false|generateValue|paid|postgres|creditCard|copilot-requests: write/i);
});
test('Source is status-only, without credentials or model client',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server/render-matt.cjs'),'utf8');
 assert.doesNotMatch(source,/CopilotClient|createSession\(|GITHUB_TOKEN|service_role|client_secret|access_token|sendAndWait\(/);
 assert.match(source,/aiEnabled:false/);
 assert.match(source,/ai_not_connected/);
});
