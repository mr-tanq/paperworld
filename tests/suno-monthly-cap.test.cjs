'use strict';
// Phase 4: the 50-songs-a-month cap is enforced in the durable claim and shown
// to the owner in plain words; no Suno request is made when it is reached.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeSunoClaim}=require('../server/suno-durable-claim.cjs');
const args={ownerId:'11111111-1111-4111-8111-111111111111',threadId:'22222222-2222-4222-8222-222222222222',
 idempotencyKey:'33333333-3333-4333-8333-333333333333',brief:{title:'t',style:'s',lyrics:'l'}};
const claim=(response)=>makeSunoClaim({secret:'sb_secret_synthetic_only_0000000000',fetcher:async()=>response});
test('a database "monthly limit" refusal becomes suno_monthly_limit_reached',async()=>{
 await assert.rejects(claim({ok:false,status:400,json:async()=>({message:'suno_monthly_limit_reached'})}).reserve(args),
  /^Error: suno_monthly_limit_reached$/);
 await assert.rejects(claim({ok:false,status:500,json:async()=>({message:'other'})}).reserve(args),/suno_claim_unavailable/);
 assert.equal(await claim({ok:true,status:200,json:async()=>true}).reserve(args),true);
});
test('server answers 429 before any Suno call; browser treats it as a safe pre-flight stop',()=>{
 const server=fs.readFileSync('server/suno-oauth-client.cjs','utf8');
 const at=server.indexOf("'suno_monthly_limit_reached')return denied(429");
 assert.ok(at>0&&at<server.indexOf('audioCreate.submit('),'cap is checked before submission');
 assert.match(fs.readFileSync('js/cloud.js','utf8'),/'suno_claim_storage_missing','suno_monthly_limit_reached'/);
 assert.match(fs.readFileSync('js/world-dialogue.js','utf8'),/Φτάσαμε τα 50 τραγούδια αυτού του μήνα/);
});
test('SQL cap: 50 per owner per Amsterdam month, serialised, never released',()=>{
 const sql=fs.readFileSync('sql/paperworld_phase4_suno_monthly_cap.sql','utf8');
 assert.match(sql,/if used>=50 then\s+raise exception 'suno_monthly_limit_reached'/);
 assert.match(sql,/pg_advisory_xact_lock\(534128,hashtext\(p_owner::text\)\)/);
 assert.match(sql,/date_trunc\('month',now\(\) at time zone 'Europe\/Amsterdam'\)/);
 assert.doesNotMatch(sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n'),/delete from/i);
});
