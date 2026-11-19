'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const js=fs.readFileSync(require.resolve('../js/world-dialogue.js'),'utf8');
const cloud=fs.readFileSync(require.resolve('../js/cloud.js'),'utf8');
const shell=fs.readFileSync(require.resolve('../js/cloud-ui.js'),'utf8');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
test('Director learning UI is explicit and limited to saved human messages',()=>{
 assert.match(js,/role==='human'&&message\?\.rememberable===true/);
 assert.match(js,/i===eligible&&openId!=='matt'/);
 assert.match(js,/id:m\.id,text:m\.content,time:m\.created_at/);
 assert.match(js,/message\.id/);
 assert.match(js,/Να το θυμάται;/);
 assert.match(js,/cancel\.addEventListener\('click'/);
 assert.match(js,/confirm\.addEventListener\('click'/);
 assert.match(js,/status!=='proposed'\|\|result\.approved!==false/);
 assert.doesNotMatch(js,/\.innerHTML\s*=/);
});
test('learning client submits only references and metadata, not a forged message body',()=>{
 const start=cloud.indexOf('async function proposeDirectorCorrection(');
 const end=cloud.indexOf('// GitHub OAuth linking',start);
 assert.ok(start>0&&end>start);
 const fn=cloud.slice(start,end);
 assert.match(fn,/getAgentThread\(agentId,false\)/);
 assert.match(fn,/messageId/);
 assert.match(fn,/sensitivity:'private'/);
 assert.match(fn,/status!=='proposed'/);
 assert.doesNotMatch(fn,/payload=\{[^}]*correction:/);
 assert.match(shell,/proposeDirectorCorrection:\(id,messageId,options\)/);
});
test('browser loads matching reviewed JS and CSS assets',()=>{
 assert.ok(html.includes('js/cloud.js?v=learning-loop-v3-integrated'));
 for(const file of ['style.css','js/messenger-format.js'])
  assert.ok(html.includes(file+'?v=messenger-v2-1'),file);
 for(const file of ['js/cloud-ui.js','messenger.css','workspace.css','js/workspace.js'])
  assert.ok(html.includes(file+'?v=workspace-v2-1'),file);
 assert.ok(html.includes('js/world-dialogue.js?v=workspace-v2-1'));
});
