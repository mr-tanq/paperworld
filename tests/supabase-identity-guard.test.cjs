'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSupabaseGuard}=require('../server/supabase-identity-guard.cjs');
const USER='11111111-1111-4111-8111-111111111111';
const THREAD='22222222-2222-4222-8222-222222222222';
const TOKEN='fixture.valid.token.payload';
function harness({person={id:USER,aud:'authenticated'},rows=[{id:THREAD,owner_id:USER,agent_id:'matt'}],status=200}={}){
 const requests=[];
 const fetcher=async(url,options)=>{requests.push({url,options});
   return {ok:status===200,status,json:async()=>url.includes('/auth/v1/user')?person:rows};
 };
 const guard=createSupabaseGuard({baseUrl:'https://example.supabase.co',publicKey:'public-fixture',fetcher});
 return {guard,requests};
}
test('Verifies authenticated Supabase identity, never accepts browser owner',async()=>{
 const x=harness();
 assert.deepEqual(await x.guard.authenticate(TOKEN),{ownerId:USER});
 assert.ok(x.requests[0].url.endsWith('/auth/v1/user'));
 assert.equal(x.requests[0].options.headers.Authorization,'Bearer '+TOKEN);
 assert.equal(x.requests[0].options.redirect,'error');
});
test('Uses same user JWT for RLS read and validates thread owner and Matt agent',async()=>{
 const x=harness();
 assert.equal(await x.guard.ownsThread({threadId:THREAD,ownerId:USER,agentId:'matt',token:TOKEN}),true);
 assert.equal(x.requests.length,3);
 assert.ok(x.requests[2].url.includes('id=eq.'+THREAD));
 assert.equal(x.requests[2].options.headers.Authorization,'Bearer '+TOKEN);
});
test('Rejects incorrect Supabase identity and foreign threads',async()=>{
 for(const cfg of [{person:{id:USER,aud:'anon'}},{person:{id:'not-uuid',aud:'authenticated'}}]){
  const x=harness(cfg);await assert.rejects(x.guard.authenticate(TOKEN));
 }
 const foreign=harness({rows:[{id:THREAD,owner_id:'33333333-3333-4333-8333-333333333333',agent_id:'matt'}]});
 assert.equal(await foreign.guard.ownsThread({threadId:THREAD,ownerId:USER,agentId:'matt',token:TOKEN}),false);
 const wrong=harness({rows:[{id:THREAD,owner_id:USER,agent_id:'listening-director'}]});
 assert.equal(await wrong.guard.ownsThread({threadId:THREAD,ownerId:USER,agentId:'matt',token:TOKEN}),false);
});
test('Fails closed on invalid tokens, missing rows or Supabase errors',async()=>{
 const x=harness();await assert.rejects(x.guard.authenticate('bad'));
 assert.equal(x.requests.length,0);
 const y=harness({rows:[]});
 assert.equal(await y.guard.ownsThread({threadId:THREAD,ownerId:USER,agentId:'matt',token:TOKEN}),false);
 const z=harness({status:401});
 await assert.rejects(z.guard.authenticate(TOKEN),/unavailable/);
});
