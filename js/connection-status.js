/* PAPERWORLD connected-service status — one honest vocabulary for the UI.
 *
 * Never reports "connected" without a successful, authenticated server answer
 * that says so. Errors are classified, not hidden behind "checking":
 *   connected      the server confirmed an active link right now
 *   disconnected   the server answered: no link for this owner
 *   not_configured the server answered: the service is not set up
 *   signed_out     the PAPERWORLD Cloud session is missing/expired
 *   unavailable    no trustworthy answer (network, timeout, server error)
 *   checking       a request is in flight (never a final state)
 * No tokens or provider data are read or shown — only these labels.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldConnectionStatus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const STATES=Object.freeze(['connected','disconnected','not_configured','signed_out','unavailable','checking']);
 function fromError(error){
  const text=String(error?.message||error||'');
  if(/not_configured/i.test(text))return 'not_configured';
  if(/HTTP 401|unauthori[sz]ed|sign in|session expired|not signed/i.test(text))return 'signed_out';
  return 'unavailable';
 }
 // GitHub: an OAuth link (temporary, in server memory) and/or the durable AI
 // chat credential. Either one is a real, server-confirmed connection.
 function github(result){
  if(!result||typeof result!=='object')return {state:'unavailable'};
  const link=result.connected===true,chat=result.chatConnected===true;
  if(!link&&!chat)return result.connected===false?{state:'disconnected'}:{state:'unavailable'};
  return {state:'connected',chat,link,temporary:link&&result.ephemeral===true&&!chat};
 }
 // Suno: a short-lived authorization held by the server. It is NOT proof that
 // song creation works (that is re-verified before every song).
 function suno(result){
  if(!result||typeof result!=='object'||result.canGenerate!==false)return {state:'unavailable'};
  if(result.oauthAuthorized===true)return {state:'connected',temporary:result.ephemeral!==false};
  if(result.oauthAuthorized===false)return {state:'disconnected'};
  return {state:'unavailable'};
 }
 const LABEL=Object.freeze({connected:'Συνδεδεμένο',disconnected:'Δεν έχει συνδεθεί',
  not_configured:'Δεν έχει ρυθμιστεί',signed_out:'Χρειάζεται σύνδεση στο Cloud',
  unavailable:'Μη διαθέσιμο τώρα',checking:'Έλεγχος…'});
 function label(state){return LABEL[state]||LABEL.unavailable}
 // A status read must never hang the UI in "checking".
 function withTimeout(promise,ms=8000){
  return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),ms))]);
 }
 async function read(kind,loader,{signedIn=true,timeoutMs=8000}={}){
  if(!signedIn)return {state:'signed_out'};
  if(typeof loader!=='function')return {state:'unavailable'};
  try{
   const result=await withTimeout(Promise.resolve().then(loader),timeoutMs);
   return kind==='github'?github(result):suno(result);
  }catch(error){return {state:fromError(error)}}
 }
 return Object.freeze({STATES,fromError,github,suno,label,read,withTimeout});
});
