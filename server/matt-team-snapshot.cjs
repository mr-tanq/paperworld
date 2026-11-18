'use strict';
/* Read-only, service-role access AFTER authenticated owner/thread verification.
 * Never use model-provided owner IDs or return private wellbeing text.
 */
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
function makeMattTeamSnapshot({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 const configured=typeof secret==='string'&&
  (secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 return Object.freeze({async load(ownerId){
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(ownerId||''))
   throw Error('invalid_owner');
  if(!configured)throw Error('team_store_unconfigured');
  const response=await fetcher(BASE+'/rest/v1/rpc/paperworld_v5_team_snapshot',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?
     {Authorization:'Bearer '+secret}:{}),
    'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({p_owner:ownerId})});
  if(!response?.ok)throw Error('team_snapshot_unavailable');
  const result=await response.json();
  if(!result||typeof result!=='object'||!Array.isArray(result.directors)||
   result.directors.length!==4)throw Error('invalid_team_snapshot');
  // Restrict the model-visible fields to known, bounded, non-sensitive values.
  const projects=['listening','pokemon','studio','wellbeing'];
  const safe=result.directors.map(d=>{
   if(!projects.includes(d.projectId)||!Number.isInteger(d.active)||
    !Number.isInteger(d.attention)||!Array.isArray(d.recent)||
    d.recent.length>3)throw Error('invalid_team_snapshot');
   return {projectId:d.projectId,name:({
    listening:'Luna',pokemon:'Joey',studio:'Crow',wellbeing:'Dave'})[d.projectId],
    active:d.active,attention:d.attention,
    recent:d.projectId==='wellbeing'?[]:d.recent.map(m=>({
     status:String(m.status||'').slice(0,25),
     goal:String(m.goal||'').slice(0,150),
     updatedAt:String(m.updatedAt||'').slice(0,45),
     result:m.result&&typeof m.result==='object'?
      {prepared:m.result.prepared===true,verified:m.result.verified===true}:null
    }))};
  });
  if(new Set(safe.map(d=>d.projectId)).size!==4)throw Error('invalid_team_snapshot');
  return Object.freeze({directors:safe,asOf:String(result.asOf||'').slice(0,45)});
 }});
}
function teamSummary(snapshot){
 if(!snapshot?.directors)return 'Δεν μπορώ να ελέγξω αυτή τη στιγμή τις εργασίες της ομάδας.';
 const phrases=[];
 for(const d of snapshot.directors){
  const what=d.active?d.active+' '+(d.active===1?'εργασία σε εξέλιξη':'εργασίες σε εξέλιξη'):'καμία ενεργή εργασία';
  const needs=d.attention?' και '+d.attention+' '+(d.attention===1?'θέμα που χρειάζεται εσένα':'θέματα που χρειάζονται εσένα'):'';
  phrases.push(d.name+': '+what+needs+'.');
 }
 return 'Αυτή είναι η εικόνα της ομάδας τώρα. '+phrases.join(' ')+
  ' Θα σου πω όταν προκύψει κάποιο νέο αποτέλεσμα.';
}
module.exports=Object.freeze({makeMattTeamSnapshot,teamSummary});
