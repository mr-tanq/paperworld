'use strict';
// Owner-enabled auto-merge in the Task Engine "report" step: only the exact
// head proven by the trusted workflow is merged; everything else stays safe.
const test=require('node:test'),assert=require('node:assert/strict');
let createTaskDispatcher;
test.before(async()=>({createTaskDispatcher}=
 await import('../supabase/functions/paperworld-task-dispatch/index.mjs')));
const mission='11111111-1111-4111-8111-111111111111';
const owner='33333333-3333-4333-8333-333333333333';
const trigger='synthetic_test_secret_0123456789012345';
const HEAD='a'.repeat(40),OTHER='b'.repeat(40),MERGE='c'.repeat(40);
const spec={projectId:'listening',directorId:'listening-director',
 repository:'mr-tanq/concerts',title:'Fix missing concerts',
 summary:'Concerts are missing',acceptance:['Concerts appear again'],
 requiredTests:['festival_discovery'],allowedPaths:['js/'],maxFiles:3,
 noAutoMerge:true,noAutoDeploy:true};
const BODY='**Cause:** Η πηγή άλλαξε μορφή ημερομηνίας και οι συναυλίες απορρίπτονταν. https://x.example/a\n'+
 '- Fix: Διαβάζουμε και τη νέα μορφή ημερομηνίας.\n\nFixes #7';
function fixture({autoMerge=true,head=HEAD,draft=true,merged=false,mergeStatus=200,loseResponse=false,graphqlOk=true}={}){
 const calls=[],finished=[],failed=[];
 const pr={number:12,state:merged?'closed':'open',draft,merged,head:{sha:head},base:{ref:'main'},
  node_id:'PR_kwDOsynthetic',body:BODY,merge_commit_sha:merged?MERGE:null};
 const steps=['create_issue','start_agent','await_agent','verify','report'].map((capability,i)=>({
  id:String(i+1).repeat(8)+'-aaaa-4aaa-8aaa-'+'a'.repeat(12),seq:i+1,capability,
  state:i<4?'succeeded':'leased',input:{effectKey:'task-v1:'+mission+':'+(i+1)},
  output:capability==='create_issue'?{issueNumber:7,issueUrl:'https://github.com/mr-tanq/concerts/issues/7'}:
   capability==='await_agent'?{prNumber:12,prUrl:'https://github.com/mr-tanq/concerts/pull/12',headSha:HEAD}:
   capability==='verify'?{verification:'trusted',headSha:HEAD,requiredTests:['festival_discovery'],
    runUrl:'https://github.com/mr-tanq/concerts/actions/runs/5'}:{}}));
 const json=v=>({ok:true,status:200,json:async()=>v});
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),method=opts.method||'GET';
  calls.push({path:u.pathname,method,body:opts.body?JSON.parse(opts.body):undefined});
  if(u.hostname.includes('supabase.co')){
   if(u.pathname.includes('/rpc/')){
    const name=u.pathname.split('/').pop(),args=JSON.parse(opts.body||'{}');
    if(name==='paperworld_v5_resume_due_budget')return json(0);
    if(name==='paperworld_v5_claim_task_step')return json([{step_id:steps[4].id,mission_id:mission,capability:'report'}]);
    if(name==='paperworld_v5_finish_task_step'){finished.push(args.p_result);return json(true)}
    if(name==='paperworld_v5_fail_step'){failed.push(args.p_reason);return json(true)}
    throw Error('unexpected rpc '+name);
   }
   if(u.pathname.endsWith('/paperworld_autonomous_controller_v5'))
    return json([{engine:'v1',dispatch_enabled:true,live_adapters:['copilot_agent'],auto_merge_verified:autoMerge}]);
   if(u.pathname.endsWith('/paperworld_autonomous_effects_v5'))return json([]);
   if(u.pathname.endsWith('/paperworld_autonomous_missions_v5'))
    return json([{id:mission,owner_id:owner,engine:'v1',project_id:'listening',status:'running',spec,policy:{}}]);
   if(u.pathname.endsWith('/paperworld_autonomous_steps_v5'))return json(steps);
  }
  if(u.hostname==='api.github.com'){
   if(u.pathname==='/graphql'){
    assert.match(calls.at(-1).body.query,/markPullRequestReadyForReview/);
    if(!graphqlOk)return {ok:true,status:200,json:async()=>({errors:[{message:'no'}]})};
    pr.draft=false;return json({data:{markPullRequestReadyForReview:{pullRequest:{isDraft:false}}}});
   }
   if(u.pathname==='/repos/mr-tanq/concerts/pulls/12'&&method==='GET')return json({...pr});
   if(u.pathname==='/repos/mr-tanq/concerts/pulls/12/merge'&&method==='PUT'){
    const b=calls.at(-1).body;
    if(mergeStatus!==200||pr.draft||b.sha!==pr.head.sha)return {ok:false,status:mergeStatus===200?409:mergeStatus};
    Object.assign(pr,{merged:true,state:'closed',merge_commit_sha:MERGE});
    if(loseResponse)throw Error('network lost');
    return json({merged:true,sha:MERGE});
   }
  }
  throw Error('unexpected network '+method+' '+url);
 };
 const env=k=>({PAPERWORLD_DISPATCH_TRIGGER_SECRET:trigger,
  GITHUB_COPILOT_USER_TOKEN:'synthetic_github_token_0000000000000',
  SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_test_only_00000000000000000'})})[k];
 const d=createTaskDispatcher({environment:env,fetcher});
 const run=async()=>(await d.handle(new Request('https://example.invalid/',{method:'POST',
  headers:{authorization:'Bearer '+trigger}}))).json();
 const merges=()=>calls.filter(c=>c.path.endsWith('/merge'));
 return {run,calls,finished,failed,merges,pr};
}
test('auto-merge off: nothing is merged, cause and fix are still reported',async()=>{
 const f=fixture({autoMerge:false});
 assert.equal((await f.run()).state,'completed');
 assert.equal(f.merges().length,0);
 assert.ok(!f.calls.some(c=>c.path==='/graphql'));
 const out=f.finished[0];
 assert.equal(out.merged,false);assert.equal(out.mergeState,'not_enabled');
 assert.equal(out.cause,'Η πηγή άλλαξε μορφή ημερομηνίας και οι συναυλίες απορρίπτονταν.');
 assert.equal(out.fix,'Διαβάζουμε και τη νέα μορφή ημερομηνίας.');
});
test('auto-merge on: the verified head is marked ready and squash-merged with a sha guard',async()=>{
 const f=fixture();
 assert.equal((await f.run()).state,'completed');
 const [m]=f.merges();
 assert.deepEqual(m.body,{sha:HEAD,merge_method:'squash',commit_title:'Fix missing concerts (#12)'});
 assert.equal(f.finished[0].merged,true);assert.equal(f.finished[0].mergeSha,MERGE);
});
test('a head pushed after verification is never merged',async()=>{
 const f=fixture({head:OTHER});
 assert.equal((await f.run()).state,'needs_you');
 assert.equal(f.merges().length,0);assert.deepEqual(f.failed,['pr_head_moved_after_verification']);
});
test('GitHub refusing the merge (branch protection) completes as "needs one tap", never as merged',async()=>{
 const f=fixture({mergeStatus:405});
 assert.equal((await f.run()).state,'completed');
 assert.equal(f.finished[0].merged,false);assert.equal(f.finished[0].mergeState,'blocked');
 assert.equal(f.finished[0].mergeBlockedReason,'github_refused_merge');
 const g=fixture({graphqlOk:false});
 await g.run();
 assert.equal(g.merges().length,0);assert.equal(g.finished[0].mergeBlockedReason,'ready_for_review_refused');
});
test('a lost merge response is resolved by re-reading the PR, and a retry never merges twice',async()=>{
 const f=fixture({loseResponse:true});
 await f.run();
 assert.equal(f.finished[0].merged,true);assert.equal(f.merges().length,1);
 const again=fixture({merged:true,draft:false});
 assert.equal((await again.run()).state,'completed');
 assert.equal(again.merges().length,0);assert.equal(again.finished[0].merged,true);
});
test('Matt routes a reported problem to the autonomous fix path, not to a consent card',()=>{
 const {routePrompt,parseIntent}=require('../server/matt-semantic-router.cjs');
 const prompt=routePrompt('Νομίζω έχουμε πρόβλημα στην εύρεση συναυλιών, μπορείς να το τσεκάρεις;');
 assert.match(prompt,/broken, missing, wrong or not working/);
 assert.match(prompt,/εύρεση συναυλιών[^\n]*\n→ \{"director":"listening-director","action":"build"\}/);
 assert.equal(parseIntent('{"director":"listening-director","action":"build"}').action,'build');
 const {buildTaskPrompt}=require('../server/v5-task-planner.cjs');
 assert.match(buildTaskPrompt({message:'Λείπουν συναυλίες',directorId:'listening-director'}),/find its root cause and fix it/);
 const fs=require('node:fs');
 assert.match(fs.readFileSync('supabase/functions/paperworld-task-dispatch/index.mjs','utf8'),/Cause: <one sentence/);
});
