'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/conversation-schema.proposed.sql'),'utf8');
const {create}=require('../js/agent-conversation-store.js');
const ID='11111111-1111-4111-8111-111111111111';
test('SQL owner protection and server-only agent replies',()=>{
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/role='human'/);
 assert.match(sql,/foreign key\(thread_id,owner_id\)/);
 assert.match(sql,/with check \(\(select auth\.uid\(\)\)=owner_id\)/);
 assert.doesNotMatch(sql,/grant .*update .*authenticated/i);
 assert.doesNotMatch(sql,/create policy .*agent_create/i);
});
test('Client uses RLS transport, never accepts owner or agent messages',async()=>{
 const calls=[];const transport=async(...args)=>{calls.push(args);return []};
 const store=create({transport});
 await store.start('matt');
 await store.say(ID,'  Help me with Listening Mirror  ');
 await store.history(ID);
 assert.deepEqual(calls[0][1].data,{agent_id:'matt'});
 assert.deepEqual(calls[1][1].data,{thread_id:ID,role:'human',content:'Help me with Listening Mirror'});
 assert.ok(!JSON.stringify(calls).includes('owner_id'));
 await assert.rejects(store.start('evil-agent'));
 await assert.rejects(store.say(ID,' '));
});
test('API is explicitly bounded and never dispatches Copilot',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/agent-conversation-store.js'),'utf8');
 assert.doesNotMatch(source,/copilot|github\.com|dispatch|\/functions\/v1/i);
 assert.match(source,/limit=100/);
});
