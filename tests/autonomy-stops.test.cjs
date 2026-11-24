'use strict';
// Fewer stops that need the owner:
//  - a too-big or out-of-scope change is redone once, smaller, on its own;
//  - waiting for the repository is allowed by the database (start_agent);
//  - "checked, nothing to change" and a redone first try count as autonomous.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('supabase/functions/paperworld-task-dispatch/index.mjs','utf8');
test('too many files / out of scope → one automatic smaller redo before stopping',()=>{
 assert.match(src,/'agent_files_out_of_scope','agent_too_many_files'\]\.includes\(reason\)/);
 assert.match(src,/await queueRetry\(mission,'agent_too_many_files',\{prNumber\}\);\n\s*return fail\(s\.id,worker,'agent_too_many_files'\)/);
 assert.match(src,/await queueRetry\(mission,'agent_files_out_of_scope',\{prNumber\}\);\n\s*return fail\(s\.id,worker,'agent_files_out_of_scope'\)/);
 assert.match(src,/Change ONLY files under: /);
 assert.match(src,/if\(count===0\)return fail\(s\.id,worker,'agent_no_changes'\)/,'nothing changed is never retried');
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
