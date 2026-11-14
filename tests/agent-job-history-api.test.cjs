'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeJobHistoryApi}=require('../server/agent-job-history-api.cjs');
const threadId='22222222-2222-4222-8222-222222222222';
const jobId='33333333-3333-4333-8333-333333333333';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer aaaaa.bbbbb.ccccc'};
const body=JSON.stringify({threadId});
function fake({owns=true,fail=false,badRow=false}={}){
 const calls=[];
 const api=makeJobHistoryApi({
  guard:{authenticate:async()=>({ownerId:'11111111-1111-4111-8111-111111111111'}),
   ownsThread:async v=>{calls.push('ownsThread');return owns}},
  jobMemory:{
   list:async v=>{calls.push('list');if(fail)throw Error('PRIVATE_DO_NOT_LEAK');
    return [{id:jobId,thread_id:badRow?'bad':threadId,project:'Listening Mirror',
     request_summary:'Investigate issue',director_id:'listening-director',
     worker_id:'listening-developer',created_at:'2026-11-14T00:00:00Z'}]},
   events:async v=>{calls.push('events');return [{job_id:jobId,state:'reported',
    actor:'matt',note:'Read-only findings returned',created_at:'2026-11-14T00:00:00Z'}]}
  }
 });
 return {api,calls};
}
test('Owner can reload bounded job history without model calls',async()=>{
 const {api,calls}=fake();
 const r=await api.handle({headers,body});
 assert.equal(r.status,200);assert.equal(r.body.jobs.length,1);
 assert.equal(r.body.jobs[0].events[0].state,'reported');
 assert.equal(r.body.authority,'owner_editable_history_not_execution_proof');
 assert.deepEqual(calls,['ownsThread','list','events']);
});
test('Only the owner Matt thread may retrieve history',async()=>{
 const {api,calls}=fake({owns:false});
 const r=await api.handle({headers,body});
 assert.equal(r.status,404);assert.deepEqual(calls,['ownsThread']);
});
test('Unknown origin and missing bearer cannot retrieve rows',async()=>{
 const {api,calls}=fake();
 assert.equal((await api.handle({headers:{...headers,origin:'https://evil.example'},body})).status,403);
 assert.equal((await api.handle({headers:{origin:headers.origin},body})).status,401);
 assert.deepEqual(calls,[]);
});
test('Storage and inconsistent results fail closed without exposing details',async()=>{
 for(const opts of [{fail:true},{badRow:true}]){
  const {api}=fake(opts);const r=await api.handle({headers,body});
  assert.equal(r.status,503);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_DO_NOT_LEAK|Investigate issue/);
 }
});
