/* PAPERWORLD owner-scoped job history adapter, OFF until reviewed migration.
 * Uses the user's Supabase JWT and existing RLS. Never stores OAuth/AI tokens.
 * Rows are descriptive, not authority to execute an action.
 */
'use strict';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const STATES=new Set(['created','routed','scoped','evidence_read','worker_reported','director_reviewed','reported','failed']);
const ACTORS=new Set(['matt','listening-director','listening-developer']);
function validText(x,max){return typeof x==='string'&&x.trim().length>0&&x.length<=max}
function createJobMemory({fetcher,baseUrl,publicKey}={}){
 if(typeof fetcher!=='function'||!/^https:\/\/[a-z0-9.-]+$/i.test(baseUrl||'')||
    !validText(publicKey,250))throw Error('job_memory_config_required');
 const origin=baseUrl.replace(/\/$/,'');
 async function request({token,method='GET',path,body}){
  if(!validText(token,4096)||!new RegExp('^[A-Za-z0-9_.-]{12,4096}$').test(token))
   throw Error('invalid_auth');
  const res=await fetcher(origin+'/rest/v1/'+path,{
   method,redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:publicKey,Authorization:'Bearer '+token,
    Accept:'application/json',...(method==='POST'?{
    'Content-Type':'application/json',Prefer:'return=minimal'}:{})},
   ...(method==='POST'?{body:JSON.stringify(body)}:{})
  });
  if(!res?.ok)throw Error('job_memory_unavailable');
  return method==='GET'?await res.json():true;
 }
 async function create({token,jobId,threadId,summary}={}){
  if(!UUID.test(jobId||'')||!UUID.test(threadId||'')||!validText(summary,1200))
   throw Error('invalid_job');
  await request({token,method:'POST',path:'paperworld_agent_jobs',body:{
   id:jobId,thread_id:threadId,project:'Listening Mirror',
   director_id:'listening-director',worker_id:'listening-developer',
   request_summary:summary.trim()
  }});
  return jobId;
 }
 async function append({token,jobId,state,actor,note}={}){
  if(!UUID.test(jobId||'')||!STATES.has(state)||!ACTORS.has(actor)||!validText(note,500))
   throw Error('invalid_job_event');
  return request({token,method:'POST',path:'paperworld_agent_job_events',
   body:{job_id:jobId,state,actor,note:note.trim()}});
 }
 async function list({token,threadId}={}){
  if(!UUID.test(threadId||''))throw Error('invalid_thread');
  const query='paperworld_agent_jobs?select=id,thread_id,project,director_id,worker_id,request_summary,created_at'+
   '&thread_id=eq.'+encodeURIComponent(threadId)+'&order=created_at.desc&limit=30';
  const jobs=await request({token,path:query});
  if(!Array.isArray(jobs)||jobs.length>30)throw Error('invalid_job_history');
  return jobs;
 }
 async function events({token,jobId}={}){
  if(!UUID.test(jobId||''))throw Error('invalid_job');
  const query='paperworld_agent_job_events?select=id,job_id,state,actor,note,created_at'+
   '&job_id=eq.'+encodeURIComponent(jobId)+'&order=created_at.asc,id.asc&limit=100';
  const rows=await request({token,path:query});
  if(!Array.isArray(rows)||rows.length>100)throw Error('invalid_job_events');
  return rows;
 }
 return Object.freeze({create,append,list,events});
}
module.exports=Object.freeze({createJobMemory});
