/* Paperworld Routine Loop V1 — deterministic schedule planning only.
 * No model, network, DB mutation or job triggering. Times are explicit UTC.
 */
'use strict';
const {randomUUID}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const PROJECTS=new Set(['listening','pokemon','studio','wellbeing']);
const DIRECTOR={listening:'listening-director',pokemon:'pokemon-director',
 studio:'studio-director',wellbeing:'wellbeing-director'};
const WEEKDAYS=new Set([0,1,2,3,4,5,6]);
function reject(){throw Error('routine_invalid_plan')}
function normalizeRoutine(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).sort().join(',')!==
   'dayOfWeek,enabled,goal,hourUtc,maxAiCalls,minuteUtc,ownerId,projectId,routineId,threadId')
  reject();
 const {dayOfWeek,enabled,goal,hourUtc,maxAiCalls,minuteUtc,ownerId,projectId,routineId,threadId}=input;
 if(![ownerId,threadId,routineId].every(x=>UUID.test(x||''))||
  !PROJECTS.has(projectId)||typeof enabled!=='boolean'||
  typeof goal!=='string'||!goal.trim()||goal.length>1200||
  !WEEKDAYS.has(dayOfWeek)||!Number.isInteger(hourUtc)||hourUtc<0||hourUtc>23||
  !Number.isInteger(minuteUtc)||minuteUtc<0||minuteUtc>59||
  maxAiCalls!==0)reject();
 return Object.freeze({ownerId,threadId,routineId,projectId,directorId:DIRECTOR[projectId],
  goal:goal.trim(),enabled,dayOfWeek,hourUtc,minuteUtc,maxAiCalls,
  additionalSpendUsd:0,executionMode:'draft_review_only'});
}
function dueSlot(plan,now=new Date()){
 const p=normalizeRoutine(plan);
 const ms=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(ms))reject();
 if(!p.enabled)return null;
 const date=new Date(ms);
 const currentDay=date.getUTCDay();
 const delta=(currentDay-p.dayOfWeek+7)%7;
 const start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-delta,
  p.hourUtc,p.minuteUtc));
 if(start.getTime()>ms)start.setUTCDate(start.getUTCDate()-7);
 const scheduledAt=start.toISOString();
 return Object.freeze({routineId:p.routineId,ownerId:p.ownerId,projectId:p.projectId,
  scheduledAt,slotKey:p.routineId+':'+scheduledAt,
  mission:{id:randomUUID(),ownerId:p.ownerId,threadId:p.threadId,
   projectId:p.projectId,goal:p.goal,status:'draft',
   policy:Object.freeze({executionMode:'draft_review_only',maxAiCalls:0,
    additionalSpendUsd:0,noAutoMerge:true,noAutoDeploy:true})}});
}
module.exports=Object.freeze({normalizeRoutine,dueSlot});
