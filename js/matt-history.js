/* Verified Matt reply envelope. Browser only decodes; server encodes. */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldMattHistory=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const PREFIX='@paperworld-matt:v1:';
 const DIRECTORS=new Set(['studio-director','listening-director','pokemon-director','matt']);
 const MAX_REPLY=5500; // matches the bounded verified Matt model response
 function encode(director,text){
  if(!DIRECTORS.has(director)||typeof text!=='string'||!text.trim())throw Error('invalid_matt_reply');
  return PREFIX+JSON.stringify({director,text:text.slice(0,MAX_REPLY)});
 }
 function decode(value){
  if(typeof value!=='string'||!value.startsWith(PREFIX))return null;
  try{const item=JSON.parse(value.slice(PREFIX.length));
   if(!item||!DIRECTORS.has(item.director)||typeof item.text!=='string'||
    !item.text.trim()||item.text.length>MAX_REPLY)return null;
   return {director:item.director,text:item.text,
    kind:item.kind==='notification'?'notification':'reply'}
  }catch(_){return null}
 }
 function recover(rows){
  let activeDirector=null,turns=[],pending=null;const display=[];
  for(const row of Array.isArray(rows)?rows:[]){
   if(row.role==='human'){
    pending=String(row.content||'');
    display.push({role:'human',text:pending,time:row.created_at});
   }else if(row.role==='agent'){
    const parsed=decode(row.content);
    display.push({role:'agent',text:parsed?parsed.text:String(row.content||''),time:row.created_at});
    if(parsed?.kind==='notification')continue;
    if(parsed?.director==='matt'){
     activeDirector=null;turns=[];
    }else if(parsed&&pending){
     if(activeDirector!==parsed.director)turns=[];
     activeDirector=parsed.director;
     turns.push({role:'human',text:pending.slice(0,600)},
      {role:'assistant',text:parsed.text.slice(0,900)});
     turns=turns.slice(-8);
    }
    pending=null;
   }
  }
  return {activeDirector,turns,display};
 }
 function reconcileReplies(pending,history){
  const saved=new Set((Array.isArray(history)?history:[]).filter(m=>m.role==='agent').map(m=>m.id));
  return (Array.isArray(pending)?pending:[]).filter(reply=>!reply.id||!saved.has(reply.id));
 }
 return Object.freeze({encode,decode,recover,reconcileReplies});
});