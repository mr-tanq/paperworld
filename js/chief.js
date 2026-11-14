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

  // Generic planning brief. Does not guess the repo files or fabricate AI work.
  function missionFor(task){
    if(!task||!REPOS[task.room]||!String(task.title||'').trim())throw Error('Unsupported mission project');
    const repo=REPOS[task.room];
    const heading='Project investigation';
    const text=[
      'PAPERWORLD — HUMAN REVIEW MISSION',
      'Project: '+PROJECTS[task.room],
      'Repository: '+repo,
      'Task: '+String(task.title||'').trim().slice(0,160),
      'User notes: '+(String(task.notes||'').trim()||'(no notes supplied)'),
      'Scope: investigation / planning ONLY; no code changes authorized.',
      'Investigation plan:',
      '1. Inspect project instructions and relevant available source files.',
      '2. Reproduce or clarify the specific request without making unsupported assumptions.',
      '3. Determine appropriate specialist based on verified task needs.',
      '4. Report evidence, options and any risks to the Chief of Staff.',
      '5. Ask for separate approval before file edits or AI execution with credits.',
      'Definition of done: a reviewed diagnosis or plan, not claimed automatic completion.',
      'Execution status: NOT STARTED.'
    ].join('\n');
    return {source_task_id:task.id,project_room:task.room,repository:repo,title:heading+': '+String(task.title||'').trim().slice(0,110),brief:text.slice(0,6000),mode:'analysis_only'};
  }
  return {PROJECTS,REPOS,summarize,brief,issueDraftUrl,missionFor};

});
