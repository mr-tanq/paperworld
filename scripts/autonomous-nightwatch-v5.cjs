/* Paperworld V5: unattended, zero-AI night watch.
 * Executes independently through public-repository GitHub Actions.
 * Reads only two explicit PUBLIC repositories; writes only two fixed
 * issue threads in this repo. Never reads private data, calls a model,
 * edits source, creates PRs, merges, deploys, or spends credits.
 */
'use strict';
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {readdirSync}=require('node:fs');
const OWNER='mr-tanq', HOME='paperworld', PUBLIC=['paperworld','concerts'];
const TAG='<!-- paperworld-autonomy-v5-report:';
const MISSIONS=Object.freeze([
 Object.freeze({id:'paperworld',director:'Chief of Staff / Paperworld',
  worker:'Public source QA',issue:'[Paperworld autonomy] Paperworld health'}),
 Object.freeze({id:'concerts',director:'Luna / Listening Mirror',
  worker:'Public source monitor',issue:'[Paperworld autonomy] Listening Mirror health'})
]);
function shaDigest(value){
 return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function summarizeTests({status,stdout='',stderr='',signal=null,error=null}={}){
 const output=String(stdout||'')+'\n'+String(stderr||'');
 const count=/# tests (\d+)/g,fail=/# fail (\d+)/g;
 const tests=[...output.matchAll(count)].at(-1)?.[1];
 const failures=[...output.matchAll(fail)].at(-1)?.[1];
 const passed=status===0&&signal===null&&!error&&failures==='0';
 return Object.freeze({ok:!!passed,tests:Number(tests||0),
  failures:Number(failures||0),reason:passed?'tests_passed':'tests_failed_or_interrupted'});
}
function runLocalTests(){
 const files=readdirSync('tests').filter(f=>/^[a-z0-9-]+\.test\.cjs$/.test(f))
  .sort().map(f=>'tests/'+f);
 if(!files.length)return {ok:false,tests:0,failures:1,reason:'no_tests_found'};
 const result=spawnSync(process.execPath,['--test',...files],{
  encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024,
  env:{...process.env,PAPERWORLD_AUTONOMY_DISABLE_AI:'1'}
 });
 return summarizeTests(result);
}
function githubApi(token,fetcher=globalThis.fetch){
 if(!/^[A-Za-z0-9_.-]{12,4096}$/.test(token||''))
  throw Error('github_actions_token_required');
 return async function api(path,{method='GET',body}={}){
  if(!/^\/(?:repos\/mr-tanq\/(?:paperworld|concerts)\/)?[a-zA-Z0-9_./?=&%-]+$/.test(path)||
   path.includes('..'))throw Error('github_api_path_rejected');
  const response=await fetcher('https://api.github.com'+path,{
   method,redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'paperworld-v5-unattended-nightwatch',
    ...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok)throw Error('github_api_'+response.status);
  return response.json();
 };
}
async function getPublicCommit(repo,api){
 if(!PUBLIC.includes(repo))throw Error('private_or_unknown_repository');
 const item=await api('/repos/'+OWNER+'/'+repo+'/commits/main');
 if(!/^[a-f0-9]{40}$/i.test(item?.sha||''))
  throw Error('unverified_commit');
 return {repository:OWNER+'/'+repo,sha:item.sha};
}
function issueText(mission){
 return [
  'This is a **public-source-only**, unattended Paperworld V5 monitor.',
  'The owner does not need to keep the app open.',
  '',
  'Director: '+mission.director,
  'Worker: '+mission.worker,
  '',
  'This monitor does not use AI, read the private Pokémon repository,',
  'access wellbeing records or Suno, write source code, deploy or spend credits.',
  'Reports appear only when the audited public source or test result changes.',
  '',
  'This is an automated monitoring task, **not proof of autonomous AI coding**.'
 ].join('\n');
}
function reportText(mission,commit,testing=null){
 const data={project:mission.id,sha:commit.sha,
  tests:testing?{ok:testing.ok,tests:testing.tests,
   failures:testing.failures,reason:testing.reason}:null};
 const digest=shaDigest(data);
 const lines=[
  TAG+digest+' -->',
  '**Unattended Paperworld check**',
  'Director: '+mission.director,
  'Verified public source: `'+commit.repository+'`',
  'Commit: `'+commit.sha.slice(0,12)+'`'
 ];
 if(testing){
  lines.push('Offline Node suite: '+(testing.ok?'passed':'needs attention')+
   ' ('+testing.tests+' tests, '+testing.failures+' failures)');
  if(!testing.ok)lines.push('Next safe step: inspect the failed GitHub Actions run; no auto-fix or deployment was attempted.');
 }else lines.push('Next safe step: review new public-source changes when they occur.');
 lines.push('No AI/model calls, private reads, GitHub source writes or extra paid services.');
 return {digest,body:lines.join('\n')};
}
async function findIssue(mission,api){
 const all=await api('/repos/'+OWNER+'/'+HOME+'/issues?state=open&per_page=100');
 if(!Array.isArray(all))throw Error('unverified_issue_list');
 return all.find(i=>!i.pull_request&&i.title===mission.issue&&
  Number.isSafeInteger(i.number))||null;
}
async function lastDigest(issue,api){
 const count=Number(issue.comments)||0;
 if(count<=0)return null;
 const page=Math.max(1,Math.ceil(count/100));
 const rows=await api('/repos/'+OWNER+'/'+HOME+'/issues/'+issue.number+
  '/comments?per_page=100&page='+page);
 if(!Array.isArray(rows))throw Error('unverified_comments');
 const comment=rows.at(-1)?.body||'';
 const match=/<!-- paperworld-autonomy-v5-report:([a-f0-9]{64}) -->/.exec(comment);
 return match?.[1]||null;
}
async function execute({api,checks,log=()=>{}}={}){
 if(typeof api!=='function'||typeof checks!=='object')
  throw Error('unattended_runner_dependencies_required');
 const outcomes=[];
 for(const mission of MISSIONS){
  const check=checks[mission.id];
  if(typeof check!=='function')throw Error('missing_project_check');
  try{
   const {commit,testing=null}=await check();
   const report=reportText(mission,commit,testing);
   let issue=await findIssue(mission,api);
   if(!issue){
    issue=await api('/repos/'+OWNER+'/'+HOME+'/issues',{
     method:'POST',body:{title:mission.issue,body:issueText(mission)}
    });
    if(!Number.isSafeInteger(issue?.number))throw Error('issue_creation_unverified');
   }
   if(await lastDigest(issue,api)===report.digest){
    outcomes.push({project:mission.id,status:'unchanged',issue:issue.number});
    continue;
   }
   await api('/repos/'+OWNER+'/'+HOME+'/issues/'+issue.number+'/comments',{
    method:'POST',body:{body:report.body}
   });
   outcomes.push({project:mission.id,status:testing&&!testing.ok?'failed_tests':'reported',
    issue:issue.number});
  }catch(_){
   // Keep the other Director's task independent. Never leak API responses
   // or credentials into public comments or the action summary.
   outcomes.push({project:mission.id,status:'monitor_unavailable'});
  }
 }
 log(outcomes);
 return outcomes;
}
async function main(){
 const token=process.env.GITHUB_TOKEN||'';
 const api=githubApi(token);
 const testing=runLocalTests();
 const results=await execute({api,checks:{
  paperworld:async()=>({commit:await getPublicCommit('paperworld',api),testing}),
  concerts:async()=>({commit:await getPublicCommit('concerts',api)})
 }});
 for(const r of results)process.stdout.write(r.project+': '+r.status+
  (r.issue?' (#'+r.issue+')':'')+'\n');
 if(results.some(x=>x.status==='monitor_unavailable')||!testing.ok)
  process.exitCode=1;
}
if(require.main===module)main().catch(()=>{
 process.stderr.write('Paperworld unattended runner unavailable\n');
 process.exitCode=1;
});
module.exports=Object.freeze({MISSIONS,shaDigest,summarizeTests,githubApi,
 getPublicCommit,reportText,findIssue,lastDigest,execute,runLocalTests});
