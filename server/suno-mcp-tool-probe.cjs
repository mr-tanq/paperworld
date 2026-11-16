/* Strict read-only MCP capability probe for Suno.
 * Only the tools/list JSON-RPC method can be sent. No tools/call,
 * no music generation, no browser token exposure. Modern 2026-07-28
 * stateless HTTP servers only; older MCP servers fail closed for now.
 */
'use strict';
const ENDPOINT='https://api.suno.com/mcp';
const VERSION='2026-07-28';
const MAX_BODY=32000,MAX_TOOLS=100;
function summarize(result){
 if(!result||result.jsonrpc!=='2.0'||result.id!==1||result.error||
   !result.result||!Array.isArray(result.result.tools)||
   result.result.tools.length>MAX_TOOLS)return null;
 const names=[];
 for(const tool of result.result.tools){
  if(!tool||typeof tool.name!=='string'||
    !/^[a-zA-Z0-9_.\/-]{1,100}$/.test(tool.name))return null;
  names.push(tool.name);
 }
 if(new Set(names).size!==names.length)return null;
 // Never send descriptions, input schemas or provider data to the browser.
 return {toolCount:names.length,tools:names};
}
function makeSunoMcpToolProbe({fetcher=globalThis.fetch}={}){
 if(typeof fetcher!=='function')throw Error('fetcher_required');
 async function inspect({accessToken}={}){
  if(typeof accessToken!=='string'||accessToken.length<12||accessToken.length>8192)
   return {available:false,reason:'not_authorized'};
  const request={jsonrpc:'2.0',id:1,method:'tools/list',params:{
   _meta:{'io.modelcontextprotocol/protocolVersion':VERSION}
  }};
  try{
   const response=await fetcher(ENDPOINT,{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(7000),
    headers:{
     Authorization:'Bearer '+accessToken,
     'Content-Type':'application/json',
     Accept:'application/json',
     'MCP-Protocol-Version':VERSION,
     'Mcp-Method':'tools/list'
    },body:JSON.stringify(request)});
   if(response.status===401||response.status===403)
    return {available:false,reason:'authorization_rejected'};
   if(response.status!==200)
    return {available:false,reason:'unsupported_mcp_transport'};
   const contentType=response.headers?.get?.('content-type')||'';
   if(!/^application\/json\b/i.test(contentType))
    return {available:false,reason:'unsupported_mcp_transport'};
   const length=response.headers?.get?.('content-length');
   if(length!==null&&length!==undefined&&
      (Number(length)>MAX_BODY||!Number.isFinite(Number(length))))
    return {available:false,reason:'unverified_mcp_response'};
   const payload=await response.text();
   if(payload.length>MAX_BODY)return {available:false,reason:'unverified_mcp_response'};
   const result=summarize(JSON.parse(payload));
   if(!result)return {available:false,reason:'unverified_mcp_response'};
   // A tool list alone is NOT authorization to invoke any tool.
   return {available:true,reason:'read_only_tools_verified',
    toolCount:result.toolCount,tools:result.tools};
  }catch(_){return {available:false,reason:'mcp_probe_unavailable'}}
 }
 return Object.freeze({inspect});
}
module.exports=Object.freeze({makeSunoMcpToolProbe,summarize,ENDPOINT,VERSION});
