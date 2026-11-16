/* Strict read-only MCP capability probe for Suno.
 * Only the tools/list JSON-RPC method can be sent. No tools/call,
 * no music generation, no browser token exposure. Modern 2026-07-28
 * modern stateless HTTP first; a bounded 2025 Streamable HTTP legacy
 * handshake is attempted only for explicit compatibility responses.
 * Supports bounded JSON and request-scoped SSE responses, not SSE sessions.
 */
'use strict';
const ENDPOINT='https://api.suno.com/mcp';
const VERSION='2026-07-28';
const MAX_BODY=32000,MAX_TOOLS=100;
function summarize(result){
 if(!result||result.jsonrpc!=='2.0'||result.id!==1||result.error||
   !result.result||!Array.isArray(result.result.tools)||
   result.result.tools.length>MAX_TOOLS||
   (result.result.nextCursor!==undefined&&result.result.nextCursor!==null))return null;
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
// Parse only finite request-scoped SSE frames. A provider may emit progress
// before the final JSON-RPC response. Never mistake a notification for a result.
function parseRequestSse(raw){
 if(typeof raw!=='string'||raw.length>MAX_BODY)return null;
 const frames=raw.replace(/\r\n/g,'\n').split(/\n\n/);
 if(frames.length>120)return null;
 let final=null;
 for(const frame of frames){
  if(!frame.trim())continue;
  const data=[];
  let event='message';
  for(const line of frame.split('\n')){
   if(!line||line.startsWith(':'))continue;
   if(line.startsWith('event:')){event=line.slice(6).trim();continue}
   if(line.startsWith('data:')){data.push(line.slice(5).trimStart());continue}
   // Reject malformed fields rather than treating partial streams as success.
   if(!/^(id|retry):/.test(line))return null;
  }
  if(event!=='message')continue;
  if(!data.length)continue;
  let parsed;
  try{parsed=JSON.parse(data.join('\n'))}catch(_){return null}
  if(!parsed||typeof parsed!=='object'||parsed.jsonrpc!=='2.0')return null;
  if(parsed.id===1){
   if(final!==null)return null;
   final=parsed;
  }else if(Object.hasOwn(parsed,'id'))return null;
  // Notifications without an id are informational only; never executed.
 }
 return final;
}
function makeSunoMcpToolProbe({fetcher=globalThis.fetch}={}){
 if(typeof fetcher!=='function')throw Error('fetcher_required');
 async function inspect({accessToken}={}){
  if(typeof accessToken!=='string'||accessToken.length<12||accessToken.length>8192)
   return {available:false,reason:'not_authorized'};
  const request={jsonrpc:'2.0',id:1,method:'tools/list',params:{
   _meta:{'io.modelcontextprotocol/protocolVersion':VERSION,
    'io.modelcontextprotocol/clientInfo':{name:'Paperworld Crow',version:'1.0.0'},
    'io.modelcontextprotocol/clientCapabilities':{}}
  }};
  try{
   const response=await fetcher(ENDPOINT,{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(7000),
    headers:{
     Authorization:'Bearer '+accessToken,
     'Content-Type':'application/json',
     Accept:'application/json, text/event-stream',
     'MCP-Protocol-Version':VERSION,
     'Mcp-Method':'tools/list'
    },body:JSON.stringify(request)});
   if(response.status===401||response.status===403)
    return {available:false,reason:'authorization_rejected'};
   // Retry only on a genuine modern transport/version rejection.
   // Authorization failures, redirects and malformed successes MUST NOT fall back.
   if([400,404,406].includes(response.status)){
    const {makeLegacySunoMcpProbe}=require('./suno-mcp-legacy-probe.cjs');
    return makeLegacySunoMcpProbe({fetcher}).inspect({accessToken});
   }
   if(response.status!==200)
    return {available:false,reason:'unsupported_mcp_transport'};
   const contentType=response.headers?.get?.('content-type')||'';
   const isJson=/^application\/json\b/i.test(contentType);
   const isSse=/^text\/event-stream\b/i.test(contentType);
   if(!isJson&&!isSse)
    return {available:false,reason:'unsupported_mcp_transport'};
   const length=response.headers?.get?.('content-length');
   if(length!==null&&length!==undefined&&
      (Number(length)>MAX_BODY||!Number.isFinite(Number(length))))
    return {available:false,reason:'unverified_mcp_response'};
   const payload=await response.text();
   if(payload.length>MAX_BODY)return {available:false,reason:'unverified_mcp_response'};
   const message=isSse?parseRequestSse(payload):JSON.parse(payload);
   const result=summarize(message);
   if(!result)return {available:false,reason:'unverified_mcp_response'};
   // A tool list alone is NOT authorization to invoke any tool.
   return {available:true,reason:'read_only_tools_verified',
    toolCount:result.toolCount,tools:result.tools};
  }catch(_){return {available:false,reason:'mcp_probe_unavailable'}}
 }
 return Object.freeze({inspect});
}
module.exports=Object.freeze({makeSunoMcpToolProbe,summarize,parseRequestSse,ENDPOINT,VERSION});
