'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGateway}=require('../server/matt-gateway.cjs');
const ID='11111111-1111-4111-8111-111111111111',RID='22222222-2222-4222-8222-222222222222',AID='33333333-3333-4333-8333-333333333333';
const req=(body={})=>({method:'POST',headers:{authorization:'Bearer jwt-fixture'},
 body:JSON.stringify({threadId:ID,requestId:RID,approvalId:AID,message:'Hello Matt',...body})});
function fixture(options={}){
 const events=[];
 const gateway=createGateway({
  authenticate:async token=>{events.push('auth');if(options.badAuth)throw Error('Invalid JWT');return {ownerId:'trusted-owner'}},
  ownsThread:async input=>{events.push('ownership');assert.equal(input.ownerId,'trusted-owner');assert.equal(input.token,'jwt-fixture');return !options.notOwner},
  claimApproval:async input=>{events.push('approval');assert.equal(input.ownerId,'trusted-owner');return {allowed:!options.denied,budgetConfigured:true}},
  linkedToken:async()=>{events.push('token');return options.noToken?'':'server-oauth-token'},
  adapter:{reply:async input=>{events.push('ai');assert.equal(input.ownerId,'trusted-owner');assert.equal(input.githubToken,'server-oauth-token');return {executed:true,agentId:'matt',content:'Real answer'}}}
 });
 return {gateway,events};
}
test('Missing auth, wrong method and invalid input never reach AI',async()=>{
 const f=fixture();
 for(const r of [{...req(),method:'GET'},{...req(),headers:{}},req({message:''}),req({threadId:'not-a-uuid'})]){
  const v=await f.gateway.handle(r);assert.notEqual(v.status,200);
 }
 assert.deepEqual(f.events,[]);
});
test('Ownership and explicit approval are both required before token lookup',async()=>{
 for(const [config,status,events] of [[{badAuth:true},401,['auth']],[{notOwner:true},404,['auth','ownership']],[{denied:true},403,['auth','ownership','approval']]]){
  const f=fixture(config),out=await f.gateway.handle(req());
  assert.equal(out.status,status);assert.deepEqual(f.events,events);
 }
});
test('Unconnected account cannot call AI; client owner and token are ignored',async()=>{
 const f=fixture({noToken:true});
 const out=await f.gateway.handle(req({ownerId:'evil-owner',githubToken:'stolen'}));
 assert.equal(out.status,409);assert.deepEqual(f.events,['auth','ownership','approval','token']);
});
test('Successful request gets trusted owner and server-side token only',async()=>{
 const f=fixture(),out=await f.gateway.handle(req({ownerId:'evil-owner',githubToken:'fake-token'}));
 assert.equal(out.status,200);assert.equal(JSON.parse(out.body).content,'Real answer');
 assert.deepEqual(f.events,['auth','ownership','approval','token','ai']);
 assert.ok(!out.body.includes('server-oauth-token'));
});
test('Approval callback failures never fall through to a model invocation',async()=>{
 let calls=0;
 const gateway=createGateway({
  authenticate:async()=>({ownerId:'owner'}),
  ownsThread:async()=>true,
  claimApproval:async()=>{throw Error('private DB failure token')},
  linkedToken:async()=>{calls++;return 'token'},
  adapter:{reply:async()=>{calls++}}
 });
 const response=await gateway.handle(req());
 assert.equal(response.status,502);assert.equal(calls,0);
 assert.ok(!response.body.includes('private DB failure'));
});
