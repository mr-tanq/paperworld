'use strict';
// The GitHub link survives Render restarts (sealed copy) instead of vanishing
// after 55 minutes or a deploy; expiring user tokens renew themselves.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createGithubOAuth}=require('../server/github-oauth.cjs');
const owner='11111111-1111-4111-8111-111111111111';
function memoryStore(){const rows=new Map();return {enabled:true,rows,save:async(o,l)=>{rows.set(o,JSON.parse(JSON.stringify(l)));return true},
 load:async o=>rows.get(o)||null,loadAll:async()=>[...rows].map(([ownerId,link])=>({ownerId,link})),remove:async o=>rows.delete(o)}}
function make({store,now,fetcher}){
 return createGithubOAuth({clientId:'Iv1abcdefgh',clientSecret:'s'.repeat(20),supabaseUrl:'https://x.supabase.co',supabaseKey:'k',
  fetcher,clock:()=>now.t,linkStore:store});
}
test('a saved link is restored after a restart and lasts beyond an hour',async()=>{
 const store=memoryStore(),now={t:1_000_000};
 store.rows.set(owner,{token:'gho_abcdefghijklmnop',githubId:1,login:'mr-tanq',writeEnabled:true,privateWriteEnabled:true,expires:now.t+30*24*3600e3});
 const o=make({store,now,fetcher:async()=>{throw Error('no network needed')}});
 assert.equal(o.getLinkedToken({ownerId:owner}),null,'memory is empty right after a restart');
 await o.hydrate({force:true});
 assert.equal(o.getLinkedToken({ownerId:owner}),'gho_abcdefghijklmnop');
 assert.equal(o.getLinkedPrivateWriteToken({ownerId:owner}),'gho_abcdefghijklmnop');
 now.t+=3*3600e3;assert.equal(o.getLinkedToken({ownerId:owner}),'gho_abcdefghijklmnop','no 55-minute cut-off');
});
test('an expiring user token is renewed with its refresh token and saved',async()=>{
 const store=memoryStore(),now={t:5_000_000},calls=[];
 store.rows.set(owner,{token:'ghu_oldtokenvalue123',githubId:1,login:'mr-tanq',expires:now.t+60e3,refreshToken:'ghr_refresh1'});
 const o=make({store,now,fetcher:async(url,opts)=>{calls.push(JSON.parse(opts.body));
  return {ok:true,json:async()=>({access_token:'ghu_newtokenvalue456',expires_in:28800,refresh_token:'ghr_refresh2'})}}});
 await o.hydrate({force:true});
 assert.equal(calls[0].grant_type,'refresh_token');assert.equal(calls[0].refresh_token,'ghr_refresh1');
 assert.equal(o.getLinkedToken({ownerId:owner}),'ghu_newtokenvalue456');
 assert.equal(store.rows.get(owner).refreshToken,'ghr_refresh2');
});
test('wiring: every request restores the link first; table is service-role only',()=>{
 assert.ok((fs.readFileSync("server/render-matt.cjs","utf8").match(/try\{await oauth\?\.hydrate\?\.\(\)\}catch\(_\)\{\}/g)||[]).length>=2);
 const sql=fs.readFileSync('sql/paperworld_github_links_v1.sql','utf8');
 assert.match(sql,/revoke all on public\.paperworld_github_links_v1 from public,anon,authenticated/);
 assert.doesNotMatch(sql,/\{\d+,\d{4,}\}/,'no regex bound above 255');
});
