/* Owner-only, client-memory handoff from Matt's verified Crow delegation.
 * No persistence, AI call, network request, invented lyrics or Suno submission.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldCrowStudioDraft=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function fromMatt({directorId,delegated,requestId,request,directorReport}={}){
  if(delegated!==true||directorId!=='studio-director'||
   typeof requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(requestId)||
   typeof request!=='string'||!request.trim()||request.length>1200||
   typeof directorReport!=='string'||!directorReport.trim()||
   directorReport.length>5500)return null;
  const clean=s=>s.replace(/\r\n?/g,'\n').trim();
  const direction=clean(directorReport).slice(0,1000);
  if(!direction)return null;
  return Object.freeze({
   source:'matt_to_crow',
   requestId,
   title:'New Lost Wanderer Song',
   style:direction,
   lyrics:'',
   originalRequest:clean(request).slice(0,1200)
  });
 }
 function fromSavedHistory(rows,decode){
  // Require owner-scoped persisted Matt rows and the server's director envelope.
  // Never infer Crow ownership from natural language or a generic 409 error.
  if(!Array.isArray(rows)||typeof decode!=='function')return null;
  const recent=rows.slice(-24);
  for(let i=recent.length-1;i>=0;i--){
   const row=recent[i];
   if(row?.role!=='agent'||typeof row.content!=='string')continue;
   const parsed=decode(row.content);
   if(!parsed||parsed.director!=='studio-director')continue;
   const prior=recent.slice(0,i).reverse().find(item=>
    item?.role==='human'&&typeof item.content==='string'&&item.content.trim());
   if(!prior)return null;
   const draft=fromMatt({delegated:true,directorId:'studio-director',
    requestId:row.id,request:prior.content.slice(0,1200),
    directorReport:parsed.text});
   if(draft)return Object.freeze({...draft,source:'saved_matt_crow_reply'});
  }
  return null;
 }
 return Object.freeze({fromMatt,fromSavedHistory});
});
