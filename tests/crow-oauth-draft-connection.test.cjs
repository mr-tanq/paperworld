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
  'cloud.js?v=oauth-draft-owner-v10',
  'cloud-ui.js?v=oauth-draft-owner-v10',
  'world-dialogue.js?v=github-one-tap-v11',
  'style.css?v=oauth-status-chips-v1'
 ])assert.ok(html.includes(marker),marker);
});
