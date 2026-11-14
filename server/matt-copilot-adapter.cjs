/* PAPERWORLD: server-side Copilot SDK adapter contract.
 * INERT until a future, separately approved trusted server invokes reply().
 * NEVER import or expose this module from GitHub Pages.
 * No SDK dependency or model call occurs merely by importing the module.
 */
'use strict';

const MODEL='auto';
const MAX_MESSAGE=1500;
const MAX_REPLY=2000;
const UID=/^[a-zA-Z0-9_-]{1,128}$/;
function validate(input){
 if(!input||typeof input!=='object')throw Error('Invalid request');
 if(typeof input.ownerId!=='string'||!UID.test(input.ownerId))throw Error('Invalid owner identity');
 if(typeof input.requestId!=='string'||!UID.test(input.requestId))throw Error('Invalid request identity');
 if(typeof input.message!=='string'||!input.message.trim()||input.message.length>MAX_MESSAGE)
  throw Error('Invalid message');
 if(typeof input.githubToken!=='string'||!input.githubToken.trim())
  throw Error('Server-side GitHub authentication required');
 return {ownerId:input.ownerId,requestId:input.requestId,message:input.message.trim()};
}
function createMattAdapter({clientFactory,authorizeRequest}={}){
 if(typeof clientFactory!=='function'||typeof authorizeRequest!=='function')
  throw Error('Trusted SDK factory and server authorization callback required');
 async function reply(input){
  const safe=validate(input);
  // MUST be implemented server-side: verify Supabase JWT, linked GitHub account,
  // owner/thread binding, per-request consent and spending policy.
  const decision=await authorizeRequest({ownerId:safe.ownerId,requestId:safe.requestId,agentId:'matt'});
  if(!decision||decision.allowed!==true||decision.budgetConfigured!==true)
   throw Error('AI request not approved by trusted server');

  // SDK is instantiated ONLY after a trusted server approves this specific request.
  // The future gateway owns the lifecycle and injection; no browser token handling.
  const client=await clientFactory({mode:'empty'});
  let session;
  try{
   session=await client.createSession({
    model:MODEL,
    availableTools:[],       // no built-in, shell, repository or custom tools
    gitHubToken:input.githubToken,
    systemMessage:{mode:'append',content:
      'You are Matt, Chief of Staff of PAPERWORLD. Respond conversationally. '+
      'You may explain and suggest plans, but you cannot access tools, run workers, '+
      'change files or assert that work occurred. Never claim you delegated a task.'}
   });
   const result=await session.sendAndWait({prompt:safe.message});
   const content=result?.data?.content;
   if(typeof content!=='string'||!content.trim())throw Error('AI returned no response');
   return {agentId:'matt',requestId:safe.requestId,content:content.slice(0,MAX_REPLY),executed:true};
  }finally{
   try{await session?.disconnect?.()}finally{await client?.stop?.()}
  }
 }
 return Object.freeze({reply});
}
module.exports=Object.freeze({createMattAdapter});
