'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const cloud=require('../js/cloud.js');
const agentStore=require('../js/agent-conversation-store.js');

test('Browser cloud resolves the agent store, reads without creating, and saves only a human note',async()=>{
 const previous=globalThis.PaperworldAgentStore;
 globalThis.PaperworldAgentStore=agentStore;
 const requests=[];
 const threadId='11111111-1111-4111-8111-111111111111';
 const session={access_token:'fixture-access-token',refresh_token:'fixture-refresh-token',
   expires_at:Date.now()+3600000,user:{email:'tester@example.org'}};
 const storage={getItem:k=>k===cloud.TOKEN_STORAGE?JSON.stringify(session):null,setItem(){},removeItem(){}};
 const fetcher=async(url,opts)=>{
   const u=String(url);requests.push({url:u,method:opts.method,body:opts.body});
   let rows=[];
   if(u.includes('paperworld_agent_threads')){
     rows=opts.method==='POST'?[{id:threadId,agent_id:'matt'}]:[];
   }else if(u.includes('paperworld_agent_messages')&&opts.method==='POST'){
     rows=[{id:'22222222-2222-4222-8222-222222222222',thread_id:threadId,role:'human',content:'Hello Matt'}];
   }
   return {ok:true,status:200,text:async()=>JSON.stringify(rows)};
 };
 try{
   const client=cloud.createClient({fetcher,storage});
   assert.deepEqual(await client.agentMessages('matt'),[]);
   assert.equal(requests.filter(r=>r.method==='POST').length,0,'reading must not create threads');
   const saved=await client.sendAgentNote('matt','Hello Matt');
   assert.equal(saved[0].role,'human');
   assert.deepEqual(requests.filter(r=>r.method==='POST').map(r=>JSON.parse(r.body)),
     [{agent_id:'matt'},{thread_id:threadId,role:'human',content:'Hello Matt'}]);
   assert.ok(requests.every(r=>!r.body||!r.body.includes('owner_id')));
 }finally{
   if(previous===undefined)delete globalThis.PaperworldAgentStore;
   else globalThis.PaperworldAgentStore=previous;
 }
});
