/* PAPERWORLD Director Memory v1 — deterministic project isolation.
 * No model, network, persistence or secret access. This module is not an
 * authorization to write code, spend credits or execute agent tools.
 */
'use strict';
const {AGENTS,PROJECTS}=require('../js/agents.js');
const PROJECT_IDS=Object.freeze(Object.keys(PROJECTS));
const DIRECTORS=Object.freeze(Object.fromEntries(
 Object.entries(AGENTS).filter(([,a])=>a.role==='director')
  .map(([id,a])=>[id,a.project])));
const KINDS=Object.freeze(['project_bible','decision','preference','current_state','work_history']);
const SOURCE_TYPES=Object.freeze(['project_file','conversation','owner_note','verified_result']);
const STATUS=Object.freeze(['proposed','approved','rejected','superseded']);
const SENSITIVITY=Object.freeze(['standard','private']);
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const CODE=/^[a-z0-9][a-z0-9_-]{0,63}$/;
function fail(code){const error=new Error(code);error.code=code;throw error}
function textField(value,max){if(typeof value!=='string'||!value.trim()||
 value.length>max||/[\u0000-\u001f\u007f]/.test(value))fail('invalid_memory_text');
 return value.trim()}
function projectForActor(actor){
 if(actor==='matt')return 'town';
 if(typeof actor!=='string'||!Object.prototype.hasOwnProperty.call(AGENTS,actor))
  fail('unknown_agent');
 return AGENTS[actor].project;
}
function authorizedProject(actor,project,{explicitHandoff=false}={}){
 if(!PROJECT_IDS.includes(project))return false;
 if(actor==='human')return true;
 if(actor==='matt')return project==='town'||explicitHandoff===true;
 return !!(Object.prototype.hasOwnProperty.call(AGENTS,actor)&&
  AGENTS[actor].project===project);
}
function validateEntry(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  !ID.test(input.id||'')||!PROJECT_IDS.includes(input.projectId)||
  !KINDS.includes(input.kind)||!STATUS.includes(input.status)||
  !SOURCE_TYPES.includes(input.sourceType)||
  !SENSITIVITY.includes(input.sensitivity)||
  !Number.isSafeInteger(input.version)||input.version<1||
  input.version>999999||
  typeof input.sourceRef!=='string'||input.sourceRef.length>400||
  !input.sourceRef.trim()||
  typeof input.observedAt!=='string'||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.observedAt)||
  !Number.isFinite(Date.parse(input.observedAt)))
  fail('invalid_memory_record');
 const title=textField(input.title,140),body=textField(input.body,4000);
 const sourceRef=textField(input.sourceRef,400);
 // All content is data. No links in content grant permissions or prove work.
 return Object.freeze({
  id:input.id,projectId:input.projectId,kind:input.kind,status:input.status,
  title,body,sourceType:input.sourceType,sourceRef,
  observedAt:new Date(input.observedAt).toISOString(),version:input.version,
  sensitivity:input.sensitivity
 });
}
function prepareProposal(input,{actor}={}){
 if(typeof actor!=='string'||!Object.prototype.hasOwnProperty.call(AGENTS,actor)||
  actor==='matt'&&input?.projectId!=='town'||
  !authorizedProject(actor,input?.projectId))fail('cross_project_proposal_denied');
 const entry=validateEntry({...input,status:'proposed'});
 if(entry.status!=='proposed')fail('proposal_required');
 return entry;
}
function memoryTerms(value){
 if(typeof value!=='string')return [];
 return [...new Set((value.toLocaleLowerCase().match(/[\\p{L}\\p{N}]{3,}/gu)||[])
  .filter(x=>x.length<=48))].slice(0,40);
}
function rankMemories(records,query){
 const terms=memoryTerms(query);
 if(!terms.length)return records;
 return records.map((entry,index)=>{
  const title=entry.title.toLocaleLowerCase();
  const body=entry.body.toLocaleLowerCase();
  let score=0;
  for(const term of terms){
   if(title.includes(term))score+=8;
   if(body.includes(term))score+=2;
  }
  if(entry.kind==='project_bible')score+=1;
  return {entry,index,score};
 }).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.entry);
}
function projectContext(entries,{actor,projectId,explicitHandoff=false,
 workerTaskApproved=false,maxChars=8000,query=''}={}){
 if(!authorizedProject(actor,projectId,{explicitHandoff})||
  !Number.isInteger(maxChars)||maxChars<256||maxChars>12000||
  !Array.isArray(entries)||entries.length>200)
  fail('memory_access_denied');
 if(!entries.every(e=>e&&e.projectId===projectId))fail('mixed_project_records_denied');
 const role=actor==='human'?'human':actor==='matt'?'chief':AGENTS[actor]?.role;
 if(role==='worker'&&workerTaskApproved!==true)fail('worker_memory_grant_required');
 if(!['human','chief','director','worker'].includes(role))fail('memory_access_denied');
 const usable=rankMemories(entries.map(validateEntry).filter(e=>e.status==='approved'&&
  (e.sensitivity==='standard'||role==='human'||role==='director')),query);
 const chunks=[];let used=0;
 for(const item of usable){
  const value='['+item.kind+' | '+item.title+' | '+item.sourceType+': '+
   item.sourceRef+' | v'+item.version+']\n'+item.body;
  if(used+value.length>maxChars)continue;
  chunks.push(value);used+=value.length+2;
 }
 return Object.freeze({projectId,actor,untrustedContent:true,
  text:chunks.join('\n\n'),included:chunks.length,
  truncated:chunks.length<usable.length,capabilitiesGranted:[]});
}
module.exports=Object.freeze({
 PROJECT_IDS,DIRECTORS,KINDS,SOURCE_TYPES,STATUS,SENSITIVITY,
 projectForActor,authorizedProject,validateEntry,prepareProposal,projectContext
});
