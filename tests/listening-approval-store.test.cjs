'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createDurableApprovalStore}=require('../server/listening-approval-store.cjs');
const id='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222';
const jobId='33333333-3333-4333-8333-333333333333';
const data={id,ownerId,jobId,repository:'mr-tanq/concerts',
 digest:'a'.repeat(64),secretHash:'b'.repeat(64),now:1800000000000};
const secret='sb_secret_TEST_ONLY_NOT_REAL';
test('Persistent approval uses ONE atomic conditional PATCH, never GET + PATCH',async()=>{
 const calls=[];
 const store=createDurableApprovalStore({secret,fetcher:async(url,opts)=>{
  calls.push({url,opts});
  return {ok:true,json:async()=>[{id}]};
 }});
 assert.equal(await store.consumeOnce(data),true);
 assert.equal(calls.length,1);
 const {url,opts}=calls[0];
 const parsed=new URL(url);
 assert.equal(parsed.hostname,'jrevhzvrgenucuozjowm.supabase.co');
 assert.equal(parsed.pathname,'/rest/v1/paperworld_write_approvals');
 assert.equal(opts.method,'PATCH');
 assert.equal(parsed.searchParams.get('owner_id'),'eq.'+ownerId);
 assert.equal(parsed.searchParams.get('job_id'),'eq.'+jobId);
 assert.equal(parsed.searchParams.get('plan_digest'),'eq.'+data.digest);
 assert.equal(parsed.searchParams.get('secret_hash'),'eq.'+data.secretHash);
 assert.equal(parsed.searchParams.get('consumed_at'),'is.null');
 assert.equal(parsed.searchParams.get('expires_at'),'gt.'+new Date(data.now).toISOString());
 assert.equal(JSON.parse(opts.body).consumed_at,new Date(data.now).toISOString());
 assert.equal(opts.headers.apikey,secret);
 assert.equal(opts.headers.Authorization,undefined);
 assert.ok(!url.includes(secret));
});
test('No matched row means expired/consumed/mismatched grant, never authorization',async()=>{
 for(const rows of [[],[{id:'other'}],[{id},{id}]]){
  const store=createDurableApprovalStore({secret,fetcher:async()=>({ok:true,json:async()=>rows})});
  assert.equal(await store.consumeOnce(data),false);
 }
 const store=createDurableApprovalStore({secret,fetcher:async()=>({ok:false})});
 assert.equal(await store.consumeOnce(data),false);
});
test('Malformed or wrong-repository grants never touch storage',async()=>{
 let n=0;
 const store=createDurableApprovalStore({secret,fetcher:async()=>{n++;return {ok:true}}});
 for(const altered of [{id:'bad'},{repository:'other/repo'},{digest:'bad'},
  {secretHash:'bad'},{now:NaN}]){
  assert.equal(await store.consumeOnce({...data,...altered}),false);
 }
 assert.equal(n,0);
});
test('Store fails closed without backend secret and has no public API route',()=>{
 assert.throws(()=>createDurableApprovalStore({secret:''}));
 const fs=require('node:fs');
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 const ui=fs.readFileSync('js/cloud-ui.js','utf8');
 assert.doesNotMatch(server,/listening-approval-store|paperworld_write_approvals/);
 assert.doesNotMatch(ui,/paperworld_write_approvals/);
});
