/* Paperworld Routine Loop — deterministic schedule planning only.
 * No model, network, DB mutation or job triggering.
 *
 * Schedules are LOCAL wall-clock times in an IANA zone (default
 * Europe/Amsterdam). The database is authoritative for next_review_at
 * (sql/paperworld_routine_loop_release_v1.sql); nextLocalSlot() mirrors
 * PostgreSQL's rules exactly so previews match what will happen:
 *  - a local time inside the spring-forward gap uses the pre-transition offset
 *  - a repeated autumn local time resolves to the later instant
 */
'use strict';
const {randomUUID}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const PROJECTS=new Set(['listening','pokemon','studio','wellbeing']);
const DIRECTOR={listening:'listening-director',pokemon:'pokemon-director',
 studio:'studio-director',wellbeing:'wellbeing-director'};
const TIMEZONES=new Set(['Europe/Amsterdam','UTC']);
const DEFAULT_TIMEZONE='Europe/Amsterdam';
const HOUR=3600000;
function reject(){throw Error('routine_invalid_plan')}
const formatters=new Map();
function partsIn(tz,ms){
 if(!formatters.has(tz))formatters.set(tz,new Intl.DateTimeFormat('en-US',{timeZone:tz,
  hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',
  minute:'numeric',second:'numeric',weekday:'short'}));
 const out={};
 for(const p of formatters.get(tz).formatToParts(new Date(ms)))out[p.type]=p.value;
 return {y:+out.year,mo:+out.month,d:+out.day,h:+out.hour,mi:+out.minute,s:+out.second,
  dow:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(out.weekday)};
}
// UTC offset (ms) of tz at an instant.
function offsetAt(tz,ms){
 const p=partsIn(tz,ms);
 return Date.UTC(p.y,p.mo-1,p.d,p.h,p.mi,p.s)-Math.floor(ms/1000)*1000;
}
// Local wall-clock fields → instant, using PostgreSQL's resolution rules.
function localToInstant(tz,y,mo,d,h,mi){
 const t0=Date.UTC(y,mo-1,d,h,mi);
 const before=offsetAt(tz,t0-3*HOUR),after=offsetAt(tz,t0+3*HOUR);
 const valid=[...new Set([before,after])].map(o=>t0-o).filter(i=>offsetAt(tz,i)===t0-i);
 if(valid.length)return Math.max(...valid);   // repeated hour → later instant
 return t0-before;                            // gap → pre-transition offset
}
function validSchedule(day,hour,minute,tz){
 return Number.isInteger(day)&&day>=0&&day<=6&&Number.isInteger(hour)&&hour>=0&&hour<=23&&
  Number.isInteger(minute)&&minute>=0&&minute<=59&&TIMEZONES.has(tz);
}
// First local occurrence of (weekday, hh:mm) strictly after `after`.
function nextLocalSlot(day,hour,minute,tz=DEFAULT_TIMEZONE,after=new Date()){
 const ms=after instanceof Date?after.getTime():Number(after);
 if(!validSchedule(day,hour,minute,tz)||!Number.isFinite(ms))reject();
 const local=partsIn(tz,ms);
 const base=Date.UTC(local.y,local.mo-1,local.d)+((day-local.dow+7)%7)*24*HOUR;
 for(let week=0;week<3;week++){
  const date=new Date(base+week*7*24*HOUR);
  const instant=localToInstant(tz,date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),hour,minute);
  if(instant>ms)return new Date(instant).toISOString();
 }
 reject();
}
function normalizeRoutine(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).sort().join(',')!==
   'dayOfWeek,enabled,goal,hour,maxAiCalls,minute,ownerId,projectId,routineId,threadId,timezone')
  reject();
 const {dayOfWeek,enabled,goal,hour,maxAiCalls,minute,ownerId,projectId,routineId,threadId,timezone}=input;
 if(![ownerId,threadId,routineId].every(x=>UUID.test(x||''))||
  !PROJECTS.has(projectId)||typeof enabled!=='boolean'||
  typeof goal!=='string'||!goal.trim()||goal.length>1200||
  !validSchedule(dayOfWeek,hour,minute,timezone)||maxAiCalls!==0)reject();
 return Object.freeze({ownerId,threadId,routineId,projectId,directorId:DIRECTOR[projectId],
  goal:goal.trim(),enabled,dayOfWeek,hour,minute,timezone,maxAiCalls,
  additionalSpendUsd:0,executionMode:'draft_review_only'});
}
// The most recent due slot at or before `now` (what the heartbeat stages).
function dueSlot(plan,now=new Date()){
 const p=normalizeRoutine(plan);
 const ms=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(ms))reject();
 if(!p.enabled)return null;
 const scheduledAt=nextLocalSlot(p.dayOfWeek,p.hour,p.minute,p.timezone,new Date(ms-8*24*HOUR));
 let slot=scheduledAt;
 for(let next=nextLocalSlot(p.dayOfWeek,p.hour,p.minute,p.timezone,new Date(slot));
  Date.parse(next)<=ms;next=nextLocalSlot(p.dayOfWeek,p.hour,p.minute,p.timezone,new Date(next)))slot=next;
 return Object.freeze({routineId:p.routineId,ownerId:p.ownerId,projectId:p.projectId,
  scheduledAt:slot,slotKey:p.routineId+':'+slot,
  mission:{id:randomUUID(),ownerId:p.ownerId,threadId:p.threadId,
   projectId:p.projectId,goal:p.goal,status:'draft',
   policy:Object.freeze({executionMode:'draft_review_only',maxAiCalls:0,
    additionalSpendUsd:0,noAutoMerge:true,noAutoDeploy:true})}});
}
module.exports=Object.freeze({normalizeRoutine,dueSlot,nextLocalSlot,localToInstant,
 validSchedule,TIMEZONES,DEFAULT_TIMEZONE});
