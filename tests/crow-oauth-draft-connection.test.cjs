'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=()=>fs.readFileSync('js/world-dialogue.js','utf8');
test('Crow keeps only owner-bound drafts in tab session across OAuth, not tokens or long-term storage',()=>{
 const script=src();
 assert.match(script,/songDraftStorageKey='paperworld-crow-oauth-draft-v1'/);
 assert.match(script,/const songOwner=\(\)=>cloud\(\)\?\.signedIn\(\)\?cloud\(\)\?\.ownerId\?\.\(\):null/);
 assert.match(script,/window\.sessionStorage\.setItem\(songDraftStorageKey/);
 assert.match(script,/draft\?\.ownerId!==ownerId/);
 assert.match(script,/Date\.now\(\)-draft\.savedAt>songDraftMaxAge/);
 assert.match(script,/restoreSongDraft\(\)/);
 assert.match(script,/rememberSongDraft\(\)/);
 assert.match(script,/forgetSongDraft\(\)/);
 const entry=script.split('function rememberSongDraft(){')[1].split('function restoreSongDraft(){')[0];
 assert.doesNotMatch(entry,/access_token|refresh_token|oauthToken|localStorage/);
});
test('Suno callback restores same owner draft and does not treat URL parameter as proof of authorization',()=>{
 const script=src();
 assert.match(script,/sunoReturn\.get\('suno_link'\)==='connected'/);
 assert.match(script,/show\('studio-director'\)/);
 assert.match(script,/if\(restoreSongDraft\(\)\)/);
 assert.match(script,/void refreshSunoConnection\(\)/);
 assert.match(script,/await cloud\(\)\.sunoLinkStatus\(\)/);
 assert.match(script,/setSunoConnection\(r\.oauthAuthorized===true\?'connected':'disconnected'\)/);
});
test('Matt and Crow render compact authenticated connection chips, never persistent connect prompts',()=>{
 const script=src(),style=fs.readFileSync('style.css','utf8');
 assert.match(script,/top\.append\(avatar,identity,connectGithub,close\)/);
 assert.doesNotMatch(script,/composer\.append\(connectGithub/);
 assert.match(script,/musicPanel\.append\(sunoConnect,musicHelp/);
 assert.match(script,/GitHub · Συνδεδεμένο/);
 assert.match(script,/Suno · Συνδεδεμένο/);
 assert.match(script,/await cloud\(\)\.githubLinkStatus\(\)/);
 assert.match(script,/link\.connected===true\|\|link\.chatConnected===true/);
 assert.match(script,/setGithubConnection\('unknown'\)/);
 assert.match(script,/setSunoConnection\('unknown'\)/);
 assert.match(style,/\.world-dialogue-head \.world-connection-chip/);
 assert.match(style,/\.crow-music-panel \.world-connection-chip/);
});
test('Cloud owner marker is UUID only and browser cache versions advance together',()=>{
 const client=fs.readFileSync('js/cloud.js','utf8');
 const wrapper=fs.readFileSync('js/cloud-ui.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert.match(client,/const ownerId=\(\)=>session\?\.user\?\.id\|\|null/);
 assert.match(client,/return \{BASE,identity,ownerId,signedIn/);
 assert.match(wrapper,/ownerId:\(\)=>client\.ownerId\(\)/);
 for(const marker of [
  'cloud.js?v=suno-create-preflight-v13',
  'cloud-ui.js?v=suno-create-exposed-v14',
  'world-dialogue.js?v=suno-mcp-diagnostic-v15',
  'style.css?v=suno-create-feedback-v13'
 ])assert.ok(html.includes(marker),marker);
});

test('One GitHub tap verifies status then opens OAuth without a second click',()=>{
 const script=src();
 const click=script.split("connectGithub.addEventListener('click',async()=>{")[1]
  ?.split("top.append(avatar,identity,connectGithub,close)")[0];
 assert.ok(click,'GitHub click handler exists');
 assert.match(click,/const state=await refreshGithubConnection\(\)/);
 assert.match(click,/if\(state==='connected'\)/);
 assert.match(click,/if\(state!=='disconnected'\)/);
 assert.match(click,/const url=await cloud\(\)\.beginGithubLink\(\)/);
 assert.match(click,/window\.location\.assign\(url\)/);
 assert.doesNotMatch(click,/await refreshGithubConnection\(\);return;/);
 assert.match(script,/let githubLinkBusy=false/);
 assert.match(script,/githubLinkBusy\|\|/);
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/world-dialogue\.js\?v=suno-mcp-diagnostic-v15/);
});
