/* One-shot Suno audio-create MCP submission (MCP 2026-07-28, stateless HTTP).
 * Never retries a credit-spending call. The provider receives a stable
 * idempotency_key when its schema declares one; no raw provider content,
 * OAuth token or lyrics are returned.
 *
 * The request is built against the tool's live inputSchema (from the
 * read-only tools/list probe performed immediately before submission):
 *  - only properties the schema declares are sent,
 *  - required/type/length/enum constraints are checked BEFORE the call,
 *  - `x-mcp-header` properties are mirrored as `Mcp-Param-{Name}` headers,
 *    as SEP-2243 requires (missing ones are rejected with HTTP 400/-32020).
 */
'use strict';
const ENDPOINT='https://api.suno.com/mcp';
const VERSION='2026-07-28';
const TOOL='audio-create';
const REQUEST_ID=2;
const MAX_RESULT=512*1024;
// audio-create may stream progress over SSE before its final result. Allow a
// generous single attempt; there is still never an automatic retry.
const TIMEOUT_MS=90000;
const KEY=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const {validLyrics}=require('../js/crow-studio-draft.js');
// Spec-defined JSON-RPC codes only. Messages and data payloads are never read
// except for the capability names of -32021.
const RPC_REASONS=Object.freeze({
 '-32700':'provider_invalid_request','-32600':'provider_invalid_request',
 '-32601':'provider_method_not_found','-32602':'provider_invalid_tool_arguments',
 '-32020':'provider_header_mismatch','-32021':'provider_client_capability_required',
 '-32022':'provider_protocol_version_unsupported'});
const CAPABILITY_NAMES=new Set(['elicitation','sampling','roots','tasks','experimental']);
const INPUT_KINDS=new Set(['elicitation/create','sampling/createMessage','roots/list']);
const isTimeout=e=>e?.name==='TimeoutError'||e?.name==='AbortError';
function validRequest(brief,key){
 if(!KEY.test(key||'')||!brief||typeof brief!=='object'||Array.isArray(brief)||
    Object.keys(brief).sort().join(',')!=='lyrics,style,title')return false;
 return typeof brief.title==='string'&&brief.title.trim().length>0&&brief.title.length<=120&&
  typeof brief.style==='string'&&brief.style.trim().length>0&&brief.style.length<=1000&&
  validLyrics(brief.lyrics);
}
// SEP-2243 value encoding: plain visible ASCII passes through, everything else
// (Greek text, leading/trailing spaces, sentinel look-alikes) is Base64-wrapped.
function encodeParamHeader(value){
 const text=typeof value==='boolean'?(value?'true':'false'):String(value);
 const plain=text.length>0&&text===text.trim()&&/^[\x20-\x7E\t]*$/.test(text)&&
  !(text.startsWith('=?base64?')&&text.endsWith('?='));
 return plain?text:'=?base64?'+Buffer.from(text,'utf8').toString('base64')+'?=';
}
function matchesType(types,value){
 if(!types.length)return true;
 if(typeof value==='string')return types.includes('string');
 if(typeof value==='boolean')return types.includes('boolean');
 return false;
}
// Builds tool arguments and headers from the live contract. Never throws and
// never echoes values; failures name at most one schema field.
function buildAudioCreateCall({brief,idempotencyKey,contract}={}){
 if(!validRequest(brief,idempotencyKey))
  return {ok:false,reason:'invalid_audio_create_request'};
 if(!contract||contract.valid!==true||!contract.properties||
    typeof contract.properties!=='object')
  return {ok:false,reason:'audio_create_schema_unverified'};
 const props=contract.properties;
 const candidates=[['title',brief.title,true],['style',brief.style,true],
  ['lyrics',brief.lyrics,true],['instrumental',false,false],
  ['idempotency_key',idempotencyKey,false]];
 const args={};
 for(const [name,value,essential] of candidates){
  const def=Object.hasOwn(props,name)?props[name]:null;
  if(!def){
   if(essential)return {ok:false,reason:'audio_create_schema_mismatch',field:name};
   continue; // Optional control the tool does not declare: do not send it.
  }
  if(!matchesType(def.types||[],value))
   return {ok:false,reason:'audio_create_schema_mismatch',field:name};
  if(typeof value==='string'){
   const length=[...value].length;
   if(Number.isSafeInteger(def.maxLength)&&length>def.maxLength)
    return {ok:false,reason:'audio_create_field_too_long',field:name,limit:def.maxLength};
   if(Number.isSafeInteger(def.minLength)&&length<def.minLength)
    return {ok:false,reason:'audio_create_schema_mismatch',field:name};
  }
  if(Array.isArray(def.enum)&&!def.enum.includes(value))
   return {ok:false,reason:'audio_create_schema_mismatch',field:name};
  args[name]=value;
 }
 for(const name of contract.required||[])
  if(!Object.hasOwn(args,name))
   return {ok:false,reason:'audio_create_required_field_unsupported',field:name};
 const paramHeaders={};
 for(const [name,def] of Object.entries(props)){
  if(!def?.header||!Object.hasOwn(args,name))continue;
  paramHeaders['Mcp-Param-'+def.header]=encodeParamHeader(args[name]);
 }
 return {ok:true,args,paramHeaders};
}
async function readBounded(response){
 const len=response.headers?.get?.('content-length');
 if(len!=null&&(!/^\d{1,8}$/.test(len)||Number(len)>MAX_RESULT))return null;
 if(response.body?.getReader){
  const reader=response.body.getReader(),decoder=new TextDecoder();let data='',bytes=0;
  try{
   while(true){
    const chunk=await reader.read();if(chunk.done)break;
    if(!(chunk.value instanceof Uint8Array))return null;
    bytes+=chunk.value.byteLength;
    if(bytes>MAX_RESULT){await reader.cancel().catch(()=>{});return null}
    data+=decoder.decode(chunk.value,{stream:true});
   }
   return data+decoder.decode();
  }finally{reader.releaseLock()}
 }
 if(typeof response.text!=='function')return null;
 const data=await response.text();
 return typeof data==='string'&&Buffer.byteLength(data,'utf8')<=MAX_RESULT?data:null;
}
function parseReply(raw,isSse){
 if(typeof raw!=='string')return null;
 if(!isSse){try{return JSON.parse(raw)}catch(_){return null}}
 const frames=raw.replace(/\r\n/g,'\n').split(/\n\n/);
 if(frames.length>2000)return null;
 let found=null;
 for(const frame of frames){
  if(!frame.trim())continue;
  let event='message';const pieces=[];
  for(const line of frame.split('\n')){
   if(!line||line.startsWith(':')||/^(id|retry):/.test(line))continue;
   if(line.startsWith('event:')){event=line.slice(6).trim();continue}
   if(line.startsWith('data:')){pieces.push(line.slice(5).trimStart());continue}
   return null;
  }
  if(event!=='message'||!pieces.length)continue;
  let data;try{data=JSON.parse(pieces.join('\n'))}catch(_){return null}
  if(!data||data.jsonrpc!=='2.0')return null;
  if(Object.hasOwn(data,'id')){
   if(data.id!==REQUEST_ID||found!==null)return null;
   found=data;
  }
  // Progress/log notifications (no id) are informational only.
 }
 return found;
}
// Classify a JSON-RPC error by its numeric code only.
function rpcFailure(error,httpStatus){
 const code=Number.isInteger(error?.code)?error.code:null;
 const reason=RPC_REASONS[String(code)]||'provider_rpc_rejected';
 const out={accepted:false,reason};
 if(code!==null&&code>=-32768&&code<=-32000)out.rpcCode=code;
 if(Number.isInteger(httpStatus)&&httpStatus!==200)out.httpStatus=httpStatus;
 if(code===-32021){
  const caps=error?.data?.requiredCapabilities;
  out.requiredCapabilities=caps&&typeof caps==='object'&&!Array.isArray(caps)?
   Object.keys(caps).filter(k=>CAPABILITY_NAMES.has(k)).slice(0,5):[];
 }
 return out;
}
async function readRpc(response){
 const type=response.headers?.get?.('content-type')||'';
 const isJson=/^application\/json\b/i.test(type);
 const isSse=/^text\/event-stream\b/i.test(type);
 if(!isJson&&!isSse)return {kind:'type'};
 const body=await readBounded(response);
 if(body===null)return {kind:'oversized'};
 const data=parseReply(body,isSse);
 if(data?.jsonrpc!=='2.0'||data.id!==REQUEST_ID)return {kind:'invalid'};
 return {kind:'rpc',data};
}
function makeSunoAudioCreate({fetcher=globalThis.fetch,timeoutMs=TIMEOUT_MS}={}){
 if(typeof fetcher!=='function')throw Error('fetcher_required');
 async function submit({accessToken,brief,idempotencyKey,contract}={}){
  if(typeof accessToken!=='string'||accessToken.length<12||accessToken.length>8192)
   return {accepted:false,reason:'suno_oauth_required'};
  const call=buildAudioCreateCall({brief,idempotencyKey,contract});
  if(!call.ok){
   const out={accepted:false,reason:call.reason,status:'blocked_before_submission'};
   if(call.field)out.field=call.field;
   if(Number.isSafeInteger(call.limit))out.limit=call.limit;
   return out;
  }
  // No automatic retries even if a timeout might have happened after acceptance.
  let response;
  try{
   response=await fetcher(ENDPOINT,{method:'POST',redirect:'manual',
    signal:AbortSignal.timeout(timeoutMs),headers:{
     Authorization:'Bearer '+accessToken,'Content-Type':'application/json',
     Accept:'application/json, text/event-stream',
     'MCP-Protocol-Version':VERSION,'Mcp-Method':'tools/call',
     'Mcp-Name':TOOL,...call.paramHeaders},
    body:JSON.stringify({jsonrpc:'2.0',id:REQUEST_ID,method:'tools/call',
     params:{name:TOOL,arguments:call.args,_meta:{
      'io.modelcontextprotocol/protocolVersion':VERSION,
      'io.modelcontextprotocol/clientInfo':{name:'Paperworld Crow',version:'1.0.0'},
      'io.modelcontextprotocol/clientCapabilities':{}
     }}})});
  }catch(error){
   // A network error or timeout may occur AFTER the provider received the
   // request. Keep the idempotency claim and never retry automatically.
   return {accepted:false,reason:isTimeout(error)?
    'provider_timeout_unverified':'provider_network_unverified'};
  }
  try{
   const status=response.status;
   // Return only finite, non-sensitive failure classes. Never return the
   // provider's body, RPC message, title, lyrics or bearer credentials.
   if(status===401||status===403)
    return {accepted:false,reason:'authorization_rejected',httpStatus:status};
   if(status===429)
    return {accepted:false,reason:'provider_rate_limited'};
   if(status===202||status===204)
    return {accepted:false,reason:'provider_async_http_unverified'};
   if(status>=500&&status<=599)
    return {accepted:false,reason:'provider_server_error_unverified',httpStatus:status};
   if(status!==200){
    // 2026-07-28 protocol-ladder rejections (400/404) carry a JSON-RPC error
    // whose numeric code identifies the cause; the tool never ran.
    if(status===400||status===404){
     const rpc=await readRpc(response).catch(()=>null);
     if(rpc?.kind==='rpc'&&rpc.data.error)return rpcFailure(rpc.data.error,status);
    }
    return {accepted:false,reason:'provider_http_unverified',
     httpStatus:Number.isInteger(status)&&status>=300&&status<=599?status:null};
   }
   const rpc=await readRpc(response);
   if(rpc.kind==='type')return {accepted:false,reason:'provider_unexpected_content_type'};
   if(rpc.kind==='oversized')return {accepted:false,reason:'provider_response_oversized'};
   if(rpc.kind!=='rpc')return {accepted:false,reason:'provider_mcp_reply_unverified'};
   const data=rpc.data;
   if(data.error)return rpcFailure(data.error,200);
   const result=data.result;
   if(!result||typeof result!=='object'||Array.isArray(result))
    return {accepted:false,reason:'provider_mcp_reply_unverified'};
   // 2026-07-28 multi-round-trip: the server needs client input (e.g. an
   // elicitation confirmation) and has NOT executed the tool yet.
   if(result.resultType==='input_required'){
    const kinds=result.inputRequests&&typeof result.inputRequests==='object'?
     [...new Set(Object.values(result.inputRequests).map(r=>r?.method)
      .filter(m=>INPUT_KINDS.has(m)))]:[];
    return {accepted:false,reason:'provider_input_required',
     status:'not_started_input_required',inputKinds:kinds};
   }
   if(result.resultType!==undefined&&result.resultType!=='complete')
    return {accepted:false,reason:'provider_result_type_unsupported'};
   if(result.isError===true)
    return {accepted:false,reason:'provider_tool_rejected'};
   // A valid tools/call reply acknowledges the request, not completion of audio.
   return {accepted:true,reason:'provider_acknowledged',
    status:'submitted_unverified',idempotencyKey};
  }catch(error){
   // E.g. the SSE stream was cut or timed out after HTTP 200 was received.
   return {accepted:false,reason:isTimeout(error)?
    'provider_timeout_unverified':'provider_mcp_reply_unverified'};
  }
 }
 return Object.freeze({submit});
}
module.exports=Object.freeze({makeSunoAudioCreate,validRequest,parseReply,
 buildAudioCreateCall,encodeParamHeader,TIMEOUT_MS});
