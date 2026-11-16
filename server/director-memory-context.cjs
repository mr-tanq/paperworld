/* Trusted Director Memory context bridge; no AI/tool execution.
 * Only server-established owner identity, agent and task grant are accepted.
 * User-authenticated reads are filtered per project and checked again here.
 */
'use strict';
const {projectForActor,projectContext,authorizedProject}=
 require('./director-memory-policy.cjs');
function deny(code){const e=new Error(code);e.code=code;throw e}
function createDirectorMemoryContext({store,authenticate}={}){
 if(typeof store?.list!=='function'||typeof authenticate!=='function')
  deny('trusted_context_dependencies_required');
 async function load({token,ownerId,actor,projectId,taskGrant=null,query=''}={}){
  const verified=await authenticate(token);
  if(!verified?.ownerId||verified.ownerId!==ownerId)
   deny('memory_owner_denied');
  const isMatt=actor==='matt';
  if(actor==='human'||!authorizedProject(actor,projectId,{
   explicitHandoff:isMatt&&taskGrant?.projectId===projectId&&
    taskGrant?.actor==='matt'&&taskGrant?.ownerId===ownerId&&
    taskGrant?.approved===true
  }))deny('memory_agent_scope_denied');
  const own=projectForActor(actor);
  const worker=actor.endsWith('-developer');
  const hasWorkerGrant=worker&&taskGrant?.ownerId===ownerId&&
   taskGrant?.actor===actor&&taskGrant?.projectId===projectId&&
   taskGrant?.approved===true;
  if(!isMatt&&own!==projectId)deny('memory_agent_scope_denied');
  if(worker&&!hasWorkerGrant)deny('memory_worker_task_grant_denied');
  const rows=await (typeof store.listRelevant==='function'?store.listRelevant({token,ownerId,projectId}):
   store.list({token,ownerId,projectId}));
  if(!Array.isArray(rows)||rows.length>400||
   rows.some(r=>r.projectId!==projectId))deny('memory_cross_project_response_denied');
  return projectContext(rows,{actor,projectId,
   explicitHandoff:isMatt&&taskGrant?.approved===true&&
    taskGrant?.actor==='matt'&&taskGrant?.projectId===projectId,
   workerTaskApproved:hasWorkerGrant,maxChars:6000,query});
 }
 return Object.freeze({load});
}
module.exports=Object.freeze({createDirectorMemoryContext});
