/* PAPERWORLD V5: project-scoped, pure orchestration contract.
 * No model calls, persistence, OAuth, network, tools, timers or side effects.
 * A server may use this policy, but MUST independently authenticate owner,
 * verify an exact consent/approval receipt and enforce tool authorization.
 */
'use strict';
const {randomUUID}=require('node:crypto');
const PROJECTS=Object.freeze({
 listening:Object.freeze({name:'Listening Mirror',director:'listening-director',workers:Object.freeze({
  'listening-developer':Object.freeze(['source_read','analysis','draft_proposal'])})}),
 pokemon:Object.freeze({name:'Pokémon Echoes',director:'pokemon-director',workers:Object.freeze({
  'pokemon-developer':Object.freeze(['source_read','analysis','draft_proposal'])})}),
 studio:Object.freeze({name:'The Lost Wanderer',director:'studio-director',workers:Object.freeze({
  'studio-creative':Object.freeze(['analysis','creative_brief'])})}),
 wellbeing:Object.freeze({name:'Wellbeing',director:'wellbeing-director',workers:Object.freeze({
  'wellbeing-research':Object.freeze(['analysis'])})})
});
const STATES=Object.freeze(['queued','assigned','awaiting_consent','ready','running','review','completed','failed','cancelled']);
const TERMINAL=new Set(['completed','failed','cancelled']);
const TRANSITIONS=Object.freeze({
 queued:['assigned','cancelled'],assigned:['awaiting_consent','cancelled'],
 awaiting_consent:['ready','cancelled'],ready:['running','cancelled'],
 running:['review','failed','cancelled'],review:['completed','failed','cancelled'],
 completed:[],failed:[],cancelled:[]
});
const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const safe=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const immutable=x=>Object.freeze(x);
function registry(project){
 const p=PROJECTS[project];if(!p)throw Error('unknown_project');
 return p;
}
function validateAssignment({project,director,worker,capability}={}){
 const p=registry(project);
 if(director!==p.director||!Object.hasOwn(p.workers,worker)||
  !p.workers[worker].includes(capability))throw Error('unauthorized_assignment');
 // Cross-project health material is never available to other directors.
 return immutable({project,director,worker,capability});
}
function createJob({id=randomUUID(),ownerId,threadId,request,project}={}){
 if(!ID.test(id)||!ID.test(ownerId||'')||!ID.test(threadId||'')||
  !safe(request,1200))throw Error('invalid_job');
 registry(project);
 return immutable({id,ownerId,threadId,request:request.trim(),project,
  state:'queued',revision:0,assignment:null,consent:null,result:null,
  events:immutable([immutable({revision:0,state:'queued',actor:'matt',proof:'accepted'})])});
}
function advance(job,{revision,state,actor,assignment=null,consent=null,result=null,proof}={}){
 if(!job||!ID.test(job.ownerId||'')||!Number.isSafeInteger(revision)||
  revision!==job.revision||!TRANSITIONS[job.state]?.includes(state)||
  !safe(proof,160)||job.events.length>=40)throw Error('invalid_transition');
 const next=revision+1;
 let selected=job.assignment;
 if(state==='assigned'){
  if(actor!=='matt'||!assignment)throw Error('assignment_required');
  selected=validateAssignment({...assignment,project:job.project});
 }else if(state==='awaiting_consent'){
  if(actor!==selected?.director)throw Error('director_required');
 }else if(state==='ready'){
  if(actor!=='owner'||!consent||consent.jobId!==job.id||
   consent.revision!==revision||consent.capability!==selected.capability||
   !ID.test(consent.grantId||'')||consent.authorized!==true)
   throw Error('fresh_consent_required');
 }else if(state==='running'){
  if(actor!==selected?.worker||!job.consent)throw Error('worker_required');
 }else if(state==='review'){
  if(actor!==selected?.director||!result||result.verified!==true||
   !safe(result.summary,800))throw Error('verified_result_required');
 }else if(state==='completed'){
  if(actor!=='matt'||!job.result?.verified)throw Error('verified_result_required');
 }else if(state==='failed'){
  if(![selected?.worker,selected?.director,'matt'].includes(actor))throw Error('invalid_actor');
 }else if(state==='cancelled'){
  if(actor!=='owner')throw Error('owner_cancel_required');
 }
 const entry=immutable({revision:next,state,actor,proof:proof.trim()});
 return immutable({...job,state,revision:next,assignment:selected,
  consent:state==='ready'?immutable({
   grantId:consent.grantId,jobId:job.id,revision,
   capability:selected.capability,authorized:true}):job.consent,
  result:state==='review'?immutable({verified:true,summary:result.summary.trim()}):job.result,
  events:immutable([...job.events,entry])});
}
function nextAction(job){
 if(!job||!PROJECTS[job.project])throw Error('invalid_job');
 return immutable({
  queued:'assign_director',assigned:'director_scope',awaiting_consent:'ask_owner',
  ready:'worker_may_start_with_server_verification',
  running:'await_verified_worker_result',review:'matt_report',
  completed:'none',failed:'owner_retry_as_new_job',cancelled:'none'
 }[job.state]?{state:job.state,action:{
  queued:'assign_director',assigned:'director_scope',awaiting_consent:'ask_owner',
  ready:'worker_may_start_with_server_verification',
  running:'await_verified_worker_result',review:'matt_report',
  completed:'none',failed:'owner_retry_as_new_job',cancelled:'none'
 }[job.state],terminal:TERMINAL.has(job.state)}:null);
}
function resumeDecision(job,{expectedRevision,serverApproved=false}={}){
 if(!job||!ID.test(job.id||'')||!Number.isSafeInteger(expectedRevision)||
  expectedRevision!==job.revision)throw Error('stale_job_revision');
 if(TERMINAL.has(job.state))return immutable({action:'none',reason:'terminal'});
 // The pure coordinator never resumes execution automatically. For a ready job,
 // only a trusted backend revalidating an exact one-use owner grant may resume.
 if(job.state==='ready'&&serverApproved===true&&job.consent?.authorized===true)
  return immutable({action:'request_server_execution',reason:'revalidate_owner_grant'});
 return immutable({action:'manual_review',reason:'no_unattended_execution'});
}
module.exports=immutable({PROJECTS,STATES,validateAssignment,createJob,advance,nextAction,resumeDecision});
