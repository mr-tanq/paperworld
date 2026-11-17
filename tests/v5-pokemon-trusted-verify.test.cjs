'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let make;
const token='synthetic_github_token_12345678901234567';
const secret='synthetic_trigger_secret_012345678901234';
const sha='98416ff0d875b550bef674a70ebe555ad4280e8b';
const marker='<!-- paperworld-v5-effect:copilot:fe28f182-5da6-4909-9ba1-70986b5ee469 -->';
test.before(async()=>({createTrustedVerifier:make}=await import('../supabase/functions/paperworld-trusted-verify/index.mjs')));
function fixture({unsafe=false,badSha=false}={}){
 const calls=[];
 const fetcher=async(url,opts)=>{
  const u=new URL(url),method=opts.method||'GET';calls.push({url,method,body:opts.body});
  if(u.pathname.endsWith('/issues/1'))return {ok:true,status:200,json:async()=>({
   state:'open',body:'Issue '+marker,assignees:[{login:'Copilot'}]})};
  if(u.pathname.endsWith('/pulls/4'))return {ok:true,status:200,json:async()=>({
   number:4,state:'open',draft:true,
   head:{sha:badSha?'f'.repeat(40):sha,ref:'copilot/godot-tests'},
   base:{ref:'main'},user:{login:'mr-tanq'},body:'Fixes #1'})};
  if(u.pathname.endsWith('/pulls/4/files'))return {ok:true,status:200,json:async()=>[
   {filename:unsafe?'.github/workflows/unsafe.yml':'tests/battle_damage_headless.gd',status:'added'}]};
  if(u.pathname.endsWith('/dispatches'))return {ok:true,status:204};
  if(u.pathname.endsWith('/runs'))return {ok:true,status:200,json:async()=>({workflow_runs:[]})};
  throw Error('unexpected '+url);
 };
 const handle=make({environment:k=>({
  PAPERWORLD_DISPATCH_TRIGGER_SECRET:secret,GITHUB_COPILOT_USER_TOKEN:token
 })[k],fetcher}).handle;
 const post=action=>handle(new Request('https://example.invalid',{
  method:'POST',headers:{authorization:'Bearer '+secret},body:JSON.stringify({action})
 }));
 return {post,handle,calls};
}
test('one immutable commit dispatch only after trusted issue, PR and tests-only diff',async()=>{
 const f=fixture(),r=await f.post('dispatch'),body=await r.json();
 assert.equal(r.status,200);assert.equal(body.sha,sha);
 assert.equal(body.aiSessionsStarted,0);
 assert.equal(f.calls.filter(x=>x.method==='POST').length,1);
 const sent=JSON.parse(f.calls.find(x=>x.method==='POST').body);
 assert.deepEqual(sent,{ref:'main',inputs:{commit_sha:sha}});
});
test('reject unsafe changes or changed SHA without dispatch',async()=>{
 for(const opts of [{unsafe:true},{badSha:true}]){
  const f=fixture(opts),r=await f.post('dispatch');
  assert.equal(r.status,503);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }
});
test('status performs read only; bad trigger performs zero requests',async()=>{
 const f=fixture();const status=await f.post('status');
 assert.equal(status.status,200);assert.equal(f.calls.filter(x=>x.method==='POST').length,0);
 const bad=await f.handle(new Request('https://example.invalid',{
  method:'POST',headers:{authorization:'Bearer wrong'},body:'{"action":"dispatch"}'
 }));
 assert.equal(bad.status,401);assert.equal(f.calls.filter(x=>x.method==='POST').length,0);
});
