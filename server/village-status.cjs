/* Read-only Matt briefing from the single owner-scoped V5 task engine.
 * Never schedule, start or retry any worker; never reveal another owner's work.
 */
'use strict';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PROJECT=Object.freeze({listening:'Luna',pokemon:'Joey',studio:'Crow',wellbeing:'Dave'});
const KNOWN=new Set(['draft','planned','queued','working','running','verifying',
 'paused_budget','needs_you','completed','failed','cancelled']);
function asksAboutVillage(message){
 if(typeof message!=='string'||message.length>1200)return false;
 const m=message.toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
 // Explicit *progress* questions, not requests to fix or build something.
 return /(?:τι καν(?:ει|ουν)|πως παν(?:ε|ε)|που βρισκ(?:εται|ομαστε)|ενημερωσε με|ποια ειναι η προοδος|κατασταση (?:της )?(?:ομαδας|εργασιας|εργασιων)|τι εγινε με|εχουμε (?:καποιο )?νεο|status (?:of|on)|progress (?:of|on)|what is (?:the )?status|how (?:is|are) .* (?:doing|going))/.test(m)
  && /(?:ομαδ|χωρι|εργασ|αποστολ|luna|joey|crow|dave|matt|listening|pokemon|ticket|director|worker|project|προτζεκτ|διορθωσ|συναυλι)/.test(m);
}
function safeRow(row){
 if(!row||!Object.hasOwn(PROJECT,row.project_id)||!KNOWN.has(row.status))return null;
 return {project:row.project_id,person:PROJECT[row.project_id],status:row.status,
  // A source goal is untrusted content and MUST NOT become executable instructions.
  title:row.project_id==='wellbeing'?'μια προσωπική εργασία':
   typeof row.goal==='string'?row.goal.trim().slice(0,125):'',
  verified:row.status==='completed'&&row.policy?.executionMode!=='simulation'&&
   row.report?.headStillCurrent===true&&
   typeof row.report?.prUrl==='string'&&
   /^https:\/\/github\.com\/mr-tanq\/(?:concerts|pokemon-echoes)\/pull\/[1-9][0-9]*$/.test(row.report.prUrl)&&
   ((row.project_id==='listening'&&row.report.prUrl.includes('/concerts/'))||
    (row.project_id==='pokemon'&&row.report.prUrl.includes('/pokemon-echoes/')))&&
   Array.isArray(row.report.requiredTests)&&row.report.requiredTests.length>0,
  simulation:row.policy?.executionMode==='simulation'
 };
}
function briefing(rows){
 if(!Array.isArray(rows))return null;
 const tasks=rows.map(safeRow).filter(Boolean);
 if(!tasks.length)return 'Δεν βλέπω ακόμη καταγεγραμμένες εργασίες για την ομάδα. Πες μου τι θα ήθελες να αναλάβουμε.';
 const active=tasks.filter(r=>['queued','working','running','verifying'].includes(r.status));
 const blocked=tasks.filter(r=>['paused_budget','needs_you','failed'].includes(r.status));
 const done=tasks.filter(r=>r.status==='completed'&&!r.simulation);
 const words=[];
 if(active.length)words.push('Αυτή τη στιγμή έχουμε '+active.length+(active.length===1?' εργασία σε εξέλιξη.':' εργασίες σε εξέλιξη.'));
 if(blocked.length)words.push(blocked.length===1?'Μία εργασία χρειάζεται την προσοχή μας.':blocked.length+' εργασίες χρειάζονται την προσοχή μας.');
 if(done.length)words.push('Έχουν ολοκληρωθεί '+done.length+(done.length===1?' εργασία.':' εργασίες.'));
 const relevant=[...blocked,...active,...done].slice(0,3);
 for(const r of relevant){
  const subject=r.title?' με το «'+r.title.replace(/[\n\r\t]/g,' ').slice(0,90)+'»':'';
  const msg=r.status==='paused_budget'?'έχει σταματήσει προσωρινά λόγω ορίου χρήσης':
   r.status==='needs_you'?'χρειάζεται την απόφασή σου':
   r.status==='failed'?'δεν μπόρεσε να ολοκληρώσει την εργασία':
   r.status==='queued'?'περιμένει να ξεκινήσει':
   r.status==='verifying'?'ελέγχει το αποτέλεσμα':
   r.status==='completed'&&r.verified?'έχει ετοιμάσει και ελέγξει μια αλλαγή, που δεν έχει δημοσιευτεί':
   r.status==='completed'?'έχει καταγράψει την εργασία ως ολοκληρωμένη, αλλά δεν βλέπω επιβεβαιωμένη αλλαγή':
   'δουλεύει πάνω στην εργασία';
  words.push(r.person+' '+msg+subject+'.');
 }
 if(!words.length)return 'Έχουμε κάποιες εργασίες σημειωμένες, αλλά καμία δεν έχει ξεκινήσει ακόμη.';
 return words.join(' ').slice(0,1400);
}
function createVillageStatus({fetcher=globalThis.fetch,
 secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 return Object.freeze({async read({ownerId,threadId}){
  if(!UUID.test(ownerId||'')||!UUID.test(threadId||''))return null;
  if(typeof secret!=='string'||!(secret.startsWith('sb_secret_')||secret.startsWith('eyJ')))return null;
  const q=new URLSearchParams({select:'project_id,goal,status,policy,report,updated_at',
   owner_id:'eq.'+ownerId,thread_id:'eq.'+threadId,order:'updated_at.desc',limit:'15'});
  try{
   const response=await fetcher(BASE+'/rest/v1/paperworld_autonomous_missions_v5?'+q,{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
     Accept:'application/json'}
   });
   if(!response?.ok)return null;
   const data=await response.json();
   return briefing(data);
  }catch(_){return null}
 }});
}
module.exports=Object.freeze({asksAboutVillage,briefing,createVillageStatus});
