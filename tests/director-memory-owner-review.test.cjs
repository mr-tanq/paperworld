'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const cloud=require('../js/cloud.js');
const {createDirectorMemoryContext}=require('../server/director-memory-context.cjs');
const {validateEntry}=require('../server/director-memory-policy.cjs');
const OWNER='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const ID='11111111-1111-4111-8111-111111111111';
const JWT='example-access-jwt';
function entry(projectId,status='approved',sensitivity='standard'){
 return validateEntry({id:ID,projectId,kind:'project_bible',status,title:'Music principles',
  body:projectId+' CONTENT '+sensitivity,sourceType:'owner_note',
  sourceRef:'owner-reviewed-2026-11-15',observedAt:'2026-11-15T00:00:00Z',
  version:1,sensitivity});
}
test('Director receives only approved facts in own project, without tool rights',async()=>{
 const store={list:async({projectId})=>[
  entry(projectId),entry(projectId,'proposed'),
  entry(projectId,'approved','private')]};
 const bridge=createDirectorMemoryContext({store,authenticate:async()=>({ownerId:OWNER})});
 const data=await bridge.load({token:JWT,ownerId:OWNER,actor:'studio-director',projectId:'studio'});
 assert.equal(data.included,2);
 assert.match(data.text,/studio CONTENT private/);
 assert.deepEqual(data.capabilitiesGranted,[]);
 assert.equal(data.untrustedContent,true);
 await assert.rejects(bridge.load({token:JWT,ownerId:OWNER,actor:'studio-director',
  projectId:'wellbeing'}),/memory_agent_scope_denied/);
});
test('Matt only receives standard context after explicit verified handoff',async()=>{
 const store={list:async({projectId})=>[
  entry(projectId),entry(projectId,'approved','private')]};
 const bridge=createDirectorMemoryContext({store,authenticate:async()=>({ownerId:OWNER})});
 await assert.rejects(bridge.load({token:JWT,ownerId:OWNER,actor:'matt',
  projectId:'wellbeing'}),/memory_agent_scope_denied/);
 const result=await bridge.load({token:JWT,ownerId:OWNER,actor:'matt',
  projectId:'wellbeing',
  taskGrant:{ownerId:OWNER,actor:'matt',projectId:'wellbeing',approved:true}});
 assert.equal(result.included,1);
 assert.doesNotMatch(result.text,/private/);
});
test('Workers cannot access unassigned projects or private records',async()=>{
 const store={list:async({projectId})=>[entry(projectId),
  entry(projectId,'approved','private')]};
 const bridge=createDirectorMemoryContext({store,authenticate:async()=>({ownerId:OWNER})});
 await assert.rejects(bridge.load({token:JWT,ownerId:OWNER,
  actor:'listening-developer',projectId:'workshop'}),
  /memory_worker_task_grant_denied/);
 const grant={actor:'listening-developer',projectId:'workshop',ownerId:OWNER,approved:true};
 const result=await bridge.load({token:JWT,ownerId:OWNER,
  actor:'listening-developer',projectId:'workshop',taskGrant:grant});
 assert.equal(result.included,1);
 await assert.rejects(bridge.load({token:JWT,ownerId:OWNER,actor:'listening-developer',
  projectId:'studio',taskGrant:{...grant,projectId:'studio'}}),
  /memory_agent_scope_denied/);
});
test('Mismatched owner or unexpected cross-project store response fails closed',async()=>{
 const bridge=createDirectorMemoryContext({
  store:{list:async()=>[entry('studio')]},
  authenticate:async()=>({ownerId:OWNER})
 });
 await assert.rejects(bridge.load({token:JWT,ownerId:OTHER,
  actor:'studio-director',projectId:'studio'}),/memory_owner_denied/);
 await assert.rejects(bridge.load({token:JWT,ownerId:OWNER,
  actor:'pokemon-director',projectId:'pokemon'}),/memory_cross_project_response_denied/);
});
test('Browser review writes status only, with owner JWT and proposed-only compare-and-swap',async()=>{
 const requests=[];
 const storage={getItem:key=>key===cloud.TOKEN_STORAGE?JSON.stringify({
  access_token:JWT,refresh_token:'refresh-test',user:{email:'person@example.org'},
  expires_at:Date.now()+3600000}):null,setItem(){},removeItem(){}};
 const client=cloud.createClient({storage,fetcher:async(url,opts)=>{
  requests.push({url:String(url),...opts});
  const payload=String(url).endsWith('/auth/v1/user')?
   {id:OWNER,email:'person@example.org'}:
   [{id:ID,project_id:'studio',status:'approved',reviewed_at:'2026-11-15T00:00:00Z'}];
  return {ok:true,status:200,text:async()=>JSON.stringify(payload)};
 }});
 const outcome=await client.reviewDirectorMemory({
  projectId:'studio',entryId:ID,decision:'approved'});
 assert.equal(outcome.status,'approved');
 assert.equal(requests.length,2);
 assert.equal(requests[0].method,'GET');
 assert.match(requests[0].url,/\/auth\/v1\/user$/);
 assert.equal(requests[1].method,'PATCH');
 assert.match(requests[1].url,/status=eq.proposed/);
 assert.match(requests[1].url,/project_id=eq.studio/);
 assert.deepEqual(JSON.parse(requests[1].body),{status:'approved'});
 assert.equal(requests[0].headers.Authorization,'Bearer '+JWT);
 assert.equal(requests[1].headers.Authorization,'Bearer '+JWT);
 await assert.rejects(client.reviewDirectorMemory({projectId:'town',entryId:ID,
  decision:'deployed'}),/Invalid Director Memory review/);
 assert.equal(requests.length,2);
});
test('A zero-row response is never reported as an approval',async()=>{
 const storage={getItem:key=>key===cloud.TOKEN_STORAGE?JSON.stringify({
  access_token:JWT,refresh_token:'refresh-test',expires_at:Date.now()+3600000
 }):null};
 const client=cloud.createClient({storage,fetcher:async(url)=>({
  ok:true,status:200,text:async()=>JSON.stringify(
   String(url).endsWith('/auth/v1/user')?{id:OWNER}:[])
 })});
 await assert.rejects(client.reviewDirectorMemory({projectId:'studio',entryId:ID,
  decision:'approved'}),/Review not applied/);
});
test('Live Auth identity failure prevents any owner status update',async()=>{
 const calls=[];
 const storage={getItem:key=>key===cloud.TOKEN_STORAGE?JSON.stringify({
  access_token:JWT,refresh_token:'refresh-test',user:{id:OWNER},
  expires_at:Date.now()+3600000}):null};
 const client=cloud.createClient({storage,fetcher:async(url,options)=>{
  calls.push({url:String(url),method:options.method});
  return {ok:true,status:200,text:async()=>JSON.stringify({id:OTHER})};
 }});
 await assert.rejects(client.reviewDirectorMemory({
  projectId:'studio',entryId:ID,decision:'approved'
 }),/identity could not be verified/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,'GET');
 assert.match(calls[0].url,/\/auth\/v1\/user$/);
});

test('Review migration grants only status UPDATE and append-only private audit',()=>{
 const migration=fs.readFileSync('supabase/director_memory_review_v2_REVIEW_ONLY.sql','utf8');
 assert.match(migration,/REVIEW-ONLY migration/);
 assert.match(migration,/grant update\(status\)/);
 assert.match(migration,/status='proposed'/);
 assert.match(migration,/status in \('approved','rejected'\)/);
 assert.match(migration,/paperworld_director_memory_review_log enable row level security/);
 assert.match(migration,/schema paperworld_memory_private/);
 assert.match(migration,/revoke all on schema paperworld_memory_private/);
 assert.match(migration,/grant select on public.paperworld_director_memory_review_log to authenticated/);
 assert.doesNotMatch(migration,/grant (?:insert|update|delete|all) on public.paperworld_director_memory_review_log to authenticated/);
});
test('Owner review UI is ready in draft PR, requires per-entry confirmation',()=>{
 const source=fs.readFileSync('js/cloud-ui.js','utf8');
 assert.match(source,/enableReview:true/);
 assert.doesNotMatch(source,/enableReview:false/);
 const view=fs.readFileSync('js/director-memory-review.js','utf8');
 assert.match(view,/confirmDecision/);
 assert.match(view,/requestReview/);
 assert.doesNotMatch(view,/innerHTML\s*=/);
});
