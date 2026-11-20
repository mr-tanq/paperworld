'use strict';
// Phase 5: the routine brief built in SQL must match the trusted project
// registry the dispatcher enforces, and the UI must describe what really happens.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let REGISTRY;
test.before(async()=>({REGISTRY}=await import('../supabase/functions/paperworld-task-dispatch/projects.mjs')));
const SQL=fs.readFileSync('sql/paperworld_phase5_routines_do_work.sql','utf8');
const list=s=>[...s.matchAll(/'([^']+)'/g)].map(m=>m[1]);
test('routine brief uses exactly the registry tests and paths for each coding project',()=>{
 for(const [project,repo] of [['listening','mr-tanq/concerts'],['pokemon','mr-tanq/pokemon-echoes']]){
  const block=SQL.slice(SQL.indexOf("when '"+project+"' then jsonb_build_object("));
  const tests=list(block.match(/'requiredTests',jsonb_build_array\(([^)]*)\)/)[1]);
  const paths=list(block.match(/'allowedPaths',jsonb_build_array\(([^)]*)\)/)[1]);
  assert.deepEqual(tests,[...REGISTRY[project].testIds],project+' tests');
  assert.deepEqual(paths,[...REGISTRY[project].allowedPaths],project+' paths');
  assert.ok(block.includes("'repository','"+repo+"'"));
 }
 assert.match(SQL,/'maxFiles',6,'noAutoMerge',true,'noAutoDeploy',true/);
});
test('no new cron, no budget bypass, safe fallback to the review-only draft',()=>{
 const body=SQL.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(body,/cron\.|sessions_per_day|allow_unmetered|begin_effect/);
 assert.match(body,/paperworld_v5_plan_task\(new_id,spec\) and public\.paperworld_v5_queue_task\(new_id\)/);
 assert.match(body,/exception when others then\s+started:=false;/);
 assert.match(body,/routines_start_work and engine='v1' and dispatch_enabled/);
});
test('routine card tells the truth for coding vs other projects',()=>{
 const js=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(js,/\['listening','pokemon'\]\.includes\(plan\.projectId\)\?\s*'Τη σωστή μέρα η ομάδα θα κάνει μόνη της τον έλεγχο/);
 assert.match(js,/Δεν ξεκινά τίποτα και δεν χρεώνεται τίποτα χωρίς εσένα/);
});
