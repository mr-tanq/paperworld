'use strict';
// Connected services never appear connected without a confirming answer.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../js/connection-status.js');

test('GitHub: only a confirming server answer is "connected"',()=>{
 assert.deepEqual(S.github({connected:true,login:'x',ephemeral:true}),{state:'connected',chat:false,link:true,temporary:true});
 assert.equal(S.github({connected:false,ephemeral:true,chatConnected:true}).state,'connected');
 assert.equal(S.github({connected:false,ephemeral:true,chatConnected:true}).temporary,false);
 assert.equal(S.github({connected:false}).state,'disconnected');
 for(const bad of [null,undefined,{},{connected:'yes'},'ok'])assert.equal(S.github(bad).state,'unavailable');
});
test('Suno: authorised only with the verified non-generating shape',()=>{
 assert.deepEqual(S.suno({oauthAuthorized:true,canGenerate:false,ephemeral:true}),{state:'connected',temporary:true});
 assert.equal(S.suno({oauthAuthorized:false,canGenerate:false}).state,'disconnected');
 assert.equal(S.suno({oauthAuthorized:true}).state,'unavailable','missing canGenerate:false is not trusted');
 assert.equal(S.suno({oauthAuthorized:true,canGenerate:true}).state,'unavailable');
});
test('Errors are named, never shown as connected or endless "checking"',async()=>{
 assert.equal(S.fromError(Error('oauth_not_configured (HTTP 503)')),'not_configured');
 assert.equal(S.fromError(Error('unauthorized (HTTP 401)')),'signed_out');
 assert.equal(S.fromError(Error('Failed to fetch')),'unavailable');
 assert.deepEqual(await S.read('github',async()=>{throw Error('x (HTTP 503)')}),{state:'unavailable'});
 assert.deepEqual(await S.read('suno',async()=>({oauthAuthorized:true,canGenerate:false}),{signedIn:false}),{state:'signed_out'});
 const started=Date.now();
 assert.deepEqual(await S.read('github',()=>new Promise(()=>{}),{timeoutMs:30}),{state:'unavailable'});
 assert.ok(Date.now()-started<1000);
 assert.equal(S.label('checking'),'Έλεγχος…');assert.equal(S.label('nonsense'),'Μη διαθέσιμο τώρα');
});
test('Messenger chips use the same honest states and never stall on "checking"',()=>{
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/if\(!cloud\(\)\?\.signedIn\(\)\)\{setSunoConnection\('signed_out'\);return\}/);
 assert.match(ui,/'Suno · Δεν έχει ρυθμιστεί'/);assert.match(ui,/'GitHub · Μη διαθέσιμο τώρα'/);
 assert.match(ui,/if\(\/not_configured\/\.test\(reason\)\)setGithubConnection\('not_configured'\)/);
 for(const src of [ui,fs.readFileSync('js/connection-status.js','utf8'),fs.readFileSync('js/workspace.js','utf8')])
  assert.doesNotMatch(src,/access_token\s*[:=]\s*[^s]|Bearer \$\{/);
});
