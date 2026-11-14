/* PAPERWORLD — loopback-only HTTP listener for a future Matt gateway.
 * Defaults to NO AI. Never exposed on a public interface.
 * No SDK import, secrets, Copilot credits or outbound requests.
 */
'use strict';
const http=require('node:http');
const MAX_BODY=5000;
const HOST='127.0.0.1';
function reply(res,status,body){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Access-Control-Allow-Origin':'null'});
 res.end(JSON.stringify(body));
}
function createMattHttpServer({gateway=null}={}){
 const server=http.createServer(async(req,res)=>{
  // No CORS opt-in, no cookies, never echo incoming authorization data.
  if(req.url==='/health'&&req.method==='GET'){
   reply(res,200,{service:'paperworld-matt',aiEnabled:false,mode:'loopback'});
   return;
  }
  if(req.url!=='/chat/matt'){reply(res,404,{error:'not_found'});return}
  if(req.method!=='POST'){reply(res,405,{error:'method_not_allowed'});return}
  if(!gateway||typeof gateway.handle!=='function'){
   reply(res,503,{error:'ai_not_configured'});return;
  }
  // The injected gateway is server-owned, NEVER selected by client input.
  let body='',size=0,overflow=false;
  try{
   for await(const piece of req){
    size+=piece.length;
    if(size>MAX_BODY){overflow=true;break}
    body+=piece.toString('utf8');
   }
   if(overflow){reply(res,413,{error:'request_too_large'});return}
   const result=await gateway.handle({method:req.method,headers:req.headers,body});
   if(!result||!Number.isInteger(result.status)||result.status<400||result.status>599){
    // Guard deliberately does not serve successful AI responses until a
    // separately reviewed, production-ready listener is introduced.
    reply(res,503,{error:'ai_not_enabled'});return;
   }
   reply(res,result.status,{error:'request_rejected'});
  }catch(_){
   if(!res.headersSent)reply(res,503,{error:'service_unavailable'});
   else res.destroy();
  }
 });
 server.requestTimeout=10000;server.headersTimeout=5000;server.maxRequestsPerSocket=20;
 const listen=({port=0}={})=>new Promise((resolve,reject)=>{
  if(!Number.isInteger(port)||port<0||port>65535)return reject(Error('Invalid port'));
  server.once('error',reject);
  server.listen(port,HOST,()=>{server.removeListener('error',reject);resolve(server.address())});
 });
 return Object.freeze({listen,close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())),server});
}
if(require.main===module){
 // Opt-in manual command. Even when started, it cannot connect to Copilot.
 const port=Number(process.env.PAPERWORLD_MATT_PORT||8787);
 const instance=createMattHttpServer();
 instance.listen({port}).then(address=>{
  process.stdout.write('PAPERWORLD local Matt status-only server at http://'+HOST+':'+address.port+' (AI OFF)\n');
 }).catch(()=>{process.stderr.write('Could not start local Matt server\n');process.exitCode=1});
}
module.exports=Object.freeze({createMattHttpServer});
