'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createGithubOAuth,APP_ORIGIN,BASE_CALLBACK}=require('../server/github-oauth.cjs');
const USER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const config={clientId:'Iv1abcde1234567890',clientSecret:'secret-for-tests-only-123456789012',
 supabaseUrl:'https://example.supabase.co',supabaseKey:'public-test-key'};
const jwt='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature';
function fake({who=USER}={}){
 let calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/auth/v1/user'))
   return {ok:true,json:async()=>({id:who,aud:'authenticated'})};
  if(url==='https://github.com/login/oauth/access_token')
   return {ok:true,json:async()=>({access_token:'gho_fakeForTest123456789',expires_in:3600})};
  if(url==='https://api.github.com/user')
   return {ok:true,json:async()=>({id:1234,login:'octo-test'})};
  throw Error('Unexpected URL: '+url);
 };
 return {fetcher,calls};
}
test('Fail-closed without OAuth credentials or valid origin',async()=>{
 const db=fake(),oauth=createGithubOAuth({...config,clientSecret:undefined,fetcher:db.fetcher});
 const headers={origin:APP_ORIGIN,authorization:'Bearer '+jwt};
 assert.equal((await oauth.start({headers})).status,503);
 assert.equal((await oauth.start({headers:{...headers,origin:'https://evil.example'}})).status,403);
 assert.equal(db.calls.length,0);
});
test('Start binds one random OAuth state to authenticated Supabase owner',async()=>{
 const db=fake();
 const oauth=createGithubOAuth({...config,fetcher:db.fetcher});
 const start=await oauth.start({headers:{origin:APP_ORIGIN,authorization:'Bearer '+jwt}});
 assert.equal(start.status,200);
 const url=new URL(start.body.authorizationUrl);
 assert.equal(url.origin,'https://github.com');
 assert.equal(url.pathname,'/login/oauth/authorize');
 assert.equal(url.searchParams.get('redirect_uri'),BASE_CALLBACK);
 assert.ok(url.searchParams.get('state').length>=40);
 assert.equal(db.calls.length,1);
});
test('Callback verifies code and GitHub profile, never leaks access token, replay denied',async()=>{
 const db=fake(),oauth=createGithubOAuth({...config,fetcher:db.fetcher});
 const headers={origin:APP_ORIGIN,authorization:'Bearer '+jwt};
 const started=await oauth.start({headers});
 const state=new URL(started.body.authorizationUrl).searchParams.get('state');
 const result=await oauth.callback({url:BASE_CALLBACK+'?state='+state+'&code=abcdefghijklmno'});
 assert.equal(result.status,302);
 assert.match(result.headers.Location,/github_link=connected/);
 assert.doesNotMatch(JSON.stringify(result),/gho_/);
 assert.deepEqual((await oauth.status({headers})).body,{connected:true,login:'octo-test',ephemeral:true});
 const replay=await oauth.callback({url:BASE_CALLBACK+'?state='+state+'&code=abcdefghijklmno'});
 assert.match(replay.headers.Location,/github_link=failed/);
 assert.equal(db.calls.filter(x=>x.url==='https://github.com/login/oauth/access_token').length,1);
});
test('Cross-origin status and untrusted callbacks cannot reveal linked identity',async()=>{
 const db=fake(),oauth=createGithubOAuth({...config,fetcher:db.fetcher});
 const headers={origin:APP_ORIGIN,authorization:'Bearer '+jwt};
 assert.equal((await oauth.status({headers:{...headers,origin:'https://untrusted.example'}})).status,403);
 assert.equal((await oauth.status({headers:{origin:APP_ORIGIN}})).status,401);
 assert.match((await oauth.callback({url:BASE_CALLBACK+'?code=abcdefghijklmno&state=bad'})).headers.Location,/failed/);
 assert.deepEqual((await oauth.status({headers})).body,{connected:false,ephemeral:true});
});
test('Render listener returns no AI success and provides protected OAuth routes',async()=>{
 const {createRenderMattServer}=require('../server/render-matt.cjs');
 const http=require('node:http');
 const oauth={
  start:async()=>({status:200,body:{authorizationUrl:'https://github.com/login/oauth/authorize'},headers:{'Content-Type':'application/json'}}),
  status:async()=>({status:200,body:{connected:false},headers:{'Content-Type':'application/json'}}),
  callback:async()=>({status:302,headers:{Location:APP_ORIGIN+'/paperworld/'}})
 };
 const app=createRenderMattServer({oauth});
 const address=await app.listen({port:0,host:'127.0.0.1'});
 const req=(url,method='GET',origin=APP_ORIGIN)=>new Promise((resolve,reject)=>{
  const r=http.request({host:'127.0.0.1',port:address.port,path:url,method,headers:{Origin:origin}},response=>{
   let raw='';response.on('data',x=>raw+=x);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,raw}))
  });r.on('error',reject);r.end();
 });
 try{
  assert.equal((await req('/auth/github/start','POST')).status,200);
  assert.equal((await req('/auth/github/status','POST')).status,200);
  assert.equal((await req('/auth/github/callback?code=foo')).status,302);
  assert.equal((await req('/chat/matt','POST')).status,503);
  assert.equal((await req('/auth/github/start','GET')).status,405);
  const options=await req('/auth/github/start','OPTIONS');
  assert.equal(options.status,204);
  assert.equal(options.headers['access-control-allow-origin'],APP_ORIGIN);
 }finally{await app.close()}
});

test('OAuth status secondary chat readiness cannot block independently authorized status',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync('server/render-matt.cjs','utf8');
 assert.match(source,/if\(action===oauth\.status&&result\.status===200/);
 assert.match(source,/try\{\s*const guard=createSupabaseGuard/);
 assert.match(source,/catch\(_\)\{\/\* OAuth status is already independently authenticated/);
});
test('GitHub status refreshes session instead of sending stale Cloud access token',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync('js/cloud.js','utf8');
 const part=source.split('async function mattOAuth(path){')[1].split('async function beginGithubLink(){')[0];
 assert.match(part,/await ensureAuth\(\)/);
 assert.match(part,/if\(response\.status===401\)\{\s*await refresh\(\)/);
 assert.match(part,/response=await send\(\)/);
});