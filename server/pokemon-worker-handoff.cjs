/* Pokémon Echoes Worker v1: pure proposed handoff, no AI, network or writes.
 * Human approves future investigation separately from any file or PR action.
 */
'use strict';
const {proposeHandoff}=require('../js/agents.js');
const REPOSITORY='mr-tanq/pokemon-echoes';
const PROJECT='pokemon';
const OPERATIONS=Object.freeze(['investigate','summarize','plan','review']);
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function reject(code){const e=new Error(code);e.code=code;throw e}
function preparePokemonWorkerHandoff({taskId,ownerId,request,operation='plan'}={}){
 if(!UUID.test(taskId||'')||!UUID.test(ownerId||'')||
  typeof request!=='string'||!request.trim()||request.length>1200||
  !OPERATIONS.includes(operation))reject('pokemon_worker_invalid_request');
 const handoff=proposeHandoff({
  from:'pokemon-director',to:'pokemon-developer',project:PROJECT,
  operation,request:request.trim(),
  context:'Owner-approved Pokémon Echoes history is project-scoped. '+
   'Historical notes are not proof of current code. Verify private repository '+
   'files independently before recommending edits; no tool execution.'
 });
 if(handoff.execution!=='none'||handoff.requiresHumanApproval!==true||
  handoff.state!=='proposed')reject('pokemon_worker_invalid_handoff');
 return Object.freeze({
  taskId,ownerId,repository:REPOSITORY,ref:'main',
  projectId:PROJECT,directorId:'pokemon-director',
  workerId:'pokemon-developer',state:'proposed',
  operation,handoff,readOnly:true,requiresHumanApproval:true,
  aiTurns:0,modelCalls:0,
  permittedNextStep:'read_project_configuration_after_separate_consent',
  blocked:Object.freeze([
   'repository_write','branch_create','draft_pr_create','merge',
   'deployment','shell_execution','paid_ai','health_data_access'
  ])
 });
}
module.exports=Object.freeze({preparePokemonWorkerHandoff,REPOSITORY,PROJECT});
