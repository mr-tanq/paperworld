'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createSafeSessionConfig,classifySessionError}=require('../server/matt-session-config.cjs');
test('Minimal Copilot session has no tools and rejects every permission request',async()=>{
 const cfg=createSafeSessionConfig({model:'gpt-4.1',gitHubToken:'gho_EXAMPLE_ONLY'});
 assert.deepEqual(Object.keys(cfg).sort(),[
  'availableTools','gitHubToken','hooks','model','onPermissionRequest','sessionLimits','systemMessage'
 ].sort());
 assert.deepEqual(cfg.availableTools,[]);
 assert.deepEqual(await cfg.onPermissionRequest(),{kind:'reject'});
 assert.equal((await cfg.hooks.onPreToolUse()).permissionDecision,'deny');
 assert.deepEqual(cfg.sessionLimits,{maxAiCredits:1});
 assert.equal(cfg.systemMessage.mode,'append');
 assert.equal('includedBuiltinAgents' in cfg,false);
 assert.equal('excludedBuiltinAgents' in cfg,false);
});
test('Missing or malformed explicit user credentials cannot create a session config',()=>{
 assert.throws(()=>createSafeSessionConfig({model:'gpt-4.1',gitHubToken:'ghp_OLD'}));
 assert.throws(()=>createSafeSessionConfig({model:'gpt-4.1'}));
 assert.throws(()=>createSafeSessionConfig({model:'../../evil',gitHubToken:'gho_OK'}));
});
test('SDK RPC classifications never reveal raw exception messages',()=>{
 const categories=[
  ['401 Unauthorized: secret XXX','auth_rejected'],
  ['403 Forbidden','access_denied'],
  ['unsupported option: secret XXX','session_options_rejected'],
  ['model unavailable','model_rejected'],
  ['deadline exceeded','timeout'],
  ['upstream 503','upstream_unavailable'],
  ['sensitive internal message XXX','unclassified']
 ];
 for(const [message,expected] of categories){
  const reason=classifySessionError(Error(message));
  assert.equal(reason,expected);
  assert.doesNotMatch(reason,/secret|XXX|message/);
 }
});
test('Diagnostic HTTP route and browser client do not dispatch chat prompts',()=>{
 const backend=fs.readFileSync(path.join(__dirname,'../server/matt-live-chat.cjs'),'utf8');
 const start=backend.indexOf('async function diagnose(');
 const end=backend.indexOf('return Object.freeze({handle,diagnose})',start);
 assert.ok(start>0&&end>start);
 const diagnostic=backend.slice(start,end);
 assert.doesNotMatch(diagnostic,/session\.send\(|session\.sendAndWait\(/);
 assert.match(diagnostic,/SESSION_ONLY_NO_MODEL_CALL/);
 assert.match(diagnostic,/identity\.ownsThread/);
 const frontend=fs.readFileSync(path.join(__dirname,'../js/cloud.js'),'utf8');
 assert.match(frontend,/async function diagnoseMattSession\(\)/);
 assert.match(frontend,/\/diagnostic\/matt-session/);
 const messenger=fs.readFileSync(path.join(__dirname,'../js/world-dialogue.js'),'utf8');
 assert.doesNotMatch(messenger,/Έλεγχος Copilot · χωρίς AI μήνυμα/);
 assert.match(messenger,/composer\.append\(connectGithub,memoryReview,musicToggle,musicPanel,form\)/);
 assert.match(messenger,/memoryReview\.hidden=!isMatt\|\|!active/);
 assert.match(messenger,/musicToggle\.hidden=openId!=='studio-director'/);
});

test('Baseline diagnostic session disables tools and rejects permissions without optional SDK settings',async()=>{
 const cfg=createSafeSessionConfig({model:'gpt-4.1',gitHubToken:'gho_EXAMPLE_ONLY',probeMinimal:true});
 assert.deepEqual(Object.keys(cfg).sort(),['model','gitHubToken','availableTools','onPermissionRequest'].sort());
 assert.deepEqual(cfg.availableTools,[]);
 assert.deepEqual(await cfg.onPermissionRequest(),{kind:'reject'});
 assert.equal('sessionLimits' in cfg,false);
 assert.equal('hooks' in cfg,false);
 assert.equal('systemMessage' in cfg,false);
});
