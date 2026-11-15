'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {makeWorkerDelegation,CONSENT}=require('../server/matt-worker-delegation.cjs');
const {FILES}=require('../server/listening-repo-reader.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer aaaaa.bbbbb.ccccc'};
const payload={threadId,requestId,message:'Investigate missing concert pictures in Listening Mirror',consent:CONSENT};
function fake({route='listening-director',category='artwork',
 owns=true,linked=true,budget=true,badEvidence=false,tamperPath=false,failTurn=0,
 failHistoryCreate=false,failHistoryEvent=false,memoryFails=false,
 workerReply=null,proposalMemory=null}={}){
 const seen={calls:0,models:0,configs:[],prompts:[],stages:[],read:[],jobs:[],events:[]};
 const gateway=makeWorkerDelegation({
  oauth:{getLinkedToken:()=>linked?'gho_VALID_FAKE_ONLY':null},
  guard:{authenticate:async()=>({ownerId:owner}),ownsThread:async()=>owns},
  budgetVerified:async()=>budget,
  proposalMemory,
  memoryLoader:{load:async params=>{
   seen.memoryParams=params;
   if(memoryFails)throw Error('PRIVATE_MEMORY_FAILURE');
   return {projectId:'workshop',actor:'listening-director',untrustedContent:true,
    included:1,text:'FESTIVAL_APPROVED_RULE_ONLY',capabilitiesGranted:[]};
  }},
  jobMemory:{
   create:async args=>{seen.jobs.push(args);if(failHistoryCreate)throw Error('storage_down')},
   append:async args=>{seen.events.push(args);if(failHistoryEvent)throw Error('event_down')}
  },
  reader:{read:async (name,options)=>{
   seen.read.push(name);seen.readerAuth=options?.token;
   const categoryPaths=FILES[name]||[];
   return {repository:badEvidence?'other/repo':'mr-tanq/concerts',
    ref:'main',category:name,readOnly:true,
    files:categoryPaths.map((path,i)=>({path:tamperPath&&i===0?'secret.env':path,sha:'a'.repeat(40),
     url:'https://github.com/mr-tanq/concerts/blob/main/'+path,
     lines:'L1 const stable = true;\nL2 // no changes performed'}))};
  }},
  clientFactory:async options=>{
   seen.options=options;
   return {start:async()=>{},
    listModels:async()=>[{id:'model-one',billing:{tokenPrices:{
     inputPrice:1,outputPrice:2,batchSize:1000}}}],
    createSession:async config=>{
     seen.configs.push(config);
     return {sendAndWait:async({prompt})=>{
      seen.calls++;seen.prompts.push(prompt);
      if(failTurn===seen.calls)throw Error('DO_NOT_LEAK_USER_PRIVATE_TOKEN');
      const responses=[route,category,
       workerReply??'Worker observed const stable at FILE L1. No edit or test was done.',
       'Director confirms L1; next request approval for change.',
       'Matt reports code reviewed read-only and no changes made.'];
      return {data:{content:responses[seen.calls-1]}};
     },disconnect:async()=>{}};
    },stop:async()=>{}};
  },
  diagnostic:stage=>seen.stages.push(stage)
 });
 return {gateway,seen};
}
const body=v=>JSON.stringify(v);
test('Matt → Director → source evidence → Worker → Director → Matt is five real simulated turns',async()=>{
 const {gateway,seen}=fake();
 const result=await gateway.handle({headers,body:body(payload)});
 assert.equal(result.status,200);
 assert.equal(result.body.delegated,true);
 assert.equal(result.body.persisted,true);
 assert.equal(seen.jobs.length,1);
 assert.equal(seen.jobs[0].jobId,requestId);
 assert.deepEqual(seen.events.map(e=>e.state),['created','routed','scoped',
  'evidence_read','worker_reported','director_reviewed','reported']);
 assert.equal(result.body.execution,'read_only_analysis');
 assert.equal(result.body.attemptedAiTurns,5);
 assert.equal(seen.calls,5);
 assert.deepEqual(seen.read,['artwork']);
 assert.equal(seen.readerAuth,'gho_VALID_FAKE_ONLY');
 assert.equal(result.body.evidence.files.length,FILES.artwork.length);
 assert.match(result.body.workerReport,/L1/);
 assert.match(result.body.content,/no changes made/);
 assert.equal(seen.options.useLoggedInUser,false);
 assert.equal(seen.options.mode,'empty');
 assert.doesNotMatch(JSON.stringify(result.body),/gho_VALID_FAKE_ONLY/);
 for(const config of seen.configs){
  assert.deepEqual(config.availableTools,[]);
  assert.deepEqual(await config.onPermissionRequest(),{kind:'reject'});
  assert.equal('hooks' in config,false);
 }
 assert.equal(seen.prompts[2].includes('UNTRUSTED REPOSITORY CONTENT'),true);
 assert.match(seen.prompts[1],/FESTIVAL_APPROVED_RULE_ONLY/);
 assert.match(seen.prompts[3],/FESTIVAL_APPROVED_RULE_ONLY/);
 assert.doesNotMatch(seen.prompts[2],/FESTIVAL_APPROVED_RULE_ONLY/);
 assert.doesNotMatch(seen.prompts[0],/FESTIVAL_APPROVED_RULE_ONLY/);
 assert.doesNotMatch(JSON.stringify(seen.events),/FESTIVAL_APPROVED_RULE_ONLY/);
 assert.equal(result.body.memory.included,1);
 assert.equal(seen.memoryParams.ownerId,owner);
});
test('No director for unrelated project: only one route call and no repo access',async()=>{
 const {gateway,seen}=fake({route:'not_ready'});
 const r=await gateway.handle({headers,body:body(payload)});
 assert.equal(r.status,200);
 assert.equal(r.body.delegated,false);
 assert.equal(r.body.attemptedAiTurns,1);
 assert.equal(seen.calls,1);
 assert.deepEqual(seen.read,[]);
});
test('Invalid Director category never opens files or invokes Worker',async()=>{
 const {gateway,seen}=fake({category:'../../anything'});
 const r=await gateway.handle({headers,body:body(payload)});
 assert.equal(r.status,422);
 assert.equal(seen.calls,2);
 assert.deepEqual(seen.read,[]);
});
test('Unauthorized request, wrong owner, GitHub disconnect, and no five-turn consent fail closed',async()=>{
 for(const opts of [{owns:false},{linked:false},{budget:false}]){
  const {gateway,seen}=fake(opts);
  const result=await gateway.handle({headers,body:body(payload)});
  assert.ok([403,404,409].includes(result.status));
  assert.equal(seen.calls,0);assert.deepEqual(seen.read,[]);
 }
 const {gateway,seen}=fake();
 assert.equal((await gateway.handle({headers:{...headers,origin:'https://evil.tld'},body:body(payload)})).status,403);
 assert.equal((await gateway.handle({headers,body:body({...payload,consent:'MATT_DIRECTOR_UP_TO_THREE_AI_TURNS'})})).status,400);
 assert.equal((await gateway.handle({headers,body:body({...payload,threadId:'bad'})})).status,400);
 assert.equal(seen.calls,0);
});
test('Replay cannot spend twice; invalid repository evidence never reaches Worker model',async()=>{
 const {gateway,seen}=fake();
 assert.equal((await gateway.handle({headers,body:body(payload)})).status,200);
 assert.equal((await gateway.handle({headers,body:body(payload)})).status,409);
 assert.equal(seen.calls,5);
 const denied=fake({badEvidence:true});
 const r=await denied.gateway.handle({headers,body:body(payload)});
 assert.equal(r.status,503);
 assert.equal(r.body.stage,'repository_read');
 assert.equal(denied.seen.calls,2);
 const tampered=fake({tamperPath:true});
 const rejected=await tampered.gateway.handle({headers,body:body(payload)});
 assert.equal(rejected.status,503);
 assert.equal(rejected.body.stage,'repository_read');
 assert.equal(tampered.seen.calls,2);
});

test('Failures do not reveal source, prompts or secrets in HTTP or logs',async()=>{
 const {gateway,seen}=fake({failTurn:3});
 const r=await gateway.handle({headers,body:body(payload)});
 assert.equal(r.status,503);
 assert.equal(r.body.attemptedAiTurns,3);
 assert.equal(r.body.stage,'model_reply');
 assert.deepEqual(seen.stages,['model_reply']);
 assert.doesNotMatch(JSON.stringify(r)+JSON.stringify(seen.stages),/DO_NOT_LEAK|gho_VALID|stable = true/);
});
test('Messenger has explicit worker-specific opt-in without losing ordinary chat',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../js/world-dialogue.js'),'utf8');
 assert.match(ui,/runMattWorkflow/);
 assert.match(ui,/έως 5|Έως 5/);
 assert.match(ui,/delegateMattWorker/);
 assert.doesNotMatch(ui,/result\.workerReport,time/);
 assert.doesNotMatch(ui,/result\.directorReport,time/);
 assert.match(ui,/replace\(\/\\\\n\/g/);
 const cloud=fs.readFileSync(path.join(__dirname,'../js/cloud.js'),'utf8');
 assert.match(cloud,/MATT_DIRECTOR_WORKER_UP_TO_FIVE_AI_TURNS/);
 assert.match(cloud,/\/delegate\/matt\/worker/);
 const server=fs.readFileSync(path.join(__dirname,'../server/render-matt.cjs'),'utf8');
 assert.match(server,/\/delegate\/matt\/worker/);
});

test('History create failure aborts before Director/Worker charged calls',async()=>{
 const {gateway,seen}=fake({failHistoryCreate:true});
 const result=await gateway.handle({headers,body:body(payload)});
 assert.equal(result.status,503);
 assert.equal(result.body.stage,'job_create');
 assert.equal(seen.calls,1);
 assert.equal(seen.jobs.length,1);
});
test('Event recording failures never falsely claim persistence',async()=>{
 const {gateway,seen}=fake({failHistoryEvent:true});
 const result=await gateway.handle({headers,body:body(payload)});
 assert.equal(result.status,200);
 assert.equal(result.body.persisted,false);
 assert.equal(seen.calls,5);
 assert.ok(seen.events.length>0);
});
test('No job row is created when route is not enabled',async()=>{
 const {gateway,seen}=fake({route:'not_ready'});
 const result=await gateway.handle({headers,body:body(payload)});
 assert.equal(result.body.delegated,false);
 assert.deepEqual(seen.jobs,[]);
});

test('Reader failure exposes only a bounded safe GitHub reason',async()=>{
 const seen={calls:0,diagnostics:[],events:[]};
 const gateway=makeWorkerDelegation({
  oauth:{getLinkedToken:()=> 'gho_PRIVATE_TOKEN_NEVER_EXPOSED'},
  guard:{authenticate:async()=>({ownerId:owner}),ownsThread:async()=>true},
  budgetVerified:()=>true,
  memoryLoader:{load:async()=>({projectId:'workshop',actor:'listening-director',
   included:0,text:'',untrustedContent:true,capabilitiesGranted:[]})},
  jobMemory:{create:async()=>{},append:async event=>{seen.events.push(event)}},
  reader:{read:async()=>{const e=new Error('SECRET_API_RESPONSE');e.code='github_rate_limited';throw e}},
  clientFactory:async()=>({
   start:async()=>{},listModels:async()=>[{id:'model',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1000}}}],
   createSession:async()=>({sendAndWait:async()=>{
    seen.calls++;return {data:{content:seen.calls===1?'listening-director':'ticketing'}}
   },disconnect:async()=>{}}),stop:async()=>{}
  }),
  diagnostic:value=>seen.diagnostics.push(value)
 });
 const response=await gateway.handle({headers,body:body(payload)});
 assert.equal(response.status,503);
 assert.equal(response.body.stage,'repository_read');
 assert.equal(response.body.reason,'github_rate_limited');
 assert.equal(response.body.attemptedAiTurns,2);
 assert.equal(seen.calls,2);
 assert.equal(seen.events.at(-1).state,'failed');
 assert.match(seen.events.at(-1).note,/github_rate_limited/);
 assert.equal(seen.diagnostics.at(-1),'repository_read:github_rate_limited');
 assert.doesNotMatch(JSON.stringify(response)+JSON.stringify(seen.diagnostics),/SECRET_API_RESPONSE|PRIVATE_TOKEN/);
});

test('Memory lookup error prevents project history creation and worker inference',async()=>{
 const {gateway,seen}=fake({memoryFails:true});
 const response=await gateway.handle({headers,body:body(payload)});
 assert.equal(response.status,503);
 assert.equal(response.body.stage,'approved_memory_read');
 assert.equal(response.body.attemptedAiTurns,1);
 assert.equal(seen.calls,1);
 assert.deepEqual(seen.jobs,[]);
 assert.deepEqual(seen.events,[]);
 assert.doesNotMatch(JSON.stringify(response),/PRIVATE_MEMORY_FAILURE/);
});

test('A long complete-file proposal is preserved, validated and stored without an extra AI turn',async()=>{
 const tag='PAPERWORLD_CHANGE_PROPOSAL_V1:';
 const draft={jobId:requestId,repository:'mr-tanq/concerts',baseRef:'main',
  summary:'Keep a small artifact safe',edits:[{path:'js/concert-image-quality.js',
   expectedSha:'a'.repeat(40),replacement:'const stable = true;\\n// clarified behavior'}]};
 const longReport='Source confirms L1. '+('Inspection detail. '.repeat(400))+
  '\\n'+tag+JSON.stringify(draft);
 assert.ok(longReport.length>6000);
 const saves=[];
 const {gateway,seen}=fake({workerReply:longReport,
  proposalMemory:{save:async input=>{saves.push(input);return {persisted:true}}}});
 const result=await gateway.handle({headers,body:body(payload)});
 assert.equal(result.status,200);
 assert.equal(result.body.attemptedAiTurns,5);
 assert.equal(seen.calls,5);
 assert.equal(result.body.proposalStatus,'ready_for_review');
 assert.equal(result.body.proposalPersisted,true);
 assert.equal(saves.length,1);
 assert.equal(saves[0].jobId,requestId);
 assert.equal(saves[0].ownerId,owner);
 assert.equal(saves[0].reviewProposal.plan.edits[0].replacement,draft.edits[0].replacement);
 assert.match(seen.prompts[2],/primary deliverable/);
 assert.match(seen.prompts[2],/ONE minimal/);
 assert.ok(!seen.prompts[3].includes(tag));
 assert.doesNotMatch(JSON.stringify(result.body),/gho_VALID_FAKE_ONLY/);
});

test('Analysis-only results do not claim saved changes and do not call storage',async()=>{
 let writes=0;
 const {gateway}=fake({proposalMemory:{save:async()=>{writes++;return {persisted:true}}}});
 const result=await gateway.handle({headers,body:body(payload)});
 assert.equal(result.status,200);
 assert.equal(result.body.proposalStatus,'analysis_only');
 assert.equal('reviewProposal' in result.body,false);
 assert.equal(writes,0);
});
