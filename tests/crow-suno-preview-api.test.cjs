'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCrowSunoPreviewApi}=require('../server/crow-suno-preview-api.cjs');
const uuid='11111111-1111-4111-8111-111111111111';
const origin='https://mr-tanq.github.io';
const headers={origin,authorization:'Bearer abcdefghijklmnop'};
const brief={operation:'create',title:'Smoky Dreams',
 style:'slow nocturnal organic guitar and muted trumpet',lyrics:'Original words'};
const mockIdentity={authenticate:async()=>({ownerId:'owner-a'}),
 ownsThread:async({ownerId,agentId,threadId})=>
  ownerId==='owner-a'&&agentId==='studio-director'&&threadId===uuid};
const create=()=>createCrowSunoPreviewApi({identity:mockIdentity});
test('Crow only: authenticated owned studio thread gets preview, never a generation',async()=>{
 const api=create();
 const payload={agentId:'studio-director',threadId:uuid,brief,expectedCredits:null};
 const p=await api.handle({headers,action:'propose',body:JSON.stringify(payload)});
 assert.equal(p.status,200);
 assert.equal(p.body.requiresExplicitApproval,true);
 assert.equal(p.body.expectedCredits,null);
 assert.equal(p.body.title,brief.title);
 const cancelled=await api.handle({headers,action:'cancel',
  body:JSON.stringify({proposalId:p.body.proposalId})});
 assert.deepEqual(cancelled,{status:200,body:{cancelled:true}});
 assert.equal((await api.handle({headers,action:'cancel',
  body:JSON.stringify({proposalId:p.body.proposalId})})).status,404);
});
test('wrong origin, unrelated thread, forged credit estimate and invalid action fail closed',async()=>{
 const api=create();
 const payload={agentId:'studio-director',threadId:uuid,brief,expectedCredits:null};
 assert.equal((await api.handle({headers:{...headers,origin:'https://attacker.example'},
  action:'propose',body:JSON.stringify(payload)})).status,403);
 assert.equal((await api.handle({headers,action:'propose',
  body:JSON.stringify({...payload,threadId:'22222222-2222-4222-8222-222222222222'})})).status,404);
 assert.equal((await api.handle({headers,action:'propose',
  body:JSON.stringify({...payload,agentId:'matt'})})).status,400);
 assert.equal((await api.handle({headers,action:'propose',
  body:JSON.stringify({...payload,expectedCredits:0})})).status,400);
 assert.equal((await api.handle({headers,action:'execute',body:'{}'})).status,404);
});
test('other signed-in user cannot cancel another owner preview',async()=>{
 const payload={agentId:'studio-director',threadId:uuid,brief,expectedCredits:null};
 // Share one trusted gate between two owners to test owner isolation.
 const {makeCrowSunoGate}=require('../server/crow-suno-gate.cjs');
 const gate=makeCrowSunoGate({authorize:async()=>false,enabled:false});
 const a=createCrowSunoPreviewApi({identity:mockIdentity,gate});
 const b=createCrowSunoPreviewApi({identity:{
  authenticate:async()=>({ownerId:'owner-b'}),ownsThread:async()=>true
 },gate});
 const p=(await a.handle({headers,action:'propose',body:JSON.stringify(payload)})).body;
 assert.equal((await b.handle({headers,action:'cancel',
  body:JSON.stringify({proposalId:p.proposalId})})).status,404);
 assert.equal((await a.handle({headers,action:'cancel',
  body:JSON.stringify({proposalId:p.proposalId})})).status,200);
});
