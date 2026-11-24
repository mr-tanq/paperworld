'use strict';
// "Χρειάζεται εσένα" → one tap "🔁 Ξαναδοκίμασε": the same stopped coding task
// goes back to the Developer, without explaining it again.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeAutonomousMissionApi}=require('../server/v5-autonomous-mission-api.cjs');
const OWNER='11111111-1111-4111-8111-111111111111',THREAD='22222222-2222-4222-8222-222222222222',
 ORIG='33333333-3333-4333-8333-333333333333';
const spec={projectId:'pokemon',directorId:'pokemon-director',repository:'mr-tanq/pokemon-echoes',title:'Δυσκολία μάχης',
 summary:'Fix the battle.',acceptance:['a'],requiredTests:['godot_smoke'],allowedPaths:['scripts/'],maxFiles:4,noAutoMerge:true,noAutoDeploy:true};
function fake({status='needs_you',project='pokemon',prior=null,owner=OWNER}={}){
 const calls=[];const missions=[{id:ORIG,owner_id:owner,thread_id:THREAD,project_id:project,goal:'Φτιάξε τη μάχη',status,
  engine:'v1',spec,policy:{engine:'v1',retryOf:'x',initiative:true},last_error:'trusted_verification_failed'}];
 const fetcher=async(url,o={})=>{const m=o.method||'GET';calls.push([m,url,o.body&&JSON.parse(o.body)]);
  const json=b=>({ok:true,status:200,json:async()=>b});
  if(url.includes('/rpc/'))return json(true);
  if(url.includes('paperworld_autonomous_missions_v5')){
   if(m==='POST'){const b=JSON.parse(o.body);return json([b])}
   const q=new URL(url).searchParams;const id=q.get('id');
   if(id==='eq.'+ORIG)return json(missions.filter(x=>q.get('owner_id')==='eq.'+x.owner_id));
   return json(prior?[prior]:[]);
  }
  return json([]);};
 const guard={authenticate:async()=>({ownerId:OWNER}),ownsThread:async()=>true};
 const api=makeAutonomousMissionApi({fetcher,secret:'sb_secret_'+'x'.repeat(30),guard});
 const call=body=>api.handle({headers:{origin:'https://mr-tanq.github.io',authorization:'Bearer '+'t'.repeat(20)},
  action:'redo',body:JSON.stringify({threadId:THREAD,missionId:ORIG,...body})});
 return {call,calls};
}
test('redo: same bounded spec, a new deterministic mission, planned and queued',async()=>{
 const f=fake();const r=await f.call({});
 assert.equal(r.status,200);assert.equal(r.body.queued,true);assert.notEqual(r.body.missionId,ORIG);
 const post=f.calls.find(([m,u])=>m==='POST'&&u.includes('paperworld_autonomous_missions_v5'))[2];
 assert.equal(post.goal,'Φτιάξε τη μάχη');assert.equal(post.owner_id,OWNER);assert.equal(post.policy.redoOf,ORIG);
 assert.equal(post.policy.retryOf,undefined);assert.equal(post.policy.initiative,undefined,'a fresh mission gets its own automatic retry');
 const plan=f.calls.find(([,u])=>u.endsWith('/rpc/paperworld_v5_plan_task'))[2];
 assert.equal(plan.p_mission,r.body.missionId);assert.equal(plan.p_spec.repository,'mr-tanq/pokemon-echoes');
 assert.match(plan.p_spec.summary,/^Fix the battle\.[\s\S]*owner asked to try again \(previous attempt stopped: trusted_verification_failed\)/);
 assert.ok(f.calls.some(([,u])=>u.endsWith('/rpc/paperworld_v5_queue_task')));
 const again=fake();assert.equal((await again.call({})).body.missionId,r.body.missionId,'a double tap is the same mission');
});
test('redo: only the owner\'s stopped coding tasks; never twice',async()=>{
 assert.equal((await fake({status:'working'}).call({})).body.error,'mission_not_redoable');
 assert.equal((await fake({status:'completed'}).call({})).body.error,'mission_not_redoable');
 assert.equal((await fake({project:'wellbeing'}).call({})).body.error,'mission_not_redoable');
 assert.equal((await fake({owner:'99999999-9999-4999-8999-999999999999'}).call({})).body.error,'mission_not_redoable');
 assert.equal((await fake().call({extra:1})).body.error,'invalid_mission');
 const started=fake({prior:{id:'x',status:'working'}});const r=await started.call({});
 assert.equal(r.body.already,true);assert.ok(!started.calls.some(([,u])=>u.includes('/rpc/')),'an already started redo is not queued again');
});
test('the button is where "needs you" is: the chat note and the Work card',()=>{
 const chat=fs.readFileSync('js/world-dialogue.js','utf8'),work=fs.readFileSync('js/workspace.js','utf8');
 assert.match(chat,/'🔁 Ξαναδοκίμασε'/);assert.match(chat,/await cloud\(\)\.redoMission\(r\.missionId\)/);
 assert.match(chat,/Δεν χρειάζεται να κάνεις τίποτα· θα σου πω το αποτέλεσμα/);
 assert.match(work,/await cloud\(\)\.redoMission\(mission\.id\)/);assert.match(work,/mission\.lastError!=='agent_no_changes'/);
 assert.match(fs.readFileSync('js/cloud.js','utf8'),/async function redoAutonomousMission\(missionId\)/);
 assert.match(fs.readFileSync('server/render-matt.cjs','utf8'),/'\/autonomous\/missions\/redo':'redo'/);
 assert.match(fs.readFileSync('js/resident-status.js','utf8'),/projectId:m\.projectId\|\|null/);
});
