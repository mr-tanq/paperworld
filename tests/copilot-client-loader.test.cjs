'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createCopilotClient,STAGES}=require('../server/copilot-client-loader.cjs');
test('real SDK package import and client construction work offline without starting it',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paperworld-sdk-smoke-'));
 try{
  const client=await createCopilotClient({useLoggedInUser:false,mode:'empty',
   baseDirectory:dir,gitHubToken:'gho_local_dummy_never_used'},{
   report:stage=>{throw Error('unexpected SDK bootstrap stage: '+stage)}
  });
  assert.equal(typeof client.start,'function');
  assert.equal(typeof client.createSession,'function');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
 // Never call start or createSession: this test consumes no Copilot credits.
});
test('import failure reports only static sdk_import stage',async()=>{
 const stages=[];
 await assert.rejects(createCopilotClient({gitHubToken:'SENSITIVE'},{
  loadSdk:async()=>{throw Error('SENSITIVE_TOKEN');},
  report:stage=>stages.push(stage)
 }),/copilot_client_factory_failed/);
 assert.deepEqual(stages,[STAGES.import]);
 assert.doesNotMatch(JSON.stringify(stages),/SENSITIVE/);
});
test('missing SDK export reports fixed sdk_export stage',async()=>{
 const stages=[];
 await assert.rejects(createCopilotClient({},{
  loadSdk:async()=>({}),report:stage=>stages.push(stage)
 }),/copilot_client_factory_failed/);
 assert.deepEqual(stages,[STAGES.export]);
});
test('constructor failure reports only static client_construct stage',async()=>{
 const stages=[];
 class Client{constructor(){throw Error('USER_SECRET_IN_EXCEPTION')}}
 await assert.rejects(createCopilotClient({},{
  loadSdk:async()=>({CopilotClient:Client}),
  report:stage=>stages.push(stage)
 }),/copilot_client_factory_failed/);
 assert.deepEqual(stages,[STAGES.constructor]);
 assert.doesNotMatch(JSON.stringify(stages),/USER_SECRET/);
});
test('Render and CI both use supported major Node 22',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/private-agent-chat-tests.yml'),'utf8');
 assert.equal(pkg.engines.node,'22.x');
 assert.match(workflow,/node-version: '22'/);
});
