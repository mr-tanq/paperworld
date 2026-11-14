/* PAPERWORLD — server-only Matt HTTP gateway contract.
   This is an inert, dependency-injected handler; importing it starts NO server
   and makes NO AI request. All auth and spending approvals must be verified
   by a trusted backend. Never bundle this file into GitHub Pages. */
'use strict';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_BYTES=5000;
function respond(status,payload){
 return {status,headers:{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'},
  body:JSON.stringify(payload)};
}
function createGateway({authenticate,ownsThread,claimApproval,linkedToken,adapter}={}){
 if([authenticate,ownsThread,claimApproval,linkedToken].some(fn=>typeof fn!=='function')||
    typeof adapter?.reply!=='function')
  throw Error('Trusted server dependencies required');
 async function handle({method,headers={},body}={}){
  // The gate is fail-closed even if the caller attempts to bypass it.
  if(method!=='POST')return respond(405,{error:'method_not_allowed'});
  const bearer=headers.authorization||headers.Authorization||'';
  if(!/^Bearer [^\s]+$/.test(bearer))return respond(401,{error:'unauthorized'});
  const wire=typeof body==='string'?body:JSON.stringify(body||{});
  if(Buffer.byteLength(wire,'utf8')>MAX_BYTES)return respond(413,{error:'request_too_large'});
  let input;
  try{input=JSON.parse(wire)}catch(_){return respond(400,{error:'invalid_json'})}
  if(!input||typeof input!=='object'||Array.isArray(input))return respond(400,{error:'invalid_request'});
  const {threadId,requestId,approvalId,message}=input;
  if(![threadId,requestId,approvalId].every(x=>typeof x==='string'&&UUID.test(x))||
    typeof message!=='string'||!message.trim()||message.length>1500)
   return respond(400,{error:'invalid_request'});
  // Ignore any ownerId/githubToken provided by the browser: never trust those.
  let identity;
  try{identity=await authenticate(bearer.slice(7))}
  catch(_){return respond(401,{error:'unauthorized'})}
  if(!identity||typeof identity.ownerId!=='string'||!identity.ownerId)
   return respond(401,{error:'unauthorized'});
  try{
   if(await ownsThread({threadId,ownerId:identity.ownerId,agentId:'matt',token:bearer.slice(7)})!==true)
    return respond(404,{error:'thread_not_found'});
   // A trusted DB method must atomically consume one explicit, owner-scoped
   // approval for THIS request. No approval means no AI, not even a retry.
   const approval=await claimApproval({approvalId,requestId,threadId,ownerId:identity.ownerId,
                                     agentId:'matt'});
   if(!approval||approval.allowed!==true||approval.budgetConfigured!==true)
    return respond(403,{error:'approval_required'});
   const githubToken=await linkedToken({ownerId:identity.ownerId});
   if(typeof githubToken!=='string'||!githubToken)
    return respond(409,{error:'github_not_connected'});
   const outcome=await adapter.reply({ownerId:identity.ownerId,requestId,message,githubToken});
   if(!outcome||outcome.executed!==true||outcome.agentId!=='matt'||
      typeof outcome.content!=='string'||!outcome.content.trim())
    throw Error('Invalid AI outcome');
   return respond(200,{requestId,agentId:'matt',content:outcome.content,executed:true});
  }catch(_){
   // No exceptions, tokens, or prompt content leak to HTTP consumers.
   return respond(502,{error:'ai_unavailable'});
  }
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({createGateway});
