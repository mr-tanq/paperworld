'use strict';
// Fewer stops that need the owner:
//  - a too-big or out-of-scope change is redone once, smaller, on its own;
//  - waiting for the repository is allowed by the database (start_agent);
//  - "checked, nothing to change" and a redone first try count as autonomous.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('supabase/functions/paperworld-task-dispatch/index.mjs','utf8');
test('too many files / out of scope → one automatic smaller redo before stopping',()=>{
 assert.match(src,/'agent_files_out_of_scope','agent_too_many_files',/);assert.match(src,/!AUTO_RETRY\.includes\(reason\)/);
 assert.match(src,/await queueRetry\(mission,'agent_too_many_files',\{prNumber\}\);\n\s*return fail\(s\.id,worker,'agent_too_many_files',mission\)/);
 assert.match(src,/await queueRetry\(mission,'agent_files_out_of_scope',\{prNumber\}\);\n\s*return fail\(s\.id,worker,'agent_files_out_of_scope',mission\)/);
 assert.match(src,/Change ONLY files under: /);
 assert.match(src,/if\(count===0\)return fail\(s\.id,worker,'agent_no_changes',mission\)/,'nothing changed is never retried');
});
test('the database allows the repository wait only before anything was sent',()=>{
 const sql=fs.readFileSync('sql/paperworld_defer_start_agent_v1.sql','utf8');
 assert.match(sql,/s\.capability not in \('start_agent','await_agent','verify'\)/);
 assert.match(sql,/if found and not \(s\.capability='verify' and e\.kind='dispatch_verify'/,'a start_agent with an effect is never deferred');
});
test('proof: checks and redone first tries count as autonomous',()=>{
 const P=require('../js/proof.js');const now=Date.parse('2026-11-24T10:00:00Z');
 const m=o=>({projectId:'listening',createdAt:'2026-11-23T10:00:00Z',updatedAt:'2026-11-23T11:00:00Z',...o});
 const s=P.summary([m({id:'a',status:'needs_you',lastError:'agent_too_many_files'}),
  m({id:'b',status:'completed',report:{merged:true},retryOf:'a'}),
  m({id:'c',status:'needs_you',lastError:'agent_no_changes'}),
  m({id:'d',status:'needs_you',lastError:'trusted_verification_failed'})],now);
 assert.equal(s.alone,1);assert.equal(s.checked,1);assert.equal(s.neededYou,1);assert.equal(s.rate,67);
 assert.equal(P.LABEL.checked,'✓ Έλεγξαν· τίποτα να αλλάξει');
 assert.match(fs.readFileSync('server/v5-autonomous-mission-api.cjs','utf8'),/retryOf:UUID\.test\(r\.policy\?\.retryOf\|\|''\)\?r\.policy\.retryOf:null/);
});
test('weekly meeting counts a check as a check, not as "needs you"',async()=>{
 const {weekly}=await import('../supabase/functions/paperworld-watch/index.mjs');
 const w=weekly([{id:'x',project_id:'pokemon',status:'needs_you',last_error:'agent_no_changes',policy:{}}]);
 assert.equal(w.you,0);assert.match(w.text,/Joey: 1 έλεγχος χωρίς να χρειαστεί αλλαγή/);
});

// More stops get one fresh attempt; a step that kept erroring is swept up too.
const OWNER='11111111-1111-4111-8111-111111111111',THREAD='22222222-2222-4222-8222-222222222222',
 MID='44444444-4444-4444-8444-444444444444';
const SPEC={projectId:'listening',directorId:'listening-director',repository:'mr-tanq/concerts',title:'t',summary:'s',
 acceptance:['a'],requiredTests:['festival_revisit'],allowedPaths:['js/'],maxFiles:4,noAutoMerge:true,noAutoDeploy:true};
function sweepFake({policy={},project='listening',enabled=true}={}){
 const calls=[];let created=null;
 const fetcher=async(url,o={})=>{const m=o.method||'GET';calls.push([m,url,o.body&&JSON.parse(o.body)]);
  const json=b=>({ok:true,status:200,json:async()=>b});
  if(url.includes('controller_v5'))return json([{engine:'v1',dispatch_enabled:enabled,live_adapters:[]}]);
  if(url.includes('/rpc/'))return json(true);
  if(url.includes('paperworld_autonomous_missions_v5')){
   if(m==='POST'){created={...JSON.parse(o.body)};return json([created])}
   const q=new URL(url).searchParams;
   if(q.get('status')==='in.(needs_you,failed)')return json([{id:MID,owner_id:OWNER,thread_id:THREAD,goal:'g',project_id:project,
    status:'needs_you',spec:SPEC,policy,last_error:'effect_requires_reconciliation'}]);
   if(q.get('id'))return json(created&&q.get('id')==='eq.'+created.id?[{id:created.id,status:'draft'}]:[]);
  }
  return json([]);};
 return {fetcher,calls,get created(){return created}};
}
test('every retryable stop gets one fresh attempt, also when a step kept erroring',async()=>{
 for(const r of ['copilot_deadline_exceeded','pr_head_changed_before_verify','trusted_verification_timed_out',
  'pr_head_moved_after_verify','effect_requires_reconciliation'])assert.ok(src.includes("'"+r+"'"),r);
 assert.doesNotMatch(src.slice(src.indexOf('const AUTO_RETRY'),src.indexOf('const respond')),/agent_no_changes|ambiguous_copilot_pr/);
 assert.match(src,/if\(mission&&AUTO_RETRY\.includes\(reason\)\)\{try\{await queueRetry\(mission,reason\)\}/,'queued before the stop is recorded');
 const {createTaskDispatcher}=await import('../supabase/functions/paperworld-task-dispatch/index.mjs');
 const env=k=>({SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40)})[k];
 const f=sweepFake();
 const out=await createTaskDispatcher({environment:env,fetcher:f.fetcher}).processBatch();
 assert.equal(out.retriesQueued,1);
 assert.ok(f.created,'a retry mission was created');assert.equal(f.created.policy.retryOf,MID);
 assert.ok(f.calls.some(([,u])=>u.endsWith('/rpc/paperworld_v5_queue_task')));
 assert.ok(f.calls.some(([,u])=>u.includes('updated_at=gte.')),'only recent stops');
 assert.equal(f.created.policy.retryDepth,1);
 // The first retry may get ONE more, last and smallest attempt; never a fourth.
 const third=sweepFake({policy:{retryOf:'x'}});await createTaskDispatcher({environment:env,fetcher:third.fetcher}).processBatch();
 assert.equal(third.created.policy.retryDepth,2);
 const plan=third.calls.find(([,u])=>u.endsWith('/rpc/paperworld_v5_plan_task'))[2];
 assert.match(plan.p_spec.summary,/LAST TRY: two attempts stopped \(latest: effect_requires_reconciliation\)/);
 assert.equal(plan.p_spec.maxFiles,3);
 const fourth=sweepFake({policy:{retryOf:'x',retryDepth:2}});await createTaskDispatcher({environment:env,fetcher:fourth.fetcher}).processBatch();
 assert.equal(fourth.created,null,'never a fourth attempt');
 const off=sweepFake({enabled:false});await createTaskDispatcher({environment:env,fetcher:off.fetcher}).processBatch();
 assert.equal(off.created,null,'nothing is queued while the engine is switched off');
 assert.match(src,/console\.error\(JSON\.stringify\(\{event:'dispatch_error',code:/);
});
test('the engine also wakes for a stopped task that can be redone (same list as the engine)',()=>{
 const sql=fs.readFileSync('sql/paperworld_wake_for_retries_v1.sql','utf8');
 const list=src.slice(src.indexOf('const AUTO_RETRY'),src.indexOf('const respond')).match(/'[a-z_]+'/g);
 for(const r of list)assert.ok(sql.includes(r),'wakeup knows '+r);
 assert.match(sql,/m\.status in \('needs_you','failed'\) and m\.updated_at>now\(\)-interval '48 hours'/);
 assert.match(sql,/not exists\(select 1 from public\.paperworld_autonomous_missions_v5 r\s+where r\.policy->>'retryOf'=m\.id::text\)/,'never wakes twice for the same stop');
});

test('wakeup v2 allows the third attempt but never a fourth',()=>{
 const sql=fs.readFileSync('sql/paperworld_wake_for_retries_v2.sql','utf8');
 assert.match(sql,/coalesce\(\(m\.policy->>'retryDepth'\)::int,case when m\.policy \? 'retryOf' then 1 else 0 end\)<2/);
 assert.doesNotMatch(sql,/m\.policy->>'retryOf' is null/);
 assert.match(src,/if\(depth>=2\|\|!AUTO_RETRY\.includes\(reason\)\)/);
 assert.match(fs.readFileSync('js/world-dialogue.js','utf8'),/όριο των 8 εργασιών τη μέρα/);
});
