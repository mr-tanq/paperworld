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
 return Object.freeze({fromMatt});
});
