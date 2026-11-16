/* Crow Suno production gate. Dependency-injected transport; disabled by default.
 * Never use model output as authorization. Never log credentials or lyrics.
 */
'use strict';
const {randomUUID}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const OPERATIONS=new Set(['create','extend','cover']);
const now=()=>Date.now();
function validBrief(brief){
 if(!brief||typeof brief!=='object'||Array.isArray(brief)||
    Object.keys(brief).sort().join(',')!=='lyrics,operation,style,title')return false;
 return OPERATIONS.has(brief.operation)&&typeof brief.title==='string'&&
  brief.title.trim().length>=1&&brief.title.length<=120&&
  typeof brief.style==='string'&&brief.style.trim().length>=1&&brief.style.length<=1000&&
  typeof brief.lyrics==='string'&&brief.lyrics.length<=8000;
}
function makeCrowSunoGate({authorize,submit,enabled=false,clock=now,ttlMs=600000}={}){
 if(typeof authorize!=='function')throw Error('authorization_required');
 if(submit!==undefined&&typeof submit!=='function')throw Error('invalid_transport');
 const pending=new Map();
 const respond=(status,error)=>({status,body:{error}});
 function clean(){for(const [id,p] of pending)if(p.until<clock())pending.delete(id)}
 async function propose({ownerId,agentId,brief,expectedCredits=null}={}){
  if(agentId!=='studio-director'||typeof ownerId!=='string'||!ownerId||
     !validBrief(brief))return respond(400,'invalid_crow_proposal');
  if(expectedCredits!==null&&(!Number.isSafeInteger(expectedCredits)||
     expectedCredits<0))return respond(400,'invalid_credit_estimate');
  clean();
  const proposalId=randomUUID();
  pending.set(proposalId,{ownerId,brief:{...brief},expectedCredits,
   until:clock()+ttlMs,used:false});
  return {status:200,body:{proposalId,title:brief.title,
   operation:brief.operation,style:brief.style,lyrics:brief.lyrics,
   expectedCredits,expiresInMs:ttlMs,requiresExplicitApproval:true}};
 }
 async function execute({ownerId,proposalId,approval,acknowledgeUnknownCost=false}={}){
  if(!UUID.test(proposalId||'')||!ownerId||approval!=='GENERATE_WITH_SUNO_CREDITS')
   return respond(400,'explicit_suno_approval_required');
  clean();
  const p=pending.get(proposalId);
  if(!p||p.ownerId!==ownerId)return respond(404,'proposal_not_found');
  if(p.used)return respond(409,'already_submitted');
  if(p.expectedCredits===null&&acknowledgeUnknownCost!==true)
   return respond(403,'unknown_credit_cost_requires_acknowledgement');
  // Never consume an approval until the trusted identity and feature checks pass.
  if(await authorize({ownerId,operation:p.brief.operation})!==true)
   return respond(403,'owner_not_authorized');
  if(enabled!==true||typeof submit!=='function')
   return respond(503,'suno_not_connected');
  // Claim before awaiting the remote provider to avoid duplicate requests.
  p.used=true;
  try{
   const result=await submit({ownerId,proposalId,brief:{...p.brief}});
   if(!result||typeof result!=='object'||typeof result.providerJobId!=='string'||
       !/^[a-zA-Z0-9_-]{1,160}$/.test(result.providerJobId))
    return respond(502,'suno_response_unverified');
   return {status:202,body:{proposalId,providerJobId:result.providerJobId,
    status:'submitted',ready:false}};
  }catch(_){return respond(502,'suno_submission_unconfirmed')}
 }
 function cancel({ownerId,proposalId}={}){
  const p=pending.get(proposalId);
  if(!p||p.ownerId!==ownerId)return respond(404,'proposal_not_found');
  if(p.used)return respond(409,'already_submitted');
  pending.delete(proposalId);
  return {status:200,body:{cancelled:true}};
 }
 return Object.freeze({propose,execute,cancel});
}
module.exports=Object.freeze({makeCrowSunoGate,validBrief});
