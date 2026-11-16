/* Read-only Suno MCP OAuth resource-metadata discovery.
 * No login, tokens, music tools or credits are used. Fixed URLs only.
 */
'use strict';
const ENDPOINT='https://api.suno.com/mcp';
const METADATA_URLS=Object.freeze([
 'https://api.suno.com/.well-known/oauth-protected-resource/mcp',
 'https://api.suno.com/.well-known/oauth-protected-resource'
]);
function safeMetadata(json){
 if(!json||typeof json!=='object'||Array.isArray(json))return null;
 if(typeof json.resource!=='string'||json.resource!==ENDPOINT)return null;
 if(!Array.isArray(json.authorization_servers)||!json.authorization_servers.length||
  json.authorization_servers.length>8)return null;
 const servers=json.authorization_servers;
 if(!servers.every(s=>typeof s==='string'&&s.length<500&&
  /^https:\/\/[a-z0-9.-]+(?::443)?(?:\/[^?#]*)?$/i.test(s)))return null;
 // Preserve issuer paths: Suno can advertise an OAuth issuer beneath /api/.
 // Reducing this value to URL.origin breaks RFC 8414 metadata discovery.
 // Only retain the two least-privilege read scopes for discovery.
 // Never request credits:spend, create:generate, write or download here.
 const allowed=new Set(['profile:read','library:read']);
 const scopes=Array.isArray(json.scopes_supported)?
  json.scopes_supported.filter(v=>typeof v==='string'&&allowed.has(v)):[];
 return {authorizationServers:servers.map(s=>new URL(s).href.replace(/\/$/,'')),
  readScopes:[...new Set(scopes)]};
}
function createSunoOAuthDiscovery({fetcher=globalThis.fetch,timeoutMs=4000}={}){
 if(typeof fetcher!=='function')throw Error('fetcher_required');
 async function inspect(){
  // A metadata read is not proof of successful user authorization.
  for(const url of METADATA_URLS){
   try{
    const res=await fetcher(url,{method:'GET',redirect:'manual',
     headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
    if(res.status!==200||!/^application\/json\b/i.test(res.headers?.get?.('content-type')||''))continue;
    const text=await res.text();
    if(text.length>12000)continue;
    const parsed=safeMetadata(JSON.parse(text));
    if(parsed)return {metadataAvailable:true,oauthConnected:false,
      canGenerate:false,provider:'Suno MCP',resource:ENDPOINT,
      authorizationServers:parsed.authorizationServers,
      readScopes:parsed.readScopes};
   }catch(_){/* Failure stays an unverified discovery; no error details leaked. */}
  }
  return {metadataAvailable:false,oauthConnected:false,canGenerate:false,
   provider:'Suno MCP',resource:ENDPOINT,authorizationServers:[],readScopes:[]};
 }
 return Object.freeze({inspect});
}
module.exports=Object.freeze({createSunoOAuthDiscovery,safeMetadata,METADATA_URLS});
