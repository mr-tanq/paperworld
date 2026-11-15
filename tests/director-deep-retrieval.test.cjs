'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createDirectorMemoryStore}=require('../server/director-memory-store.cjs');
const {createDirectorMemoryContext}=require('../server/director-memory-context.cjs');
const owner='22222222-2222-4222-8222-222222222222',token='a'.repeat(30);
const make=(n)=>({id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),
 project_id:'studio',kind:'preference',status:'approved',title:'Studio note '+n,
 body:n===120?'Golden Ray acoustic voice':('Other reference '+n),
 source_type:'conversation',source_ref:'synthetic-only',observed_at:'2026-11-15T00:00:00Z',
 version:1,sensitivity:'private'});
function factory(pages){
 const requests=[];
 const identity={authenticate:async()=>({ownerId:owner})};
 const store=createDirectorMemoryStore({baseUrl:'https://demo.example',
  publicKey:'public-test-key',authenticate:identity.authenticate,
  fetcher:async(url,opts)=>{
   requests.push({url,opts});
   const offset=Number(new URL(url).searchParams.get('offset')||0);
   return {ok:true,json:async()=>pages.get(offset)||[]};
  }});
 return {store,requests,identity};
}
test('retrieves approved memory from older pages with correct owner and status filters',async()=>{
 const pages=new Map([[0,Array.from({length:100},(_,i)=>make(i+1))],
 [100,[make(120)]]]);
 const {store,requests,identity}=factory(pages);
 const context=createDirectorMemoryContext({store,authenticate:identity.authenticate});
 const result=await context.load({token,ownerId:owner,actor:'studio-director',
  projectId:'studio',query:'Golden Ray acoustic voice'});
 assert.match(result.text,/Golden Ray acoustic voice/);
 assert.equal(requests.length,2);
 for(const req of requests){
  assert.match(req.url,/project_id=eq.studio/);
  assert.match(req.url,/status=eq.approved/);
  assert.equal(req.opts.headers.Authorization,'Bearer '+token);
 }
});
test('rejects duplicate page ids and mixed-project or unapproved responses',async()=>{
 for(const second of [make(1),{...make(101),project_id:'wellbeing'},
  {...make(102),status:'proposed'}]){
  const pages=new Map([[0,Array.from({length:100},(_,i)=>make(i+1))],[100,[second]]]);
  const {store}=factory(pages);
  await assert.rejects(store.listRelevant({token,ownerId:owner,projectId:'studio'}));
 }
});
test('fails closed on an incomplete maximum page scan',async()=>{
 const pages=new Map([0,100,200,300].map(offset=>[
  offset,Array.from({length:100},(_,i)=>make(offset+i+1))]));
 const {store,requests}=factory(pages);
 await assert.rejects(store.listRelevant({token,ownerId:owner,projectId:'studio'}),
 /memory_search_index_required/);
 assert.equal(requests.length,4);
});
