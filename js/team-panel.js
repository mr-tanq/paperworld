/* PAPERWORLD Team view ("Η ομάδα σου") — rendered inside the Workspace.
 * Who helps with what, how to reach them, and what they are doing ONLY when
 * real owner-scoped records say so. Availability is never inferred: there are
 * no presence indicators, fake statistics or simulated activity here.
 */
(()=>{'use strict';
const profiles=window.PaperworldProfiles;
if(!profiles)return;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
// Static descriptions of responsibility (not activity claims).
const ABOUT=Object.freeze({
 matt:'Οργανώνει την ομάδα, βρίσκει ποιος μπορεί να βοηθήσει και σου φέρνει τα αποτελέσματα.',
 'listening-director':'Η εφαρμογή Listening Mirror: συναυλίες, εμπειρία χρήστη και ανάπτυξη.',
 'pokemon-director':'Το παιχνίδι Pokémon: Echoes σε Godot 4: χάρτες, μάχες και διάλογοι.',
 'studio-director':'Η μουσική του The Lost Wanderer: τραγούδια, στίχοι και Music Studio.',
 'wellbeing-director':'Προπόνηση, διατροφή και καθημερινές συνήθειες. Ιδιωτικό project.',
 'shop-director':'Το δικό του μαγαζί: έρευνα, ψηφιακά προϊόντα και πωλήσεις. Εσύ εγκρίνεις μία φορά την εβδομάδα.',
 'markets-director':'Παρακολουθεί τις μετοχές και τα ETF σου: κάθε βράδυ η μέρα, κάθε Παρασκευή η εβδομάδα. Μόνο ενημέρωση, ποτέ αγορές ή συμβουλές. Ιδιωτικό.',
 'listening-developer':'Διαβάζει τον κώδικα του Listening Mirror όταν το εγκρίνεις.',
 'pokemon-developer':'Διαβάζει τα αρχεία του Pokémon: Echoes όταν το εγκρίνεις.'
});
const PROJECT_OF=Object.freeze({matt:'town','listening-director':'workshop',
 'pokemon-director':'pokemon','studio-director':'studio','wellbeing-director':'wellbeing','shop-director':'shop','markets-director':'markets'});
// "Ο Matt" / "η Luna": Greek articles for natural action labels.
const article=id=>id==='listening-director'?'τη':'τον';
function activityLine(stats){
 // stats: {attention,active,done} from real records, or null when unavailable.
 if(!stats)return {text:'Η δραστηριότητα δεν είναι διαθέσιμη χωρίς σύνδεση.',state:'unknown'};
 const parts=[];
 if(stats.attention)parts.push(stats.attention+(stats.attention===1?' χρειάζεται εσένα':' χρειάζονται εσένα'));
 if(stats.active)parts.push(stats.active+' σε εξέλιξη');
 if(!parts.length)return {text:stats.done?'Καμία ενεργή εργασία · '+stats.done+' ολοκληρώθηκαν πρόσφατα':
  'Καμία καταγεγραμμένη εργασία αυτή τη στιγμή',state:'idle'};
 return {text:parts.join(' · '),state:stats.attention?'attention':'active'};
}
function actionButton(label,cls,handler,aria){
 const b=el('button',cls,label);b.type='button';if(aria)b.setAttribute('aria-label',aria);
 b.addEventListener('click',handler);return b;
}
function agentCard(p,{stats,featured,ctx}){
 const card=el('article','pw-agent-card'+(featured?' pw-agent-featured':''));
 card.dataset.agent=p.id;
 const avatar=el('span','pw-agent-portrait');profiles.paintAvatar(avatar,p.id);
 avatar.setAttribute('aria-hidden','true');
 const head=el('div','pw-agent-head');
 const who=el('div','pw-agent-who');
 who.append(el('h3','pw-agent-name',p.name),
  el('p','pw-agent-role',p.id==='matt'?'Chief of Staff · Όλα τα projects':p.project+' · '+p.role));
 head.append(avatar,who);
 const line=activityLine(stats);
 const activity=el('p','pw-agent-activity',line.text);activity.dataset.state=line.state;
 const actions=el('div','pw-agent-actions');
 actions.append(actionButton('Συνομιλία','pw-btn-primary',()=>ctx.chat(p.id),
  'Συνομιλία με '+article(p.id)+' '+p.name));
 if(PROJECT_OF[p.id]&&p.id!=='matt')actions.append(actionButton('Εργασίες','pw-btn-secondary',
  ()=>ctx.project(PROJECT_OF[p.id]),'Εργασίες του project '+p.project));
 actions.append(actionButton('⌖','pw-icon-btn pw-agent-locate',()=>ctx.locate(p.id),
  'Δες '+article(p.id)+' '+p.name+' στο χωριό'));
 card.append(head,el('p','pw-agent-about',ABOUT[p.id]||''),activity,actions);
 return card;
}
function workerRow(p,{status,ctx}){
 // Workers work through their Director; opening a Worker never fabricates
 // an independent AI account, call, assignment or message.
 const responsible=p.id==='listening-developer'?'listening-director':
  p.id==='pokemon-developer'?'pokemon-director':p.id;
 const director=profiles.get(responsible);
 const row=el('article','pw-worker');
 const avatar=el('span','pw-worker-avatar');profiles.paintAvatar(avatar,p.id);
 const info=el('div','pw-worker-info');
 info.append(el('strong','',p.name),el('p','pw-agent-about',ABOUT[p.id]||''));
 if(status)info.append(el('p','pw-agent-activity',status));
 const via=actionButton('Μέσω '+(director?.name||'Director')+' ›','pw-chip',
  ()=>ctx.chat(responsible),
  'Μίλα στον αρμόδιο Director, '+(director?.name||''));
 row.title='Μίλα στον αρμόδιο Director';
 row.append(avatar,info,via);
 return row;
}
// Latest REAL worker state per worker (read-only investigation records).
function workerStatus(raw,workerId){
 const project=workerId==='listening-developer'?'listening':'pokemon';
 const awaiting=(raw?.teamJobs||[]).some(j=>j?.workerId===workerId&&j?.status==='awaiting_consent');
 if(awaiting)return 'Ένας έλεγχος περιμένει την έγκρισή σου.';
 const runs=(raw?.workerRuns||[]).filter(r=>r?.project===project&&r?.workerId===workerId);
 const last=runs.sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0))[0];
 if(!last)return null;
 return last.status==='running'?'Τελευταίος έλεγχος: δεν έχει τελειώσει.':
  last.status==='reported'?'Τελευταίος έλεγχος: ολοκληρώθηκε χωρίς αλλαγές.':
  last.status==='failed'?'Τελευταίος έλεγχος: σταμάτησε.':null;
}
function render(host,ctx){
 host.replaceChildren();
 const intro=el('div','pw-view-intro');
 intro.append(el('p','pw-lede','Πάτησε «Συνομιλία» για να μιλήσεις απευθείας με κάποιον.'));
 const hall=document.querySelector('#call-visual-meeting');
 if(hall)intro.append(actionButton('Συγκέντρωση στο Town Hall','pw-chip',()=>ctx.townHall(),
  'Συγκέντρωσε την ομάδα στο Town Hall'));
 host.append(intro);
 const all=profiles.entries('director');
 const matt=all.find(p=>p.id==='matt');
 if(matt)host.append(agentCard(matt,{stats:ctx.stats('town',true),featured:true,ctx}));
 const grid=el('div','pw-agent-grid');grid.setAttribute('role','list');
 for(const p of all.filter(p=>p.id!=='matt')){
  const card=agentCard(p,{stats:ctx.stats(PROJECT_OF[p.id]),ctx});card.setAttribute('role','listitem');
  grid.append(card);
 }
 const directors=el('section','pw-section');
 directors.append(el('h2','pw-section-title','Directors'),grid);
 host.append(directors);
 const workers=el('section','pw-section pw-workers');
 workers.append(el('h2','pw-section-title','Βοηθοί ανάπτυξης'),
  el('p','pw-section-hint','Ελέγχουν κώδικα μόνο μέσω του υπεύθυνου του project και μόνο με την έγκρισή σου.'));
 for(const p of profiles.entries('worker'))
  workers.append(workerRow(p,{status:ctx.raw?workerStatus(ctx.raw,p.id):null,ctx}));
 host.append(workers);
}
window.PaperworldTeamView=Object.freeze({render,activityLine,workerStatus,ABOUT,PROJECT_OF});
})();
