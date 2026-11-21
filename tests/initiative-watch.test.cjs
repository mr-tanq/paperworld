'use strict';
// Initiatives phase A: Luna/Joey notice a failing workflow on main and start
// one fix through the normal Task Engine — within strict, calm limits.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const load=()=>import('../supabase/functions/paperworld-watch/index.mjs');
const owner='11111111-1111-4111-8111-111111111111',thread='22222222-2222-4222-8222-222222222222';
const run=(o)=>({id:1,workflow_id:10,name:'Discover concerts',path:'.github/workflows/discover-concerts.yml',head_branch:'main',
 status:'completed',event:'schedule',conclusion:'failure',created_at:'2026-11-21T05:00:00Z',head_sha:'a'.repeat(40),
 html_url:'https://github.com/mr-tanq/concerts/actions/runs/1',...o});
test('only workflows whose latest run on main failed; ignores verify/copilot/manual runs',async()=>{
 const {failingWorkflows}=await load();
 const out=failingWorkflows([run({}),run({id:2,workflow_id:10,conclusion:'success',created_at:'2026-11-21T06:00:00Z'}),
  run({id:3,workflow_id:11,name:'Refresh TicketSwap'}),run({id:4,workflow_id:12,name:'paperworld-verify',path:'.github/workflows/paperworld-verify.yml'}),
  run({id:5,workflow_id:13,event:'workflow_dispatch'}),run({id:6,workflow_id:14,head_branch:'copilot/x'})]);
 assert.deepEqual(out.map(r=>r.id),[3],'the fixed workflow and the excluded ones are ignored');
});
test('the brief is a valid bounded spec (same limits as the Task Engine)',async()=>{
 const {brief}=await load();const {verifyBoundedSpec}=await import('../supabase/functions/paperworld-task-dispatch/projects.mjs');
 for(const p of ['listening','pokemon']){
  const {goal,spec}=brief(p,run({}),{name:'build',step:'npm test'});
  verifyBoundedSpec(spec,p);
  assert.ok(goal.length<=1200&&spec.summary.length<=800&&spec.title.length<=120);
  assert.ok(spec.acceptance.length<=5&&spec.allowedPaths.length<=8&&spec.maxFiles<=10);
  assert.match(goal,/είδε ότι απέτυχε η αυτόματη εργασία «Discover concerts»/);
 }
});
function fakeDb({missions=[],runs=[run({})],paused=false}){
 const calls=[],posts=[];
 const fetcher=async(url,o={})=>{const m=o.method||'GET';calls.push([m,url]);
  const json=b=>({ok:true,status:200,json:async()=>b});
  if(url.includes('api.github.com')){if(url.includes('/jobs'))return json({jobs:[{name:'discover',conclusion:'failure',steps:[{name:'Run discovery',conclusion:'failure'}]}]});
   return json({workflow_runs:url.includes('concerts')?runs:[]})}
  if(url.includes('paperworld_autonomous_controller_v5'))return json([{engine:'v1',dispatch_enabled:true,initiatives_paused:paused}]);
  if(url.includes('rpc/'))return json(true);
  if(url.includes('paperworld_agent_messages')){posts.push(JSON.parse(o.body));return {ok:true,status:201,json:async()=>null}}
  if(url.includes('paperworld_autonomous_missions_v5')){
   if(m==='POST'){const b=JSON.parse(o.body);missions.push({...b,created_at:'2026-11-21T06:47:00Z',status:'draft'});return json([b])}
   if(url.includes('policy-%3E%3Einitiative')||url.includes('policy->>initiative'))return json(missions.filter(x=>x.policy?.initiative));
   if(url.includes('engine=eq.v1'))return json([{owner_id:owner,thread_id:thread,policy:{engine:'v1',retryOf:'x'}}]);
   const id=new URL(url).searchParams.get('id');if(id)return json(missions.filter(x=>'eq.'+x.id===id));
   return json([]);
  }
  return json([]);
 };
 return {fetcher,calls,posts,missions};
}
const env={SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40),GITHUB_COPILOT_USER_TOKEN:'t'.repeat(30)};
const clock=()=>Date.parse('2026-11-21T06:47:30Z');
test('a failing workflow becomes one queued mission and Matt tells the owner',async()=>{
 const {createWatcher}=await load();const f=fakeDb({});
 const r=await createWatcher({environment:k=>env[k],fetcher:f.fetcher,clock}).runOnce();
 assert.equal(r.results.find(x=>x.projectId==='listening').state,'initiative_queued');
 assert.equal(f.missions.length,1);
 const m=f.missions[0];assert.equal(m.policy.initiative,true);assert.equal(m.policy.retryOf,undefined,'never inherits a retry marker');
 assert.equal(m.owner_id,owner);assert.equal(m.thread_id,thread);
 assert.match(f.posts[0].content,/Η Luna είδε ότι απέτυχε η αυτόματη εργασία «Discover concerts» και την έδωσε μόνη της στον Developer/);
 assert.ok(f.calls.some(([,u])=>u.includes('rpc/paperworld_v5_plan_task'))&&f.calls.some(([,u])=>u.includes('rpc/paperworld_v5_queue_task')));
});
test('limits: one per Director per day, never the same workflow twice, pause stops all',async()=>{
 const {createWatcher}=await load();
 const one=fakeDb({missions:[{id:'m1',project_id:'listening',created_at:'2026-11-21T06:00:00Z',policy:{initiative:true,initiativeWorkflow:'99'}}]});
 const r1=await createWatcher({environment:k=>env[k],fetcher:one.fetcher,clock}).runOnce();
 assert.equal(r1.results.find(x=>x.projectId==='listening'),undefined,'Luna already used today\'s initiative');
 const twice=fakeDb({missions:[{id:'m2',project_id:'listening',created_at:'2026-11-18T06:00:00Z',policy:{initiative:true,initiativeWorkflow:'10'}}]});
 const r2=await createWatcher({environment:k=>env[k],fetcher:twice.fetcher,clock}).runOnce();
 assert.equal(r2.results.find(x=>x.projectId==='listening').state,'all_green','same workflow within 7 days is left alone');
 const paused=fakeDb({paused:true});
 assert.deepEqual(await createWatcher({environment:k=>env[k],fetcher:paused.fetcher,clock}).runOnce(),{state:'paused'});
 const sql=fs.readFileSync('sql/paperworld_initiatives_v1.sql','utf8');
 assert.match(sql,/add column if not exists initiatives_paused boolean not null default false/);
 assert.match(sql,/cron\.schedule\('paperworld-watch','47 6 \* \* \*'/);
});
