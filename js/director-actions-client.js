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
// One voice setting shared with the Music Studio: "Τυχαία" by default; the
// owner's saved "The Wanderer" voice only when they explicitly picked it.
const VOICE_KEY='paperworld-suno-voice-choice-v1-';
function voiceChoice(cloud,storage){
 let pref=null;try{const o=cloud?.ownerId?.();if(o)pref=storage?.getItem?.(VOICE_KEY+o)}catch(_){}
 return pref==='wanderer'||(typeof pref==='string'&&pref.startsWith('voice:'))?'wanderer':'random';
}
async function pickVoice(cloud,storage){
 if(voiceChoice(cloud,storage)!=='wanderer')return {id:null,name:'Τυχαία'};
 if(typeof cloud?.listSunoVoices!=='function')return null;
 let voices;try{voices=await cloud.listSunoVoices()}catch(_){return null}
 if(!Array.isArray(voices))return null;
 const v=voices.find(voice=>String(voice?.name||'').trim().toLowerCase()==='the wanderer');
 return v?{id:v.id,name:v.name}:null;
}
function blockedWords(brief){
 try{const d=typeof require==='function'?require('./crow-studio-draft.js'):globalThis.PaperworldCrowStudioDraft;
  return d?.sunoBlockedWords?.(brief)||[]}catch(_){return globalThis.PaperworldCrowStudioDraft?.sunoBlockedWords?.(brief)||[]}
}
const unverified='🎵 Η υποβολή δεν επαληθεύτηκε. Έλεγξε πρώτα τη βιβλιοθήκη σου στο Suno.';
async function run(actions,{cloud,requestId,confirmSuno,storage=(typeof localStorage!=='undefined'?localStorage:null)}={}){
 const lines=[];
 for(const a of Array.isArray(actions)?actions.slice(0,8):[]){
  if(!valid(a))continue;
  try{
   if(a.type==='suno_song'){
    if(typeof confirmSuno!=='function')continue;
    const blocked=blockedWords(a.brief);
    if(blocked.length){lines.push('🎵 Δεν στάλθηκε: το Suno απορρίπτει τη λέξη «'+blocked.join('», «')+
     '» (τη θεωρεί copyright). Ζήτα από τον Crow να την αλλάξει. Δεν χρεώθηκε τίποτα.');continue}
    const ownerId=cloud.ownerId?.();
    const voice=await pickVoice(cloud,storage);
    if(!voice){lines.push('🎵 Δεν βρέθηκε η φωνή «The Wanderer» στο Suno σου. Διάλεξε «Τυχαία» στο Music Studio ή δοκίμασε ξανά.');continue}
    if(cloud.ownerId?.()!==ownerId||confirmSuno({title:a.brief.title,voice:voice.name})!==true){
     lines.push('🎵 Η υποβολή στο Suno ακυρώθηκε.');continue;
    }
    const r=await cloud.createSunoSong(a.brief,requestId,voice.id);
    if(r?.accepted===true)lines.push('🎵 Το «'+a.brief.title+'» στάλθηκε στο Suno με φωνή «'+voice.name+
     '». Το Suno επιβεβαίωσε τη λήψη. Έλεγξε τη βιβλιοθήκη σου για την ολοκλήρωση.');
    else if(r?.status==='blocked_before_submission')lines.push('🎵 Η υποβολή στο Suno μπλοκαρίστηκε. '+
     (SUNO_REASONS[r.reason]||'Έλεγξε το τραγούδι και τη σύνδεση στο Music Studio.'));
    else lines.push(unverified);
   }else if(a.type==='add_task'){
    await cloud.addTask('wellbeing',a.title.trim(),String(a.notes||'').trim());
    lines.push('✓ Το πρόσθεσα στη λίστα σου: «'+a.title.trim()+'».');
   }else if(a.type==='weekly_reminder'){
    const made=await cloud.createRoutine({projectId:'wellbeing',goal:a.goal.trim(),dayOfWeek:a.dayOfWeek,hour:a.hour,minute:a.minute});
    await cloud.changeRoutine(made.routineId,true);
    lines.push('⏰ Υπενθύμιση κάθε '+DAY[a.dayOfWeek]+' στις '+two(a.hour)+':'+two(a.minute)+'. Θα σου έρχεται και στο κινητό.');
   }
  }catch(_){
   lines.push(a.type==='suno_song'?unverified:
    a.type==='add_task'?'Δεν μπόρεσα να το προσθέσω στη λίστα: «'+a.title+'».':
    'Δεν μπόρεσα να βάλω την υπενθύμιση. Δοκίμασε ξανά σε λίγο.');
  }
 }
 return lines;
}
return Object.freeze({run,valid,pickVoice,voiceChoice,VOICE_KEY});
});
