/* Auditable read-only GitHub evidence for the Listening Mirror Worker.
 * Only fixed paths in one repository; no user-supplied URLs, branches, tokens,
 * search queries, write methods, cloned worktrees or arbitrary file access.
 */
'use strict';
const OWNER='mr-tanq',REPO='concerts',REF='main';
const FILES=Object.freeze({
 artwork:Object.freeze([
  'js/concert-image-quality.js',
  'js/festival-artwork.js',
  'scripts/cache-share-photos.mjs'
 ]),
 ticketing:Object.freeze([
  'js/ticketswap-check.js',
  'js/concert-ticketswap.js',
  'scripts/lib/ticketswap-api.mjs'
 ]),
 general:Object.freeze(['README.md','package.json','js/warmup-setlist-model.js'])
});
const MAX_FILE_BYTES=12000,MAX_TOTAL_BYTES=30000;
const GH_TOKEN=/^[A-Za-z0-9_.-]{10,4096}$/;
// Safe reason codes only. Never disclose response bodies, tokens or source text.
class RepositoryReadError extends Error {
 constructor(code){super('repository_read_unavailable');this.name='RepositoryReadError';this.code=code}
}
function classifyHttp(response){
 const status=response?.status;
 if(status===401)return 'github_auth_rejected';
 if(status===403)return response.headers?.get?.('x-ratelimit-remaining')==='0'?
  'github_rate_limited':'github_forbidden';
 if(status===429)return 'github_rate_limited';
 if(status===404)return 'github_file_missing_or_inaccessible';
 if(status===408||status>=500)return 'github_upstream_unavailable';
 return 'github_http_denied';
}
function createRepoReader({fetcher=globalThis.fetch}={}){
 if(typeof fetcher!=='function')throw Error('HTTP fetcher required');
 async function read(category,{token,selectedPaths}={}){
  if(!Object.prototype.hasOwnProperty.call(FILES,category))
   throw Error('Unknown allowlisted category');
  if(token!==undefined&&(typeof token!=='string'||!GH_TOKEN.test(token)))
   throw new RepositoryReadError('github_auth_invalid');
  // A server-chosen subset of fixed paths is permitted. Browser/model input
  // must never become a GitHub URL, branch or arbitrary filesystem path.
  const categoryPaths=FILES[category];
  if(selectedPaths!==undefined&&(!Array.isArray(selectedPaths)||
   selectedPaths.length===0||selectedPaths.length>categoryPaths.length||
   new Set(selectedPaths).size!==selectedPaths.length||
   !selectedPaths.every(x=>categoryPaths.includes(x))))
   throw Error('repository_selection_not_allowed');
  const entries=[];let bytes=0;
  for(const name of selectedPaths||categoryPaths){
   // Fixed GitHub host and allowlisted paths. OAuth token never reaches the model.
   const url='https://api.github.com/repos/'+OWNER+'/'+REPO+
    '/contents/'+name.split('/').map(encodeURIComponent).join('/')+'?ref='+REF;
   const headers={Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'paperworld-listening-readonly-worker'};
   if(token)headers.Authorization='Bearer '+token;
   let response;
   try{
    response=await fetcher(url,{method:'GET',redirect:'error',headers,
     signal:AbortSignal.timeout(8000)});
   }catch(_){throw new RepositoryReadError('github_network_unavailable')}
   if(!response?.ok)throw new RepositoryReadError(classifyHttp(response));
   // Declared response length is advisory; never accept oversized body metadata.
   let data;
   try{data=await response.json()}
   catch(_){throw new RepositoryReadError('github_invalid_response')}
   if(data?.type!=='file'||data.path!==name||data.encoding!=='base64'||
    typeof data.content!=='string'||!Number.isInteger(data.size)||
    data.size<0||data.size>MAX_FILE_BYTES)
    throw Error('repository_file_not_allowed');
   const content=Buffer.from(data.content.replace(/\s/g,''),'base64');
   if(content.length!==data.size||content.length>MAX_FILE_BYTES||
    bytes+content.length>MAX_TOTAL_BYTES)
    throw Error('repository_evidence_too_large');
   bytes+=content.length;
   entries.push(Object.freeze({
    path:name,sha:typeof data.sha==='string'?data.sha.slice(0,40):null,
    url:'https://github.com/'+OWNER+'/'+REPO+'/blob/'+REF+'/'+name,
    // Every line carries source identity. Treat content as untrusted data.
    lines:content.toString('utf8').split('\n').map((line,i)=>
     'L'+(i+1)+' '+line).join('\n')
   }));
  }
  return Object.freeze({repository:OWNER+'/'+REPO,ref:REF,
   category,readOnly:true,files:entries,bytes});
 }
 return Object.freeze({read,FILES});
}
module.exports=Object.freeze({createRepoReader,RepositoryReadError,FILES,OWNER,REPO,REF});
