'use strict';
/* Real tools for Crow and Dave, decided in conversation and executed by the
 * owner's own app session (RLS, Suno monthly cap, routine policy all apply).
 * The Director only ends a reply with a strict action line; the server
 * validates and strips it and returns structured `actions`. Model text can
 * never name another owner, project, account or arbitrary endpoint.
 *  - Crow (studio-director): CREATE_SUNO_SONG after a complete song package
 *    → the app submits it to Suno (counts towards the 50 songs/month cap).
 *  - Dave (wellbeing-director): SAVE_TASK / REMIND_WEEKLY lines → the app
 *    adds items to the Wellbeing list and sets a weekly reminder that reaches
 *    the owner's phone (the reminder text never shows private details).
 */
const {parseSong}=require('../js/crow-studio-draft.js');
const SONG_MARKER='CREATE_SUNO_SONG';
const DAYS={SUN:0,MON:1,TUE:2,WED:3,THU:4,FRI:5,SAT:6};
const MAX_TASKS=5,MAX_REMINDERS=3;
function prompt(agentId){
 if(agentId==='studio-director')return 'You CAN create the song on Suno for the owner: when the owner asks you '+
  '(now, or clearly in this conversation) to make, create or produce the song, write the complete song '+
  'package (TITLE, SUNO STYLE PROMPT, LYRICS ending with [End]) and end your reply with the exact line '+
  SONG_MARKER+'. The app submits it with the owner\'s own Suno account (monthly limit applies). '+
  'Never write that line when the owner is only discussing ideas. ';
 if(agentId==='wellbeing-director')return 'You CAN save things for the owner: when the owner asks you to save a '+
  'plan, add exercises/habits to their list, or remind them, add at the very end of your reply one line per item: '+
  '"SAVE_TASK: <short title> || <short details>" (at most '+MAX_TASKS+') and/or '+
  '"REMIND_WEEKLY: <MON|TUE|WED|THU|FRI|SAT|SUN> <HH:MM> || <short neutral reminder>" (at most '+MAX_REMINDERS+
  ', Europe/Amsterdam time). Only when the owner asked for it. Keep reminder text neutral: no health details. ';
 return '';
}
const clean=(s,n)=>String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
function extract(agentId,content){
 const text=typeof content==='string'?content:'';
 if(agentId==='studio-director'){
  if(!text.includes(SONG_MARKER))return {content:text,actions:[]};
  const reply=text.split(SONG_MARKER).join('').trim();
  const song=parseSong(reply);
  return {content:reply,actions:song?[{type:'suno_song',brief:{title:song.title,style:song.style,lyrics:song.lyrics}}]:[],
   ...(song?{}:{actionError:'song_package_incomplete'})};
 }
 if(agentId==='wellbeing-director'){
  const kept=[],actions=[];let tasks=0,reminders=0;
  for(const line of text.split('\n')){
   const t=line.trim().replace(/^[-*•]\s*/,'').replace(/^\*\*|\*\*$/g,'');
   let m=t.match(/^SAVE_TASK\s*:\s*(.+)$/i);
   if(m){const [title,notes='']=m[1].split('||');
    if(tasks<MAX_TASKS&&clean(title,160)){tasks++;actions.push({type:'add_task',title:clean(title,160),notes:clean(notes,600)})}
    continue}
   m=t.match(/^REMIND_WEEKLY\s*:\s*([A-Za-z]{3})[a-z]*\s+([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:\|\|\s*(.*))?$/i);
   if(m){const day=DAYS[m[1].toUpperCase()];
    if(reminders<MAX_REMINDERS&&day!==undefined){reminders++;
     actions.push({type:'weekly_reminder',dayOfWeek:day,hour:Number(m[2]),minute:Number(m[3]),
      goal:clean(m[4]||'Υπενθύμιση από τον Dave',300)||'Υπενθύμιση από τον Dave'})}
    continue}
   if(/^(SAVE_TASK|REMIND_WEEKLY)\b/i.test(t))continue; // malformed tool line: never shown
   kept.push(line);
  }
  return {content:kept.join('\n').trim(),actions};
 }
 return {content:text,actions:[]};
}
module.exports=Object.freeze({prompt,extract,SONG_MARKER,DAYS});
