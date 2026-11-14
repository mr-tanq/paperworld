/* PAPERWORLD Render Free bootstrap. PUBLIC HTTP, AI intentionally OFF.
 * No OAuth tokens, Copilot SDK or private project data available here.
 * This file only proves HTTPS reachability after explicitly approved deployment.
 */
'use strict';
const http=require('node:http');
function response(res,status,body){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options':'DENY'});
 res.end(JSON.stringify(body));
}
function createRenderMattServer(){
 const server=http.createServer((req,res)=>{
  // Never enable CORS or accept browser credentials until a full OAuth review.
  if(req.method==='GET'&&req.url==='/health')
   return response(res,200,{service:'paperworld-matt',reachable:true,aiEnabled:false,stage:'hosting-smoke-test'});
  if(req.url==='/chat/matt')
   return response(res,503,{error:'ai_not_connected'});
  return response(res,404,{error:'not_found'});
 });
 server.requestTimeout=10000;
 server.headersTimeout=5000;
 server.maxRequestsPerSocket=20;
 function listen({port=process.env.PORT===undefined?8787:Number(process.env.PORT),host='0.0.0.0'}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
  return new Promise((resolve,reject)=>{
   server.once('error',reject);
   server.listen(port,host,()=>{server.removeListener('error',reject);resolve(server.address())});
  });
 }
 return Object.freeze({server,listen,close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))});
}
if(require.main===module){
 createRenderMattServer().listen().then(()=>process.stdout.write('PAPERWORLD hosting check ready (AI DISABLED)\n'))
  .catch(()=>{process.stderr.write('PAPERWORLD hosting check failed\n');process.exitCode=1});
}
module.exports=Object.freeze({createRenderMattServer});
