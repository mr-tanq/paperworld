/* PAPERWORLD Matt routine intent — deterministic, zero-model parse only.
 * Fails closed: no implicit local timezone/DST guesses or paid instructions.
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
 function fold(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
 function classify(message){
  const raw=String(message||'').trim();
  if(!raw||raw.length>1200)return null;
  const t=fold(raw);
  if(/(?:ρουτιν|προγραμματ|routines?)/i.test(t)&&
   /(?:δειξε|δειξ|ποιες|ποια|σταματ|παυσ|απενεργοποι|list|show)/i.test(t))
   return {kind:'list_routines'};
  if(!/(?:\b(?:every|weekly|schedule)\b|καθε|εβδομαδ|προγραμματι)/i.test(t))return null;
  const dayNames=Object.keys(weekdays).filter(k=>new RegExp('(^|[^a-zα-ω])'+k+'(?:ς)?(?=$|[^a-zα-ω])','i').test(t));
  const time=t.match(/(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  const matched=projects.filter(p=>p.match.test(t));
  const utc=/(?:\butc\b|ωρα\s+utc)/i.test(t);
  if(dayNames.length!==1||!time||matched.length!==1||!utc)
   return {kind:'clarify',reason:!utc?'timezone':'missing',
    message:raw};
  const selected=matched[0];
  const dayOfWeek=weekdays[dayNames[0]];
  const hourUtc=Number(time[1]),minuteUtc=Number(time[2]);
  if(!Number.isInteger(dayOfWeek))return {kind:'clarify',reason:'missing',message:raw};
  return {kind:'weekly_preview',projectId:selected.id,dayOfWeek,
   hourUtc,minuteUtc,goal:raw};
 }
 return Object.freeze({classify});
});