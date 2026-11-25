/* PAPERWORLD «Απόδειξη» — how much the team really did on its own, computed
 * only from the owner's Task Engine records (no estimates, no AI). Pure.
 *  - "Χωρίς εσένα": finished and merged with no stop that needed the owner.
 *  - "Χρειάστηκε εσένα": stopped and asked the owner (needs_you / failed).
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldProof=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const ACTIVE=new Set(['queued','running','working','verifying','paused_budget']);
const NAME={listening:'Luna',pokemon:'Joey',studio:'Crow',wellbeing:'Dave'};
const SOURCE={owner:'Δικό σου αίτημα',initiative:'Πρωτοβουλία',retry:'2η προσπάθεια'};
function outcome(m){
 if(m.status==='completed'&&m.report?.merged===true)return 'alone';
 // The Developer looked and nothing needed to change: a finished check.
 if(m.status==='needs_you'&&m.lastError==='agent_no_changes')return 'checked';
 if(m.status==='completed')return 'ready';
 if(m.status==='needs_you'||m.status==='failed')return 'needed_you';
 if(ACTIVE.has(m.status))return 'running';
 return 'other';
}
function minutes(m){const a=Date.parse(m.createdAt),b=Date.parse(m.updatedAt);
 return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?Math.round((b-a)/60000):null}
function summary(missions,now=Date.now(),days=30){
 const since=now-days*864e5;
 let rows=(Array.isArray(missions)?missions:[]).filter(m=>m&&m.simulation!==true&&
  ['listening','pokemon'].includes(m.projectId)&&Date.parse(m.createdAt)>=since);
 // A first attempt the team redid on its own is not "needed you": the redo counts.
 const redone=new Set(rows.flatMap(m=>[m.retryOf,m.redoOf]).filter(Boolean));
 rows=rows.filter(m=>!redone.has(m.id));
 const count=k=>rows.filter(m=>outcome(m)===k).length;
 const finished=rows.filter(m=>['alone','checked','ready','needed_you'].includes(outcome(m)));
 const times=rows.filter(m=>outcome(m)==='alone').map(minutes).filter(x=>x!==null).sort((a,b)=>a-b);
 return Object.freeze({total:rows.length,alone:count('alone'),ready:count('ready'),neededYou:count('needed_you'),
  running:count('running'),initiatives:rows.filter(m=>m.source==='initiative').length,
  rate:finished.length?Math.round(100*(count('alone')+count('checked'))/finished.length):null,checked:count('checked'),
  medianMinutes:times.length?times[Math.floor(times.length/2)]:null,
  recent:rows.slice(0,8).map(m=>({who:NAME[m.projectId]||m.projectId,source:SOURCE[m.source]||SOURCE.owner,
   title:String(m.report?.title||m.goal||'').replace(/\s+/g,' ').trim().slice(0,70),outcome:outcome(m),minutes:minutes(m)}))});
}
// What Matt says at the Town Hall table: the last 7 days in one short line.
function weekLine(missions,now=Date.now()){
 const s=summary(missions,now,7);
 if(!s.total)return 'Ήσυχη εβδομάδα: καμία εργασία τις τελευταίες 7 μέρες.';
 const bits=[];
 if(s.alone)bits.push(s.alone===1?'1 αλλαγή μπήκε μόνη της':s.alone+' αλλαγές μπήκαν μόνες τους');
 if(s.neededYou)bits.push(s.neededYou===1?'1 θέλει εσένα':s.neededYou+' θέλουν εσένα');
 if(s.running)bits.push(s.running===1?'1 τρέχει ακόμα':s.running+' τρέχουν ακόμα');
 if(s.initiatives)bits.push(s.initiatives===1?'1 πρωτοβουλία της ομάδας':s.initiatives+' πρωτοβουλίες της ομάδας');
 return 'Αυτή την εβδομάδα: '+(bits.length?bits.join(', '):s.total+' εργασίες')+'.';
}
const LABEL={alone:'✓ Μόνοι τους',checked:'✓ Έλεγξαν· τίποτα να αλλάξει',ready:'✓ Έτοιμο, περίμενε εσένα',needed_you:'✋ Χρειάστηκε εσένα',running:'… Σε εξέλιξη',other:'—'};
return Object.freeze({summary,outcome,weekLine,LABEL});
});
