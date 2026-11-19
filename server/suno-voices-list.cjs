'use strict';
// Owner-scoped, non-generation Suno voices-list lookup.
// Bounded and privacy-minimized: only names and IDs of saved voices exit.
const ENDPOINT='https://api.suno.com/mcp';
const VERSION='2026-07-28';
const VOICE_ID=/^[A-Za-z0-9_-]{8,128}$/;
const MAX_BYTES=256*1024;
function extractVoices(raw){
 const out=[],seen=new Set();
 function walk(node,depth=0){
  if(depth>5||out.length>=100||!node)return;
  if(Array.isArray(node)){for(const item of node.slice(0,100))walk(item,depth+1);return}
  if(typeof node!=='object')return;
  const id=node.voice_id??node.voiceId??node.id;
  const name=node.name??node.display_name??node.title;
  if(typeof id==='string'&&VOICE_ID.test(id)&&
     typeof name==='string'&&name.trim().length>0&&name.length<=120&&
     !seen.has(id)){
   out.push({id,name:name.trim()});seen.add(id);return;
  }
  for(const key of ['voices','items','data','results','structuredContent','result','content'])
   if(Object.hasOwn(node,key))walk(node[key],depth+1);
  if(node.type==='text'&&typeof node.text==='string'&&node.text.length<=MAX_BYTES){
   try{walk(JSON.parse(node.text),depth+1)}catch(_){}
  }
 }
 walk(raw);
 return out;
}
async function parseResponse(response){
 const len=response.headers?.get?.('content-length');
 if(len!=null&&(!/^\d{1,8}$/.test(len)||Number(len)>MAX_BYTES))return null;
 let raw;
 try{raw=await response.text()}catch(_){return null}
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>MAX_BYTES)return null;
 const type=response.headers?.get?.('content-type')||'';
 if(/^text\/event-stream\b/i.test(type)){
  const frames=raw.replace(/\r\n/g,'\n').split(/\n\n/);if(frames.length>300)return null;
  let final=null;
  for(const frame of frames){
   const data=frame.split('\n').filter(l=>l.startsWith('data:'))
    .map(l=>l.slice(5).trimStart()).join('\n');
   if(!data)continue;
   let obj;try{obj=JSON.parse(data)}catch(_){return null}
   if(obj.id===7){if(final)return null;final=obj}
  }
  return final;
 }
 if(!/^application\/json\b/i.test(type))return null;
 try{return JSON.parse(raw)}catch(_){return null}
}
function makeSunoVoicesList({fetcher=globalThis.fetch}={}){
 async function list({accessToken}={}){
  if(typeof accessToken!=='string'||accessToken.length<12)
   return {available:false,reason:'suno_oauth_required',voices:[]};
  try{
   const response=await fetcher(ENDPOINT,{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
    headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json',
     Accept:'application/json, text/event-stream',
     'MCP-Protocol-Version':VERSION,'Mcp-Method':'tools/call','Mcp-Name':'voices-list'},
    body:JSON.stringify({jsonrpc:'2.0',id:7,method:'tools/call',
     params:{name:'voices-list',arguments:{},_meta:{
      'io.modelcontextprotocol/protocolVersion':VERSION,
      'io.modelcontextprotocol/clientInfo':{name:'Paperworld Crow',version:'1.0.0'},
      'io.modelcontextprotocol/clientCapabilities':{}
     }}})
   });
   if(response.status!==200)return {available:false,reason:
    response.status===401||response.status===403?'suno_oauth_required':'voices_list_unavailable',voices:[]};
   const reply=await parseResponse(response);
   if(reply?.jsonrpc!=='2.0'||reply.id!==7||reply.error||
      !reply.result||reply.result.isError===true||
      reply.result.resultType==='input_required')
    return {available:false,reason:'voices_list_unverified',voices:[]};
   const voices=extractVoices(reply.result);
   // An empty list is only verified when the provider gives a recognizable empty collection.
   const result=reply.result;
   const empty=Array.isArray(result?.structuredContent?.voices)&&
     result.structuredContent.voices.length===0 ||
     Array.isArray(result?.voices)&&result.voices.length===0;
   if(!voices.length&&!empty)return {available:false,reason:'voices_list_format_unverified',voices:[]};
   return {available:true,reason:'voices_list_verified',voices};
  }catch(_){return {available:false,reason:'voices_list_unavailable',voices:[]}}
 }
 return Object.freeze({list});
}
module.exports=Object.freeze({makeSunoVoicesList,extractVoices,VOICE_ID});
