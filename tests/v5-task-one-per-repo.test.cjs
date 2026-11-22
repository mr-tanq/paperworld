'use strict';
// Parallel Developer PRs on the same repo conflicted once the first merged
// (pokemon-echoes #17/#18). Now: one Developer at a time per repository, and a
// verified change that only conflicts with a newer main is redone once.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const HEAD='a'.repeat(40);
test('a conflicting PR is reported as merge_conflict, never merged blindly',async()=>{
 const {makeTaskGithub}=await import('../supabase/functions/paperworld-task-dispatch/github.mjs');
 const calls=[];
 const fetcher=async(url,o={})=>{calls.push([o.method||'GET',url]);
  return {ok:true,status:200,json:async()=>({number:18,state:'open',draft:false,mergeable:false,mergeable_state:'dirty',
   head:{sha:HEAD},base:{ref:'main'},node_id:'PR_x'})}};
 const gh=makeTaskGithub({fetcher,token:'t'.repeat(30)});
 assert.deepEqual(await gh.mergeVerified('pokemon',{prNumber:18,headSha:HEAD,title:'NPC dialogue'}),{state:'blocked',reason:'merge_conflict'});
 assert.ok(!calls.some(([m])=>m==='PUT'),'no merge attempt on a conflicted PR');
});
test('engine: waits while another Developer works on the same repo; conflict → one automatic redo',()=>{
 const src=fs.readFileSync('supabase/functions/paperworld-task-dispatch/index.mjs','utf8');
 assert.match(src,/if\(await busyRepository\(mission\)\)\{/);
 assert.match(src,/status:'in\.\(working,verifying\)',id:'neq\.'\+mission\.id/);
 assert.match(src,/capability:'eq\.report',state:'eq\.succeeded'/);
 assert.ok(src.indexOf('busyRepository(mission)')<src.indexOf("reserve(s.id,worker,key,'start_agent')"),'checked before any session is reserved');
 assert.match(src,/\['trusted_verification_failed','copilot_pr_missing','merge_conflict'\]/);
 assert.match(src,/if\(merge\.reason==='merge_conflict'\)retry=await queueRetry\(mission,'merge_conflict'/);
 assert.match(src,/Redo the same change on top of the current main/);
});
test('Matt does not ask for a click when the redo is already queued',()=>{
 const sql=fs.readFileSync('sql/paperworld_phase3_learning_memory.sql','utf8');
 assert.match(sql,/when notice\.kind='completed' and rep->>'retryQueued'='true' then/);
 assert.ok(sql.indexOf("rep->>'retryQueued'='true'")<sql.indexOf("when notice.kind='completed' and rep ? 'mergeState'"));
});
