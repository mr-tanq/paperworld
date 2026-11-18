/* Read-only legacy MCP 2025 Streamable HTTP handshake for Suno.
 * Exactly initialize -> notifications/initialized -> tools/list. No tools/call.
 * Session id never exits this function. No cookies or redirects.
 */
'use strict';
const ENDPOINT='https://api.suno.com/mcp';
const VERSION='2025-11-25';
const MAX_BODY=512*1024;
const {summarize}=require('./suno-mcp-tool-probe.cjs');
function parseMessage(raw,expectedId){
 if(typeof raw!=='string'||raw.length>MAX_BODY)return null;
 let parsed;
 try{parsed=JSON.parse(raw)}catch(_){
  const frames=raw.replace(/\r\n?/g,'\n').split('\n\n');
  if(frames.length>120)return null;
  parsed=null;
  for(const frame of frames){
   if(!frame.trim())continue;
   const lines=frame.split('\n'),parts=[];
   for(const line of lines){
    if(!line||line.startsWith(':')||/^(event|id|retry):/.test(line))continue;
    if(line.startsWith('data:'))parts.push(line.slice(5).trimStart());
    else return null;
   }
   if(!parts.length)continue;
   let obj;try{obj=JSON.parse(parts.join('\n'))}catch(_){return null}
   if(!obj||obj.jsonrpc!=='2.0')return null;
   if(Object.hasOwn(obj,'id')){
    if(obj.id!==expectedId||parsed!==null)return null;
    parsed=obj;
   }
  }
 }
 return parsed?.jsonrpc==='2.0'&&parsed.id===expectedId&&!parsed.error?parsed:null;
}
function validSessionId(raw){
 return typeof raw==='string'&&raw.length>=1&&raw.length<=128&&
  /^[\x21-\x7E]+$/.test(raw);
}
async function readResponse(response,id){
 if(response.status!==200)return null;
 const mime=response.headers?.get?.('content-type')||'';
 if(!/^application\/json\b/i.test(mime)&&
    !/^text\/event-stream\b/i.test(mime))return null;
 const length=response.headers?.get?.('content-length');
 if(length!==null&&length!==undefined&&
    (!/^\d{1,6}$/.test(length)||Number(length)>MAX_BODY))return null;
 // Legacy handshake is read-only, but the tool schemas may exceed 32 KiB.
 // Bound the actual response stream as well as the advertised length.
 let data='';
 if(response.body&&typeof response.body.getReader==='function'){
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let size=0;
  try{
   while(true){
    const part=await reader.read();
    if(part.done)break;
    if(!(part.value instanceof Uint8Array))return null;
    size+=part.value.byteLength;
    if(size>MAX_BODY){await reader.cancel().catch(()=>{});return null}
    data+=decoder.decode(part.value,{stream:true});
   }
   data+=decoder.decode();
  }finally{reader.releaseLock()}
 }else{
  data=await response.text();
  if(Buffer.byteLength(data,'utf8')>MAX_BODY)return null;
 }
 return parseMessage(data,id);
}
function makeLegacySunoMcpProbe({fetcher=globalThis.fetch}={}){
 if(typeof fetcher!=='function')throw Error('fetcher_required');
 async function inspect({accessToken}={}){
  if(typeof accessToken!=='string'||accessToken.length<12||accessToken.length>8192)
   return {available:false,reason:'not_authorized'};
  const base={'Authorization':'Bearer '+accessToken,
   'Content-Type':'application/json','Accept':'application/json, text/event-stream'};
  try{
   const initialized=await fetcher(ENDPOINT,{method:'POST',redirect:'manual',
    signal:AbortSignal.timeout(7000),headers:base,
    body:JSON.stringify({jsonrpc:'2.0',id:0,method:'initialize',params:{
     protocolVersion:VERSION,capabilities:{},
     clientInfo:{name:'Paperworld Crow',version:'1.0.0'}}})});
   if(initialized.status===401||initialized.status===403)
    return {available:false,reason:'authorization_rejected'};
   if(initialized.status===429)return {available:false,reason:'provider_rate_limited'};
   if(initialized.status>=500&&initialized.status<=599)
    return {available:false,reason:'provider_server_error'};
   const response=await readResponse(initialized,0);
   if(!response?.result||typeof response.result!=='object'||
      !['2025-11-25','2025-06-18','2025-03-26'].includes(response.result.protocolVersion))
    return {available:false,reason:'legacy_handshake_unverified'};
   const rawId=initialized.headers?.get?.('mcp-session-id')??null;
   if(rawId!==null&&!validSessionId(rawId))
    return {available:false,reason:'legacy_session_invalid'};
   const session=rawId?{'Mcp-Session-Id':rawId}:{};
   const version=response.result.protocolVersion;
   const stateHeaders={...base,...session,'MCP-Protocol-Version':version};
   const notification=await fetcher(ENDPOINT,{method:'POST',redirect:'manual',
    signal:AbortSignal.timeout(7000),headers:stateHeaders,
    body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});
   if(notification.status===401||notification.status===403)
    return {available:false,reason:'authorization_rejected'};
   if(![200,202,204].includes(notification.status))
    return {available:false,reason:'legacy_handshake_unverified'};
   const list=await fetcher(ENDPOINT,{method:'POST',redirect:'manual',
    signal:AbortSignal.timeout(7000),headers:stateHeaders,
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})});
   if(list.status===401||list.status===403)
    return {available:false,reason:'authorization_rejected'};
   const result=await readResponse(list,1);
   const summary=summarize(result);
   if(!summary)return {available:false,reason:'legacy_tools_unverified'};
   return {available:true,reason:'read_only_legacy_tools_verified',
    toolCount:summary.toolCount,tools:summary.tools};
  }catch(error){
   return {available:false,reason:error?.name==='TimeoutError'||
    error?.name==='AbortError'?'provider_timeout':'legacy_probe_unavailable'};
  }
 }
 return Object.freeze({inspect});
}
module.exports=Object.freeze({makeLegacySunoMcpProbe,parseMessage,validSessionId});
