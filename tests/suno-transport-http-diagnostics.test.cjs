'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=p=>fs.readFileSync(p,'utf8');
test('Suno Create preserves bounded numeric HTTP status and MCP error code',()=>{
 const transport=src('server/suno-audio-create.cjs');
 const owner=src('server/suno-oauth-client.cjs');
 assert.match(transport,/reason:'provider_http_unverified'/);
 assert.match(transport,/httpStatus:Number.isInteger\(status\)/);
 assert.match(owner,/httpStatus:result.httpStatus/);
 assert.match(owner,/rpcCode:result.rpcCode/);
 assert.doesNotMatch(transport,/response\.text\(\).*console\.log/);
});
test('Owner can use read-only MCP transport check without invoking tools/call',()=>{
 const ui=src('js/world-dialogue.js');
 const click=ui.split("sunoTransportCheck.addEventListener('click',async()=>{")[1]
  ?.split("const musicCancel=make(")[0];
 assert.ok(click);
 assert.match(click,/cloud\(\)\.diagnoseSunoConnection\(\)/);
 assert.match(click,/result.toolTransport==='modern'/);
 assert.match(click,/result.toolTransport==='legacy'/);
 assert.doesNotMatch(click,/createSunoSong|audio-create|window\.confirm/);
 assert.match(ui,/sunoGenerate,sunoCreateStatus,sunoTransportCheck,musicCopy/);
});
