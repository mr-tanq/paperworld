'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('js/world-dialogue.js','utf8');
test('Matt refreshes only the authenticated current conversation, with no agent execution',()=>{
 assert.match(source,/function ingestMattHistory\(history\)/);
 assert.match(source,/async function refreshLiveMatt\(\)/);
 assert.match(source,/cloud\(\)\.privateAgentMessages\('matt'\)/);
 assert.match(source,/selectedRevision===revision/);
 assert.match(source,/openId==='matt'&&!busy/);
 assert.match(source,/document\.visibilityState!=='visible'/);
 const refresh=source.split('async function refreshLiveMatt(){')[1].split('function stopLiveMatt()')[0];
 assert.doesNotMatch(refresh,/delegateMatt\(|askDirector\(|createAutonomousMission\(|runApproved|launchCopilot|setAgentWorkflow/);
});
test('an open chat polls without duplicate polling, and closes cleanly',()=>{
 assert.match(source,/let mattLiveTimer=null,mattLiveReading=false/);
 assert.match(source,/mattLiveReading=true/);
 assert.match(source,/finally\{mattLiveReading=false\}/);
 assert.match(source,/clearInterval\(mattLiveTimer\)/);
 assert.match(source,/setInterval\(\(\)=>\{void refreshLiveMatt\(\)\},20000\)/);
 assert.match(source,/function show\(id\)\{stopLiveMatt\(\);openId=id;paint\(\);startLiveMatt\(\)/);
 assert.match(source,/function hide\(\)\{stopLiveMatt\(\);openId=null/);
 assert.match(source,/visibilitychange/);
});
test('the initial and recurring reads share saved Crow recovery and idempotent message reconciliation',()=>{
 assert.equal((source.match(/const recovered=historyCodec\(\)\.recover\(history\)/g)||[]).length,1);
 assert.match(source,/historyCodec\(\)\.reconcileReplies\(mattReplies,history\)/);
 assert.match(source,/mattHistorySignature/);
 assert.match(source,/if\(fingerprint===mattHistorySignature&&mattCachedEntries!==null\)return/);
 assert.match(source,/if\(selected==='matt'&&historyCodec\(\)\)\{\s*ingestMattHistory\(history\)/);
});
