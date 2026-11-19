/* One-shot Suno audio-create MCP submission.
 * Never retries a credit-spending call. The provider receives a stable
 * idempotency_key; no raw provider content, OAuth token or lyrics are returned.
 */
'use strict';
const ENDPOINT='https://api.suno.com/mcp';
const MAX_RESULT=512*1024;
const KEY=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const {validLyrics}=require('../js/crow-studio-draft.js');
function validRequest(brief,key){
 if(!KEY.test(key||'')||!brief||typeof brief!=='object'||Array.isArray(brief)||
    Object.keys(brief).sort().join(',')!=='lyrics,style,title')return false;
 return typeof brief.title==='string'&&brief.title.trim().length>0&&brief.title.length<=120&&
  typeof brief.style==='string'&&brief.style.trim().length>0&&brief.style.length<=1000&&
  validLyrics(brief.lyrics);
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
 const data=await response.text();
 return typeof data==='string'&&Buffer.byteLength(data,'utf8')<=MAX_RESULT?data:null;
}
function parseReply(raw,isSse){
 if(!isSse){try{return JSON.parse(raw)}catch(_){return null}}
 const frames=raw.replace(/\r\n/g,'\n').split(/\n\n/);
 if(frames.length>120)return null;
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
   if(data.id!==2||found!==null)return null;
   found=data;
  }
 }
 return found;
}
function makeSunoAudioCreate({fetcher=globalThis.fetch}={}){
 if(typeof fetcher!=='function')throw Error('fetcher_required');
 async function submit({accessToken,brief,idempotencyKey}={}){
  if(typeof accessToken!=='string'||accessToken.length<12||accessToken.length>8192)
   return {accepted:false,reason:'suno_oauth_required'};
  if(!validRequest(brief,idempotencyKey))
   return {accepted:false,reason:'invalid_audio_create_request'};
  const args={title:brief.title,style:brief.style,lyrics:brief.lyrics,
   instrumental:false,idempotency_key:idempotencyKey};
  // No automatic retries even if a timeout might have happened after acceptance.
  try{
   const response=await fetcher(ENDPOINT,{method:'POST',redirect:'manual',
    signal:AbortSignal.timeout(20000),headers:{
     Authorization:'Bearer '+accessToken,'Content-Type':'application/json',
     Accept:'application/json, text/event-stream',
     'MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call'},
    body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',
     params:{name:'audio-create',arguments:args}})});
   // Return only finite, non-sensitive failure classes. Never return the
   // provider's body, RPC message, title, lyrics or bearer credentials.
   if(response.status===401||response.status===403)
    return {accepted:false,reason:'authorization_rejected'};
   if(response.status===429)
    return {accepted:false,reason:'provider_rate_limited'};
   if(response.status===202||response.status===204)
    return {accepted:false,reason:'provider_async_http_unverified'};
   if(response.status>=500&&response.status<=599)
    return {accepted:false,reason:'provider_server_error_unverified'};
   if(response.status!==200)
    return {accepted:false,reason:'provider_http_unverified'};
   const type=response.headers?.get?.('content-type')||'';
   const isJson=/^application\/json\b/i.test(type);
   const isSse=/^text\/event-stream\b/i.test(type);
   if(!isJson&&!isSse)
    return {accepted:false,reason:'provider_unexpected_content_type'};
   const body=await readBounded(response);
   if(body===null)
    return {accepted:false,reason:'provider_response_oversized'};
   const data=parseReply(body,isSse);
   if(data?.jsonrpc!=='2.0'||data.id!==2)
    return {accepted:false,reason:'provider_mcp_reply_unverified'};
   if(data.error){
    const code=data.error?.code;
    return {accepted:false,reason:code===-32602?
     'provider_invalid_tool_arguments':'provider_rpc_rejected'};
   }
   if(data.result?.isError===true)
    return {accepted:false,reason:'provider_tool_rejected'};
   if(!data.result||typeof data.result!=='object')
    return {accepted:false,reason:'provider_mcp_reply_unverified'};
   // A valid tools/call reply acknowledges the request, not completion of audio.
   return {accepted:true,reason:'provider_acknowledged',
    status:'submitted_unverified',idempotencyKey};
  }catch(error){
   // A network error or timeout may occur AFTER the provider received the
   // request. Keep the idempotency claim and never retry automatically.
   return {accepted:false,reason:
    error?.name==='TimeoutError'||error?.name==='AbortError'?
     'provider_timeout_unverified':'provider_network_unverified'};
  }
 }
 return Object.freeze({submit});
}
module.exports=Object.freeze({makeSunoAudioCreate,validRequest,parseReply});
