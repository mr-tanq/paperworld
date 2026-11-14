/* PAPERWORLD Render Free server. AI gated by owner auth, consent and model quota.
 * Never log or return OAuth tokens. No autonomous tools or background work.
 */
'use strict';
const http=require('node:http');
const {createGithubOAuth,APP_ORIGIN}=require('./github-oauth.cjs');
const {makeMattChat}=require('./matt-live-chat.cjs');
const {createCopilotClient}=require('./copilot-client-loader.cjs');
function response(res,status,body){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options':'DENY'});
 res.end(JSON.stringify(body));
}
function createRenderMattServer({oauth=createGithubOAuth({
  clientId:process.env.GITHUB_OAUTH_CLIENT_ID,
  clientSecret:process.env.GITHUB_OAUTH_CLIENT_SECRET,
  supabaseUrl:'https://jrevhzvrgenucuozjowm.supabase.co',
  supabaseKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL'
 }),chatFactory=({oauth})=>makeMattChat({oauth,clientFactory:createCopilotClient})}={}){
 let live;
 function getLive(){if(!live)live=chatFactory({oauth});return live}
 const server=http.createServer(async(req,res)=>{
  // Never enable CORS or accept browser credentials until a full OAuth review.
  if(req.method==='GET'&&req.url==='/health')
   return response(res,200,{service:'paperworld-matt',reachable:true,aiEnabled:true,stage:'authenticated-chat-guarded'});
  if(req.url==='/auth/github/callback' || req.url?.startsWith('/auth/github/callback?')){
   const result=await oauth.callback({url:req.url});
   res.writeHead(result.status,result.headers);res.end();return;
  }
  const isOAuth=req.url==='/auth/github/start'||req.url==='/auth/github/status';
  if(isOAuth){
   const origin=req.headers.origin;
   if(origin===APP_ORIGIN&&req.method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'authorization,content-type',
      'Access-Control-Max-Age':'600','Vary':'Origin'});res.end();return;
   }
   if(req.method!=='POST'){response(res,405,{error:'method_not_allowed'});return}
   try{
    const action=req.url.endsWith('/start')?oauth.start:oauth.status;
    const result=await action({headers:req.headers});
    res.writeHead(result.status,result.headers);res.end(JSON.stringify(result.body));return;
   }catch(_){response(res,503,{error:'oauth_unavailable'});return}
  }
  if(req.url==='/chat/matt'){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   let parts=[],total=0;
   try{
    for await(const chunk of req){
     total+=chunk.length;
     if(total>4000){res.writeHead(413,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'request_too_large'}));return}
     parts.push(chunk);
    }
    const result=await getLive().handle({headers:req.headers,
      body:Buffer.concat(parts).toString('utf8')});
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store','Access-Control-Allow-Origin':APP_ORIGIN,
      'Vary':'Origin','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'chat_unavailable'})}
  }
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
 createRenderMattServer().listen().then(()=>process.stdout.write('PAPERWORLD Matt server ready (AI guarded; no model call during startup)\n'))
  .catch(()=>{process.stderr.write('PAPERWORLD hosting check failed\n');process.exitCode=1});
}
module.exports=Object.freeze({createRenderMattServer});
