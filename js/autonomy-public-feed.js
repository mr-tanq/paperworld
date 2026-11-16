/* PAPERWORLD V5 - present public unattended work without exposing private data.
 * Reads only the two fixed issue threads of the public Paperworld repo.
 * Comments are untrusted: only verified GitHub Actions bot report markers
 * map to bounded, authored status labels. No model calls or user actions.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldAutonomyFeed=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const API='https://api.github.com/repos/mr-tanq/paperworld';
 const MISSIONS=Object.freeze([
  Object.freeze({title:'[Paperworld autonomy] Paperworld health',
   project:'Paperworld',id:'paperworld'}),
  Object.freeze({title:'[Paperworld autonomy] Listening Mirror health',
   project:'Listening Mirror',id:'concerts'})
 ]);
 const marker=/<!-- paperworld-autonomy-v5-report:[a-f0-9]{64} -->/;
 async function load({fetcher=globalThis.fetch}={}){
  if(typeof fetcher!=='function')throw Error('fetcher_required');
  const get=async path=>{
   const response=await fetcher(API+path,{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(7000),
    headers:{Accept:'application/vnd.github+json'}
   });
   if(!response?.ok)throw Error('autonomous_reports_unavailable');
   return response.json();
  };
  const issues=await get('/issues?state=open&per_page=100');
  if(!Array.isArray(issues))throw Error('invalid_autonomous_report_list');
  const reports=[];
  for(const mission of MISSIONS){
   const issue=issues.find(item=>item?.title===mission.title&&
    !item.pull_request&&Number.isInteger(item.number)&&
    item.number>0&&item.number<1000000);
   if(!issue||!Number.isInteger(issue.comments)||issue.comments<1)continue;
   const page=Math.max(1,Math.ceil(issue.comments/100));
   const comments=await get('/issues/'+issue.number+'/comments?per_page=100&page='+page);
   if(!Array.isArray(comments))continue;
   const value=comments.toReversed().find(x=>x?.user?.login==='github-actions[bot]'&&
    typeof x.body==='string'&&marker.test(x.body));
   if(!value)continue;
   const failed=/Offline Node suite: needs attention/.test(value.body);
   const sha=/Commit: \`([a-f0-9]{12})\`/.exec(value.body)?.[1]||null;
   if(!sha||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value.created_at||''))
    continue;
   reports.push(Object.freeze({id:'autonomy-'+mission.id,
    project:mission.project,status:failed?'needs_attention':'checked',
    summary:failed?'Ο αυτόματος έλεγχος εντόπισε αποτυχία στα tests.':
     'Ο αυτόματος έλεγχος πηγών ολοκληρώθηκε χωρίς παρέμβασή σου.',
    createdAt:value.created_at,commit:sha,
    issueUrl:'https://github.com/mr-tanq/paperworld/issues/'+issue.number}));
  }
  return reports;
 }
 return Object.freeze({load,MISSIONS});
});
