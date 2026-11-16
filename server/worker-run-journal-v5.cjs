/* V5 owner-scoped immutable read-only Worker execution receipt journal.
 * Server-only writes, existing user-authenticated execution gateway decides
 * whether an AI request is allowed. No polling, scheduling or auto-resume.
 */
'use strict';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const ALLOW=Object.freeze({
 listening:Object.freeze({director:'listening-director',worker:'listening-developer'}),
 pokemon:Object.freeze({director:'pokemon-director',worker:'pokemon-developer'})
});
function makeWorkerRunJournal({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 const configured=typeof fetcher==='function'&&typeof secret==='string'&&
  (secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 async function query(method,query,body,prefer){
  if(!configured)throw Error('worker_journal_not_configured');
  const res=await fetcher(BASE+'/rest/v1/paperworld_worker_runs_v5'+query,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,
    ...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    'Content-Type':'application/json',Accept:'application/json',
    ...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!res?.ok)throw Error('worker_journal_unavailable');
  const rows=await res.json();
  if(!Array.isArray(rows))throw Error('worker_journal_bad_response');
  return rows;
 }
 function check({ownerId,threadId,requestId,project,summary}={}){
  if(![ownerId,threadId,requestId].every(x=>UUID.test(x||''))||
   !ALLOW[project]||typeof summary!=='string'||!summary.trim()||
   summary.length>1200)throw Error('invalid_worker_run');
  return ALLOW[project];
 }
 async function claim(details){
  const kind=check(details);
  const rows=await query('POST','?on_conflict=owner_id,request_id',{
   owner_id:details.ownerId,thread_id:details.threadId,request_id:details.requestId,
   project:details.project,director_id:kind.director,worker_id:kind.worker,
   status:'running',execution:'read_only_analysis',summary:details.summary.trim()
  },'resolution=ignore-duplicates,return=representation');
  if(rows.length!==1||rows[0].owner_id!==details.ownerId||
   rows[0].request_id!==details.requestId||rows[0].status!=='running')
   throw Error('worker_run_replay_or_unverified');
  return true;
 }
 async function finish({ownerId,requestId,status,summary}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(requestId||'')||
   !['reported','failed'].includes(status)||typeof summary!=='string'||
   summary.length>800)throw Error('invalid_worker_finish');
  const params=new URLSearchParams({owner_id:'eq.'+ownerId,
   request_id:'eq.'+requestId,status:'eq.running'});
  const rows=await query('PATCH','?'+params.toString(),{
   status,result_summary:summary,updated_at:new Date().toISOString()
  },'return=representation');
  if(rows.length!==1||rows[0].owner_id!==ownerId||rows[0].request_id!==requestId||
   rows[0].status!==status)throw Error('worker_finish_not_verified');
  return true;
 }
 async function list({ownerId,threadId}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(threadId||''))throw Error('invalid_scope');
  const params=new URLSearchParams({select:'id,owner_id,thread_id,request_id,project,director_id,worker_id,status,summary,started_at,updated_at',
   owner_id:'eq.'+ownerId,thread_id:'eq.'+threadId,order:'started_at.desc',limit:'30'});
  const rows=await query('GET','?'+params.toString());
  if(rows.length>30||rows.some(row=>row.owner_id!==ownerId||
   row.thread_id!==threadId||!ALLOW[row.project]||
   ALLOW[row.project].director!==row.director_id||
   ALLOW[row.project].worker!==row.worker_id||
   !['running','reported','failed'].includes(row.status)))
   throw Error('worker_history_unverified');
  return rows.map(row=>Object.freeze({id:row.id,requestId:row.request_id,
   project:row.project,directorId:row.director_id,workerId:row.worker_id,
   status:row.status,summary:row.summary,createdAt:row.started_at}));
 }
 // Never retry a potentially billable operation after an unknown outcome.
 // A claim left in "running" by a crash is visibly interrupted; the
 // human can create a NEW request with a fresh, separately confirmed consent.
 return Object.freeze({claim,finish,list,configured});
}
module.exports=Object.freeze({makeWorkerRunJournal});
