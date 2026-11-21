'use strict';
// The dispatcher handles several ready steps per wake-up (live: up to 4,
// bounded to 8 s, inside the 12 s cron call) instead of one step per five-minute tick for everyone.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('live dispatcher batches steps; tests keep one step per call',()=>{
 const src=fs.readFileSync('supabase/functions/paperworld-task-dispatch/index.mjs','utf8');
 assert.match(src,/clock=Date\.now,batch=1,batchMs=8000\}=\{\}/);
 assert.match(src,/createTaskDispatcher\(\{environment:k=>Deno\.env\.get\(k\),batch:4\}\)/);
 assert.match(src,/\['idle','disabled','awaiting_external_evidence','effect_reconciled','reconciling'\]/);
 assert.match(src,/clock\(\)-started>batchMs\)break;/);
 assert.match(src,/respond\(200,await processBatch\(\)\)/);
});
