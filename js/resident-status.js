/* PAPERWORLD resident status — what each Director is doing RIGHT NOW,
 * derived only from the owner's real Task Engine missions. Pure and read-only:
 * no network, no AI, no simulated activity. No record → no bubble.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldResidentStatus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const DIRECTOR=Object.freeze({listening:'listening-director',pokemon:'pokemon-director',
 studio:'studio-director',wellbeing:'wellbeing-director'});
const ACTIVE=new Set(['queued','running','working','verifying']);
const ATTENTION=new Set(['needs_you','failed']);
const DAY=24*3600*1000;
function short(text,max){const t=String(text||'').replace(/\s+/g,' ').trim();
 return t.length>max?t.slice(0,max-1).trimEnd()+'…':t}
function topic(m){
 if(m.projectId==='wellbeing')return 'κάτι προσωπικό';
 const t=String(m.report?.title||m.goal||'').replace(/^Εβδομαδιαίος έλεγχος:\s*/,'');
 return short(t,26);
}
// One line per resident, most important first: needs you > working > just finished.
function line(m){
 if(ATTENTION.has(m.status))return {tone:'attention',text:'Χρειάζεται εσένα'};
 if(m.status==='verifying')return {tone:'active',text:'Ελέγχει: '+topic(m)};
 if(ACTIVE.has(m.status))return {tone:'active',text:'Δουλεύει: '+topic(m)};
 if(m.status==='completed'&&m.report?.merged===true)return {tone:'done',text:'✓ Το φτιάξαμε'};
 if(m.status==='completed'&&m.report?.headStillCurrent===true)return {tone:'done',text:'✓ Έτοιμο για σένα'};
 return null;
}
const RANK={attention:3,active:2,done:1};
function statuses(missions,now=Date.now()){
 const out={};
 for(const m of Array.isArray(missions)?missions:[]){
  if(!m||typeof m!=='object'||!Object.hasOwn(DIRECTOR,m.projectId)||m.simulation===true)continue;
  const at=Date.parse(m.updatedAt||m.createdAt||'');
  const l=line(m);
  if(!l)continue;
  // Finished work shows for a day; attention for three days; active while active.
  if(l.tone==='done'&&!(at>now-DAY))continue;
  if(l.tone==='attention'&&!(at>now-3*DAY))continue;
  const id=DIRECTOR[m.projectId],prev=out[id];
  if(!prev||RANK[l.tone]>RANK[prev.tone]||(RANK[l.tone]===RANK[prev.tone]&&at>prev.at))
   out[id]={...l,at};
 }
 for(const k of Object.keys(out))out[k]=Object.freeze({tone:out[k].tone,text:out[k].text});
 return Object.freeze(out);
}
return Object.freeze({statuses,DIRECTOR});
});
