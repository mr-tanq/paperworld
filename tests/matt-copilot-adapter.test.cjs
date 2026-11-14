'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createMattAdapter}=require('../server/matt-copilot-adapter.cjs');
const valid={ownerId:'owner-1',requestId:'request-1',githubToken:'server-fixture',message:'Matt, τι κάνουμε τώρα;'};
test('Never initializes Copilot without trusted request and budget authorization',async()=>{
 let calls=0;
 const adapter=createMattAdapter({clientFactory:async()=>{calls++;throw Error('should never instantiate')},
  authorizeRequest:async()=>({allowed:false,budgetConfigured:true})});
 await assert.rejects(adapter.reply(valid),/not approved/);assert.equal(calls,0);
 const none=createMattAdapter({clientFactory:async()=>{calls++;throw Error('should never instantiate')},
  authorizeRequest:async()=>({allowed:true,budgetConfigured:false})});
 await assert.rejects(none.reply(valid),/not approved/);assert.equal(calls,0);
});
test('Permitted call requests zero tools, returns actual reply and releases session',async()=>{
 const actions=[];
 const adapter=createMattAdapter({
  authorizeRequest:async meta=>{actions.push(['auth',meta]);return {allowed:true,budgetConfigured:true}},
  clientFactory:async opts=>{actions.push(['client',opts]);return {
   createSession:async opts=>{actions.push(['session',opts]);return{
    sendAndWait:async msg=>{actions.push(['prompt',msg]);return {data:{content:'Μπορώ να το σχεδιάσω, δεν το εκτέλεσα.'}}},
    disconnect:async()=>actions.push(['disconnect'])
   }},
   stop:async()=>actions.push(['stop'])
  }}
 });
 const result=await adapter.reply(valid);
 assert.equal(result.executed,true);assert.equal(result.agentId,'matt');
 assert.deepEqual(actions[1],[ 'client',{mode:'empty'}]);
 assert.deepEqual(actions[2][1].availableTools,[]);
 assert.equal(actions[2][1].model,'auto');
 assert.equal(actions[2][1].gitHubToken,'server-fixture');
 assert.deepEqual(actions.slice(-2).map(x=>x[0]),['disconnect','stop']);
});
test('Invalid input cannot initialize model',async()=>{
 let calls=0;
 const adapter=createMattAdapter({clientFactory:async()=>{calls++;return{}},authorizeRequest:async()=>({allowed:true,budgetConfigured:true})});
 await assert.rejects(adapter.reply({...valid,message:''}),/Invalid message/);
 await assert.rejects(adapter.reply({...valid,githubToken:''}),/authentication required/);
 assert.equal(calls,0);
});
test('Empty AI response is never reported as success; session cleanup is enforced',async()=>{
 let stopped=0,disconnected=0;
 const adapter=createMattAdapter({
  authorizeRequest:async()=>({allowed:true,budgetConfigured:true}),
  clientFactory:async()=>({createSession:async()=>({sendAndWait:async()=>({data:{content:''}}),disconnect:async()=>{disconnected++}}),stop:async()=>{stopped++}})
 });
 await assert.rejects(adapter.reply(valid),/no response/);
 assert.equal(disconnected,1);assert.equal(stopped,1);
});
