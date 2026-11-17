'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeAutonomousMissionApi}=require('../server/v5-autonomous-mission-api.cjs');
const OWNER='11111111-1111-4111-8111-111111111111',
 THREAD='22222222-2222-4222-8222-222222222222';
const HEADERS={origin:'https://mr-tanq.github.io',authorization:'Bearer '+('a'.repeat(24))};
function fixture({owns=true}={}){
 const records=[],calls=[];
 const api=makeAutonomousMissionApi({
  secret:'sb_secret_synthetic_test_not_a_real_key',
  guard:{authenticate:async()=>({ownerId:OWNER}),ownsThread:async()=>owns},
  fetcher:async(url,options)=>{
   calls.push({url,options});
   if(url.includes('/rpc/paperworld_v5_queue_mission'))return {ok:true,json:async()=>true};
   if(url.includes('/rpc/paperworld_v5_queue_copilot_pilot'))return {ok:true,json:async()=>true};
   if(options.method==='POST'){
    const row=JSON.parse(options.body);records.push(row);
    return {ok:true,json:async()=>[row]};
   }
   return {ok:true,json:async()=>records.map(row=>({
    id:row.id,project_id:row.project_id,goal:row.goal,status:row.status,
    owner_id:row.owner_id,thread_id:row.thread_id,policy:row.policy,
    created_at:'2026-11-16T00:00:00Z',updated_at:'2026-11-16T00:00:00Z'
   }))};
  }
 });
 return {api,records,calls};
}
const body=obj=>JSON.stringify({threadId:THREAD,...obj});
test('All four Directors can save private mission drafts with zero authorization to execute',async()=>{
 const {api,records,calls}=fixture();
 for(const projectId of ['listening','pokemon','studio','wellbeing']){
  const result=await api.handle({headers:HEADERS,action:'create',
   body:body({projectId,goal:'Safely prepare an evidence-backed improvement'})});
  assert.equal(result.status,201);
  assert.equal(result.body.mission.projectId,projectId);
  assert.equal(result.body.mission.status,'draft');
  assert.equal(result.body.mission.spendingAllowed,false);
  assert.equal(result.body.mission.execution,'not_started');
 }
 assert.equal(records.length,4);
 for(const r of records){
  assert.equal(r.owner_id,OWNER);
  assert.equal(r.thread_id,THREAD);
  assert.equal(r.status,'draft');
  assert.equal(r.policy.maxAiCalls,0);
  assert.deepEqual(r.policy.permissions,[]);
 }
 const list=await api.handle({headers:HEADERS,action:'list',body:body({})});
 assert.equal(list.status,200);
 assert.equal(list.body.missions.length,4);
 assert.equal(calls.length,9);
});
test('Missing owner auth, forged cross-origin request or unowned Matt thread makes zero writes',async()=>{
 for(const invalid of [
  {headers:{...HEADERS,origin:'https://bad.example'}},
  {headers:{origin:HEADERS.origin}},
  {body:'garbage'},
  {body:body({projectId:'intruder',goal:'x'})},
  {body:body({projectId:'pokemon',goal:'x',grant:'merge'})}
 ]){
  const {api,calls}=fixture();
  const r=await api.handle({headers:invalid.headers||HEADERS,action:'create',
   body:invalid.body||body({projectId:'pokemon',goal:'Safe task'})});
  assert.notEqual(r.status,201);
  assert.equal(calls.length,0);
 }
 const {api,calls}=fixture({owns:false});
 assert.equal((await api.handle({headers:HEADERS,body:body({
  projectId:'pokemon',goal:'Safe task'}),action:'create'})).status,404);
 assert.equal(calls.length,0);
});
test('Owner can authorize a zero-AI simulation only for her own draft',async()=>{
 const {api,records,calls}=fixture();
 const created=await api.handle({headers:HEADERS,action:'create',body:body({
  projectId:'studio',goal:'Δοκιμή εσωτερικής ουράς'})});
 assert.equal(created.status,201);
 const missionId=created.body.mission.id;
 const queued=await api.handle({headers:HEADERS,action:'simulate',
  body:body({missionId})});
 assert.equal(queued.status,200);
 assert.equal(queued.body.realWork,false);
 assert.equal(queued.body.aiCalls,0);
 assert.ok(calls.some(c=>c.url.includes('/rpc/paperworld_v5_queue_mission')));
 const forbidden=await api.handle({headers:HEADERS,action:'simulate',
  body:body({missionId,grant:'start_agent'})});
 assert.equal(forbidden.status,400);
 const other=await api.handle({headers:{...HEADERS,origin:'https://evil.invalid'},
  action:'simulate',body:body({missionId})});
 assert.equal(other.status,403);
});
test('Explicit owner pilot consent queues only the bounded Pokémon Issue #1',async()=>{
 const {api,calls}=fixture();
 const created=await api.handle({headers:HEADERS,action:'create',
  body:body({projectId:'pokemon',goal:'Safe, bounded pilot'})});
 assert.equal(created.status,201);
 const missionId=created.body.mission.id;
 const noConsent=await api.handle({headers:HEADERS,action:'pilot',body:body({missionId})});
 assert.equal(noConsent.status,400);
 const result=await api.handle({headers:HEADERS,action:'pilot',body:body({
  missionId,consent:true})});
 assert.equal(result.status,200);
 assert.equal(result.body.execution,'real_copilot_pilot');
 assert.equal(result.body.sessionBudget,1);
 assert.equal(result.body.autoMerge,false);
 assert.ok(calls.some(x=>x.url.includes('/rpc/paperworld_v5_queue_copilot_pilot')));
 assert.equal(calls.filter(x=>x.url.includes('api.github.com')).length,0);
 const crow=await api.handle({headers:HEADERS,action:'create',
  body:body({projectId:'studio',goal:'Private research'})});
 const blocked=await api.handle({headers:HEADERS,action:'pilot',body:body({
  missionId:crow.body.mission.id,consent:true})});
 assert.equal(blocked.status,409);
});
test('No public mutation or autonomous AI scheduling route is installed by this PR',()=>{
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 const client=fs.readFileSync('js/cloud.js','utf8');
 const ui=fs.readFileSync('js/cloud-ui.js','utf8');
 assert.match(server,/\/autonomous\/missions\/create/);
 assert.match(client,/createAutonomousMission/);
 assert.match(ui,/Αποστολές ολόκληρης της ομάδας/);
 assert.match(ui,/Σχέδιο · δεν εκτελείται/);
 assert.doesNotMatch(server,/\/autonomous\/missions\/execute/);
});
