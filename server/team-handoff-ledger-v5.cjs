/* V5 durable team handoff ledger: server-only summary of verified Matt routing.
 * This is not an execution queue, approval, or proof of Worker action.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {PROJECTS,validateAssignment}=require('./team-orchestrator-v5.cjs');
const {makeWorkerRunJournal}=require('./worker-run-journal-v5.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const KEY='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const ORIGIN='https://mr-tanq.github.io';
const ROUTES=Object.freeze({'listening-director':'listening',
 'pokemon-director':'pokemon','studio-director':'studio','wellbeing-director':'wellbeing'});
function makeTeamHandoffLedger({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY,
 guard=createSupabaseGuard({baseUrl:BASE,publicKey:KEY,fetcher}),workerJournal=null}={}){
 const configured=typeof secret==='string'&&(secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 const journal=workerJournal||makeWorkerRunJournal({fetcher,secret});
 async function query(method,path,body){
  if(!configured)throw Error('team_ledger_not_configured');
  const response=await fetcher(BASE+'/rest/v1/'+path,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    Accept:'application/json','Content-Type':'application/json',
    ...(method==='POST'?{Prefer:'resolution=ignore-duplicates,return=representation'}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!response?.ok)throw Error('team_ledger_unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('invalid_team_ledger_reply');
  return rows;
 }
 async function record({ownerId,threadId,requestId,message,directorId,workProposal,report}={}){
  if(![ownerId,threadId,requestId].every(x=>UUID.test(x||''))||
   typeof message!=='string'||!message.trim()||message.length>1200||
   typeof report!=='string')throw Error('invalid_handoff');
  const project=ROUTES[directorId];if(!project)throw Error('unregistered_director');
  const proposal=workProposal?.requiresSeparateConsent===true&&workProposal?.execution==='none'?
   workProposal:null;
  const workerId=proposal?.workerId||null;
  if(workerId)validateAssignment({project,director:directorId,worker:workerId,capability:'source_read'});
  const rows=await query('POST','paperworld_team_handoffs_v5?on_conflict=owner_id,request_id',{
   owner_id:ownerId,thread_id:threadId,request_id:requestId,project,
   director_id:directorId,worker_id:workerId,
   capability:workerId?'source_read':null,
   status:workerId?'awaiting_consent':'reported',
   request_summary:message.trim(),report_summary:report.slice(0,800)
  });
  // Replayed requests cannot overwrite the original handoff.
  if(rows.length>1)throw Error('invalid_team_ledger_reply');
  return rows.length===1&&rows[0].owner_id===ownerId&&
   rows[0].request_id===requestId;
 }
 async function verifyWorkerRequest({ownerId,threadId,requestId,project,workerId,message}={}){
  if(![ownerId,threadId,requestId].every(x=>UUID.test(x||''))||
   !PROJECTS[project]||typeof message!=='string'||!message.trim()||
   message.length>1200||
   !Object.hasOwn(PROJECTS[project].workers,workerId))
   throw Error('invalid_worker_request');
  // The exact owner/request ID is authoritative. A previous Matt handoff can
  // never be repurposed to another project, user text or Worker.
  const params=new URLSearchParams({select:'owner_id,thread_id,request_id,project,director_id,worker_id,status,request_summary',
   owner_id:'eq.'+ownerId,request_id:'eq.'+requestId,limit:'2'});
  const rows=await query('GET','paperworld_team_handoffs_v5?'+params.toString());
  if(rows.length>1)throw Error('ambiguous_worker_handoff');
  if(rows.length===0)return Object.freeze({matched:false});
  const row=rows[0];
  validateAssignment({project,director:row.director_id,worker:workerId,capability:'source_read'});
  if(row.owner_id!==ownerId||row.thread_id!==threadId||row.request_id!==requestId||
   row.project!==project||row.worker_id!==workerId||
   row.status!=='awaiting_consent'||row.request_summary!==message.trim())
   throw Error('worker_handoff_mismatch');
  return Object.freeze({matched:true,project,workerId,requestId});
 }
 async function list({ownerId,threadId}={}){
  if(!UUID.test(ownerId||'')||!UUID.test(threadId||''))throw Error('invalid_handoff_scope');
  const params=new URLSearchParams({select:'id,owner_id,thread_id,request_id,project,director_id,worker_id,status,request_summary,created_at',
   owner_id:'eq.'+ownerId,thread_id:'eq.'+threadId,
   order:'created_at.desc',limit:'30'});
  const rows=await query('GET','paperworld_team_handoffs_v5?'+params.toString());
  if(rows.length>30||rows.some(x=>x.owner_id!==ownerId||x.thread_id!==threadId||
   !ROUTES[x.director_id]||ROUTES[x.director_id]!==x.project))
   throw Error('invalid_team_ledger_reply');
  return rows.map(x=>Object.freeze({id:x.id,requestId:x.request_id,project:x.project,
   directorId:x.director_id,workerId:x.worker_id,status:x.status,
   summary:x.request_summary,createdAt:x.created_at}));
 }
 async function handle({headers={},body}={}){
  if(headers.origin!==ORIGIN)return {status:403,body:{error:'origin_denied'}};
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))
   return {status:401,body:{error:'unauthorized'}};
  if(typeof body!=='string'||Buffer.byteLength(body)>500)
   return {status:400,body:{error:'invalid_body'}};
  let data;try{data=JSON.parse(body)}catch(_){return {status:400,body:{error:'invalid_json'}}}
  if(!UUID.test(data?.threadId||''))return {status:400,body:{error:'invalid_thread'}};
  try{
   const token=bearer.slice(7);
   const {ownerId}=await guard.authenticate(token);
   if(!await guard.ownsThread({ownerId,threadId:data.threadId,agentId:'matt',token}))
    return {status:404,body:{error:'thread_not_found'}};
   const jobs=await list({ownerId,threadId:data.threadId});
   let workerRuns=[],workerHistoryUnavailable=false;
   try{workerRuns=await journal.list({ownerId,threadId:data.threadId})}
   catch(_){workerHistoryUnavailable=true}
   return {status:200,body:{jobs,workerRuns,workerHistoryUnavailable,
    authority:'recorded_handoffs_not_worker_execution'}};
  }catch(_){return {status:503,body:{error:'team_history_unavailable'}}}
 }
 return Object.freeze({record,list,handle,verifyWorkerRequest,configured});
}
module.exports=Object.freeze({makeTeamHandoffLedger,ROUTES});
