/* PAPERWORLD Agent Conversation Store — no automatic model calls.
   Uses an authenticated, existing Supabase-style client transport provided by caller.
   This module does not expose secrets or grant permissions. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldAgentStore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ALLOWED=new Set(['matt','listening-director','listening-developer','pokemon-director','wellbeing-director','studio-director']);
 const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
 function create({transport}){
  if(typeof transport!=='function')throw Error('Authenticated transport required');
  const ensureAgent=id=>{if(!ALLOWED.has(id))throw Error('Unknown agent');return id};
  const ensureUuid=id=>{if(typeof id!=='string'||!UUID.test(id))throw Error('Invalid thread');return id};
  const path='/rest/v1/';
  async function threads(){
   return transport(path+'paperworld_agent_threads?select=id,agent_id,created_at&order=created_at.desc&limit=20');
  }
  async function start(agentId){
   const agent_id=ensureAgent(agentId);
   // RLS enforces the owner; do not accept owner_id from callers.
   return transport(path+'paperworld_agent_threads?select=id,agent_id,created_at',{method:'POST',data:{agent_id},extra:{Prefer:'return=representation'}});
  }
  async function history(threadId){
   const id=ensureUuid(threadId);
   return transport(path+'paperworld_agent_messages?select=id,thread_id,role,content,created_at&thread_id=eq.'+
     encodeURIComponent(id)+'&order=created_at.asc,id.asc&limit=100');
  }
  async function say(threadId,content){
   const thread_id=ensureUuid(threadId);
   if(typeof content!=='string'||!content.trim()||content.length>2000)throw Error('Invalid message');
   return transport(path+'paperworld_agent_messages?select=id,thread_id,role,content,created_at',{
     method:'POST',data:{thread_id,role:'human',content:content.trim()},
     extra:{Prefer:'return=representation'}
   });
  }
  return Object.freeze({threads,start,history,say});
 }
 return Object.freeze({create});
});
