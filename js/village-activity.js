/* A human-facing, read-only projection of verified owner-scoped task records.
 * This module has NO authority to create missions, spend credits or change code.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldVillageActivity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const PERSON=Object.freeze({listening:'Luna',pokemon:'Joey',studio:'Crow',wellbeing:'Dave'});
const STATUS=Object.freeze({
 draft:'Το έχω σημειώσει. Δεν έχει ξεκινήσει ακόμη.',
 planned:'Έχουμε ετοιμάσει το πλάνο. Δεν έχει ξεκινήσει ακόμη.',
 queued:'Η εργασία είναι στην αναμονή.',
 running:'Η ομάδα ασχολείται με αυτό.',
 working:'Η ομάδα ασχολείται με αυτό.',
 verifying:'Ελέγχουμε το αποτέλεσμα.',
 paused_budget:'Έχουμε σταματήσει προσωρινά λόγω του ορίου χρήσης.',
 needs_you:'Χρειάζεται μια απόφασή σου.',
 completed:'Η ομάδα ολοκλήρωσε την εργασία.',
 failed:'Δεν ολοκληρώθηκε. Ο Matt μπορεί να σου εξηγήσει τι συνέβη.',
 cancelled:'Η εργασία ακυρώθηκε.'
});
const ACTIVE=new Set(['queued','running','working','verifying']);
function safeUrl(url){
 if(typeof url!=='string')return null;
 try{const u=new URL(url);
  return u.protocol==='https:'&&u.hostname==='github.com'&&
   /^\/mr-tanq\/(?:concerts|pokemon-echoes)\/pull\/[1-9][0-9]*$/.test(u.pathname)&&
   !u.username&&!u.password&&!u.search&&!u.hash?u.href:null;
 }catch(_){return null}
}
function view(raw){
 if(!raw||typeof raw!=='object'||!Object.hasOwn(PERSON,raw.projectId)||
  !Object.hasOwn(STATUS,raw.status)||typeof raw.goal!=='string')return null;
 const title=raw.goal.trim().slice(0,180);
 if(!title)return null;
 const completed=raw.status==='completed';
 const reviewed=completed&&raw.report&&typeof raw.report==='object'&&
  raw.report.headStillCurrent===true&&
  Array.isArray(raw.report.requiredTests)&&raw.report.requiredTests.length>0;
 const verifiedUrl=reviewed?safeUrl(raw.report.prUrl):null;
 const projectRepo={listening:'concerts',pokemon:'pokemon-echoes'};
 const link=verifiedUrl&&projectRepo[raw.projectId]&&
  verifiedUrl.startsWith('https://github.com/mr-tanq/'+projectRepo[raw.projectId]+'/pull/')
  ?verifiedUrl:null;
 const isSimulation=raw.simulation===true;
 const merged=Boolean(link)&&raw.report.merged===true;
 return Object.freeze({id:String(raw.id||''),person:PERSON[raw.projectId],
  projectId:raw.projectId,title,status:raw.status,
  message:isSimulation?'Ολοκληρώθηκε μόνο δοκιμή υποδομής, όχι πραγματική εργασία.':
   completed&&!reviewed?'Η εργασία καταγράφηκε ως ολοκληρωμένη. Δεν υπάρχει εδώ επαληθευμένο αποτέλεσμα.':
   STATUS[raw.status],
  stage:raw.status==='needs_you'||raw.status==='failed'?'attention':
   ACTIVE.has(raw.status)?'active':completed?'finished':'waiting',
  resultLink:isSimulation?null:link,
  resultLabel:link?(merged?'Δες τι αλλάξαμε':'Δες την αλλαγή που ετοιμάστηκε'):null,
  resultNote:link?(merged?'Πέρασε τα tests και μπήκε ήδη στην εφαρμογή.':
   'Η αλλαγή έχει ελεγχθεί, αλλά δεν έχει δημοσιευτεί.'):null,
  // Phase 2: the Developer's own one-line explanation, when present.
  cause:reviewed&&typeof raw.report.cause==='string'?raw.report.cause.slice(0,280):null,
  fix:reviewed&&typeof raw.report.fix==='string'?raw.report.fix.slice(0,280):null
 });
}
function summary(rows){
 const visible=(Array.isArray(rows)?rows:[]).map(view).filter(Boolean);
 return Object.freeze({items:visible,
  active:visible.filter(x=>x.stage==='active').length,
  attention:visible.filter(x=>x.stage==='attention').length,
  finished:visible.filter(x=>x.stage==='finished').length});
}
return Object.freeze({view,summary,safeUrl,STATUS});
});
