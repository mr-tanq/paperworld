'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
let createDispatcher;
test.before(async()=>({createDispatcher}=await import('../supabase/functions/paperworld-copilot-dispatch/index.mjs')));
const trigger='fixture-trigger-secret-0123456789-abcdef-1234';
const token='fixture-github-user-token-0123456789';
const backend='sb_secret_fixture_only_0123456789';
const invoke=async(vars,authorization)=> {
 let calls=0,headers;
 const fetcher=async(url,opts)=>{
  calls++;headers=opts.headers;
  if(!url.includes('/rest/v1/paperworld_autonomous_controller_v5'))throw Error('unexpected remote request');
  return {ok:true,json:async()=>[{dispatch_enabled:false,live_adapters:[]}]};
 };
 const dispatcher=createDispatcher({environment:k=>vars[k],fetcher});
 const res=await dispatcher.handle(new Request('https://example.invalid/',{
  method:'POST',headers:{authorization:'Bearer '+authorization}
 }));
 return {status:res.status,body:await res.json(),calls,headers};
};
test('modern named secret key authenticates backend; kill switch makes zero GitHub calls',async()=>{
 const r=await invoke({PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,
  GITHUB_COPILOT_USER_TOKEN:token,
  SUPABASE_SECRET_KEYS:JSON.stringify({default:backend})},trigger);
 assert.equal(r.status,200);assert.equal(r.body.state,'disabled');
 assert.equal(r.body.sessionsStarted,0);assert.equal(r.calls,1);
 assert.equal(r.headers.apikey,backend);assert.equal(r.headers.Authorization,undefined);
});
test('legacy service-role backend key remains available during migration',async()=>{
 const legacy='eyJfixture-only-jwt-token-0123456789';
 const r=await invoke({PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,
  GITHUB_COPILOT_USER_TOKEN:token,SUPABASE_SERVICE_ROLE_KEY:legacy},trigger);
 assert.equal(r.status,200);assert.equal(r.headers.apikey,legacy);
 assert.equal(r.headers.Authorization,'Bearer '+legacy);
});
test('invalid trigger blocks without touching backend or GitHub',async()=>{
 const r=await invoke({PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,
  GITHUB_COPILOT_USER_TOKEN:token,
  SUPABASE_SECRET_KEYS:JSON.stringify({default:backend})},'wrong');
 assert.equal(r.status,401);assert.equal(r.calls,0);
});
test('malformed modern key or missing token fails closed without external requests',async()=>{
 for(const vars of [
  {PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,GITHUB_COPILOT_USER_TOKEN:token,SUPABASE_SECRET_KEYS:'{invalid'},
  {PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,SUPABASE_SECRET_KEYS:JSON.stringify({default:backend})}
 ]){
  const r=await invoke(vars,trigger);assert.equal(r.status,503);assert.equal(r.calls,0);
 }
});
