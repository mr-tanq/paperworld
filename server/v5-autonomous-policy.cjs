/* Shared autonomous village policy, no IO and no model calls.
 * The same engine serves every Director. Role personas are NOT independent
 * trusted processes. All side effects are blocked until explicit capability
 * policies and verified server grants exist.
 */
'use strict';
const {randomUUID}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const PROJECTS=Object.freeze({
 listening:Object.freeze({director:'listening-director',role:'Luna',output:'draft_pr',
  allowed:Object.freeze(['plan','read_repo','write_branch','run_tests','draft_pr']),
  repository:'mr-tanq/concerts'}),
 pokemon:Object.freeze({director:'pokemon-director',role:'Joey',output:'draft_pr',
  allowed:Object.freeze(['plan','read_repo','write_branch','run_tests','draft_pr']),
  repository:'mr-tanq/pokemon-echoes'}),
 studio:Object.freeze({director:'studio-director',role:'Crow',output:'private_draft',
  allowed:Object.freeze(['plan','draft_lyrics','draft_brief','research_public']),
  repository:null}),
 wellbeing:Object.freeze({director:'wellbeing-director',role:'Dave',output:'private_draft',
  allowed:Object.freeze(['plan','draft_plan','research_public']),
  repository:null})
});
const RESTRICTED=Object.freeze(['merge','deploy','publish','send_email','send_message',
 'external_health_data','paid_suno','purchase','unlimited_ai','run_untrusted_code_with_secrets']);
const STATUSES=Object.freeze(['draft','queued','running','needs_you','paused_budget','completed','failed','cancelled']);
const STEPS=Object.freeze(['pending','ready','leased','running','succeeded','retry_wait','failed','skipped']);
const TRANSITIONS=Object.freeze({
 draft:['queued','cancelled'],queued:['running','needs_you','cancelled'],
 running:['needs_you','paused_budget','completed','failed','cancelled'],
 needs_you:['queued','cancelled'],paused_budget:['queued','cancelled'],
 completed:[],failed:[],cancelled:[]
});
const safe=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
function project(id){if(!Object.hasOwn(PROJECTS,id))throw Error('unknown_project');return PROJECTS[id]}
function missionSpec({id=randomUUID(),ownerId,threadId,projectId,goal,limit={}}={}){
 const p=project(projectId);
 if(![id,ownerId,threadId].every(s=>UUID.test(s||''))||!safe(goal,1200))
  throw Error('invalid_mission');
 const maxSteps=limit.maxSteps===undefined?4:limit.maxSteps;
 const maxAiCalls=limit.maxAiCalls===undefined?0:limit.maxAiCalls;
 const maxAttempts=limit.maxAttempts===undefined?2:limit.maxAttempts;
 if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>8||
  !Number.isInteger(maxAiCalls)||maxAiCalls<0||maxAiCalls>8||
  !Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)
  throw Error('unsafe_limit');
 return Object.freeze({id,ownerId,threadId,projectId,director:p.director,
  goal:goal.trim(),status:'draft',output:p.output,
  policy:Object.freeze({maxSteps,maxAiCalls,maxAttempts,
   permissions:Object.freeze([]),additionalSpendUsd:0,
   noAutoMerge:true,noAutoDeploy:true})});
}
function capability(projectId,action,{approved=false,verifiedBudget=false}={}){
 const p=project(projectId);
 if(RESTRICTED.includes(action))return Object.freeze({allowed:false,reason:'separate_approval_required'});
 if(!p.allowed.includes(action))return Object.freeze({allowed:false,reason:'project_capability_denied'});
 if(!approved)return Object.freeze({allowed:false,reason:'mission_authorization_required'});
 if(action==='plan'&&verifiedBudget!==true)
  return Object.freeze({allowed:false,reason:'ai_budget_unverified'});
 // Tool execution needs backend checks as well as these static capabilities.
 return Object.freeze({allowed:true,reason:'backend_must_revalidate'});
}
function transition(from,to){
 if(!STATUSES.includes(from)||!STATUSES.includes(to)||
  !TRANSITIONS[from].includes(to))throw Error('invalid_mission_transition');
 return Object.freeze({from,to});
}
function classification(projectId,action){
 const p=project(projectId);
 return Object.freeze({projectId,role:p.role,director:p.director,
  output:p.output,capability:capability(projectId,action)});
}
module.exports=Object.freeze({PROJECTS,RESTRICTED,STATUSES,STEPS,
 missionSpec,capability,transition,classification});
