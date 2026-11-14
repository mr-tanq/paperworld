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
function createRepoReader({fetcher=globalThis.fetch}={}){
 if(typeof fetcher!=='function')throw Error('HTTP fetcher required');
 async function read(category){
  if(!Object.prototype.hasOwnProperty.call(FILES,category))
   throw Error('Unknown allowlisted category');
  const entries=[];let bytes=0;
  for(const name of FILES[category]){
   // No supplied access token: public, read-only GitHub Contents API only.
   const url='https://api.github.com/repos/'+OWNER+'/'+REPO+
    '/contents/'+name.split('/').map(encodeURIComponent).join('/')+'?ref='+REF;
   const response=await fetcher(url,{method:'GET',redirect:'error',
    headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
     'User-Agent':'paperworld-listening-readonly-worker'},
    signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('repository_read_unavailable');
   // Declared response length is advisory; never accept oversized body metadata.
   const data=await response.json();
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
module.exports=Object.freeze({createRepoReader,FILES,OWNER,REPO,REF});
