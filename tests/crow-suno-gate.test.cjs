'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeCrowSunoGate,validBrief}=require('../server/crow-suno-gate.cjs');
const brief={operation:'create',title:'And I',style:'Organic slow nocturnal folk',lyrics:'An original lyric'};
const owner='owner-1';
test('only typed Crow proposals accepted',async()=>{
 assert.equal(validBrief(brief),true);
 assert.equal(validBrief({...brief,operation:'delete'}),false);
 assert.equal(validBrief({...brief,token:'secret'}),false);
 const gate=makeCrowSunoGate({authorize:async()=>true});
 assert.equal((await gate.propose({ownerId:owner,agentId:'matt',brief})).status,400);
 assert.equal((await gate.propose({ownerId:owner,agentId:'studio-director',brief})).status,200);
});
test('no spend in preview; no execution without consent, cost acknowledgement, verified transport',async()=>{
 let count=0;
 const gate=makeCrowSunoGate({authorize:async()=>true,enabled:true,
  submit:async()=>{count++;return {providerJobId:'real-job-1'}}});
 const p=(await gate.propose({ownerId:owner,agentId:'studio-director',brief})).body;
 assert.equal(count,0);
 assert.equal((await gate.execute({ownerId:owner,proposalId:p.proposalId})).status,400);
 assert.equal((await gate.execute({ownerId:owner,proposalId:p.proposalId,
  approval:'GENERATE_WITH_SUNO_CREDITS'})).status,403);
 assert.equal(count,0);
 assert.equal((await gate.execute({ownerId:'someone-else',proposalId:p.proposalId,
  approval:'GENERATE_WITH_SUNO_CREDITS',acknowledgeUnknownCost:true})).status,404);
 assert.equal((await gate.execute({ownerId:owner,proposalId:p.proposalId,
  approval:'GENERATE_WITH_SUNO_CREDITS',acknowledgeUnknownCost:true})).status,202);
 assert.equal(count,1);
 assert.equal((await gate.execute({ownerId:owner,proposalId:p.proposalId,
  approval:'GENERATE_WITH_SUNO_CREDITS',acknowledgeUnknownCost:true})).status,409);
 assert.equal(count,1);
});
test('disabled transport never executes or marks ready',async()=>{
 let count=0;
 const gate=makeCrowSunoGate({enabled:false,authorize:async()=>true,
  submit:async()=>{count++;return {providerJobId:'fake'}}});
 const p=(await gate.propose({ownerId:owner,agentId:'studio-director',brief,expectedCredits:10})).body;
 const result=await gate.execute({ownerId:owner,proposalId:p.proposalId,
  approval:'GENERATE_WITH_SUNO_CREDITS'});
 assert.equal(result.status,503);assert.equal(count,0);
});
test('no execution for failed authorization, expired or cancelled proposals',async()=>{
 let time=0,count=0;
 const gate=makeCrowSunoGate({clock:()=>time,ttlMs:100,enabled:true,
  authorize:async()=>false,submit:async()=>{count++;return {providerJobId:'x'}}});
 const p=(await gate.propose({ownerId:owner,agentId:'studio-director',brief,expectedCredits:5})).body;
 assert.equal((await gate.execute({ownerId:owner,proposalId:p.proposalId,
  approval:'GENERATE_WITH_SUNO_CREDITS'})).status,403);
 assert.equal((gate.cancel({ownerId:owner,proposalId:p.proposalId})).status,200);
 const q=(await gate.propose({ownerId:owner,agentId:'studio-director',brief})).body;
 time=101;
 assert.equal((await gate.execute({ownerId:owner,proposalId:q.proposalId,
  approval:'GENERATE_WITH_SUNO_CREDITS',acknowledgeUnknownCost:true})).status,404);
 assert.equal(count,0);
});
