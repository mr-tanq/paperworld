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
const MAX_BODY=512*1024,MAX_TOOLS=100;
// Suno can include substantial JSON schemas in tools/list. Keep an upper
// bound on actual network bytes, not just the Content-Length header.
async function readBoundedResponse(response){
 const length=response.headers?.get?.('content-length');
 if(length!==null&&length!==undefined){
  if(!/^\d{1,8}$/.test(length)||Number(length)>MAX_BODY)return null;
 }
 if(response.body&&typeof response.body.getReader==='function'){
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let size=0,data='';
  try{
   while(true){
    const part=await reader.read();
    if(part.done)break;
    if(!(part.value instanceof Uint8Array))return null;
    size+=part.value.byteLength;
    if(size>MAX_BODY){await reader.cancel().catch(()=>{});return null}
    data+=decoder.decode(part.value,{stream:true});
   }
   return data+decoder.decode();
  }finally{reader.releaseLock()}
 }
 // Test doubles without ReadableStream: still check actual UTF-8 byte size.
 const data=await response.text();
 return typeof data==='string'&&Buffer.byteLength(data,'utf8')<=MAX_BODY?data:null;
}
// Fixed response categories only. Never return response body, RPC messages,
// tool schemas, OAuth credentials, or private catalog data.
function responseFailure(message){
 if(!message||typeof message!=='object'||Array.isArray(message))return 'mcp_invalid_envelope';
 if(message.jsonrpc!=='2.0'||message.id!==1)return 'mcp_invalid_envelope';
 if(message.error)return 'provider_rpc_rejected';
 if(!message.result||typeof message.result!=='object'||
    !Array.isArray(message.result.tools))return 'mcp_tools_missing';
 if(message.result.nextCursor!=null)return 'mcp_pagination_unsupported';
 if(message.result.tools.length>MAX_TOOLS)return 'mcp_tool_limit_exceeded';
 return 'mcp_invalid_tool_definition';
}
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
// Only safe structural metadata for creation-like tools is returned to the
// authenticated Crow owner. No descriptions, prompt examples, or raw schemas.
function creationSignatures(message){
 const source=message?.result?.tools;
 if(!Array.isArray(source)||source.length>MAX_TOOLS)return [];
 const picked=[];
 for(const tool of source){
  if(!tool||typeof tool.name!=='string'||
     !/(^|[.\/-])(audio-create|create-song|generate-song|generate-music|music-create)$/.test(tool.name))continue;
  const schema=tool.inputSchema;
  if(!schema||typeof schema!=='object'||Array.isArray(schema))continue;
  const props=schema.properties;
  if(!props||typeof props!=='object'||Array.isArray(props))continue;
  const keys=Object.keys(props);
  if(keys.length>64||picked.length>=8)continue;
  const fields=[];
  for(const key of keys){
   if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(key))continue;
   const def=props[key];
   const type=typeof def?.type==='string'&&
    ['string','number','integer','boolean','array','object'].includes(def.type)?
    def.type:'unknown';
   fields.push({name:key,type});
  }
  const required=Array.isArray(schema.required)?
   schema.required.filter(key=>typeof key==='string'&&fields.some(p=>p.name===key)):[];
  picked.push({name:tool.name,fields,required:required.slice(0,64)});
 }
 return picked;
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
 async function inspect({accessToken,includeCreationSchema=false}={}){
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
   if(response.status===429)return {available:false,reason:'provider_rate_limited'};
   if(response.status===404)return {available:false,reason:'provider_endpoint_missing'};
   if(response.status>=500&&response.status<=599)
    return {available:false,reason:'provider_server_error'};
   if(response.status!==200)
    return {available:false,reason:'unsupported_mcp_transport'};
   const contentType=response.headers?.get?.('content-type')||'';
   const isJson=/^application\/json\b/i.test(contentType);
   const isSse=/^text\/event-stream\b/i.test(contentType);
   if(!isJson&&!isSse)
    return {available:false,reason:'unsupported_response_type'};
   const payload=await readBoundedResponse(response);
   if(payload===null)return {available:false,reason:'mcp_response_oversized'};
   let message;
   try{message=isSse?parseRequestSse(payload):JSON.parse(payload)}
   catch(_){return {available:false,reason:'mcp_invalid_json'}}
   if(message===null)return {available:false,reason:'mcp_invalid_sse'};
   // Some MCP servers return a valid JSON-RPC protocol/parameter rejection
   // with HTTP 200 rather than a 400/406 status. In that narrow case only,
   // negotiate the older, fully initialized read-only handshake. Do not
   // fallback for arbitrary errors, auth failures, or malformed responses.
   if(message?.jsonrpc==='2.0'&&message.id===1&&
      message.error&&typeof message.error==='object'&&
      Number.isInteger(message.error.code)){
    if([-32600,-32601,-32602].includes(message.error.code)){
     const {makeLegacySunoMcpProbe}=require('./suno-mcp-legacy-probe.cjs');
     return makeLegacySunoMcpProbe({fetcher}).inspect({accessToken});
    }
    return {available:false,reason:'provider_rpc_rejected'};
   }
   if(message?.error)return {available:false,reason:'provider_rpc_rejected'};
   const result=summarize(message);
   if(!result)return {available:false,reason:responseFailure(message)};
   // A tool list alone is NOT authorization to invoke any tool.
   return {available:true,reason:'read_only_tools_verified',
    toolCount:result.toolCount,tools:result.tools,
    ...(includeCreationSchema===true?{creationTools:creationSignatures(message)}:{})};
  }catch(error){
   return {available:false,reason:error?.name==='TimeoutError'||
    error?.name==='AbortError'?'provider_timeout':'mcp_probe_unavailable'};
  }
 }
 return Object.freeze({inspect});
}
module.exports=Object.freeze({makeSunoMcpToolProbe,summarize,parseRequestSse,responseFailure,creationSignatures,ENDPOINT,VERSION});
