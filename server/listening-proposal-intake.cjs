/* PAPERWORLD — verified Listening Mirror proposal intake (read-only).
 * A worker's text is untrusted. Accept one bounded JSON envelope ONLY after
 * source SHA and exact owner-scoped job review. Never grants permission to write.
 */
'use strict';
const {validateChangeProposal}=require('./listening-change-proposal.cjs');
const TAG='PAPERWORLD_CHANGE_PROPOSAL_V1:';
function parseWorkerProposal(report,{job,evidence}={}){
 if(typeof report!=='string'||report.length>16000||!job||!evidence)return null;
 const at=report.lastIndexOf(TAG);
 if(at<0||report.indexOf(TAG)!==at)return null;
 let raw=report.slice(at+TAG.length).trim();
 if(!raw||raw.length>13500)return null;
 // An otherwise exact JSON code fence is accepted; extra prose, multiple
 // proposals and any text after the fence remain invalid.
 if(raw.startsWith('```')){
  const fenced=/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(raw);
  if(!fenced)return null;
  raw=fenced[1].trim();
 }
 let candidate;
 try{candidate=JSON.parse(raw)}catch(_){return null}
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return null;
 if(Object.keys(candidate).sort().join(',')!=='baseRef,edits,jobId,repository,summary')
  return null;
 try{
  return validateChangeProposal({job,proposal:candidate,evidence});
 }catch(_){return null}
}
function previewPayload(plan,evidence){
 if(!plan||plan.kind!=='paperworld-listening-change-proposal-v1'||!evidence)
  throw Error('unverified_preview');
 const approved=validateChangeProposal({job:{id:plan.jobId,project:'Listening Mirror',
  directorId:'listening-director',workerId:'listening-developer',
  approvedForProposal:true},proposal:{jobId:plan.jobId,repository:plan.repository,
  baseRef:plan.baseRef,summary:plan.summary,edits:plan.edits},evidence});
 return Object.freeze({plan:approved,evidence:{repository:evidence.repository,
  ref:evidence.ref,readOnly:true,files:evidence.files.filter(f=>
    approved.edits.some(e=>e.path===f.path)).map(f=>({
     path:f.path,sha:f.sha,lines:f.lines
    }))}});
}
module.exports=Object.freeze({TAG,parseWorkerProposal,previewPayload});
