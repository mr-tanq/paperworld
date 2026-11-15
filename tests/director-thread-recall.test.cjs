'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createDirectorThreadRecall}=require('../server/director-thread-recall.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const thread='22222222-2222-4222-8222-222222222222';
const token='abc.123.fake_auth_token';
function make({rows=[],owns=true,ownerMatches=true}={}){
 const seen={urls:[],headers:[]};
 const identity={authenticate:async()=>({ownerId:ownerMatches?owner:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}),
  ownsThread:async()=>owns};
 const fetcher=async(url,options)=>{seen.urls.push(url);seen.headers.push(options.headers);
  return {ok:true,json:async()=>rows};};
 return {api:createDirectorThreadRecall({identity,fetcher}),seen};
}
const entry=(id,role,content,threadId=thread)=>({id:String(id),thread_id:threadId,role,content,
 created_at:'2026-11-15T12:00:00Z'});
test('private thread read is owner-verified, RLS user-token-only and read-only',async()=>{
 const {api,seen}=make({rows:[entry(2,'agent','Previous approved output'),
 entry(1,'human','Original user detail')]});
 const result=await api.load({token,ownerId:owner,agentId:'studio-director',threadId:thread});
 assert.match(result.text,/Original user detail/);
 assert.match(result.text,/Previous approved output/);
 assert.equal(result.messageCount,2);
 assert.match(seen.urls[0],/thread_id=eq/);
 assert.equal(seen.headers[0].Authorization,'Bearer '+token);
 assert.ok(!JSON.stringify(seen).includes('service_role'));
});
test('wrong user, missing ownership and unregistered agents deny without reading',async()=>{
 for(const opts of [{owns:false},{ownerMatches:false}]){
  const {api,seen}=make(opts);
  await assert.rejects(api.load({token,ownerId:owner,agentId:'studio-director',threadId:thread}));
  assert.equal(seen.urls.length,0);
 }
 const {api,seen}=make();
 await assert.rejects(api.load({token,ownerId:owner,agentId:'matt',threadId:thread}));
 assert.equal(seen.urls.length,0);
});
test('mixed thread response fails closed',async()=>{
 const {api}=make({rows:[entry(1,'human','Wrong private record',
  '99999999-9999-4999-8999-999999999999')]});
 await assert.rejects(api.load({token,ownerId:owner,agentId:'studio-director',threadId:thread}),
 /director_recall_invalid_response/);
});
test('cap history and reject malformed records',async()=>{
 const {api}=make({rows:[entry(1,'admin','Not a chat role')]});
 await assert.rejects(api.load({token,ownerId:owner,agentId:'studio-director',threadId:thread}),
 /director_recall_invalid_response/);
 const b=make({rows:[entry(1,'human','Q'.repeat(2100)),entry(2,'human','Short historical fact')]});
 const r=await b.api.load({token,ownerId:owner,agentId:'studio-director',threadId:thread});
 assert.doesNotMatch(r.text,/QQQQQQQQ/);
 assert.match(r.text,/Short historical fact/);
});
