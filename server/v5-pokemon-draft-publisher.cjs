/* Owner-approved Pokémon Draft PR writer. Exact validated proposal + verified
 * source SHA + one-use persistent grant. Never merges, deploys or force pushes.
 */
'use strict';
const {validateProposal,digestPlan,REPO}=require('./v5-pokemon-code-proposal.cjs');
const TOKEN=/^(gho_|ghu_|ghp_|github_pat_)[A-Za-z0-9_]{12,}$/;
const SHA=/^[a-f0-9]{40}$/i;
const API='https://api.github.com/repos/'+REPO;
function makePokemonDraftPublisher({fetcher=globalThis.fetch,approvals}={}){
 if(typeof fetcher!=='function'||typeof approvals?.consumeOnce!=='function')
  throw Error('trusted_pokemon_writer_required');
 async function call(token,method,resource,payload){
  const response=await fetcher(API+resource,{
   method,redirect:'error',signal:AbortSignal.timeout(9000),
   headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',
    'User-Agent':'paperworld-pokemon-reviewed-draft'},
   ...(payload===undefined?{}:{body:JSON.stringify(payload)})
  });
  if(!response?.ok)throw Error('pokemon_github_operation_unavailable');
  const data=await response.json();
  if(!data||typeof data!=='object'||Array.isArray(data))
   throw Error('pokemon_github_reply_invalid');
  return data;
 }
 async function publish({ownerId,githubToken,plan,evidence,approval}={}){
  if(!/^[0-9a-f-]{36}$/i.test(ownerId||'')||
   !TOKEN.test(githubToken||''))throw Error('pokemon_writer_not_linked');
  const verified=validateProposal({jobId:plan?.jobId,proposal:{
   jobId:plan?.jobId,repository:plan?.repository,baseRef:plan?.baseRef,
   summary:plan?.summary,edits:plan?.edits},evidence});
  const digest=digestPlan(verified);
  // Exactly one conditional Postgres update consumes this grant. Even if the
  // network crashes after creating a branch, never silently repeat the write.
  const consumed=await approvals.consumeOnce({ownerId,jobId:verified.jobId,
   digest,approval});
  if(consumed!==true)throw Error('pokemon_draft_approval_required');
  const parent=await call(githubToken,'GET','/git/ref/heads/main');
  if(!SHA.test(parent?.object?.sha||''))throw Error('invalid_pokemon_base');
  const edit=verified.edits[0];
  const current=await call(githubToken,'GET','/contents/'+
   edit.path.split('/').map(encodeURIComponent).join('/')+'?ref=main');
  if(current.type!=='file'||current.path!==edit.path||
   current.sha!==edit.expectedSha)throw Error('stale_pokemon_source_revision');
  const branch='paperworld/pokemon-'+verified.jobId.slice(0,12);
  await call(githubToken,'POST','/git/refs',{
   ref:'refs/heads/'+branch,sha:parent.object.sha});
  await call(githubToken,'PUT','/contents/'+
   edit.path.split('/').map(encodeURIComponent).join('/'),{
    message:'Paperworld proposed Pokémon change: '+verified.summary.slice(0,100),
    content:Buffer.from(edit.replacement,'utf8').toString('base64'),
    sha:edit.expectedSha,branch
   });
  const created=await call(githubToken,'POST','/pulls',{
   title:'[Paperworld draft] '+verified.summary.slice(0,100),
   head:branch,base:'main',draft:true,
   body:'Source-reviewed Pokémon Echoes proposal.\\nJob: '+verified.jobId+
    '\\nFile: '+edit.path+'\\nNo tests executed by Paperworld. '+
    'Review manually and wait for CI before merge.'
  });
  if(!Number.isInteger(created.number)||created.number<=0||
   created.html_url!=='https://github.com/'+REPO+'/pull/'+created.number)
   throw Error('pokemon_draft_confirmation_unverified');
  return Object.freeze({created:true,draft:true,merged:false,
   tested:false,jobId:verified.jobId,number:created.number,url:created.html_url});
 }
 return Object.freeze({publish});
}
module.exports=Object.freeze({makePokemonDraftPublisher});
