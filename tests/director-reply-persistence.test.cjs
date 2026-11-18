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
test('requires configured secret and stores full owner-scoped Crow replies',async()=>{
 const noSecret=mock({secret:''});
 assert.equal(await noSecret.api.save(args),false);
 const fail=mock({ok:false});
 assert.equal(await fail.api.save(args),false);
 const {api,calls}=mock();
 assert.equal(await api.save({...args,content:'X'.repeat(2300)}),true);
 assert.equal(JSON.parse(calls.find(c=>c.options).options.body).content.length,2300);
});

test('Crow full lyrics survive while oversized drafts and other Directors fail closed',async()=>{
 const {api,calls}=mock();
 const longSong='TITLE: Original\nSUNO STYLE PROMPT: Organic trip-hop\nLYRICS:\n[Verse 1]\n'+
  'One original lyric line\n'.repeat(130)+'[End]';
 assert.ok(longSong.length>2000&&longSong.length<6000);
 assert.equal(await api.save({...args,content:longSong}),true);
 const post=calls.find(c=>c.options);
 assert.equal(JSON.parse(post.options.body).content,longSong);
 const before=calls.filter(x=>x.options).length;
 assert.equal(await api.save({...args,content:'X'.repeat(6001)}),false);
 assert.equal(await api.save({...args,agentId:'pokemon-director',
  content:'X'.repeat(2100)}),false);
 assert.equal(calls.filter(x=>x.options).length,before);
});
