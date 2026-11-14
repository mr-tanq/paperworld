/* Pure visual state projection of real, owner-scoped workflow events.
 * No model calls or source authority. Movement is presentation, not execution.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldVisualWorkflow=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const STATES=Object.freeze(['created','routed','scoped','evidence_read','worker_reported','director_reviewed','reported','failed']);
 function project(events){
  if(!Array.isArray(events))return Object.freeze({phase:'idle',travel:false,meeting:false,returning:false});
  const known=events.filter(e=>e&&STATES.includes(e.state)&&
   ['matt','listening-director','listening-developer'].includes(e.actor));
  if(!known.length)return Object.freeze({phase:'idle',travel:false,meeting:false,returning:false});
  const phase=known[known.length-1].state;
  const assigned=known.some(e=>e.state==='routed'&&e.actor==='matt');
  const completed=phase==='reported'||phase==='failed';
  return Object.freeze({phase,travel:assigned&&!completed,meeting:assigned&&!completed,
   returning:assigned&&completed,failed:phase==='failed'});
 }
 return Object.freeze({STATES,project});
});
