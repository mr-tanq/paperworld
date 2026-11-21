/* Paperworld Task Engine v1 — one deterministic cron-woken dispatcher.
 * No model calls, no user-facing CORS. External mutations only after DB intent
 * reservation. A verified PR is merged ONLY when the owner switched on
 * controller.auto_merge_verified and the trusted workflow proved its exact head.
 */
import {makeTaskGithub} from './github.mjs';
import {taskProject,verifyBoundedSpec} from './projects.mjs';

const URL='https://jrevhzvrgenucuozjowm.supabase.co';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
// "Cause:/Fix:" lines the Developer writes at the top of the PR description,
// reduced to short plain text for Matt's message (owner's own chat only).
function plainLine(body,labels){
 if(typeof body!=='string')return null;
 for(const raw of body.split('\n').slice(0,40)){
  const line=raw.replace(/<[^>]*>/g,'').replace(/[*_`#>]/g,'').trim().replace(/^[-•]\s*/,'');
  const m=line.match(new RegExp('^(?:'+labels.join('|')+')\\s*[:：-]\\s*(.+)$','i'));
  if(m){const text=m[1].replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim();
   return text?text.slice(0,280):null}
 }
 return null;
}
const respond=(status,body)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json','cache-control':'no-store',
 'x-content-type-options':'nosniff'}
});
function createTaskDispatcher({environment,fetcher=fetch,clock=Date.now,batch=1,batchMs=8000}={}){
 const env=k=>environment?.(k);
 function dbKey(){
  try{
   const modern=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default;
   if(typeof modern==='string'&&modern.startsWith('sb_secret_'))return modern;
  }catch(_){}
  const legacy=env('SUPABASE_SERVICE_ROLE_KEY');
  return typeof legacy==='string'&&legacy.length>20?legacy:null;
 }
 async function db(path,method='GET',body){
  const key=dbKey();
  if(!key)throw Error('backend_credential_unavailable');
  const response=await fetcher(URL+'/rest/v1/'+path,{
   method,redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),
     Accept:'application/json','Content-Type':'application/json',
     ...(method==='POST'?{Prefer:'return=representation'}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!response?.ok)throw Error('database_request_failed');
  return response.json();
 }
 async function rpc(name,args={}){
  if(!/^paperworld_v5_[a-z_]+$/.test(name))throw Error('unsupported_database_operation');
  return db('rpc/'+name,'POST',args);
 }
 async function fetchOne(table,selector){
  const rows=await db(table+'?'+new URLSearchParams({...selector,limit:'1'}));
  return Array.isArray(rows)&&rows.length===1?rows[0]:null;
 }
 async function readMission(id){
  const mission=await fetchOne('paperworld_autonomous_missions_v5',{
   select:'id,owner_id,thread_id,goal,project_id,status,engine,spec,policy',id:'eq.'+id});
  if(!mission||mission.engine!=='v1')throw Error('mission_scope_invalid');
  verifyBoundedSpec(mission.spec,mission.project_id);
  return mission;
 }
 async function readSteps(missionId){
  const result=await db('paperworld_autonomous_steps_v5?'+new URLSearchParams({
   select:'id,seq,capability,input,output,state',mission_id:'eq.'+missionId,
   order:'seq.asc',limit:'8'}));
  if(!Array.isArray(result)||result.length!==5)throw Error('mission_step_shape_invalid');
  return result;
 }
 async function readEffect(stepId){
  return fetchOne('paperworld_autonomous_effects_v5',{
   select:'effect_key,step_id,kind,state,external_id,external_url,confirmed_at,evidence,created_at',
   step_id:'eq.'+stepId});
 }
 async function fail(step,worker,reason){
  await rpc('paperworld_v5_fail_step',{p_step:step,p_worker:worker,
   p_reason:reason,p_retryable:false});
  return {state:'needs_you',reason,sessionsStarted:0};
 }
 async function complete(step,worker,output){
  const ok=await rpc('paperworld_v5_finish_task_step',{
   p_step:step,p_worker:worker,p_result:output});
  if(ok!==true)throw Error('task_completion_refused');
 }
 async function reserve(step,worker,key,kind){
  return rpc('paperworld_v5_begin_effect',{p_step:step,p_worker:worker,
   p_key:key,p_adapter:'copilot_agent',p_kind:kind});
 }
 async function confirm(key,worker,ref,done=true){
  if(await rpc('paperworld_v5_confirm_effect',{p_key:key,p_worker:worker,
    p_reference:ref,p_done:done})!==true)
   throw Error('effect_confirmation_refused');
 }
 async function uncertainty(key,worker,code){
  if(await rpc('paperworld_v5_mark_task_uncertain',{p_key:key,p_worker:worker,
   p_reason:code})!==true)throw Error('uncertain_effect_not_persisted');
  return {state:'reconciling',sessionsStarted:0};
 }
 async function pauseBudget(step,worker){
  if(await rpc('paperworld_v5_pause_task_budget',{
   p_step:step,p_worker:worker})!==true)throw Error('budget_pause_failed');
  return {state:'waiting_for_budget',sessionsStarted:0};
 }
 async function pendingReconciliation(gh){
  const rows=await db('paperworld_autonomous_effects_v5?'+new URLSearchParams({
   select:'effect_key,step_id,mission_id,kind,reconcile_attempts,state,created_at',
   state:'eq.uncertain',order:'updated_at.asc',limit:'8'}));
  for(const e of rows){
   if(!UUID.test(e.mission_id)||e.reconcile_attempts>=6)continue;
   let m;
   try{m=await readMission(e.mission_id)}catch(_){continue}
   if(m.status==='completed'||m.status==='cancelled')continue;
   const steps=await readSteps(m.id);
   const issueStep=steps.find(s=>s.capability==='create_issue');
   let evidence=null;
   try{
    if(e.kind==='create_issue'){
     const x=await gh.findExistingIssue(m.project_id,e.effect_key);
     if(x)evidence={proof:'issue_marker_and_number',
      externalId:String(x.number),externalUrl:x.html_url};
    }else if(e.kind==='start_agent'){
     const issueNumber=Number(issueStep?.output?.issueNumber);
     if(Number.isSafeInteger(issueNumber)&&issueNumber>0){
      const r=await gh.reconcileAssignment(m.project_id,{issueNumber,
       effectKey:issueStep.input.effectKey});
      if(r.state==='confirmed')evidence={proof:'issue_marker_and_copilot_assignee',
       externalId:String(issueNumber),externalUrl:'https://github.com/'+
        taskProject(m.project_id).repository+'/issues/'+issueNumber};
     }
    }else if(e.kind==='dispatch_verify'){
     const awaiting=steps.find(x=>x.capability==='await_agent');
     const sha=awaiting?.output?.headSha;
     if(typeof sha==='string'){
      const located=await gh.findDispatchedRun(m.project_id,{
       missionId:m.id,headSha:sha,since:e.created_at});
      if(located.state==='found'){
       const id=located.run.id;
       evidence={proof:'trusted_workflow_run_id',externalId:String(id),
        externalUrl:located.run.html_url,runId:id,headSha:sha,
        mainSha:located.run.head_sha,
        workflowBlob:taskProject(m.project_id).workflowBlob};
      }
     }
    }
   }catch(_){}
   if(evidence){
    const resolved=await rpc('paperworld_v5_reconcile_task_effect',{
     p_key:e.effect_key,p_outcome:'confirmed',p_evidence:evidence});
    if(resolved===true)return {state:'effect_reconciled',sessionsStarted:0};
   }else{
    await rpc('paperworld_v5_reconcile_task_effect',{
     p_key:e.effect_key,p_outcome:'unresolved',p_evidence:{}});
    return {state:'awaiting_external_evidence',sessionsStarted:0};
   }
  }
  return null;
 }
 // Phase 1b: ONE automatic follow-up when the Developer's attempt fails its
 // tests or never delivers. It is a normal new mission (same owner, thread,
 // project, bounded spec) so every budget cap and verification still applies.
 // Deterministic id → a crash or replay can never queue it twice.
 async function retryId(missionId){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',
   new TextEncoder().encode('paperworld-retry:'+missionId))).slice(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
  const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
 }
 async function queueRetry(mission,reason,{prNumber=null,prUrl=null,runUrl=null}={}){
  if(mission.policy?.retryOf||!['trusted_verification_failed','copilot_pr_missing'].includes(reason))
   return {state:'not_retried'};
  if(!UUID.test(mission.thread_id||'')||typeof mission.goal!=='string')return {state:'not_retried'};
  const id=await retryId(mission.id);
  const previous=reason==='trusted_verification_failed'?
   '\n\nPrevious attempt'+(prNumber?' (PR #'+prNumber+')':'')+' failed the required tests'+
    (runUrl?' ('+runUrl+')':'')+'. Start from that work if useful, find why the tests fail and fix it.':
   '\n\nPrevious attempt did not deliver a pull request. Keep the change small and deliver one.';
  const spec={...mission.spec,summary:(String(mission.spec.summary||'').slice(0,800-previous.length)+previous)};
  try{
   const existing=await fetchOne('paperworld_autonomous_missions_v5',{select:'id,status',id:'eq.'+id});
   if(!existing){
    await db('paperworld_autonomous_missions_v5','POST',{id,owner_id:mission.owner_id,
     thread_id:mission.thread_id,project_id:mission.project_id,goal:mission.goal,status:'draft',
     policy:{...(mission.policy||{}),retryOf:mission.id,retryReason:reason}});
   }else if(existing.status!=='draft'&&existing.status!=='planned')return {state:'already_queued',missionId:id};
   const now=await fetchOne('paperworld_autonomous_missions_v5',{select:'id,status',id:'eq.'+id});
   if(now?.status==='draft'&&await rpc('paperworld_v5_plan_task',{p_mission:id,p_spec:spec})!==true)
    return {state:'retry_plan_refused'};
   if(await rpc('paperworld_v5_queue_task',{p_mission:id})!==true)return {state:'retry_queue_refused'};
   return {state:'retry_queued',missionId:id};
  }catch(_){return {state:'retry_failed'}}
 }
 async function runClaim(step,worker,gh,settings={}){
  if(!UUID.test(step?.step_id)||!UUID.test(step?.mission_id)||
   !['create_issue','start_agent','await_agent','verify','report'].includes(step.capability))
   throw Error('invalid_task_claim');
  const mission=await readMission(step.mission_id);
  const project=mission.project_id,spec=mission.spec;
  const config=taskProject(project);
  const steps=await readSteps(mission.id);
  const s=steps.find(x=>x.id===step.step_id);
  if(!s||s.capability!==step.capability)throw Error('step_claim_mismatch');
  const key=s.input?.effectKey;
  if(typeof key!=='string'||!key.startsWith('task-v1:'+mission.id+':'))
   throw Error('effect_key_scope_invalid');
  const issueStep=steps.find(x=>x.capability==='create_issue');
  const startStep=steps.find(x=>x.capability==='start_agent');
  const awaitStep=steps.find(x=>x.capability==='await_agent');
  const verifyStep=steps.find(x=>x.capability==='verify');
  const issue=Number(issueStep?.output?.issueNumber);
  if(step.capability==='create_issue'){
   const state=await reserve(s.id,worker,key,'create_issue');
   if(state==='budget_denied')return pauseBudget(s.id,worker);
   if(state!=='reserved')return fail(s.id,worker,'issue_effect_reservation_denied');
   const brief=spec.summary+'\n\nAcceptance:\n'+
     spec.acceptance.map((x,i)=>'- '+(i+1)+'. '+x).join('\n')+
     '\n\nRequired tests: '+spec.requiredTests.join(', ')+
     '\nAllowed paths: '+spec.allowedPaths.join(', ')+
     '\nDraft PR only. Never modify CI, secrets, deployment or protected files.'+
     '\nIf this reports a problem, find the root cause before changing code.'+
     '\nStart the PR description with two plain Greek lines for the owner:'+
     '\nCause: <one sentence: what was wrong>\nFix: <one sentence: what you changed>';
   const result=await gh.createIssue(project,{effectKey:key,title:spec.title,body:brief});
   if(result.state==='uncertain')return uncertainty(key,worker,'issue_post_uncertain');
   await confirm(key,worker,{externalId:String(result.issueNumber),
    externalUrl:result.issueUrl,proof:'issue_marker_and_number'},true);
   await complete(s.id,worker,{issueNumber:result.issueNumber,issueUrl:result.issueUrl});
   return {state:'issue_created',sessionsStarted:0};
  }
  if(step.capability==='start_agent'){
   if(!Number.isSafeInteger(issue)||issue<1)throw Error('issue_not_confirmed');
   const state=await reserve(s.id,worker,key,'start_agent');
   if(state==='budget_denied')return pauseBudget(s.id,worker);
   if(state!=='reserved')return fail(s.id,worker,'copilot_effect_reservation_denied');
   const result=await gh.assignCopilot(project,{issueNumber:issue,
    effectKey:issueStep.input.effectKey});
   if(result.state==='uncertain')return uncertainty(key,worker,'copilot_assignment_uncertain');
   await confirm(key,worker,{externalId:String(issue),externalUrl:issueStep.output.issueUrl,
    proof:'issue_marker_and_copilot_assignee'},true);
   await complete(s.id,worker,{issueNumber:issue,assignment:result.state,sessionReserved:true});
   return {state:'agent_assigned',sessionsStarted:result.state==='assigned'?1:0};
  }
  if(step.capability==='await_agent'){
   if(!Number.isSafeInteger(issue)||issue<1)throw Error('missing_issue');
   const effect=await readEffect(startStep.id);
   const started=Date.parse(effect?.confirmed_at||'');
   if(!Number.isFinite(started))throw Error('assignment_time_missing');
   const age=clock()-started;
   const found=await gh.findLinkedPr(project,{issueNumber:issue,
    effectKey:issueStep.input.effectKey});
   if(found.state==='ambiguous')return fail(s.id,worker,'ambiguous_copilot_pr');
   if(found.state!=='found'){
    if(age>30*60*1000){
     await queueRetry(mission,'copilot_pr_missing');
     return fail(s.id,worker,'copilot_pr_missing');
    }
    await rpc('paperworld_v5_defer_task_step',{p_step:s.id,p_worker:worker,
     p_seconds:300,p_observation:s.output||{}});
    return {state:'awaiting_agent_pr',sessionsStarted:0};
   }
   const pr=found.pr,sha=pr.head?.sha;
   if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('invalid_pr_head');
   const previous=s.output||{};
   const stable=previous.headSha===sha?
     Number(previous.stableSince||clock()):clock();
   const observation={prNumber:pr.number,prUrl:pr.html_url,
    headSha:sha,stableSince:stable,confirmedStart:effect.confirmed_at};
   if(age>3*60*60*1000)return fail(s.id,worker,'copilot_deadline_exceeded');
   // Fast path: Copilot said it finished AND the head did not move since the
   // previous poll (>= one 5-minute tick). Verification still pins this sha.
   if(previous.headSha===sha&&clock()-stable>=4*60*1000){
    let done={finished:false};
    try{done=await gh.agentFinished(project,pr.number)}catch(_){}
    if(done.finished===true){
     await complete(s.id,worker,{...observation,completion:'trusted_signal',
      signal:done.signal,stableHead:true});
     return {state:'agent_finished_waiting_verify',sessionsStarted:0};
    }
   }
   // Fallback when no finish signal is visible: the original conservative rule.
   if(age>=75*60*1000&&clock()-stable>=20*60*1000){
    await complete(s.id,worker,{...observation,
     completion:'conservative_fallback',stableHead:true});
    return {state:'agent_finished_waiting_verify',sessionsStarted:0};
   }
   await rpc('paperworld_v5_defer_task_step',{p_step:s.id,p_worker:worker,
    p_seconds:300,p_observation:observation});
   return {state:'awaiting_stable_head',sessionsStarted:0};
  }
  if(step.capability==='verify'){
   const sha=awaitStep?.output?.headSha;
   const prNumber=awaitStep?.output?.prNumber;
   if(!/^[a-f0-9]{40}$/i.test(sha||'')||
    !Number.isSafeInteger(prNumber))throw Error('unverified_pr_identity');
   const pr=await gh.getPull(project,prNumber);
   if(pr?.head?.sha!==sha||pr?.draft!==true||pr?.state!=='open')
    return fail(s.id,worker,'pr_head_changed_before_verify');
   // A Developer who investigated and changed nothing, or who touched files
   // outside the allowed scope, is a clear outcome for the owner — never an
   // error loop. Matt explains it in plain words.
   try{await gh.assertScopedChanges(project,prNumber,spec.allowedPaths,spec.maxFiles)}
   catch(error){
    if(error?.message==='file_count_denied'){
     const count=await gh.changedFileCount(project,prNumber);
     return fail(s.id,worker,count===0?'agent_no_changes':'agent_too_many_files');
    }
    if(error?.message==='file_policy_denied')return fail(s.id,worker,'agent_files_out_of_scope');
    throw error;
   }
   const pin=await gh.trustedMain(project,config.workflowBlob);
   let effect=await readEffect(s.id);
   if(!effect){
    const state=await reserve(s.id,worker,key,'dispatch_verify');
    if(state==='budget_denied')return pauseBudget(s.id,worker);
    if(state!=='reserved')return fail(s.id,worker,'verification_effect_reservation_denied');
    const submitted=await gh.dispatchVerify(project,{missionId:mission.id,
     headSha:sha,requiredTests:spec.requiredTests});
    if(submitted.state==='uncertain')return uncertainty(key,worker,'verify_dispatch_uncertain');
    const receipt={externalId:String(submitted.runId),
     runId:submitted.runId,externalUrl:'https://github.com/'+config.repository+
      '/actions/runs/'+submitted.runId,runUrl:'https://github.com/'+config.repository+
      '/actions/runs/'+submitted.runId,
     headSha:sha,mainSha:pin.mainSha,workflowBlob:pin.workflowBlob};
    await confirm(key,worker,receipt,false);
    await rpc('paperworld_v5_defer_task_step',{p_step:s.id,p_worker:worker,
     p_seconds:300,p_observation:receipt});
    return {state:'verification_dispatched',sessionsStarted:0};
   }
   if(effect.state!=='started')throw Error('verify_effect_requires_reconciliation');
   const proof=effect.evidence||{};
   const runId=Number(effect.external_id);
   if(!Number.isSafeInteger(runId)||!/^[a-f0-9]{40}$/i.test(proof.mainSha||'')||
    proof.headSha!==sha||proof.workflowBlob!==config.workflowBlob)
    throw Error('verify_effect_receipt_invalid');
   const rawRun=await gh.getRun(project,runId);
   if(rawRun?.status==='completed'&&rawRun.conclusion!=='success'){
    await queueRetry(mission,'trusted_verification_failed',{prNumber,
     prUrl:awaitStep.output?.prUrl,runUrl:proof.runUrl});
    return fail(s.id,worker,'trusted_verification_failed');
   }
   const elapsed=clock()-Date.parse(effect.confirmed_at||'');
   if(Number.isFinite(elapsed)&&elapsed>2*60*60*1000)
    return fail(s.id,worker,'trusted_verification_timed_out');
   if(rawRun?.status!=='completed'){
    await rpc('paperworld_v5_defer_task_step',{p_step:s.id,p_worker:worker,
     p_seconds:300,p_observation:proof});
    return {state:'verifying',sessionsStarted:0};
   }
   await gh.getVerifiedRun(project,{runId,headSha:sha,mainSha:proof.mainSha});
   const proofTests=await gh.readTrustedAttestation(project,{runId,headSha:sha,
    mainSha:proof.mainSha,missionId:mission.id,requiredTests:spec.requiredTests});
   const latest=await gh.getPull(project,prNumber);
   if(latest.head?.sha!==sha)return fail(s.id,worker,'pr_head_moved_after_verify');
   const final={externalId:String(runId),runId,headSha:sha,
    verification:'trusted',requiredTests:proofTests.requiredTests,
    runUrl:proof.runUrl,prUrl:awaitStep.output.prUrl};
   await confirm(key,worker,final,true);
   await complete(s.id,worker,final);
   return {state:'verified',sessionsStarted:0};
  }
  if(step.capability==='report'){
   const v=verifyStep?.output||{};
   const prNumber=awaitStep?.output?.prNumber;
   if(v.verification!=='trusted'||!Number.isSafeInteger(prNumber))
    return fail(s.id,worker,'trusted_verification_missing');
   const pr=await gh.getPull(project,prNumber);
   // A retry after a successful merge sees the merged PR at the verified head.
   const mergedEarlier=pr?.merged===true&&pr.head?.sha===v.headSha;
   if(!mergedEarlier&&(pr?.state!=='open'||pr.head?.sha!==v.headSha))
    return fail(s.id,worker,'pr_head_moved_after_verification');
   let merge={state:'not_enabled'};
   if(settings.autoMerge===true){
    merge=await gh.mergeVerified(project,{prNumber,headSha:v.headSha,title:spec.title});
    if(merge.state==='head_moved')return fail(s.id,worker,'pr_head_moved_after_verification');
   }
   const merged=merge.state==='merged';
   const outcome={title:spec.title,projectId:project,
    prUrl:awaitStep.output.prUrl,runUrl:v.runUrl,
    headSha:v.headSha,headStillCurrent:true,
    requiredTests:v.requiredTests,sessionsReserved:1,
    merged,mergeState:merge.state,...(merged?{mergeSha:merge.mergeSha}:{}),
    ...(merge.reason?{mergeBlockedReason:merge.reason}:{}),
    cause:plainLine(pr?.body,['cause','αιτία','αιτια','τι έφταιγε']),
    fix:plainLine(pr?.body,['fix','διόρθωση','διορθωση','τι αλλάξαμε']),
    summary:merged?'Verified by the trusted main workflow and merged automatically.':
     'PR checked by the trusted main workflow; review before merging.'};
   await complete(s.id,worker,outcome);
   return {state:'completed',missionId:mission.id,sessionsStarted:0};
  }
  throw Error('unknown_task_capability');
 }
 async function processOnce(){
  const row=await fetchOne('paperworld_autonomous_controller_v5',{
   select:'engine,dispatch_enabled,live_adapters,auto_merge_verified',singleton:'eq.true'});
  if(!row||row.engine!=='v1'||row.dispatch_enabled!==true||
   !row.live_adapters?.includes('copilot_agent'))
   return {state:'disabled',sessionsStarted:0};
  await rpc('paperworld_v5_resume_due_budget');
  const gh=makeTaskGithub({fetcher,token:env('GITHUB_COPILOT_USER_TOKEN')});
  const recovered=await pendingReconciliation(gh);
  if(recovered)return recovered;
  const worker=crypto.randomUUID();
  const claimed=await rpc('paperworld_v5_claim_task_step',{
   p_worker:worker,p_lease_seconds:600});
  if(!Array.isArray(claimed)||claimed.length===0)
   return {state:'idle',sessionsStarted:0};
  if(claimed.length!==1)throw Error('multiple_steps_claimed');
  return runClaim(claimed[0],worker,gh,{autoMerge:row.auto_merge_verified===true});
 }
 // Several ready steps per wake-up (at most 4, none started after 8 s: the
 // cron call waits 12 s), so two missions no longer queue behind each other.
 async function processBatch(){
  const started=clock();let result=null,steps=0;
  while(steps<Math.max(1,batch)){
   result=await processOnce();steps++;
   // Reconciliation counts its attempts: never spend more than one per wake-up.
   if(!result||['idle','disabled','awaiting_external_evidence','effect_reconciled','reconciling']
     .includes(result.state)||clock()-started>batchMs)break;
  }
  return steps>1?{...result,steps}:result;
 }
 async function handle(request){
  if(request.method!=='POST')return respond(405,{error:'method_not_allowed'});
  const secret=env('PAPERWORLD_DISPATCH_TRIGGER_SECRET');
  if(!secret||secret.length<32||!dbKey()||
   !env('GITHUB_COPILOT_USER_TOKEN'))
   return respond(503,{error:'credentials_unavailable'});
  if(request.headers.get('authorization')!=='Bearer '+secret)
   return respond(401,{error:'unauthorized'});
  try{return respond(200,await processBatch())}
  catch(_){return respond(503,{error:'v1_dispatch_requires_reconciliation'})}
 }
 return Object.freeze({handle,processOnce});
}
export {createTaskDispatcher};
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function'){
 Deno.serve(createTaskDispatcher({environment:k=>Deno.env.get(k),batch:4}).handle);
}
