/* PAPERWORLD: inert, owner-reviewable Listening Mirror change proposals.
 * Validates proposed text edits only. NO GitHub writes, model calls or execution.
 */
'use strict';
const {FILES,OWNER,REPO,REF}=require('./listening-repo-reader.cjs');
const CR=/^[a-f0-9]{40}$/i, UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ALLOWED=new Set(Object.values(FILES).flat());
function validText(x,max){return typeof x==='string'&&x.trim().length>0&&
 x.length<=max&& !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x)}
function validateChangeProposal({job,proposal,evidence}={}){
 // This is just a schema check. No owner approval or write permission is granted.
 if(!job||!UUID.test(job.id||'')||job.project!=='Listening Mirror'||
  job.directorId!=='listening-director'||job.workerId!=='listening-developer'||
  job.approvedForProposal!==true)throw Error('job_proposal_not_authorized');
 if(!proposal||typeof proposal!=='object'||Array.isArray(proposal)||
  proposal.jobId!==job.id||proposal.repository!==OWNER+'/'+REPO||
  proposal.baseRef!==REF||!validText(proposal.summary,500)||
  !Array.isArray(proposal.edits)||proposal.edits.length<1||proposal.edits.length>3)
  throw Error('invalid_change_proposal');
 if(!evidence||evidence.repository!==OWNER+'/'+REPO||evidence.ref!==REF||
  evidence.readOnly!==true||!Array.isArray(evidence.files))
  throw Error('verified_evidence_required');
 const sources=new Map(evidence.files.map(f=>[f.path,f]));
 const used=new Set(),edits=[];
 for(const edit of proposal.edits){
  if(!edit||typeof edit!=='object'||Array.isArray(edit)||
   !ALLOWED.has(edit.path)||used.has(edit.path)||
   !CR.test(edit.expectedSha||'')||!validText(edit.replacement,12000))
   throw Error('invalid_proposed_edit');
  const source=sources.get(edit.path);
  if(!source||source.sha!==edit.expectedSha||!Array.isArray(source.lines)&&
   typeof source.lines!=='string')throw Error('source_revision_mismatch');
  if(edit.replacement.length>12000)throw Error('edit_too_large');
  used.add(edit.path);
  edits.push(Object.freeze({path:edit.path,expectedSha:edit.expectedSha,
   replacement:edit.replacement}));
 }
 return Object.freeze({kind:'paperworld-listening-change-proposal-v1',
  jobId:job.id,repository:OWNER+'/'+REPO,baseRef:REF,
  summary:proposal.summary.trim(),edits:Object.freeze(edits),
  execution:'none',approvalRequired:true,canWrite:false,canDeploy:false});
}
module.exports=Object.freeze({validateChangeProposal});
