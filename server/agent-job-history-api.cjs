/* Authenticated, read-only job-history query for the owner's Matt thread.
 * Job events are user-owned narrative records, NEVER proof of AI execution.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {createJobMemory}=require('./agent-job-memory.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ORIGIN='https://mr-tanq.github.io';
function makeJobHistoryApi({guard,jobMemory,fetcher=globalThis.fetch}={}){
 const baseUrl='https://jrevhzvrgenucuozjowm.supabase.co';
 const publicKey='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
 const identity=guard||createSupabaseGuard({baseUrl,publicKey,fetcher});
 const memory=jobMemory||createJobMemory({baseUrl,publicKey,fetcher});
 async function handle({headers={},body}={}){
  if(headers.origin!==ORIGIN)return {status:403,body:{error:'origin_denied'}};
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))
   return {status:401,body:{error:'unauthorized'}};
  if(typeof body!=='string'||Buffer.byteLength(body)>500)
   return {status:400,body:{error:'invalid_request'}};
  let data;
  try{data=JSON.parse(body)}catch(_){return {status:400,body:{error:'invalid_json'}}}
  if(!UUID.test(data?.threadId||''))
   return {status:400,body:{error:'invalid_thread'}};
  const token=bearer.slice(7);
  try{
   const {ownerId}=await identity.authenticate(token);
   if(!await identity.ownsThread({threadId:data.threadId,ownerId,agentId:'matt',token}))
    return {status:404,body:{error:'thread_not_found'}};
   const jobs=await memory.list({token,threadId:data.threadId});
   const results=[];
   for(const job of jobs){
    if(!UUID.test(job.id||'')||job.thread_id!==data.threadId)
     throw Error('unexpected_history_row');
    const events=await memory.events({token,jobId:job.id});
    if(!events.every(e=>e.job_id===job.id))throw Error('unexpected_history_event');
    results.push({id:job.id,project:job.project,summary:job.request_summary,
      directorId:job.director_id,workerId:job.worker_id,
      createdAt:job.created_at,events:events.map(e=>({
       state:e.state,actor:e.actor,note:e.note,createdAt:e.created_at
      }))});
   }
   return {status:200,body:{jobs:results,authority:'owner_editable_history_not_execution_proof'}};
  }catch(_){
   return {status:503,body:{error:'job_history_unavailable'}};
  }
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeJobHistoryApi});
