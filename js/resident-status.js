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
// The task's planned title first; a raw chat goal only as a last resort, and
// never its "Νωρίτερα:" context prefix.
function title(m){
 const g=String(m.goal||''),now=g.match(/Τώρα:\s*([\s\S]+)$/);
 return String(m.title||m.report?.title||(now?now[1]:g)).replace(/^Εβδομαδιαίος έλεγχος:\s*/,'').replace(/\s+/g,' ').trim();
}
function topic(m){
 if(m.projectId==='wellbeing')return 'κάτι προσωπικό';
 return short(title(m),26);
}
// One line per resident, most important first: needs you > working > just finished.
// Active work with no progress for 2 hours is NOT shown as busy: the village
// must never look busier than the system really is.
const STALL=2*3600*1000;
function line(m,now=Date.now()){
 // A check that found nothing to change is a finished check, not a problem.
 if(m.status==='needs_you'&&m.lastError==='agent_no_changes')return {tone:'done',text:'✓ Έλεγξε· τίποτα να αλλάξει'};
 if(ATTENTION.has(m.status))return {tone:'attention',text:'Χρειάζεται εσένα'};
 const at=Date.parse(m.updatedAt||m.createdAt||'');
 if(ACTIVE.has(m.status)&&Number.isFinite(at)&&now-at>STALL)return {tone:'attention',text:'Κόλλησε: δεν προχωράει'};
 if(m.status==='verifying')return {tone:'active',text:'Ελέγχει: '+topic(m)};
 if(ACTIVE.has(m.status))return {tone:'active',text:'Δουλεύει: '+topic(m)};
 if(m.status==='completed'&&m.report?.merged===true)return {tone:'done',text:'✓ Το φτιάξαμε'};
 if(m.status==='completed'&&m.report?.headStillCurrent===true)return {tone:'done',text:'✓ Έτοιμο για σένα'};
 return null;
}
const RANK={attention:3,active:2,done:1};
function statuses(missions,now=Date.now(),dismissed=null){
 const out={};
 const hidden=dismissed instanceof Set?dismissed:new Set(Array.isArray(dismissed)?dismissed:[]);
 for(const m of Array.isArray(missions)?missions:[]){
  if(!m||typeof m!=='object'||!Object.hasOwn(DIRECTOR,m.projectId)||m.simulation===true)continue;
  // Items the owner removed from their lists never come back as bubbles.
  if(m.id&&hidden.has('mission:'+m.id))continue;
  const at=Date.parse(m.updatedAt||m.createdAt||'');
  const l=line(m,now);
  if(!l)continue;
  // Finished work and things that need the owner show for a day; active while active.
  if(l.tone==='done'&&!(at>now-DAY))continue;
  if(l.tone==='attention'&&!(at>now-DAY))continue;
  const id=DIRECTOR[m.projectId],prev=out[id];
  if(!prev||RANK[l.tone]>RANK[prev.tone]||(RANK[l.tone]===RANK[prev.tone]&&at>prev.at))
   out[id]={...l,at,mission:m};
 }
 // Details for the chat (what this is about) ride along, not shown on the map.
 for(const k of Object.keys(out)){const m=out[k].mission,v={tone:out[k].tone,text:out[k].text};
  Object.defineProperty(v,'detail',{enumerable:false,value:Object.freeze({missionId:m.id||null,
   title:m.projectId==='wellbeing'?'κάτι προσωπικό':short(title(m),120),status:m.status,lastError:m.lastError||null})});
  out[k]=Object.freeze(v)}
 return Object.freeze(out);
}
return Object.freeze({statuses,DIRECTOR,STALL});
});
