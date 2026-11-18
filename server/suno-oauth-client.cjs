/* Suno MCP owner-scoped OAuth PKCE client. No music tool invocation.
 * Supports Client ID Metadata Documents only when provider explicitly advertises
 * them; fails closed otherwise. Tokens are process-memory-only.
 */
'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {createSunoOAuthDiscovery}=require('./suno-oauth-discovery.cjs');
const {makeSunoMcpToolProbe}=require('./suno-mcp-tool-probe.cjs');
const APP='https://mr-tanq.github.io';
const HOST='https://paperworld-matt-test-6hmd.onrender.com';
const CLIENT_ID=HOST+'/auth/suno/client-metadata';
const CALLBACK=HOST+'/auth/suno/callback';
const RESOURCE='https://api.suno.com/mcp';
const OWNER=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const CODE=/^[A-Za-z0-9_.~%-]{8,1024}$/;
const AUTH_TTL=600000,MAX_TTL=3300000;
const SAFE_TOOL_REASONS=Object.freeze(new Set([
 'not_authorized','authorization_rejected','unsupported_mcp_transport',
 'unsupported_response_type','unverified_mcp_response','provider_rpc_rejected',
 'provider_rate_limited','provider_server_error','provider_endpoint_missing',
 'provider_timeout','mcp_probe_unavailable','legacy_probe_unavailable',
 'legacy_handshake_unverified','legacy_session_invalid','legacy_tools_unverified',
 'mcp_invalid_envelope','mcp_tools_missing','mcp_pagination_unsupported',
 'mcp_tool_limit_exceeded','mcp_invalid_tool_definition','mcp_response_oversized',
 'mcp_invalid_json','mcp_invalid_sse'
]));
function safeToolReason(verdict){
 if(verdict?.available===true)return 'mcp_capability_unverified';
 const reason=verdict?.reason;
 return typeof reason==='string'&&SAFE_TOOL_REASONS.has(reason)?
  reason:'mcp_capability_unverified';
}

const headers=Object.freeze({'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Access-Control-Allow-Origin':APP,'Vary':'Origin'});
function isSunoOrigin(s){
 try{const u=new URL(s);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
   (u.hostname==='suno.com'||u.hostname.endsWith('.suno.com'))&&
   (u.port===''||u.port==='443')&&s===u.href.replace(/\/$/,'')&&
   !u.pathname.includes('//');
 }catch(_){return false}
}
function serverMetadataUrls(issuer){
 if(!isSunoOrigin(issuer))return [];
 const u=new URL(issuer),suffix=u.pathname==='/'?'':u.pathname.replace(/\/$/,'');
 // RFC 8414: well-known before an issuer path; OIDC: after issuer path.
 return [u.origin+'/.well-known/oauth-authorization-server'+suffix,
  u.origin+suffix+'/.well-known/openid-configuration'];
}
function validServerMeta(m,origin){
 if(!m||typeof m!=='object'||Array.isArray(m)||m.issuer!==origin)return null;
 if(m.client_id_metadata_document_supported!==true)return null;
 if(!Array.isArray(m.code_challenge_methods_supported)||
    !m.code_challenge_methods_supported.includes('S256'))return null;
 if(!Array.isArray(m.response_types_supported)||
    !m.response_types_supported.includes('code'))return null;
 const result={};
 for(const key of ['authorization_endpoint','token_endpoint']){
  const url=m[key];
  if(typeof url!=='string'||url.length>1000)return null;
  let p;
  try{p=new URL(url)}catch(_){return null}
  if(p.origin!==new URL(origin).origin||p.protocol!=='https:'||p.username||p.password||
      p.search||p.hash)return null;
  result[key]=p.href;
 }
 return result;
}
function createSunoOAuthClient({identity,discovery,toolProbe,fetcher=globalThis.fetch,
 clock=Date.now}={}){
 if(typeof fetcher!=='function')throw Error('fetcher_required');
 const guard=identity||createSupabaseGuard({
  baseUrl:'https://jrevhzvrgenucuozjowm.supabase.co',
  publicKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL',fetcher});
 const provider=discovery||createSunoOAuthDiscovery({fetcher});
 const tools=toolProbe||makeSunoMcpToolProbe({fetcher});
 const pending=new Map(),linked=new Map();
 const answer=(status,body)=>({status,body,headers});
 const denied=(status,error)=>answer(status,{error});
 function cleanup(){
  const t=clock();
  for(const [key,v] of pending)if(v.expires<=t)pending.delete(key);
  for(const [key,v] of linked)if(v.expires<=t)linked.delete(key);
 }
 async function identify({headers:requestHeaders={},body}){
  if(requestHeaders.origin!==APP)return {error:denied(403,'origin_denied')};
  const bearer=requestHeaders.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))
   return {error:denied(401,'unauthorized')};
  if(typeof body!=='string'||Buffer.byteLength(body)>256)
   return {error:denied(413,'invalid_body')};
  let data;try{data=JSON.parse(body)}catch(_){return {error:denied(400,'invalid_json')}}
  if(!data||Object.keys(data).sort().join(',')!=='agentId,threadId'||
      data.agentId!=='studio-director'||!OWNER.test(data.threadId||''))
   return {error:denied(400,'invalid_request')};
  try{
   const token=bearer.slice(7);
   const {ownerId}=await guard.authenticate(token);
   if(!OWNER.test(ownerId||''))return {error:denied(401,'unauthorized')};
   if(!await guard.ownsThread({ownerId,threadId:data.threadId,
     agentId:'studio-director',token}))
    return {error:denied(404,'crow_thread_not_found')};
   return {ownerId};
  }catch(_){return {error:denied(401,'unauthorized')}}
 }
 async function capability(){
  const resource=await provider.inspect();
  if(!resource.metadataAvailable)return null;
  for(const issuer of resource.authorizationServers||[]){
   if(!isSunoOrigin(issuer))continue;
   for(const metadataUrl of serverMetadataUrls(issuer)){
    try{
     const response=await fetcher(metadataUrl,{
      method:'GET',redirect:'manual',signal:AbortSignal.timeout(5000),
      headers:{Accept:'application/json'}});
     if(response.status!==200||
        !/^application\/json\b/i.test(response.headers?.get?.('content-type')||''))continue;
     const text=await response.text();
     if(text.length>12000)continue;
     const endpoints=validServerMeta(JSON.parse(text),issuer);
     if(endpoints){
      const allowed=new Set(['api:v0','profile:read','library:read','credits:spend']);
      const declared=Array.isArray(resource.requestedScopes)?
       resource.requestedScopes.filter(v=>allowed.has(v)):[];
      return {...endpoints,requestedScopes:[...new Set(declared)]};
     }
    }catch(_){}
   }
  }
  return null;
 }
 async function start(req={}){
  const who=await identify(req);if(who.error)return who.error;
  cleanup();if(pending.size>=100)return denied(429,'oauth_busy');
  const meta=await capability();
  if(!meta)return denied(503,'suno_client_registration_not_verified');
  const state=randomBytes(32).toString('base64url');
  const verifier=randomBytes(32).toString('base64url');
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  pending.set(state,{ownerId:who.ownerId,verifier,tokenEndpoint:meta.token_endpoint,
    expires:clock()+AUTH_TTL});
  const url=new URL(meta.authorization_endpoint);
  url.searchParams.set('response_type','code');
  url.searchParams.set('client_id',CLIENT_ID);
  url.searchParams.set('redirect_uri',CALLBACK);
  url.searchParams.set('state',state);
  url.searchParams.set('code_challenge',challenge);
  url.searchParams.set('code_challenge_method','S256');
  url.searchParams.set('resource',RESOURCE);
  // User authorized Suno credits. Suno consent screen remains the grant authority.
  if(meta.requestedScopes.length)url.searchParams.set('scope',meta.requestedScopes.join(' '));
  return answer(200,{authorizationUrl:url.href,connected:false,
   canGenerate:false,expiresInSeconds:600});
 }
 async function status(req={}){
  const who=await identify(req);if(who.error)return who.error;
  cleanup();
  const token=linked.get(who.ownerId);
  return answer(200,{oauthAuthorized:!!token,canGenerate:false,ephemeral:true});
 }
 async function inspectTools(req={}){
  const who=await identify(req);if(who.error)return who.error;
  cleanup();
  const linkedToken=linked.get(who.ownerId);
  if(!linkedToken)return denied(409,'suno_oauth_required');
  // Owner initiated only; a successful OAuth link does not authorize a tools/call.
  const verdict=await tools.inspect({accessToken:linkedToken.accessToken});
  const allowed=verdict?.available===true&&
   Number.isSafeInteger(verdict.toolCount)&&verdict.toolCount>=0&&verdict.toolCount<=100&&
   Array.isArray(verdict.tools)&&verdict.tools.length===verdict.toolCount&&
   verdict.tools.every(name=>typeof name==='string'&&
    /^[a-zA-Z0-9_.-]{1,100}$/.test(name));
  return answer(200,{service:'suno_mcp',oauthAuthorized:true,
   toolsListed:allowed,canGenerate:false,
   toolCount:allowed?verdict.toolCount:0,
   reason:allowed?'read_only_tools_verified':safeToolReason(verdict)});
 }
 // Owner-initiated connection doctor. Only existing read-only discovery
 // and tools/list probes; no OAuth start, tools/call or generation.
 async function diagnose(req={}){
  const who=await identify(req);if(who.error)return who.error;
  cleanup();
  const session=linked.get(who.ownerId);
  let resourceAvailable=false,clientRegistrationSupported=false;
  try{
   const resource=await provider.inspect();
   resourceAvailable=resource?.metadataAvailable===true;
   if(resourceAvailable){
    const endpoints=await capability();
    clientRegistrationSupported=!!endpoints;
   }
  }catch(_){/* Provider availability is not permission to guess. */}
  let toolsListed=false,toolCount=0,toolReason='not_authorized';
  if(session){
   try{
    const verdict=await tools.inspect({accessToken:session.accessToken});
    toolReason=safeToolReason(verdict);
    if(verdict?.available===true&&
       Number.isSafeInteger(verdict.toolCount)&&verdict.toolCount>=0&&
       verdict.toolCount<=100&&Array.isArray(verdict.tools)&&
       verdict.tools.length===verdict.toolCount&&
       verdict.tools.every(x=>typeof x==='string'&&
        /^[a-zA-Z0-9_.-]{1,100}$/.test(x))){
      toolsListed=true;toolCount=verdict.toolCount;
    }
   }catch(_){toolReason='mcp_probe_unavailable'}
  }
  return answer(200,{service:'suno_mcp',resourceAvailable,
   clientRegistrationSupported,oauthAuthorized:!!session,
   toolsListed,toolCount,toolReason:toolsListed?'read_only_tools_verified':toolReason,
   canGenerate:false,
   nextStep:!resourceAvailable?'provider_resource_unavailable':
    !clientRegistrationSupported?'client_registration_unverified':
    !session?'owner_oauth_required':
    !toolsListed?'mcp_tools_unverified':'generation_not_enabled'});
 }
 async function callback({url}={}){
  // Only fixed, non-sensitive failure categories may reach the browser.
  // Never expose OAuth code, state, tokens, provider response or error descriptions.
  const reasons=new Set(['authorization_denied','authorization_expired',
    'token_exchange_rejected','token_response_invalid','provider_unavailable']);
  const redirect=(ok,reason)=>({status:302,body:null,headers:{'Location':APP+
    '/paperworld/?suno_link='+(ok?'connected':'failed')+
    (!ok&&reasons.has(reason)?'&suno_reason='+reason:''),
    'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  let u;try{u=new URL(url,CALLBACK)}catch(_){return redirect(false)}
  if(u.origin!==HOST||u.pathname!=='/auth/suno/callback')return redirect(false);
  const state=u.searchParams.get('state')||'';
  cleanup();
  const entry=pending.get(state);
  pending.delete(state);
  if(!entry||entry.expires<=clock())return redirect(false,'authorization_expired');
  if(u.searchParams.has('error'))return redirect(false,'authorization_denied');
  if(!CODE.test(u.searchParams.get('code')||''))
   return redirect(false,'token_response_invalid');
  try{
   const params=new URLSearchParams({grant_type:'authorization_code',
    code:u.searchParams.get('code'),redirect_uri:CALLBACK,
    client_id:CLIENT_ID,code_verifier:entry.verifier,resource:RESOURCE});
   const response=await fetcher(entry.tokenEndpoint,{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),
    headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
    body:params.toString()});
   if(response.status!==200||
      !/^application\/json\b/i.test(response.headers?.get?.('content-type')||''))
    return redirect(false,'token_exchange_rejected');
   const body=await response.text();
   if(body.length>12000)return redirect(false,'token_response_invalid');
   const data=JSON.parse(body);
   if(typeof data.access_token!=='string'||data.access_token.length<12||
      data.access_token.length>8192||data.token_type?.toLowerCase()!=='bearer')
    return redirect(false,'token_response_invalid');
   const ttl=Number(data.expires_in);
   if(!Number.isSafeInteger(ttl)||ttl<1)return redirect(false,'token_response_invalid');
   linked.set(entry.ownerId,{accessToken:data.access_token,
    expires:clock()+Math.min(ttl*1000,MAX_TTL)});
   return redirect(true);
  }catch(_){return redirect(false,'provider_unavailable')}
 }
 function clientMetadata(){
  return {client_id:CLIENT_ID,client_name:'Paperworld — Crow Music Studio',
   client_uri:APP+'/paperworld/',redirect_uris:[CALLBACK],
   grant_types:['authorization_code'],response_types:['code'],
   token_endpoint_auth_method:'none'};
 }
 return Object.freeze({start,status,inspectTools,diagnose,callback,clientMetadata});
}
module.exports=Object.freeze({createSunoOAuthClient,validServerMeta,isSunoOrigin,
 serverMetadataUrls,CLIENT_ID,CALLBACK});
