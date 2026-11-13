/* PAPERWORLD Chief of Staff — transparent, rule-based task review.
   No AI model, background work, API calls or automatic side effects. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PaperworldChief=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PROJECTS={town:'PAPERWORLD',workshop:'Listening Mirror',pokemon:'Pokémon: Echoes',wellbeing:'Wellbeing & Training',studio:'The Lost Wanderer'};
  const REPOS={town:'mr-tanq/paperworld',workshop:'mr-tanq/concerts'};
  function summarize(tasks){
    if(!Array.isArray(tasks))throw Error('Expected cloud task list');
    const pending=tasks.filter(t=>t&&PROJECTS[t.room]&&(t.status==='todo'||t.status==='doing'));
    const ranked=pending.map(t=>{
      const inProgress=t.status==='doing';
      const created=Date.parse(t.created_at||'');
      return {id:t.id,title:String(t.title||'').slice(0,160),room:t.room,status:t.status,created_at:t.created_at||null,
        score:(inProgress?100:20),reason:inProgress?'Already in progress — review or finish it first':'Not started — available to plan',
        timestamp:Number.isFinite(created)?created:Infinity};
    }).sort((a,b)=>b.score-a.score||a.timestamp-b.timestamp||a.room.localeCompare(b.room)||a.title.localeCompare(b.title));
    const doing=ranked.filter(t=>t.status==='doing'),todo=ranked.filter(t=>t.status==='todo');
    return {open:pending.length,doing:doing.length,todo:todo.length,done:tasks.filter(t=>t&&t.status==='done').length,review:ranked.slice(0,5),
      guidance:doing.length?'Review the tasks already in progress before starting more.':todo.length?'Choose one task to begin; these are not ranked by urgency.':'Nothing is waiting in the cloud task list.'};
  }
  function brief(task){
    if(!task||!PROJECTS[task.room])throw Error('Unknown project');
    const name=String(task.title||'').trim();
    if(!name)throw Error('Task title missing');
    return ['Project: '+PROJECTS[task.room],'Task: '+name,'Status: '+({todo:'To do',doing:'In progress',done:'Done'}[task.status]||'Unknown'),
      'Notes: '+(String(task.notes||'').trim()||'(none)'),
      'Source: PAPERWORLD task board',
      'Action requested: Review the scope and decide next steps. No automatic code changes are authorized.'].join('\n');
  }
  function issueDraftUrl(task){
    const repo=REPOS[task?.room];if(!repo)return null;
    const title=String(task.title||'').trim();if(!title)return null;
    return 'https://github.com/'+repo+'/issues/new?title='+encodeURIComponent(title.slice(0,160))+'&body='+encodeURIComponent(brief(task));
  }

  const ticketSwapFiles=[
    'js/concert-ticketswap.js',
    'js/ticketswap-check.js',
    'scripts/lib/ticketswap-matching.mjs',
    'scripts/lib/ticketswap-going.mjs',
    'scripts/test-ticketswap.mjs'
  ];
  function missionFor(task){
    if(!task||!REPOS[task.room]||!String(task.title||'').trim())throw Error('Unsupported mission project');
    const repo=REPOS[task.room];
    const isTicketSwap=task.room==='workshop'&&/ticket\s*swap|ticketswap/i.test(task.title+' '+(task.notes||''));
    const references=isTicketSwap?ticketSwapFiles:[];
    const heading=isTicketSwap?'TicketSwap fallback investigation':'Task investigation';
    const steps=isTicketSwap?[
      'Reproduce the failure when the user presses the TicketSwap check or search fallback and no matching ticket is found.',
      'Trace the frontend render/check flow, the request queue and event matching; distinguish no matching event, no tickets, stale snapshot and API/network error.',
      'Preserve safe TicketSwap URL validation and avoid reporting availability unless confirmed by the source.',
      'Add or update deterministic regression tests for the observed failure before proposing a code change.',
      'Prepare a scoped patch on a new branch and draft PR only after separate explicit authorization.'
    ]:[
      'Read the relevant files and reproduce the exact reported problem.',
      'Record what is confirmed and what requires clarification.',
      'List a focused test plan, possible fixes, and any risks.',
      'Request separate approval before touching repository files or creating a PR.'
    ];
    const text=[
      'PAPERWORLD — HUMAN REVIEW MISSION',
      'Project: '+PROJECTS[task.room],
      'Repository: '+repo,
      'Task: '+String(task.title||'').trim().slice(0,160),
      'User notes: '+(String(task.notes||'').trim()||'(no notes supplied)'),
      'Suggested specialist: '+(isTicketSwap?'Frontend + TicketSwap integration engineer':'Repository analyst'),
      'Scope: investigation / planning ONLY; no code changes authorized.',
      'Reference files to inspect (not proof of the bug):',
      ...(references.length?references.map(x=>'- '+x):['- Identify relevant files in the repository.']),
      'Investigation plan:',
      ...steps.map((x,i)=>(i+1)+'. '+x),
      'Definition of done for this mission: evidence-based diagnosis, reproducible steps and a test/fix proposal for human review.',
      'Permission boundary: DO NOT modify files, push commits, open or merge PRs, deploy, spend money, call paid APIs or use credentials. A future action requires distinct human approval.',
      'Execution status: NOT STARTED; this is a saved planning brief only.'
    ].join('\n');
    return {source_task_id:task.id,project_room:task.room,repository:repo,title:heading+': '+String(task.title||'').trim().slice(0,110),brief:text.slice(0,6000),mode:'analysis_only'};
  }
  return {PROJECTS,REPOS,summarize,brief,issueDraftUrl,missionFor};

});
