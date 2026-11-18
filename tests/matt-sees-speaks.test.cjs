'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeMattTeamSnapshot,teamSummary}=require('../server/matt-team-snapshot.cjs');
const {parseIntent,routePrompt}=require('../server/matt-semantic-router.cjs');
const {makeDelegation,CONSENT}=require('../server/matt-delegation.cjs');
const OWNER='22222222-2222-4222-8222-222222222222';
const THREAD='11111111-1111-4111-8111-111111111111';
const REQUEST='33333333-3333-4333-8333-333333333333';
const report={directors:[
 {projectId:'listening',active:1,attention:0,recent:[{goal:'Fix ticket updates',status:'working'}]},
 {projectId:'pokemon',active:0,attention:1,recent:[{goal:'Fix battle',status:'needs_you'}]},
 {projectId:'studio',active:0,attention:0,recent:[]},
 {projectId:'wellbeing',active:0,attention:1,recent:[{goal:'PRIVATE HEALTH SECRET',status:'needs_you'}]}
],asOf:'2026-11-18T14:00:00Z'};
test('only a validated server-authorized owner identifier reads team state',async()=>{
 const calls=[];const snap=makeMattTeamSnapshot({
  secret:'sb_secret_test_fake_only',
  fetcher:async(url,options)=>{calls.push({url,options});
   return {ok:true,json:async()=>report};}
 });
 await assert.rejects(snap.load('not-a-uuid'),/invalid_owner/);
 assert.equal(calls.length,0);
 const value=await snap.load(OWNER);
 assert.equal(calls.length,1);
 assert.deepEqual(JSON.parse(calls[0].options.body),{p_owner:OWNER});
 assert.equal(value.directors[3].recent.length,0);
 assert.ok(!JSON.stringify(value).includes('PRIVATE HEALTH SECRET'));
 assert.match(teamSummary(value),/Luna/);
 assert.match(teamSummary(value),/Joey/);
 assert.equal(teamSummary(null).includes('ολοκληρώθηκε'),false);
});
test('team status intent is narrow and read-only',()=>{
 assert.equal(parseIntent('{"action":"team_status"}').action,'team_status');
 assert.equal(parseIntent('{"action":"team_status","owner":"other"}'),null);
 assert.equal(parseIntent('{"action":"team_status","director":"wellbeing-director"}'),null);
 assert.match(routePrompt('Πώς πάνε όλοι;'),/team_status/);
});
test('Matt answers team-wide status from live data using only one AI routing turn',async()=>{
 const prompts=[],saves=[],owners=[];
 const handler=makeDelegation({
  oauth:{getLinkedToken:()=> 'gho_TEST_TEST'},
  guard:{authenticate:async()=>({ownerId:OWNER}),ownsThread:async()=>true},
  budgetVerified:async()=>true,
  teamSnapshot:{load:async(owner)=>{owners.push(owner);return report}},
  memoryLoader:{load:async()=>{throw Error('No Director memory needed')}},
  persistence:{save:async(item)=>{saves.push(item);return true}},
  clientFactory:async()=>({
   start:async()=>{},listModels:async()=>[{id:'one',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1000}}}],
   createSession:async()=>({sendAndWait:async({prompt})=>{
    prompts.push(prompt);return {data:{content:'{"action":"team_status"}'}};
   },disconnect:async()=>{}}),stop:async()=>{}
  })
 });
 const response=await handler.handle({headers:{
  origin:'https://mr-tanq.github.io',authorization:'Bearer abcdefghijklmnop'},
  body:JSON.stringify({threadId:THREAD,requestId:REQUEST,
   message:'Πώς πάνε όλοι;',consent:CONSENT})});
 assert.equal(response.status,200,JSON.stringify(response.body));
 assert.equal(response.body.routeStatus,'team_status');
 assert.equal(response.body.aiTurns,1);
 assert.deepEqual(owners,[OWNER]);
 assert.equal(prompts.length,1);
 assert.equal(saves.length,1);
 assert.ok(response.body.content.includes('Luna'));
 assert.ok(!response.body.content.includes('PRIVATE HEALTH SECRET'));
});
