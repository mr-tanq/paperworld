'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeTeamHandoffLedger}=require('../server/team-handoff-ledger-v5.cjs');
const hub=require('../js/human-first-hub.js');
const ownerId='11111111-1111-4111-8111-111111111111',
 threadId='22222222-2222-4222-8222-222222222222',
 requestId='33333333-3333-4333-8333-333333333333';
const base={ownerId,threadId,requestId,message:'Plan Route 1',
 directorId:'pokemon-director',report:'Director advice only'};
function mockLedger(){
 const requests=[];
 const fetcher=async(url,opts)=>{
  requests.push({url,opts});
  const input=opts.method==='POST'?JSON.parse(opts.body):null;
  return {ok:true,json:async()=>opts.method==='POST'?[{
   ...input,created_at:'2026-11-16T10:00:00Z'}]:[{
    id:requestId,owner_id:ownerId,thread_id:threadId,request_id:requestId,
    project:'pokemon',director_id:'pokemon-director',worker_id:null,
    status:'reported',request_summary:'Plan Route 1',created_at:'2026-11-16T10:00:00Z'
   }]};
 };
 const guard={authenticate:async()=>({ownerId}),
  ownsThread:async({ownerId:o,threadId:t,agentId})=>
   o===ownerId&&t===threadId&&agentId==='matt'};
 return {ledger:makeTeamHandoffLedger({fetcher,guard,secret:'sb_secret_synthetic'}),requests};
}
test('V5 records a real Director handoff without asserting Worker execution',async()=>{
 const {ledger,requests}=mockLedger();
 assert.equal(await ledger.record(base),true);
 const item=JSON.parse(requests[0].opts.body);
 assert.equal(item.project,'pokemon');
 assert.equal(item.status,'reported');
 assert.equal(item.worker_id,null);
 assert.equal(item.request_summary,'Plan Route 1');
 assert.ok(requests[0].url.includes('on_conflict=owner_id,request_id'));
});
test('A validated proposed Worker remains awaiting consent, never running',async()=>{
 const {ledger,requests}=mockLedger();
 assert.equal(await ledger.record({...base,workProposal:{
  directorId:'pokemon-director',workerId:'pokemon-developer',
  requiresSeparateConsent:true,execution:'none'}}),true);
 assert.equal(JSON.parse(requests[0].opts.body).status,'awaiting_consent');
 assert.rejects(()=>ledger.record({...base,workProposal:{
  workerId:'studio-creative',requiresSeparateConsent:true,execution:'none'}}),
 /unauthorized_assignment/);
});
test('V5 owner-scoped endpoint rejects missing auth, wrong thread and wrong origin',async()=>{
 const {ledger}=mockLedger();
 assert.equal((await ledger.handle({headers:{origin:'https://evil.invalid'}})).status,403);
 const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer '+('a'.repeat(30))};
 assert.equal((await ledger.handle({headers,body:JSON.stringify({threadId:'bad'})})).status,400);
 assert.equal((await ledger.handle({headers,body:JSON.stringify({threadId})})).status,200);
 const result=await ledger.handle({headers,body:JSON.stringify({threadId})});
 assert.equal(result.body.jobs.length,1);
 assert.equal(result.body.authority,'recorded_handoffs_not_worker_execution');
});
test('Never persist a handoff without configured server-only service key',async()=>{
 const ledger=makeTeamHandoffLedger({fetcher:async()=>{throw Error('network call forbidden')},
  secret:''});
 await assert.rejects(()=>ledger.record(base),/team_ledger_not_configured/);
});
test('Human First hub shows only truthful generic handoffs',()=>{
 const item={id:requestId,requestId,project:'pokemon',directorId:'pokemon-director',
  status:'awaiting_consent',summary:'Map work',createdAt:'2026-11-16T12:00:00Z'};
 const r=hub.project({jobs:[],proposals:[],tasks:[],teamJobs:[item]});
 assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].kind,'handoff');
 assert.equal(r.rows[0].stage,'planned');
 const forged=hub.project({teamJobs:[{...item,directorId:'studio-director'}]});
 assert.equal(forged.rows.length,0);
 const reported=hub.project({teamJobs:[{...item,status:'reported'}]});
 assert.equal(reported.rows[0].stage,'diagnosed');
});
test('V5 client and backend integrations do not auto-run AI or workers',()=>{
 const source=fs.readFileSync('server/render-matt.cjs','utf8');
 const chat=fs.readFileSync('server/matt-delegation.cjs','utf8');
 const cloud=fs.readFileSync('js/cloud.js','utf8');
 const ui=fs.readFileSync('js/cloud-ui.js','utf8');
 assert.match(source,/history\/matt\/team/);
 assert.match(chat,/teamLedger\.record/);
 assert.match(chat,/handoffStored/);
 assert.match(cloud,/teamHandoffHistory/);
 assert.match(ui,/teamJobs/);
 assert.doesNotMatch(fs.readFileSync('server/team-handoff-ledger-v5.cjs','utf8'),
  /\b(sendAndWait|createPullRequest|tools\/call)\s*\(/);
});
