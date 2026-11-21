/* PAPERWORLD — runs the tools Crow and Dave chose in conversation, with the
 * owner's own session: Crow's song goes to the owner's Suno account (monthly
 * cap), Dave's items go to the Wellbeing list, reminders become weekly
 * routines that reach the phone. Returns plain Greek lines for the chat.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldDirectorActions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const DAY=['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
const two=n=>String(n).padStart(2,'0');
const SUNO_REASONS={suno_oauth_required:'πρώτα σύνδεσε το Suno από το Music Studio του Crow',
 suno_monthly_limit_reached:'φτάσαμε το όριο των 50 τραγουδιών αυτόν τον μήνα',
 audio_create_already_submitted:'αυτό το τραγούδι έχει ήδη σταλεί'};
function valid(a){
 if(!a||typeof a!=='object')return false;
 if(a.type==='suno_song')return typeof a.brief?.title==='string'&&typeof a.brief?.style==='string'&&typeof a.brief?.lyrics==='string';
 if(a.type==='add_task')return typeof a.title==='string'&&a.title.trim().length>0&&a.title.length<=160;
 if(a.type==='weekly_reminder')return Number.isInteger(a.dayOfWeek)&&a.dayOfWeek>=0&&a.dayOfWeek<=6&&
  Number.isInteger(a.hour)&&a.hour>=0&&a.hour<=23&&Number.isInteger(a.minute)&&a.minute>=0&&a.minute<=59&&
  typeof a.goal==='string'&&a.goal.trim().length>0;
 return false;
}
async function run(actions,{cloud,requestId}={}){
 const lines=[];
 for(const a of Array.isArray(actions)?actions.slice(0,8):[]){
  if(!valid(a))continue;
  try{
   if(a.type==='suno_song'){
    const r=await cloud.createSunoSong(a.brief,requestId);
    if(r?.accepted===true)lines.push('🎵 Το «'+a.brief.title+'» στάλθηκε στο Suno. Θα το βρεις στη βιβλιοθήκη σου σε λίγα λεπτά.');
    else lines.push('🎵 Δεν στάλθηκε στο Suno: '+(SUNO_REASONS[r?.reason]||'το Suno δεν το δέχτηκε αυτή τη στιγμή')+'. Δεν χρεώθηκε τίποτα.');
   }else if(a.type==='add_task'){
    await cloud.addTask('wellbeing',a.title.trim(),String(a.notes||'').trim());
    lines.push('✓ Το πρόσθεσα στη λίστα σου: «'+a.title.trim()+'».');
   }else if(a.type==='weekly_reminder'){
    const made=await cloud.createRoutine({projectId:'wellbeing',goal:a.goal.trim(),dayOfWeek:a.dayOfWeek,hour:a.hour,minute:a.minute});
    await cloud.changeRoutine(made.routineId,true);
    lines.push('⏰ Υπενθύμιση κάθε '+DAY[a.dayOfWeek]+' στις '+two(a.hour)+':'+two(a.minute)+'. Θα σου έρχεται και στο κινητό.');
   }
  }catch(_){
   lines.push(a.type==='suno_song'?'🎵 Δεν μπόρεσα να το στείλω στο Suno τώρα. Δοκίμασε ξανά από το Music Studio.':
    a.type==='add_task'?'Δεν μπόρεσα να το προσθέσω στη λίστα: «'+a.title+'».':
    'Δεν μπόρεσα να βάλω την υπενθύμιση. Δοκίμασε ξανά σε λίγο.');
  }
 }
 return lines;
}
return Object.freeze({run,valid});
});
