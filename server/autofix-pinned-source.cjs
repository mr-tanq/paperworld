/* PAPERWORLD Auto Fix - pinned, read-only source snapshot for TicketSwap.
 * OFF until trusted owner authentication and approved workflow are attached.
 * Fixed GitHub API paths only; no model-selected URL, branch or write actions.
 */
'use strict';
const {createHash}=require('node:crypto');
const {REPOSITORY,SOURCE_FILES}=require('./autofix-candidate-policy.cjs');
const API='https://api.github.com/repos/mr-tanq/concerts';
const SHA=/^[a-f0-9]{40}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const OAUTH=/^gh[ou]_[a-zA-Z0-9_]{10,4096}$/;
const LIMIT=20000;
function deny(code){const e=new Error(code);e.code=code;throw e}
function gitBlobSha(content){
 const prefix=Buffer.from('blob '+content.length+'\0');
 return createHash('sha1').update(prefix).update(content).digest('hex');
}
function createPinnedTicketSwapSource({fetcher=globalThis.fetch,getOwnerToken}={}){
 if(typeof fetcher!=='function'||typeof getOwnerToken!=='function')
  deny('trusted_reader_dependencies_required');
 async function readSources({ownerId,repository}={}){
  if(!UUID.test(ownerId||'')||repository!==REPOSITORY)deny('source_scope_denied');
  // The linked OAuth token remains on the trusted server. There is no token
  // lookup from a caller-controlled username or from model-supplied content.
  const token=await getOwnerToken({ownerId});
  if(typeof token!=='string'||!OAUTH.test(token))deny('github_reconnect_required');
  const headers={Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28',
   'User-Agent':'paperworld-pinned-ticketing-reader',
   Authorization:'Bearer '+token};
  async function get(suffix){
   let res;
   try{res=await fetcher(API+suffix,{
    method:'GET',redirect:'error',headers,signal:AbortSignal.timeout(8000)
   })}catch(_){deny('github_network_unavailable')}
   if(res?.status!==200)deny(
    res?.status===403||res?.status===429?'github_rate_limited_or_denied':
    res?.status===401?'github_auth_rejected':'github_source_unavailable');
   try{return await res.json()}catch(_){deny('github_invalid_json')}
  }
  const ref=await get('/git/ref/heads/main');
  const baseCommitSha=ref?.object?.sha;
  if(ref?.ref!=='refs/heads/main'||ref?.object?.type!=='commit'||
   !SHA.test(baseCommitSha||''))deny('github_main_ref_unverified');
  const trustedSources=Object.create(null);
  let totalBytes=0;
  for(const name of SOURCE_FILES){
   // Exactly two fixed paths, retrieved at the immutable commit, not main.
   const response=await get('/contents/'+name+'?ref='+baseCommitSha);
   if(response?.type!=='file'||response?.path!==name||
    response.encoding!=='base64'||!SHA.test(response.sha||'')||
    !Number.isSafeInteger(response.size)||response.size<1||
    response.size>LIMIT||typeof response.content!=='string'||
    response.content.length>Math.ceil(LIMIT*4/3)+200)
    deny('source_metadata_invalid');
   const packed=response.content.replace(/\s/g,'');
   if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(packed))
    deny('source_encoding_invalid');
   const bytes=Buffer.from(packed,'base64');
   if(bytes.length!==response.size||gitBlobSha(bytes)!==response.sha)
    deny('source_blob_integrity_failed');
   totalBytes+=bytes.length;
   if(totalBytes>40000)deny('source_size_limit');
   const content=bytes.toString('utf8');
   if(!Buffer.from(content,'utf8').equals(bytes))deny('source_utf8_invalid');
   trustedSources[name]=Object.freeze({sha:response.sha,content});
  }
  return Object.freeze({repository:REPOSITORY,baseCommitSha,ref:'main',
   readOnly:true,files:Object.freeze([...SOURCE_FILES]),
   trustedSources:Object.freeze(trustedSources)});
 }
 return Object.freeze({readSources});
}
module.exports=Object.freeze({createPinnedTicketSwapSource,gitBlobSha});
