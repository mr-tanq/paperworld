'use strict';
// A malformed memory (e.g. a lesson with line breaks) is skipped, never takes a
// Director offline; automatic lessons are stored on one line.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createDirectorMemoryStore}=require('../server/director-memory-store.cjs');
const OWNER='22222222-2222-4222-8222-222222222222',JWT='x'.repeat(28);
const row=(id,body)=>({id,project_id:'workshop',kind:'work_history',status:'approved',title:'Μάθημα',body,
 source_type:'verified_result',source_ref:'mission:'+id,observed_at:'2026-11-21T07:40:00.117044+00:00',version:1,sensitivity:'standard'});
function store(rows){return createDirectorMemoryStore({baseUrl:'https://example.supabase.co',publicKey:'test-public-key',
 authenticate:async()=>({ownerId:OWNER}),fetcher:async()=>({ok:true,json:async()=>rows})})}
test('one bad memory row is skipped, the rest still load',async()=>{
 const rows=[row('11111111-1111-4111-8111-111111111111','Εργασία.\nΑποτέλεσμα: ok'),
  row('11111111-1111-4111-8111-111111111112','Εργασία. · Αποτέλεσμα: ok')];
 const s=store(rows);
 const listed=await s.list({token:JWT,ownerId:OWNER,projectId:'workshop'});
 assert.deepEqual(listed.map(x=>x.id),['11111111-1111-4111-8111-111111111112']);
 const relevant=await s.listRelevant({token:JWT,ownerId:OWNER,projectId:'workshop'});
 assert.equal(relevant.length,1);
 await assert.rejects(store([{...rows[1],project_id:'studio'}]).list({token:JWT,ownerId:OWNER,projectId:'workshop'}),
  /memory_project_response_mismatch/,'cross-project rows still fail closed');
});
test('lesson trigger keeps automatic lessons on one line',()=>{
 const sql=fs.readFileSync('sql/paperworld_memory_lesson_clean_v1.sql','utf8');
 assert.match(sql,/if new\.source_type='verified_result' then/);
 assert.match(sql,/before insert or update on public\.paperworld_director_memory/);
});
