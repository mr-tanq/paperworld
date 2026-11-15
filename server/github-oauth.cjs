/* PAPERWORLD GitHub OAuth link — real user-linked authentication, NO AI.
 * The Render Free prototype keeps user tokens in MEMORY ONLY; they disappear
 * when the free service sleeps/restarts. Never send them to GitHub Pages.
 */
'use strict';
const {randomBytes}=require('node:crypto');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const APP_ORIGIN='https://mr-tanq.github.io';
const BASE_CALLBACK='https://paperworld-matt-test-6hmd.onrender.com/auth/github/callback';
const STATE_TTL=10*60*1000, TOKEN_TTL=55*60*1000;
const validId=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const validCode=/^[A-Za-z0-9_-]{10,300}$/;
function createGithubOAuth({clientId,clientSecret,callbackUrl=BASE_CALLBACK,
  supabaseUrl,supabaseKey,fetcher=globalThis.fetch,clock=Date.now}={}){
 if(!/^https:\/\/[^/?#]+\/auth\/github\/callback$/.test(callbackUrl))
  throw Error('Fixed HTTPS OAuth callback required');
 const enabled=typeof clientId==='string'&&/^[a-zA-Z0-9]{8,100}$/.test(clientId)&&
  typeof clientSecret==='string'&&clientSecret.length>=16;
 const guard=(supabaseUrl&&supabaseKey&&typeof fetcher==='function')?
  createSupabaseGuard({baseUrl:supabaseUrl,publicKey:supabaseKey,fetcher}):null;
 const states=new Map(),linked=new Map();
 const clean=()=>{
  const now=clock();
  for(const [k,v] of states)if(v.expires<=now)states.delete(k);
  for(const [k,v] of linked)if(v.expires<=now)linked.delete(k);
 };
 const json=(status,body)=>({status,body,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','Vary':'Origin',
  'Access-Control-Allow-Origin':APP_ORIGIN}});
 const redirect=(where)=>({status:302,body:null,headers:{
  'Location':where,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 const error=(status,reason)=>json(status,{error:reason});
 async function owner(headers={}){
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer)||!guard)throw Error('Unauthorized');
  const identity=await guard.authenticate(bearer.slice(7));
  if(!validId.test(identity.ownerId))throw Error('Unauthorized');
  return identity.ownerId;
 }
 async function start({headers={}}={}){
  if(headers.origin!==APP_ORIGIN)return error(403,'origin_denied');
  if(!enabled||!guard)return error(503,'oauth_not_configured');
  let ownerId;
  try{ownerId=await owner(headers)}catch(_){return error(401,'unauthorized')}
  clean();
  if(states.size>=100)return error(429,'try_again_later');
  const state=randomBytes(32).toString('base64url');
  states.set(state,{ownerId,expires:clock()+STATE_TTL});
  const params=new URLSearchParams({
   client_id:clientId,redirect_uri:callbackUrl,state,allow_signup:'false',
   // GitHub displays the repository-write scope for explicit human consent.
   scope:'public_repo'
  });
  return json(200,{authorizationUrl:'https://github.com/login/oauth/authorize?'+params});
 }
 async function callback({url}={}){
  const fail=redirect(APP_ORIGIN+'/paperworld/?github_link=failed');
  if(!enabled||!guard)return fail;
  let parsed;
  try{parsed=new URL(url,callbackUrl)}catch(_){return fail}
  if(parsed.origin!==new URL(callbackUrl).origin||parsed.pathname!==new URL(callbackUrl).pathname)
   return fail;
  const state=parsed.searchParams.get('state')||'',code=parsed.searchParams.get('code')||'';
  clean();
  const pending=states.get(state);
  // Single use even when the exchange fails.
  states.delete(state);
  if(!pending||!validCode.test(code)||pending.expires<=clock()||parsed.searchParams.has('error'))
   return fail;
  try{
   const exchange=await fetcher('https://github.com/login/oauth/access_token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({client_id:clientId,client_secret:clientSecret,
       code,redirect_uri:callbackUrl})
   });
   if(!exchange.ok)return fail;
   const payload=await exchange.json();
   const token=payload?.access_token;
   if(typeof token!=='string'||!/^(gho_|ghu_)[A-Za-z0-9_]+$/.test(token))
    return fail;
   const profile=await fetcher('https://api.github.com/user',{
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
     'X-GitHub-Api-Version':'2022-11-28'},
    redirect:'error',signal:AbortSignal.timeout(8000)
   });
   if(!profile.ok)return fail;
   const user=await profile.json();
   if(!Number.isSafeInteger(user?.id)||user.id<=0||typeof user?.login!=='string'||
     !/^[a-z0-9-]{1,39}$/i.test(user.login))return fail;
   const lifetime=Number(payload.expires_in);
   const ttl=Number.isFinite(lifetime)&&lifetime>0?
     Math.min(TOKEN_TTL,Math.floor(lifetime)*1000):TOKEN_TTL;
   // The token never enters the redirect URL or browser response.
   const scopes=String(profile.headers?.get?.('x-oauth-scopes')||'')
    .split(',').map(x=>x.trim());
   const writeEnabled=user.login.toLowerCase()==='mr-tanq'&&
    (scopes.includes('public_repo')||scopes.includes('repo'));
   linked.set(pending.ownerId,{token,githubId:user.id,login:user.login,
    writeEnabled,expires:clock()+ttl});
   return redirect(APP_ORIGIN+'/paperworld/?github_link=connected');
  }catch(_){return fail}
 }
 async function status({headers={}}={}){
  if(headers.origin!==APP_ORIGIN)return error(403,'origin_denied');
  let ownerId;
  try{ownerId=await owner(headers)}catch(_){return error(401,'unauthorized')}
  clean();
  const link=linked.get(ownerId);
  return json(200,link?{connected:true,login:link.login,ephemeral:true,
    ...(link.writeEnabled?{writeEnabled:true}:{})}:
    {connected:false,ephemeral:true});
 }
 // Future AI bridge MUST still separately claim a one-time approval before
 // requesting a token. Exposes no token from HTTP endpoints.
 function getLinkedWriteToken({ownerId}={}){
  if(typeof ownerId!=='string'||!validId.test(ownerId))return null;
  clean();
  const link=linked.get(ownerId);
  return link?.writeEnabled===true?link.token:null;
 }
 function getLinkedToken({ownerId}={}){
  if(typeof ownerId!=='string'||!validId.test(ownerId))return null;
  clean();
  return linked.get(ownerId)?.token||null;
 }
 return Object.freeze({enabled:enabled&&!!guard,start,callback,status,getLinkedToken,getLinkedWriteToken});
}
module.exports=Object.freeze({createGithubOAuth,APP_ORIGIN,BASE_CALLBACK});
