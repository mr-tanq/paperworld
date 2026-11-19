/* PAPERWORLD Learning Loop v1: owner correction -> reviewable memory proposal.
 * Deterministic, no inference, no network, no persistence and no auto approval.
 * Model suggestions are never trusted as owner confirmations.
 */
'use strict';
const {prepareProposal,projectForActor,DIRECTORS}=
 require('./director-memory-policy.cjs');
const {randomUUID}=require('node:crypto');
const TYPES=new Set(['preference','decision']);
const SENSITIVITIES=new Set(['standard','private']);
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function fail(code){const e=new Error(code);e.code=code;throw e}
function ownerCorrectionProposal({actor,ownerConfirmed=false,threadId,
 title,correction,sourceRef,sensitivity='private',kind='preference',
 observedAt,entryId}={}){
 // The caller must verify actual owner identity and user message source.
 // This flag by itself is NOT a proof of authorization.
 if(ownerConfirmed!==true)fail('owner_correction_confirmation_required');
 if(!Object.hasOwn(DIRECTORS,actor))fail('learning_director_required');
 if(!ID.test(threadId||''))fail('learning_thread_reference_required');
 if(!TYPES.has(kind)||!SENSITIVITIES.has(sensitivity))
  fail('learning_kind_or_sensitivity_invalid');
 if(typeof sourceRef!=='string'||!sourceRef.trim()||sourceRef.length>300||
  !sourceRef.startsWith('owner-thread:'))
  fail('learning_owner_source_required');
 const time=observedAt===undefined?new Date().toISOString():observedAt;
 const data={id:entryId||randomUUID(),projectId:projectForActor(actor),
  kind,status:'proposed',title,body:correction,
  sourceType:'conversation',sourceRef,observedAt:time,
  version:1,sensitivity};
 const proposal=prepareProposal(data,{actor});
 return Object.freeze({...proposal,requiresOwnerReview:true,
  execution:'none',capabilitiesGranted:Object.freeze([])});
}
module.exports=Object.freeze({ownerCorrectionProposal});
