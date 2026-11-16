/* Verified, inert Pokémon code proposal. AI output is untrusted data and
 * cannot authorize GitHub writes. Only exact source-backed small GDScript edits.
 */
'use strict';
const {createHash}=require('node:crypto');
const TAG='PAPERWORLD_POKEMON_PATCH_V1:';
const REPO='mr-tanq/pokemon-echoes',REF='main';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{40}$/i;
const FILES=Object.freeze([
 'player.gd','scripts/alder_route_gate_v1.gd',
 'scripts/battle_test_trigger.gd','scripts/inventory_manager_v1.gd',
 'scripts/npc.gd'
]);
function validateProposal({jobId,proposal,evidence}={}){
 if(!UUID.test(jobId||'')||!proposal||typeof proposal!=='object'||
  Array.isArray(proposal)||!evidence||evidence.repository!==REPO||
  evidence.ref!==REF||evidence.readOnly!==true||
  !Array.isArray(evidence.files)||evidence.files.length>4)
  throw Error('invalid_pokemon_proposal');
 if(Object.keys(proposal).sort().join(',')!=='baseRef,edits,jobId,repository,summary'||
  proposal.jobId!==jobId||proposal.repository!==REPO||
  proposal.baseRef!==REF||typeof proposal.summary!=='string'||
  !proposal.summary.trim()||proposal.summary.length>300||
  !Array.isArray(proposal.edits)||proposal.edits.length!==1)
  throw Error('invalid_pokemon_proposal');
 const edit=proposal.edits[0];
 const orig=evidence.files.find(f=>f.path===edit?.path);
 if(!edit||Object.keys(edit).sort().join(',')!=='expectedSha,path,replacement'||
  !FILES.includes(edit.path)||!orig||!SHA.test(edit.expectedSha||'')||
  orig.sha!==edit.expectedSha||typeof orig.lines!=='string'||
  typeof edit.replacement!=='string'||!edit.replacement.trim()||
  edit.replacement.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(edit.replacement)||
  !/^extends (?:Node|Node2D|CharacterBody2D|StaticBody2D|Area2D)\b/m.test(edit.replacement))
  throw Error('invalid_pokemon_patch');
 const plan=Object.freeze({kind:'paperworld-pokemon-code-proposal-v5',
  jobId,repository:REPO,baseRef:REF,summary:proposal.summary.trim(),
  edits:Object.freeze([Object.freeze({path:edit.path,
   expectedSha:edit.expectedSha,replacement:edit.replacement})]),
  execution:'none',approvalRequired:true,canWrite:false,canDeploy:false});
 return plan;
}
function digestPlan(plan){
 if(!plan||plan.kind!=='paperworld-pokemon-code-proposal-v5'||
  !UUID.test(plan.jobId||'')||plan.repository!==REPO||
  plan.baseRef!==REF||plan.execution!=='none'||plan.edits?.length!==1)
  throw Error('invalid_pokemon_plan');
 return createHash('sha256').update(JSON.stringify({
  version:5,jobId:plan.jobId,repository:plan.repository,
  baseRef:plan.baseRef,summary:plan.summary,
  edits:plan.edits.map(x=>({path:x.path,expectedSha:x.expectedSha,
   replacement:x.replacement}))
 }),'utf8').digest('hex');
}
function parseProposal(report,{jobId,evidence}={}){
 if(typeof report!=='string'||report.length>16000)return null;
 const at=report.lastIndexOf(TAG);
 if(at<0||report.indexOf(TAG)!==at)return null;
 let raw=report.slice(at+TAG.length).trim();
 if(!raw||raw.length>6500)return null;
 if(raw.startsWith('```')){
  const match=/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(raw);
  if(!match)return null;
  raw=match[1].trim();
 }
 let obj;try{obj=JSON.parse(raw)}catch(_){return null}
 try{return validateProposal({jobId,proposal:obj,evidence})}catch(_){return null}
}
module.exports=Object.freeze({TAG,FILES,REPO,REF,validateProposal,digestPlan,parseProposal});
