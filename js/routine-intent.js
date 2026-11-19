/* PAPERWORLD Matt routine intent — deterministic, zero-model parse only.
 * Times are local wall-clock time in Europe/Amsterdam unless the owner
 * explicitly says UTC. The database applies daylight saving correctly.
 * Nothing is saved from text alone: the owner confirms a preview card.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldRoutineIntent=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const weekdays={κυριακη:0,δευτερα:1,τριτη:2,τεταρτη:3,πεμπτη:4,παρασκευη:5,σαββατο:6,
  sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
 const projects=[
  {id:'listening',match:/listening\s*mirror|συναυλι|concert|festival|φεστιβαλ/i},
  {id:'pokemon',match:/pok[eé]mon|ποκεμον|echoes/i},
  {id:'studio',match:/lost\s*wanderer|crow|μουσικ|τραγουδι|studio/i},
  {id:'wellbeing',match:/wellbeing|ευεξι|υγεια|ασκησ|φυσιοθεραπ/i}
 ];
 const DEFAULT_TIMEZONE='Europe/Amsterdam';
 function fold(v){return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
 function parseTime(t){
  const hm=t.match(/(?:^|[^\d])([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/);
  if(hm)return {hour:Number(hm[1]),minute:Number(hm[2])};
  // "στις 9", "at 9" (whole hour). Afternoon words shift 1–11 by 12.
  const h=t.match(/(?:στις|at)\s+([01]?\d|2[0-3])(?![\d:.])/);
  if(!h)return null;
  let hour=Number(h[1]);
  if(hour<12&&/(?:(?:^|[^α-ω])μ\.?\s?μ\.?|απογευμα|βραδυ|\bpm\b)/.test(t))hour+=12;
  return {hour,minute:0};
 }
 function classify(message){
  const raw=String(message||'').trim();
  if(!raw||raw.length>1200)return null;
  const t=fold(raw);
  if(/(?:ρουτιν|προγραμμα|routines?)/i.test(t)&&
   /(?:δειξε|δειξ|ποιες|ποια|σταματ|παυσ|απενεργοποι|αλλαξ|αλλαγ|επεξεργ|list|show|edit|change)/i.test(t))
   return {kind:'list_routines'};
  if(!/(?:\b(?:every|weekly|schedule)\b|καθε|εβδομαδ|προγραμματι)/i.test(t))return null;
  const dayNames=Object.keys(weekdays).filter(k=>new RegExp('(^|[^a-zα-ω])'+k+'(?:ς)?(?=$|[^a-zα-ω])','i').test(t));
  const time=parseTime(t);
  const matched=projects.filter(p=>p.match.test(t));
  if(dayNames.length!==1||!time||matched.length!==1)
   return {kind:'clarify',reason:'missing',message:raw};
  const timezone=/(?:\butc\b|ωρα\s+utc)/i.test(t)?'UTC':DEFAULT_TIMEZONE;
  return {kind:'weekly_preview',projectId:matched[0].id,dayOfWeek:weekdays[dayNames[0]],
   hour:time.hour,minute:time.minute,timezone,goal:raw};
 }
 return Object.freeze({classify,DEFAULT_TIMEZONE});
});
