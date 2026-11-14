/* PAPERWORLD agent collaboration foundation.
   Pure data and validation: NO network, AI inference, token usage, or execution. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PaperworldAgents=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PROJECTS=Object.freeze({
    town:{name:'PAPERWORLD',director:'matt'},
    workshop:{name:'Listening Mirror',director:'listening-director'},
    pokemon:{name:'Pokémon: Echoes',director:'pokemon-director'},
    wellbeing:{name:'Wellbeing & Training',director:'wellbeing-director'},
    studio:{name:'The Lost Wanderer',director:'studio-director'}
  });
  const AGENTS=Object.freeze({
    matt:{name:'Matt',role:'chief',project:'town',reportsTo:'human',canDelegateTo:['listening-director','pokemon-director','wellbeing-director','studio-director']},
    'listening-director':{name:'Listening Mirror Director',role:'director',project:'workshop',reportsTo:'matt',canDelegateTo:['listening-developer']},
    'listening-developer':{name:'Listening Mirror Developer',role:'worker',project:'workshop',reportsTo:'listening-director',canDelegateTo:[]},
    'pokemon-director':{name:'Pokémon Director',role:'director',project:'pokemon',reportsTo:'matt',canDelegateTo:[]},
    'wellbeing-director':{name:'Wellbeing Director',role:'director',project:'wellbeing',reportsTo:'matt',canDelegateTo:[]},
    'studio-director':{name:'The Lost Wanderer Director',role:'director',project:'studio',reportsTo:'matt',canDelegateTo:[]}
  });
  const OPERATIONS=Object.freeze(['investigate','summarize','plan','review']);
  const ID=/^[a-z0-9][a-z0-9_-]{0,63}$/;
  function agent(id){return Object.prototype.hasOwnProperty.call(AGENTS,id)?AGENTS[id]:null}
  function clean(s,max){
    if(typeof s!=='string'||!s.trim()||s.length>max)throw Error('Invalid or oversized text');
    return s.trim();
  }
  function route(from,to){
    const a=agent(from),b=agent(to);
    return !!(a&&b&&a.canDelegateTo.includes(to));
  }
  function proposeHandoff(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid handoff');
    const from=clean(input.from,64),to=clean(input.to,64),operation=clean(input.operation,32);
    if(!route(from,to))throw Error('Agent handoff is not authorized');
    if(!OPERATIONS.includes(operation))throw Error('Unsupported operation');
    const request=clean(input.request,2000);
    const context=typeof input.context==='string'?input.context.trim():'';
    if(context.length>4000)throw Error('Context too long');
    if(input.project!==undefined&&input.project!==agent(to).project)throw Error('Project mismatch');
    return Object.freeze({
      version:1,from,to,project:agent(to).project,operation,request,context,
      state:'proposed',execution:'none',requiresHumanApproval:true
    });
  }
  function previewHandoff(handoff){
    if(!handoff||handoff.state!=='proposed'||handoff.execution!=='none'||!route(handoff.from,handoff.to))
      throw Error('Invalid pending handoff');
    return AGENTS[handoff.from].name+' → '+AGENTS[handoff.to].name+
      ' ('+handoff.operation+'): '+handoff.request;
  }
  function roster(){return Object.keys(AGENTS).map(id=>Object.freeze({id,...AGENTS[id]}))}
  return Object.freeze({PROJECTS,AGENTS,OPERATIONS,agent,route,roster,proposeHandoff,previewHandoff});
});
