'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createJobMemory}=require('../server/agent-job-memory.cjs');
const ID='11111111-1111-4111-8111-111111111111';
const THREAD='22222222-2222-4222-8222-222222222222';
function setup(){
 const calls=[];
 const memory=createJobMemory({baseUrl:'https://example.supabase.co',publicKey:'publishable',
  fetcher:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>[]}}});
 return {memory,calls};
}
test('records an owner-scoped job through bearer auth without storing secrets',async()=>{
 const {memory,calls}=setup();
 await memory.create({token:'a'.repeat(24),jobId:ID,threadId:THREAD,summary:'Review TicketSwap'});
 assert.equal(calls[0].opts.method,'POST');
 assert.equal(calls[0].opts.headers.Authorization,'Bearer '+'a'.repeat(24));
 const payload=JSON.parse(calls[0].opts.body);
 assert.deepEqual(Object.keys(payload).sort(),['director_id','id','project','request_summary','thread_id','worker_id'].sort());
 assert.equal(payload.thread_id,THREAD);
 assert.equal(calls[0].opts.redirect,'error');
});
test('events are bounded and append-only',async()=>{
 const {memory,calls}=setup();
 await memory.append({token:'b'.repeat(24),jobId:ID,state:'worker_reported',actor:'listening-developer',note:'Evidence read'});
 assert.match(calls[0].url,/paperworld_agent_job_events$/);
 assert.equal(calls[0].opts.method,'POST');
 await assert.rejects(memory.append({token:'b'.repeat(24),jobId:ID,state:'deployed',actor:'matt',note:'not allowed'}));
});
test('reads are filtered by thread and bounded',async()=>{
 const {memory,calls}=setup();
 await memory.list({token:'a'.repeat(24),threadId:THREAD});
 assert.match(calls[0].url,/thread_id=eq\./);
 assert.match(calls[0].url,/limit=30/);
 await memory.events({token:'a'.repeat(24),jobId:ID});
 assert.match(calls[1].url,/limit=100/);
});
test('RLS migration keeps history owner scoped and non-authoritative',()=>{
 const sql=fs.readFileSync(require('node:path').join(__dirname,'../supabase/paperworld_agent_job_history_review.sql'),'utf8');
 for(const table of ['paperworld_agent_jobs','paperworld_agent_job_events']){
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security','i'));
  assert.match(sql,new RegExp('grant select,insert on public\\.'+table+' to authenticated','i'));
 }
 assert.match(sql,/auth\.uid\(\)/);
 assert.doesNotMatch(sql,/grant (?:update|delete|all) on public\.paperworld_agent_job/);
 assert.match(sql,/NOT proof that an AI turn occurred/);
});
