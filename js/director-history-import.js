/* PAPERWORLD — local-only preparation of user-selected ChatGPT conversations.
 * No network calls, persistent cache, automatic project classification or AI.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldHistoryImport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const PROJECTS=new Set(['workshop','pokemon','studio','wellbeing']);
 const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
 function takeText(message){
  if(!message||!['user','assistant'].includes(message.author?.role))return null;
  const c=message.content;
  const pieces=Array.isArray(c?.parts)?c.parts.filter(x=>typeof x==='string'):
   typeof c?.text==='string'?[c.text]:[];
  const text=pieces.join('\n').trim();
  if(!text)return null;
  return {role:message.author.role,text,createdAt:message.create_time};
 }
 function mainMessages(conversation){
  if(!conversation||typeof conversation!=='object'||!conversation.mapping||
   typeof conversation.mapping!=='object')return [];
  const mapping=conversation.mapping;
  // Prefer the exported active conversation path: edited/regenerated branches
  // must not be silently treated as a single linear canonical exchange.
  const seen=new Set(),path=[];
  let node=conversation.current_node;
  if(typeof node!=='string'||!Object.hasOwn(mapping,node))return [];
  while(typeof node==='string'&&Object.hasOwn(mapping,node)&&!seen.has(node)&&path.length<1500){
   seen.add(node);
   const current=mapping[node],message=takeText(current?.message);
   if(message)path.unshift(message);
   node=current?.parent;
  }
  return path;
 }
 function catalog(source){
  if(!Array.isArray(source)||source.length>30000)
   throw Error('Invalid ChatGPT conversations.json format');
  return source.map((conversation,index)=>{
   const id=conversation?.id||conversation?.conversation_id;
   if(!UUID.test(id||''))return null;
   const messages=mainMessages(conversation);
   if(!messages.length)return null;
   return {index,id,title:typeof conversation.title==='string'?
    conversation.title.slice(0,120):'Untitled conversation',
    count:messages.length,createdAt:conversation.create_time||null};
  }).filter(Boolean);
 }
 function prepare(source,index,projectId,{offset=0,limit=30}={}){
  if(!PROJECTS.has(projectId)||!Array.isArray(source)||
   !Number.isInteger(index)||index<0||index>=source.length||
   !Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>40)
   throw Error('Invalid selected import scope');
  const conversation=source[index],id=conversation?.id||conversation?.conversation_id;
  if(!UUID.test(id||''))throw Error('Invalid ChatGPT conversation ID');
  const messages=mainMessages(conversation);
  if(!messages.length)throw Error('No text messages on active conversation branch');
  const title=(typeof conversation.title==='string'?conversation.title:'Untitled').trim().slice(0,95);
  const lines=[];
  for(const message of messages){
   const role=message.role==='user'?'User':'Assistant (historical, unverified)';
   const value=message.text.replace(/\u0000/g,'');
   for(let start=0;start<value.length;start+=2500){
    lines.push(role+': '+value.slice(start,start+2500));
   }
  }
  const chunks=[];let chunk='';
  for(const line of lines){
   if(chunk&&chunk.length+line.length+2>3500){chunks.push(chunk);chunk=''}
   if(line.length>3500)throw Error('Import chunk too long');
   chunk+=(chunk?'\n\n':'')+line;
  }
  if(chunk)chunks.push(chunk);
  if(offset>=chunks.length)return {records:[],total:chunks.length,nextOffset:null};
  const now=new Date().toISOString(),records=[];
  for(let i=offset;i<Math.min(chunks.length,offset+limit);i++){
   records.push(Object.freeze({
    project_id:projectId,kind:'work_history',status:'proposed',
    title:('ChatGPT history: '+title+' (part '+(i+1)+')').slice(0,140),
    body:chunks[i],
    source_type:'conversation',
    source_ref:'chatgpt-export:'+id+':'+i,
    observed_at:now,version:1,sensitivity:'private'
   }));
  }
  return {records,total:chunks.length,
   nextOffset:offset+records.length<chunks.length?offset+records.length:null};
 }
 return Object.freeze({catalog,prepare,mainMessages});
});