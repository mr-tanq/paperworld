/* LIVE Supabase Auth integration — MANUAL, STAGING ONLY.
 * Uses two independent real Supabase Auth JWTs and disposable synthetic records.
 * Never run against PAPERWORLD production, never print or commit credentials.
 * Requires review migration separately applied to an isolated staging branch.
 * Run: SUPABASE_TEST_URL=... SUPABASE_PUBLISHABLE_KEY=...
 * SUPABASE_TEST_JWT_A=... SUPABASE_TEST_JWT_B=...
 * SUPABASE_EXPECTED_PROJECT_REF=<staging-ref> node tests/integration/supabase-two-auth-memory.mjs
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const vars=['SUPABASE_TEST_URL','SUPABASE_PUBLISHABLE_KEY',
 'SUPABASE_TEST_JWT_A','SUPABASE_TEST_JWT_B','SUPABASE_EXPECTED_PROJECT_REF'];
for(const k of vars)assert.ok(process.env[k], 'Missing required staging test environment variable: '+k);
const ref=process.env.SUPABASE_EXPECTED_PROJECT_REF;
const origin=new URL(process.env.SUPABASE_TEST_URL);
assert.equal(origin.protocol,'https:');
assert.equal(origin.username,'');
assert.equal(origin.password,'');
assert.equal(origin.pathname,'/');
assert.equal(origin.hostname,ref+'.supabase.co','Staging ref and API host mismatch');
assert.notEqual(ref,'jrevhzvrgenucuozjowm','PRODUCTION_PROJECT_FORBIDDEN');
assert.notEqual(process.env.SUPABASE_TEST_JWT_A,
 process.env.SUPABASE_TEST_JWT_B,'Independent user tokens required');
const api=origin.origin;
const key=process.env.SUPABASE_PUBLISHABLE_KEY;
const clients=[process.env.SUPABASE_TEST_JWT_A,process.env.SUPABASE_TEST_JWT_B];
async function request(token,path,{method='GET',body,prefer}={}){
 const headers={apikey:key,Authorization:'Bearer '+token,Accept:'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(prefer)headers.Prefer=prefer;
 const result=await fetch(api+path,{method,headers,redirect:'error',
  signal:AbortSignal.timeout(10000),
  ...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(!result.ok)throw Error('Supabase staging request rejected: '+method+
  ' [HTTP '+result.status+']');
 const raw=await result.text();
 if(!raw)return null;
 try{return JSON.parse(raw)}catch{throw Error('Invalid staging response JSON')}
}
const users=await Promise.all(clients.map(token=>request(token,'/auth/v1/user')));
for(const user of users)assert.match(user.id,
/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
assert.notEqual(users[0].id,users[1].id,'Two real distinct Supabase Auth accounts required');
const idA=randomUUID(),idB=randomUUID();
const table='/rest/v1/paperworld_director_memory';
const log='/rest/v1/paperworld_director_memory_review_log';
const makeRow=(id,projectId)=>({
 id,project_id:projectId,kind:'decision',status:'proposed',
 title:'SYNTHETIC AUTH RLS TEST '+id,
 body:'Synthetic staging data only. No private memories.',
 source_type:'owner_note',source_ref:'synthetic-staging-auth-test',
 observed_at:new Date().toISOString(),version:1,sensitivity:'standard'
});
async function insertRow(token,data){
 await request(token,table,{method:'POST',body:data,prefer:'return=minimal'});
}
async function rows(token,id){
 return await request(token,table+'?select=id,project_id,status,owner_id'+
 '&id=eq.'+encodeURIComponent(id));
}
async function logRows(token,id){
 return await request(token,log+'?select=entry_id,decision,owner_id'+
 '&entry_id=eq.'+encodeURIComponent(id));
}
async function review(token,id,projectId,decision){
 return await request(token,table+'?select=id,project_id,status'+
 '&id=eq.'+encodeURIComponent(id)+
 '&project_id=eq.'+encodeURIComponent(projectId)+
 '&status=eq.proposed',{
 method:'PATCH',body:{status:decision},prefer:'return=representation'});
}
// These new rows are left in the disposable staging branch on purpose.
// Remove the entire branch after the test; never provision them in production.
await insertRow(clients[0],makeRow(idA,'studio'));
await insertRow(clients[1],makeRow(idB,'workshop'));
assert.equal((await rows(clients[0],idA)).length,1);
assert.equal((await rows(clients[1],idB)).length,1);
assert.equal((await rows(clients[0],idB)).length,0);
assert.equal((await rows(clients[1],idA)).length,0);
assert.equal((await review(clients[0],idB,'workshop','approved')).length,0);
assert.equal((await review(clients[1],idA,'studio','approved')).length,0);
const approved=await review(clients[0],idA,'studio','approved');
assert.equal(approved.length,1);
assert.equal(approved[0].status,'approved');
assert.equal((await review(clients[0],idA,'studio','rejected')).length,0);
const rejected=await review(clients[1],idB,'workshop','rejected');
assert.equal(rejected.length,1);
assert.equal(rejected[0].status,'rejected');
assert.equal((await logRows(clients[0],idA)).length,1);
assert.equal((await logRows(clients[1],idB)).length,1);
assert.equal((await logRows(clients[0],idB)).length,0);
assert.equal((await logRows(clients[1],idA)).length,0);
console.log('PASS: two real Auth JWTs, owner isolation, approvals, replays and audit in disposable staging');
