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
 const GROUPS=Object.freeze({
  core:Object.freeze(['project.godot','player.gd','scripts/alder_route_gate_v1.gd',
   'scripts/dialogue_manager_v5_safe.gd']),
  battle:Object.freeze(['project.godot','scripts/battle_manager_v1.gd',
   'scripts/battle_test_trigger.gd','scripts/inventory_manager_v1.gd']),
  dialogue:Object.freeze(['project.godot','scripts/dialogue_manager_v5_safe.gd',
   'scripts/npc_research_aide_v5_aligned.gd']),
  map:Object.freeze(['project.godot','scripts/hazel_lab_interior_v2_collisions.gd',
   'scripts/ground_detail.gd','scripts/obstacles.gd'])
 });
 async function readProjectFiles({token,category='core'}={}){
  if(typeof token!=='string'||!TOKEN.test(token))error('invalid_oauth');
  if(!Object.hasOwn(GROUPS,category))error('invalid_file_category');
  let bytesTotal=0;
  const files=[];
  for(const name of GROUPS[category]){
   const url='https://api.github.com/repos/'+OWNER+'/'+REPO+
    '/contents/'+name.split('/').map(encodeURIComponent).join('/')+'?ref='+REF;
   let res;
   try{
    res=await fetcher(url,{method:'GET',redirect:'error',
     signal:AbortSignal.timeout(8000),headers:{
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'paperworld-pokemon-scoped-worker',
      Authorization:'Bearer '+token
     }});
   }catch(_){error('network_unavailable')}
   if(!res?.ok)error('github_read_denied');
   let item;
   try{item=await res.json()}catch(_){error('invalid_github_response')}
   if(item?.type!=='file'||item.path!==name||
    item.encoding!=='base64'||typeof item.content!=='string'||
    !Number.isSafeInteger(item.size)||item.size<1||item.size>12000||
    !/^[a-f0-9]{40}$/i.test(item.sha||''))
    error('invalid_source_metadata');
   let raw;
   try{
    const encoded=item.content.replace(/\\s/g,'');
    raw=Buffer.from(encoded,'base64');
    if(raw.toString('base64')!==encoded)error('invalid_source_content');
   }catch(_){error('invalid_source_content')}
   bytesTotal+=raw.length;
   if(raw.length!==item.size||bytesTotal>24000)error('invalid_source_content');
   const content=raw.toString('utf8');
   if(!content.trim()||(name==='project.godot'&&
    (!content.includes('config_version=5')||!content.includes('[application]')))||
    (name.endsWith('.gd')&&!/^extends (?:Node|Node2D|CharacterBody2D|StaticBody2D|CanvasLayer|Area2D|Control|RefCounted|Resource|Sprite2D|TileMap|TileMapLayer|AnimatableBody2D|Path2D|CollisionObject2D|Panel|Object)/m.test(content)))
    error('invalid_godot_configuration');
   files.push(Object.freeze({path:name,sha:item.sha,
    lines:content.split('\\n').map((line,i)=>'L'+(i+1)+' '+line).join('\\n'),
    size:raw.length}));
  }
  return Object.freeze({repository:OWNER+'/'+REPO,ref:REF,
   category,readOnly:true,sourceUntrusted:true,bytes:bytesTotal,
   files:Object.freeze(files)});
 }
 return Object.freeze({readProjectConfig,readProjectFiles,GROUPS});
}
module.exports=Object.freeze({createPokemonRepoReader,OWNER,REPO,REF,FILE});
