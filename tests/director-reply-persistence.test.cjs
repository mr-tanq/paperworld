'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDirectorReplyPersistence}=require('../server/director-reply-persistence.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const thread='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const args={token:'abc.123.long_valid_token',ownerId:owner,threadId:thread,
 agentId:'studio-director',requestId,content:'Original private studio reply'};
function mock({match=true,owns=true,ok=true,secret='sb_secret_MOCK_TEST_ONLY'}={}){
 const calls=[];
 const api=createDirectorReplyPersistence({
  secret,identity:{authenticate:async()=>({ownerId:match?owner:'44444444-4444-4444-8444-444444444444'}),
   ownsThread:async a=>{calls.push({ownership:a});return owns}},
  fetcher:async(url,options)=>{calls.push({url,options});return {ok}}
 });
 return {api,calls};
}
test('persists a trusted Director reply under the exact private owner and thread',async()=>{
 const {api,calls}=mock();
 assert.equal(await api.save(args),true);
 const write=calls.find(c=>c.options);
 assert.equal(write.options.method,'POST');
 assert.equal(write.options.headers.Prefer,'return=minimal');
 assert.equal(write.options.headers.apikey,'sb_secret_MOCK_TEST_ONLY');
 assert.equal(write.options.headers.Authorization,undefined);
 assert.deepEqual(JSON.parse(write.options.body),{
  id:requestId,thread_id:thread,owner_id:owner,role:'agent',content:args.content
 });
});
test('denies wrong owner, wrong Director thread or invalid actor without posting',async()=>{
 for(const flags of [{match:false},{owns:false}]){
  const {api,calls}=mock(flags);
  assert.equal(await api.save(args),false);
  assert.equal(calls.filter(c=>c.options).length,0);
 }
 const {api,calls}=mock();
 assert.equal(await api.save({...args,agentId:'matt'}),false);
 assert.equal(calls.filter(c=>c.options).length,0);
});
test('requires configured secret, reports failed writes and clips to schema limit',async()=>{
 const noSecret=mock({secret:''});
 assert.equal(await noSecret.api.save(args),false);
 const fail=mock({ok:false});
 assert.equal(await fail.api.save(args),false);
 const {api,calls}=mock();
 assert.equal(await api.save({...args,content:'X'.repeat(2300)}),true);
 assert.equal(JSON.parse(calls.find(c=>c.options).options.body).content.length,2000);
});
