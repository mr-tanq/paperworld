/* One-shot trusted GitHub workflow dispatch for the reviewed Pokémon Echoes
 * Draft PR #4. The requested SHA is immutable; this function neither creates
 * Copilot sessions nor modifies source, approvals, billing, or deployments.
 * Never retry a failed/uncertain POST without first checking GitHub runs.
 */
const API='https://api.github.com';
const REPO='mr-tanq/pokemon-echoes';
const SHA='98416ff0d875b550bef674a70ebe555ad4280e8b';
const EFFECT='copilot:fe28f182-5da6-4909-9ba1-70986b5ee469';
const json=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function createTrustedVerifier({environment,fetcher=fetch}={}){
 const env=name=>environment?.(name);
 async function github(path,{method='GET',body}={}){
  const token=env('GITHUB_COPILOT_USER_TOKEN');
  if(!token||token.length<20)throw Error('github_token_missing');
  const r=await fetcher(API+'/repos/'+REPO+path,{
   method,redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'paperworld-trusted-pr4-verifier',
    Authorization:'Bearer '+token,
    ...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!r?.ok)throw Error('github_request_failed_'+(r?.status||0));
  return r.status===204?null:r.json();
 }
 async function guard(){
  const issue=await github('/issues/1');
  if(issue?.state!=='open'||typeof issue.body!=='string'||
   !issue.body.includes('<!-- paperworld-v5-effect:'+EFFECT+' -->')||
   !(issue.assignees||[]).some(x=>x?.login==='Copilot'||x?.login==='copilot-swe-agent[bot]'))
   throw Error('issue_evidence_not_verified');
  const pr=await github('/pulls/4');
  if(pr?.number!==4||pr?.state!=='open'||pr?.draft!==true||
   pr.head?.sha!==SHA||!/^copilot\/[a-zA-Z0-9._-]{1,120}$/.test(pr.head?.ref||'')||
   pr.base?.ref!=='main'||!['mr-tanq','Copilot','copilot-swe-agent[bot]'].includes(pr.user?.login)||
   !(pr.body||'').includes('#1'))
   throw Error('pr_evidence_not_verified');
  const files=await github('/pulls/4/files?per_page=100');
  if(!Array.isArray(files)||files.length<1||files.length>10||
   files.some(f=>typeof f.filename!=='string'||!f.filename.startsWith('tests/')||
    !['added','modified'].includes(f.status)))
   throw Error('unsafe_pr_changes');
  return {files:files.length};
 }
 async function handle(req){
  if(req.method!=='POST')return json(405,{error:'method_not_allowed'});
  const secret=env('PAPERWORLD_DISPATCH_TRIGGER_SECRET');
  if(!secret||secret.length<32||!env('GITHUB_COPILOT_USER_TOKEN'))
   return json(503,{error:'credentials_unavailable'});
  if(req.headers.get('authorization')!=='Bearer '+secret)
   return json(401,{error:'unauthorized'});
  let input;try{input=await req.json()}catch(_){return json(400,{error:'invalid_request'})}
  if(!input||Object.keys(input).length!==1||!['status','dispatch'].includes(input.action))
   return json(400,{error:'invalid_action'});
  try{
   if(input.action==='status'){
    const result=await github('/actions/workflows/paperworld-verify.yml/runs?event=workflow_dispatch&per_page=20');
    return json(200,{state:'status',runs:(result.workflow_runs||[]).map(r=>({
     id:r.id,event:r.event,status:r.status,conclusion:r.conclusion,
     headSha:r.head_sha,inputSha:r.inputs?.commit_sha||null,
     url:r.html_url,createdAt:r.created_at
    }))});
   }
   const proof=await guard();
   await github('/actions/workflows/paperworld-verify.yml/dispatches',{
    method:'POST',body:{ref:'main',inputs:{commit_sha:SHA}}
   });
   return json(200,{state:'workflow_submitted',sha:SHA,prNumber:4,
    reviewedTestFiles:proof.files,aiSessionsStarted:0});
  }catch(_){return json(503,{error:'verification_dispatch_not_confirmed_do_not_retry'});}
 }
 return Object.freeze({handle});
}
export {createTrustedVerifier};
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function')
 Deno.serve(createTrustedVerifier({environment:k=>Deno.env.get(k)}).handle);
