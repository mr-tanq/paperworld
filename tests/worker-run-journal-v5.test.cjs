'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeWorkerRunJournal}=require('../server/worker-run-journal-v5.cjs');
const hub=require('../js/human-first-hub.js');
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const details={ownerId,threadId,requestId,project:'pokemon',summary:'Please inspect my Godot config'};
function mockStorage(){
 const seen=new Set(),calls=[],runs=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  if(opts.method==='POST'){
   const row=JSON.parse(opts.body),key=row.owner_id+':'+row.request_id;
   if(seen.has(key))return {ok:true,json:async()=>[]};
   seen.add(key);runs.push(row);
   return {ok:true,json:async()=>[row]};
  }
  if(opts.method==='PATCH'){
   const next=JSON.parse(opts.body),row=runs[0];
   if(!row||row.status!=='running')return {ok:true,json:async()=>[]};
   Object.assign(row,next);
   return {ok:true,json:async()=>[row]};
  }
  return {ok:true,json:async()=>runs.map(row=>({
   id:'44444444-4444-4444-8444-444444444444',
   ...row,started_at:'2026-11-16T12:00:00Z'
  }))};
 };
 return {journal:makeWorkerRunJournal({fetcher,secret:'sb_secret_synthetic'}),calls,runs};
}
test('real read-only Worker claim is one-use across processes',async()=>{
 const {journal,runs}=mockStorage();
 assert.equal(journal.configured,true);
 await journal.claim(details);
 assert.equal(runs[0].project,'pokemon');
 assert.equal(runs[0].status,'running');
 await assert.rejects(()=>journal.claim(details),/worker_run_replay_or_unverified/);
 assert.equal(runs.length,1);
});
test('report is one-way, cannot finish twice, and never means source code was changed',async()=>{
 const {journal,runs}=mockStorage();
 await journal.claim(details);
 await journal.finish({ownerId,requestId,status:'reported',summary:'Verified read-only report'});
 assert.equal(runs[0].status,'reported');
 assert.equal(runs[0].execution,'read_only_analysis');
 await assert.rejects(()=>journal.finish({ownerId,requestId,status:'failed',summary:'retry'}),
  /worker_finish_not_verified/);
});
test('failed and interrupted runs remain persisted; no automatic retry is provided',async()=>{
 const {journal}=mockStorage();
 await journal.claim({...details,project:'listening'});
 await journal.finish({ownerId,requestId,status:'failed',summary:'Interrupted'});
 const entries=await journal.list({ownerId,threadId});
 assert.equal(entries[0].status,'failed');
 assert.equal(entries[0].workerId,'listening-developer');
 assert.equal('resume' in journal,false);
 await assert.rejects(()=>journal.claim({...details,project:'listening'}),
  /worker_run_replay_or_unverified/);
});
test('invalid or cross-project Worker execution claims are rejected before storage',async()=>{
 const {journal,calls}=mockStorage();
 await assert.rejects(()=>journal.claim({...details,project:'wellbeing'}),/invalid_worker_run/);
 await assert.rejects(()=>journal.claim({...details,ownerId:'not-owner'}),/invalid_worker_run/);
 assert.equal(calls.length,0);
});
test('browser UI distinguishes Worker run from a successful code change',()=>{
 const item={id:'44444444-4444-4444-8444-444444444444',
  requestId,project:'pokemon',directorId:'pokemon-director',
  workerId:'pokemon-developer',status:'reported',
  summary:'Read project.godot',createdAt:'2026-11-16T12:00:00Z'};
 const completed=hub.project({jobs:[],proposals:[],tasks:[],workerRuns:[item]});
 assert.equal(completed.rows[0].kind,'worker-run');
 assert.equal(completed.rows[0].stage,'diagnosed');
 const invalid=hub.project({workerRuns:[{...item,workerId:'studio-creative'}]});
 assert.equal(invalid.rows.length,0);
 const pending=hub.project({workerRuns:[{...item,status:'running'}]});
 assert.equal(pending.rows[0].stage,'in_progress');
});
test('existing five-turn consent and $0 usage gate remain unchanged',()=>{
 for(const path of ['server/matt-worker-delegation.cjs','server/pokemon-worker-delegation.cjs']){
  const s=fs.readFileSync(path,'utf8');
  assert.match(s,/budgetVerified/);
  assert.match(s,/runClaimed/);
  assert.match(s,/journal\.claim/);
  assert.match(s,/journal\.finish/);
  assert.match(s,/already_submitted/);
 }
 const code=fs.readFileSync('server/worker-run-journal-v5.cjs','utf8');
 assert.doesNotMatch(code,/sendAndWait|createPullRequest|tools\/call/);
});
