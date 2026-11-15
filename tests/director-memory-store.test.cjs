'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createDirectorMemoryStore}=require('../server/director-memory-store.cjs');
const OWNER='22222222-2222-4222-8222-222222222222';
const ID='11111111-1111-4111-8111-111111111111',JWT='x'.repeat(28);
function entry(){return {id:ID,projectId:'studio',kind:'project_bible',
 status:'proposed',title:'Artistic vision',body:'No fabricated live performances.',
 sourceType:'owner_note',sourceRef:'owner-manual-review',
 observedAt:'2026-11-15T00:00:00Z',version:1,sensitivity:'private'};}
function setup({validOwner=true,rows=[],failStatus=false}={}){
 const requests=[];
 const store=createDirectorMemoryStore({
  baseUrl:'https://example.supabase.co',publicKey:'test-public-key',
  authenticate:async()=>({ownerId:validOwner?OWNER:'33333333-3333-4333-8333-333333333333'}),
  fetcher:async(url,opts)=>{requests.push({url,opts});return {
   ok:!failStatus,json:async()=>rows
  }}
 });
 return {store,requests};
}
test('Only proposed facts may be sent with the current owner JWT',async()=>{
 const s=setup();
 const proposal=await s.store.propose({token:JWT,ownerId:OWNER,entry:entry()});
 assert.equal(proposal.status,'proposed');
 assert.equal(s.requests.length,1);
 assert.match(s.requests[0].url,/paperworld_director_memory$/);
 assert.equal(s.requests[0].opts.method,'POST');
 assert.equal(s.requests[0].opts.headers.Authorization,'Bearer '+JWT);
 const data=JSON.parse(s.requests[0].opts.body);
 assert.equal(data.status,'proposed');
 assert.equal(data.project_id,'studio');
 assert.equal(data.sensitivity,'private');
 assert.equal(data.owner_id,undefined);
 await assert.rejects(s.store.propose({token:JWT,ownerId:OWNER,
  entry:{...entry(),status:'approved'}}),/memory_proposal_required/);
 assert.equal(s.requests.length,1);
});
test('Reject mismatched owner and invalid project before any storage request',async()=>{
 const s=setup({validOwner:false});
 await assert.rejects(s.store.propose({token:JWT,ownerId:OWNER,entry:entry()}),
  /memory_owner_mismatch/);
 await assert.rejects(s.store.list({token:JWT,ownerId:OWNER,projectId:'wrong'}),
  /memory_identity_invalid/);
 assert.equal(s.requests.length,0);
});
test('Select is filtered on one project and response mixing is denied',async()=>{
 const source=entry(),db={
  id:source.id,project_id:'studio',kind:source.kind,status:source.status,
  title:source.title,body:source.body,source_type:source.sourceType,
  source_ref:source.sourceRef,observed_at:source.observedAt,
  version:source.version,sensitivity:source.sensitivity};
 const s=setup({rows:[db]});
 const rows=await s.store.list({token:JWT,ownerId:OWNER,projectId:'studio'});
 assert.equal(rows.length,1);
 assert.equal(rows[0].projectId,'studio');
 assert.match(s.requests[0].url,/project_id=eq.studio/);
 assert.match(s.requests[0].url,/limit=100/);
 const invalid=setup({rows:[{...db,project_id:'workshop'}]});
 await assert.rejects(invalid.store.list({token:JWT,ownerId:OWNER,
  projectId:'studio'}),/memory_project_response_mismatch/);
});
test('Database and network failures hide response body and credentials',async()=>{
 const s=setup({failStatus:true});
 await assert.rejects(s.store.list({token:JWT,ownerId:OWNER,projectId:'studio'}),
  error=>{assert.doesNotMatch(String(error),new RegExp(JWT));return true});
});
test('Migration is review-only, RLS owner-scoped and proposed-only writes',()=>{
 const sql=fs.readFileSync(path.join(__dirname,
  '../supabase/paperworld_director_memory_v1_REVIEW.sql'),'utf8');
 assert.match(sql,/REVIEW ONLY, NOT APPLIED/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/auth.uid\(\)/);
 assert.match(sql,/with check \(\(select auth.uid\(\)\)=owner_id and status='proposed'\)/);
 assert.match(sql,/grant select,insert on public.paperworld_director_memory to authenticated/);\n assert.match(sql,/paperworld_review_director_memory/);\n assert.match(sql,/p_decision not in \('approved','rejected'\)/);
 assert.doesNotMatch(sql,/grant (?:all|update|delete) on public.paperworld_director_memory to authenticated/);
});

test('Owner review RPC is disabled until trusted one-time human confirmation exists',async()=>{
 const base=setup();
 await assert.rejects(base.store.review({token:JWT,ownerId:OWNER,
  entryId:ID,decision:'approved',
  approvalId:'33333333-3333-4333-8333-333333333333'}),
  /owner_review_not_configured/);
 assert.equal(base.requests.length,0);
});
test('Approved owner review uses scoped RPC, never direct UPDATE or DELETE',async()=>{
 const calls=[];
 const store=createDirectorMemoryStore({
  baseUrl:'https://example.supabase.co',publicKey:'test-public-key',
  authenticate:async()=>({ownerId:OWNER}),
  verifyOwnerReview:async args=>{
   assert.equal(args.ownerId,OWNER);
   assert.equal(args.decision,'approved');return true
  },
  fetcher:async(url,opts)=>{
   calls.push({url,opts});
   return {ok:true,json:async()=>true};
  }
 });
 const approvalId='33333333-3333-4333-8333-333333333333';
 const result=await store.review({token:JWT,ownerId:OWNER,entryId:ID,
  decision:'approved',approvalId});
 assert.equal(result.status,'approved');
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/\/rpc\/paperworld_review_director_memory$/);
 assert.equal(calls[0].opts.method,'POST');
 assert.deepEqual(JSON.parse(calls[0].opts.body),{
  p_id:ID,p_decision:'approved'
 });
});
test('Human review callback denial cannot touch persistence',async()=>{
 let invoked=false;
 const store=createDirectorMemoryStore({
  baseUrl:'https://example.supabase.co',publicKey:'test-public-key',
  authenticate:async()=>({ownerId:OWNER}),
  verifyOwnerReview:async()=>false,
  fetcher:async()=>{invoked=true;return {ok:true,json:async()=>true}}
 });
 await assert.rejects(store.review({token:JWT,ownerId:OWNER,
  entryId:ID,decision:'approved',approvalId:'33333333-3333-4333-8333-333333333333'}),
  /explicit_owner_approval_required/);
 assert.equal(invoked,false);
});
