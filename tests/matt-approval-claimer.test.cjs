'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createApprovalClaimer,CLAIM_SQL}=require('../server/matt-approval-claimer.cjs');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',
 c='33333333-3333-4333-8333-333333333333',d='44444444-4444-4444-8444-444444444444';
const input={approvalId:a,requestId:b,threadId:c,ownerId:d,agentId:'matt'};
test('Cannot claim without explicit independent billing guard',async()=>{
 let calls=0;
 const x=createApprovalClaimer({execute:async()=>{calls++;return [{id:a}]},checkBudget:async()=>false});
 assert.deepEqual(await x.claimApproval(input),{allowed:false,budgetConfigured:false});
 assert.equal(calls,0);
});
test('Claim is parameterized, bound to owner/thread/request, and single use',async()=>{
 const claimed=new Set(),seen=[];
 const x=createApprovalClaimer({checkBudget:async()=>true,execute:async(sql,args)=>{
  seen.push({sql,args});
  if(claimed.has(args[0]))return [];
  claimed.add(args[0]);return [{id:args[0]}];
 }});
 assert.equal((await x.claimApproval(input)).allowed,true);
 assert.equal((await x.claimApproval(input)).allowed,false);
 assert.deepEqual(seen[0].args,[a,b,c,d]);
 assert.match(CLAIM_SQL,/state='approved' AND expires_at > now\(\)/);
 assert.match(CLAIM_SQL,/request_id=\$2::uuid/);
 assert.match(CLAIM_SQL,/thread_id=\$3::uuid/);
 assert.match(CLAIM_SQL,/owner_id=\$4::uuid/);
});
test('Cannot claim for invalid identifiers or other agent',async()=>{
 let calls=0;
 const x=createApprovalClaimer({execute:async()=>{calls++},checkBudget:async()=>{calls++;return true}});
 assert.equal((await x.claimApproval({...input,ownerId:'evil'})).allowed,false);
 assert.equal((await x.claimApproval({...input,agentId:'listening-director'})).allowed,false);
 assert.equal(calls,0);
});
test('Schema is a private non-browser ledger, not an approval UI',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/matt-approvals.proposed.sql'),'utf8');
 assert.match(sql,/create schema if not exists paperworld_private/);
 assert.match(sql,/revoke all on schema paperworld_private from public, anon, authenticated/);
 assert.match(sql,/revoke all on paperworld_private\.matt_ai_approvals from public, anon, authenticated/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/unique/);
 assert.doesNotMatch(sql,/grant .*authenticated/i);
});
