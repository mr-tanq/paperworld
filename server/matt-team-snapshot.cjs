'use strict';
/* Read-only, service-role access AFTER authenticated owner/thread verification.
 * Never use model-provided owner IDs or return private wellbeing text.
 */
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
// Deterministic, narrowly scoped progress enquiries: no AI or credits needed.
function asksAboutVillage(message){
 if(typeof message!=='string'||message.length>1200)return false;
 const m=message.toLocaleLowerCase('el-GR').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').trim();
 const asks=/(?:τι καν(?:ει|ουν)|πως παν(?:ε|ει)|που βρισκ(?:εται|ομαστε)|τι εγινε με|εχουμε (?:καποιο )?νεο|ενημερωσε με|ποια ειναι η προοδος|κατασταση (?:της )?(?:ομαδας|εργασιας|εργασιων)|(?:what is the |current )?status (?:of|on)|progress (?:of|on)|how (?:is|are) .* (?:doing|going))/.test(m);
 const subject=/(?:ομαδ|χωρι|εργασ|αποστολ|luna|joey|crow|dave|matt|listening|pokemon|ticket|director|worker|project|προτζεκτ|διορθωσ|συναυλι)/.test(m);
 return asks&&subject;
}
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
      {hasReport:m.result.hasReport===true,
       existingTestsPassed:m.result.existingTestsPassed===true,
       ownNewTestPassed:false,applied:false}:null
    }))};
  });
  if(new Set(safe.map(d=>d.projectId)).size!==4)throw Error('invalid_team_snapshot');
  return Object.freeze({directors:safe,asOf:String(result.asOf||'').slice(0,45)});
 }});
}
function teamSummary(snapshot,question=''){
 if(!snapshot?.directors)return 'Δεν μπορώ να δω αξιόπιστα την πρόοδο αυτή τη στιγμή. Δεν θα μαντέψω τι έκανε η ομάδα.';
 const query=String(question||'').toLocaleLowerCase('el-GR').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'');
 const named=/(?:luna|listening|ticket|συναυλι)/.test(query)?'listening':
  /(?:joey|pokemon|ποκεμον)/.test(query)?'pokemon':
  /(?:crow|wanderer|τραγουδ|μουσικ)/.test(query)?'studio':
  /(?:dave|wellbeing|υγεια|ασκησ)/.test(query)?'wellbeing':null;
 const selected=named?snapshot.directors.filter(d=>d.projectId===named):
  snapshot.directors;
 if(!selected.length)return 'Δεν βρίσκω ενημέρωση για αυτή την εργασία.';
 const article={listening:'Η',pokemon:'Ο',studio:'Ο',wellbeing:'Ο'};
 const person={listening:'Luna',pokemon:'Joey',studio:'Crow',wellbeing:'Dave'};
 const lines=[];
 for(const d of selected){
  const name=(article[d.projectId]||'Η')+' '+(person[d.projectId]||'ομάδα');
  const active=Number.isInteger(d.active)?Math.max(0,d.active):0;
  const attention=Number.isInteger(d.attention)?Math.max(0,d.attention):0;
  if(active)lines.push(name+(active===1?
   ' έχει μία εργασία σε εξέλιξη.':' έχει '+active+' εργασίες σε εξέλιξη.'));
  if(attention)lines.push(name+(attention===1?
   ' έχει ένα θέμα που χρειάζεται προσοχή.':' έχει '+attention+' θέματα που χρειάζονται προσοχή.'));
  if(!active&&!attention){
   const recent=Array.isArray(d.recent)?d.recent:[];
   const finished=recent.find(m=>m.status==='completed');
   if(finished?.result?.hasReport===true)
    lines.push(name+' έχει ετοιμάσει ένα αποτέλεσμα για έλεγχο. Δεν έχει εφαρμοστεί κάποια αλλαγή.');
   else if(finished)
    lines.push(name+' έχει ολοκληρώσει μια εργασία, αλλά δεν έχω εδώ πλήρη στοιχεία για το αποτέλεσμα.');
   else lines.push(name+' δεν έχει κάποια ενεργή εργασία καταγεγραμμένη.');
  }
 }
 return lines.join(' ').slice(0,1300);
}
module.exports=Object.freeze({makeMattTeamSnapshot,teamSummary,asksAboutVillage});
