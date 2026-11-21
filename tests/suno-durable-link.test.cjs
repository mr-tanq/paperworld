'use strict';
// Crow's Suno link survives deploys (sealed copy) and renews itself with the
// refresh token instead of silently expiring after an hour.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createSunoOAuthClient,CLIENT_ID}=require('../server/suno-oauth-client.cjs');
const {makeSunoLinkStore,seal,open,keyFrom}=require('../server/suno-link-store.cjs');
const ownerId='11111111-1111-4111-8111-111111111111',threadId='22222222-2222-4222-8222-222222222222';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer abcdefghijklmnop'};
const body=JSON.stringify({agentId:'studio-director',threadId});
const identity={authenticate:async()=>({ownerId}),ownsThread:async()=>true};
const issuer='https://accounts.suno.com';
const discovery={inspect:async()=>({metadataAvailable:true,authorizationServers:[issuer]})};
const metadata={issuer,client_id_metadata_document_supported:true,code_challenge_methods_supported:['S256'],
 response_types_supported:['code'],authorization_endpoint:issuer+'/oauth/authorize',token_endpoint:issuer+'/oauth/token'};
function memoryStore(){const rows=new Map();return {rows,save:async(o,l)=>{rows.set(o,JSON.parse(JSON.stringify(l)));return true},
 load:async o=>rows.get(o)||null,remove:async o=>rows.delete(o)}}
function client({store,now,tokenReply}){
 const posts=[];
 const fetcher=async(url,opts)=>{
  if(opts.method==='GET')return {status:200,headers:{get:()=>'application/json'},text:async()=>JSON.stringify(metadata)};
  posts.push(new URLSearchParams(opts.body));
  return {status:200,headers:{get:()=>'application/json'},text:async()=>JSON.stringify(tokenReply(posts.at(-1)))};
 };
 return {c:createSunoOAuthClient({identity,discovery,fetcher,linkStore:store,clock:()=>now.t}),posts};
}
test('link is saved with its refresh token and survives a restart; expiry renews it',async()=>{
 const store=memoryStore(),now={t:1_000_000};
 const reply=p=>p.get('grant_type')==='refresh_token'?
  {access_token:'renewed-access-token-1',token_type:'Bearer',expires_in:3600,refresh_token:'rotated-refresh-1'}:
  {access_token:'first-access-token-123',token_type:'Bearer',expires_in:3600,refresh_token:'first-refresh-token'};
 const a=client({store,now,tokenReply:reply});
 const start=await a.c.start({headers,body});
 const state=new URL(start.body.authorizationUrl).searchParams.get('state');
 assert.match((await a.c.callback({url:'/auth/suno/callback?state='+encodeURIComponent(state)+'&code=abcdefghi12345'})).headers.Location,/connected/);
 assert.equal(store.rows.get(ownerId).refreshToken,'first-refresh-token');
 // A deploy: a brand-new process with empty memory still sees the link.
 const b=client({store,now,tokenReply:reply});
 assert.deepEqual((await b.c.status({headers,body})).body,{oauthAuthorized:true,canGenerate:false,ephemeral:false});
 // Two hours later the access token has expired: it is renewed, not lost.
 now.t+=2*3600*1000;
 const d=client({store,now,tokenReply:reply});
 assert.equal((await d.c.status({headers,body})).body.oauthAuthorized,true);
 const p=d.posts.at(-1);
 assert.equal(p.get('grant_type'),'refresh_token');assert.equal(p.get('client_id'),CLIENT_ID);
 assert.equal(store.rows.get(ownerId).accessToken,'renewed-access-token-1');
 assert.equal(store.rows.get(ownerId).refreshToken,'rotated-refresh-1');
});
test('without a refresh token an expired link is simply gone (old behaviour)',async()=>{
 const store=memoryStore(),now={t:5_000_000};
 store.rows.set(ownerId,{accessToken:'old-access-token-1234',expires:now.t-1000,tokenEndpoint:issuer+'/oauth/token'});
 const {c,posts}=client({store,now,tokenReply:()=>({})});
 assert.equal((await c.status({headers,body})).body.oauthAuthorized,false);assert.equal(posts.length,0);
});
test('sealed copy is AES-GCM encrypted and tamper-evident; client metadata asks for refresh tokens',()=>{
 const key=keyFrom('x'.repeat(40)),s=seal(key,{accessToken:'secret-token-value'});
 assert.doesNotMatch(s,/secret-token-value/);assert.equal(open(key,s).accessToken,'secret-token-value');
 assert.equal(open(keyFrom('y'.repeat(40)),s),null);
 assert.equal(makeSunoLinkStore({secret:''}).enabled,false);
 const src=fs.readFileSync('server/suno-oauth-client.cjs','utf8');
 assert.match(src,/grant_types:\['authorization_code','refresh_token'\]/);
 const sql=fs.readFileSync('sql/paperworld_suno_links_v1.sql','utf8');
 assert.match(sql,/revoke all on public\.paperworld_suno_links_v1 from public,anon,authenticated/);
});
