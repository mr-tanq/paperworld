/* Read-only Pokémon Echoes project evidence. Repo and file allowlisted.
 * Private GitHub OAuth token is transport-only: never appears in result,
 * error details, AI prompts, telemetry or URL.
 * NOT mounted in Paperworld's HTTP server.
 */
'use strict';
const OWNER='mr-tanq',REPO='pokemon-echoes',REF='main';
const FILE='project.godot',MAX_BYTES=8192;
const TOKEN=/^[A-Za-z0-9_.-]{10,4096}$/;
function error(code){const x=new Error('pokemon_source_unavailable');x.code=code;throw x}
function createPokemonRepoReader({fetcher=globalThis.fetch}={}){
 if(typeof fetcher!=='function')throw Error('fetcher_required');
 async function readProjectConfig({token}={}){
  if(typeof token!=='string'||!TOKEN.test(token))error('invalid_oauth');
  const url='https://api.github.com/repos/'+OWNER+'/'+REPO+
   '/contents/'+FILE+'?ref='+REF;
  let res;
  try{res=await fetcher(url,{method:'GET',redirect:'error',
   signal:AbortSignal.timeout(8000),headers:{
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'paperworld-pokemon-readonly-worker',
    Authorization:'Bearer '+token
   }})}catch(_){error('network_unavailable')}
  if(!res?.ok)error('github_read_denied');
  let item;
  try{item=await res.json()}catch(_){error('invalid_github_response')}
  if(item?.type!=='file'||item.path!==FILE||
   item.encoding!=='base64'||typeof item.content!=='string'||
   !Number.isSafeInteger(item.size)||item.size<1||item.size>MAX_BYTES||
   typeof item.sha!=='string'||!/^[a-f0-9]{40}$/i.test(item.sha))
   error('invalid_source_metadata');
  let bytes;
  try{bytes=Buffer.from(item.content.replace(/\s/g,''),'base64')}
  catch(_){error('invalid_source_content')}
  if(bytes.length!==item.size||bytes.length>MAX_BYTES||
   bytes.toString('base64')!==item.content.replace(/\s/g,''))
   error('invalid_source_content');
  const content=bytes.toString('utf8');
  if(!content.includes('config_version=5')||!content.includes('[application]'))
   error('invalid_godot_configuration');
  return Object.freeze({
   repository:OWNER+'/'+REPO,ref:REF,path:FILE,sha:item.sha,
   readOnly:true,sourceUntrusted:true,size:bytes.length,
   lines:content.split('\n').map((line,i)=>'L'+(i+1)+' '+line).join('\n')
  });
 }
 return Object.freeze({readProjectConfig});
}
module.exports=Object.freeze({createPokemonRepoReader,OWNER,REPO,REF,FILE});
