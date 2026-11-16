/* PAPERWORLD dedicated cloud project. Browser-only Supabase Auth + PostgREST.
   Publishable API key is intentionally public; RLS authorizes every row. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperworldCloud=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
 const KEY='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
 const TOKEN_STORAGE='paperworld-cloud-session-v1';
 const ROOMS=new Set(['town','workshop','pokemon','wellbeing','studio']);
 function createClient({fetcher=typeof fetch==='function'?fetch.bind(globalThis):null,storage=typeof localStorage!=='undefined'?localStorage:null}={}){
  if(!fetcher)throw Error('Network API unavailable');
  let session=null;
  try{const saved=storage?.getItem(TOKEN_STORAGE);if(saved){const v=JSON.parse(saved);if(v&&typeof v.access_token==='string'&&typeof v.refresh_token==='string')session=v}}catch(_){}
  const save=v=>{session=v;if(!storage)return;try{if(v)storage.setItem(TOKEN_STORAGE,JSON.stringify(v));else storage.removeItem(TOKEN_STORAGE)}catch(_){}};
  async function request(path,{method='GET',data,auth=false,extra={}}={}){
   const headers={'apikey':KEY,...extra};if(data!==undefined)headers['Content-Type']='application/json';
   if(auth){if(!session?.access_token)throw Error('Sign in to use cloud tasks');
    headers.Authorization='Bearer '+session.access_token}
   let response;
   try{response=await fetcher(BASE+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)})}
   catch(_){throw Error('Network unavailable. Your local tasks have not been changed.')}
   if(!response.ok){let detail='';try{const e=await response.json();detail=e.msg||e.message||e.error_description||e.error||''}catch(_){}
    throw Error((detail||'Cloud request failed')+' (HTTP '+response.status+')')}
   if(response.status===204)return null;
   const text=await response.text();return text?JSON.parse(text):null;
  }
  function accept(result){if(!result?.access_token||!result?.refresh_token)throw Error('No session returned; check your email to confirm this account');save({...result,expires_at:Date.now()+Number(result.expires_in||3600)*1000});return session}
  async function refresh(){
   if(!session?.refresh_token)throw Error('Sign in to use cloud tasks');
   try{const r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',data:{refresh_token:session.refresh_token}});return accept(r)}
   catch(e){save(null);throw new Error('Your session expired. Please sign in again.')}
  }
  async function ensureAuth(){if(!session?.access_token)throw Error('Sign in first');if(!session.expires_at||session.expires_at<Date.now()+90000)await refresh()}
  async function login(email,password){const r=await request('/auth/v1/token?grant_type=password',{method:'POST',data:{email,password}});return accept(r)}
  async function signup(email,password){
   const r=await request('/auth/v1/signup',{method:'POST',data:{email,password},extra:{'Accept':'application/json'}});
   if(r?.access_token)accept(r);
   return !!session;
  }
  async function signout(){if(session?.access_token){try{await request('/auth/v1/logout',{method:'POST',auth:true})}catch(_){}}save(null)}
  const identity=()=>session?.user?.email||'Signed-in user';
  const signedIn=()=>!!session?.access_token;
  async function withAuth(path,opts={}){
   await ensureAuth();
   try{return await request(path,{...opts,auth:true})}
   catch(e){if(/HTTP 401/.test(e.message)){await refresh();return request(path,{...opts,auth:true})}throw e}
  }
  const fields='id,owner_id,room,title,notes,status,created_at,local_task_id';
  async function list(room){
   if(room&&!ROOMS.has(room))throw Error('Invalid room');
   const filter=room?'&room=eq.'+encodeURIComponent(room):'';
   return withAuth('/rest/v1/paperworld_tasks?select='+fields+filter+'&order=created_at.desc&limit=2000');
  }
  async function add(room,title,notes='',local_task_id=null){
   title=String(title||'').trim().slice(0,160);notes=String(notes||'').slice(0,1500);
   if(!ROOMS.has(room)||!title)throw Error('Project and title required');
   const payload={room,title,notes,status:'todo'};
   if(local_task_id!==null){const source=String(local_task_id);if(!source||source.length>120)throw Error('Invalid local task ID');payload.local_task_id=source}
   const rows=await withAuth('/rest/v1/paperworld_tasks?select='+fields,{method:'POST',data:payload,extra:{Prefer:'return=representation'}});
   return rows[0];
  }
  async function update(id,patch){
   if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid task ID');
   const permitted={};
   if(Object.prototype.hasOwnProperty.call(patch,'title')){const t=String(patch.title||'').trim().slice(0,160);if(!t)throw Error('Title required');permitted.title=t}
   if(Object.prototype.hasOwnProperty.call(patch,'notes'))permitted.notes=String(patch.notes||'').slice(0,1500);
   if(Object.prototype.hasOwnProperty.call(patch,'status')){if(!['todo','doing','done'].includes(patch.status))throw Error('Invalid status');permitted.status=patch.status}
   if(!Object.keys(permitted).length)throw Error('No changes');
   const rows=await withAuth('/rest/v1/paperworld_tasks?id=eq.'+encodeURIComponent(id)+'&select='+fields,{method:'PATCH',data:permitted,extra:{Prefer:'return=representation'}});
   if(!rows.length)throw Error('Task not found or not accessible');return rows[0];
  }
  async function remove(id){if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid task ID');await withAuth('/rest/v1/paperworld_tasks?id=eq.'+encodeURIComponent(id),{method:'DELETE'})}
  function prepareImport(localTasks,remoteTasks){
   if(!Array.isArray(localTasks)||!Array.isArray(remoteTasks))throw Error('Invalid task lists');
   const known=new Set(remoteTasks.map(t=>t.local_task_id).filter(Boolean));
   const incoming=[];let duplicates=0;
   for(const t of localTasks){if(!t||!ROOMS.has(t.room)||typeof t.id!=='string'||t.id.length>120)continue;
    if(known.has(t.id)){duplicates++;continue}
    if(typeof t.title!=='string'||!t.title.trim())continue;
    incoming.push(t);known.add(t.id);
   }
   return {incoming,duplicates};
  }
  async function importTasks(localTasks){
   const current=await list();
   const {incoming,duplicates}=prepareImport(localTasks,current);
   if(incoming.length>2000)throw Error('Too many tasks to import');
   let imported=0,skipped=duplicates;
   // Fail safely on partial imports: existing local_task_id uniques prevent duplicates on retry.
   for(const t of incoming){
    try{const made=await add(t.room,t.title,t.notes||'',t.id);
     if(t.status==='doing'||t.status==='done')await update(made.id,{status:t.status});imported++;
    }catch(e){if(/duplicate key|unique constraint|HTTP 409/i.test(e.message)){skipped++;continue}
     throw Error('Import stopped after '+imported+' tasks; originals untouched. '+e.message)}
   }
   return {imported,skipped};
  }

  // Owner-only Director Memory review, read-only. RLS is enforced in
  // Supabase; agents cannot gain additional permissions from this method.
  const directorMemoryFields='id,project_id,kind,status,title,body,source_type,source_ref,observed_at,version,sensitivity';
  async function listDirectorMemory(projectId){
   if(!ROOMS.has(projectId))throw Error('Invalid Director Memory project');
   const query='/rest/v1/paperworld_director_memory?select='+directorMemoryFields+
    '&project_id=eq.'+encodeURIComponent(projectId)+
    '&order=observed_at.desc,id.asc&limit=100';
   const rows=await withAuth(query);
   if(!Array.isArray(rows)||rows.length>100||
    rows.some(row=>row?.project_id!==projectId))
    throw Error('Invalid private Director Memory response');
   return rows;
  }

  // Auth API re-check before enabling any owner decision: the bearer token
  // must represent an actual Supabase Auth user, not just a cached UI session.
  // PostgREST owner RLS remains the authoritative per-row permission check.
  async function verifiedMemoryReviewer(){
   const user=await withAuth('/auth/v1/user');
   const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
   if(!user||!uuid.test(user.id||'')||
    (session?.user?.id&&user.id!==session.user.id))
    throw Error('Supabase Auth identity could not be verified; sign in again');
   return user.id;
  }

  // Owner-selected ChatGPT export excerpts are always proposed, never approved.
  // The browser cannot impersonate an owner or grant itself review status.
  async function proposeDirectorHistory({projectId,records}={}){
   if(!['workshop','pokemon','studio','wellbeing'].includes(projectId)||
      !Array.isArray(records)||records.length<1||records.length>40)
    throw Error('Invalid private history import');
   await verifiedMemoryReviewer();
   const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
   let imported=0,skipped=0;
   for(const item of records){
    if(item?.project_id!==projectId||item.status!=='proposed'||
     item.kind!=='work_history'||item.source_type!=='conversation'||
     item.sensitivity!=='private'||item.version!==1||
     typeof item.source_ref!=='string'||
     !/^chatgpt-export:[0-9a-f-]{36}:[0-9]{1,6}$/i.test(item.source_ref)||
     !UUID.test(item.source_ref.split(':')[1])||
     typeof item.title!=='string'||!item.title.trim()||item.title.length>140||
     typeof item.body!=='string'||!item.body.trim()||item.body.length>4000||
     typeof item.observed_at!=='string'||!Number.isFinite(Date.parse(item.observed_at)))
     throw Error('Malformed private history excerpt');
    const exists=await withAuth('/rest/v1/paperworld_director_memory?select=id'+
     '&project_id=eq.'+encodeURIComponent(projectId)+
     '&source_ref=eq.'+encodeURIComponent(item.source_ref)+'&limit=1');
    if(!Array.isArray(exists)||exists.length>1)
     throw Error('History duplication check failed');
    if(exists.length){skipped++;continue}
    // Explicitly whitelist columns; never accept owner_id/status=approved.
    const data={project_id:projectId,kind:'work_history',status:'proposed',
     title:item.title,body:item.body,source_type:'conversation',
     source_ref:item.source_ref,observed_at:item.observed_at,
     version:1,sensitivity:'private'};
    await withAuth('/rest/v1/paperworld_director_memory',{
     method:'POST',data,extra:{Prefer:'return=minimal'}});
    imported++;
   }
   return {imported,skipped};
  }

  // Explicit user-directed decision for exactly one proposed memory.
  // Requires installed audited migration; each call verifies live Auth identity.
  // The browser sends only the status column. PostgreSQL RLS and an append-
  // only trigger log become the authority when the migration is applied.
  async function reviewDirectorMemory({projectId,entryId,decision}={}){
   if(!ROOMS.has(projectId)||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(entryId||'')||
    !['approved','rejected'].includes(decision))
    throw Error('Invalid Director Memory review');
   await verifiedMemoryReviewer();
   const query='/rest/v1/paperworld_director_memory?select=id,project_id,status,reviewed_at'+
    '&id=eq.'+encodeURIComponent(entryId)+'&project_id=eq.'+encodeURIComponent(projectId)+
    '&status=eq.proposed';
   const result=await withAuth(query,{method:'PATCH',data:{status:decision},
    extra:{Prefer:'return=representation'}});
   if(!Array.isArray(result)||result.length!==1||result[0]?.id!==entryId||
    result[0]?.project_id!==projectId||result[0]?.status!==decision)
    throw Error('Review not applied; refresh to confirm current status');
   return Object.freeze({id:entryId,projectId,status:decision});
  }

  // Exactly the owner-reviewed, private 2026-11-16 import; no unrelated proposals.
  // Preview and approval are separate deliberate UI actions.
  const IMPORT_SOURCE='chat-summary:2026-11-16';
  const IMPORT_PROJECTS=['workshop','pokemon','studio','wellbeing'];
  async function previewImportedDirectorMemory(){
   await verifiedMemoryReviewer();
   const groups=[];const ids=new Set();
   for(const projectId of IMPORT_PROJECTS){
    const rows=await listDirectorMemory(projectId);
    const selected=rows.filter(row=>row.status==='proposed'&&
     row.source_type==='conversation'&&row.source_ref===IMPORT_SOURCE);
    for(const item of selected){
     if(typeof item.id!=='string'||ids.has(item.id)||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(item.id)||
      typeof item.title!=='string'||!item.title.trim())
      throw Error('Invalid memory import preview');
     ids.add(item.id);
    }
    groups.push({projectId,items:selected.map(item=>({id:item.id,title:item.title,
     sensitivity:item.sensitivity}))});
   }
   if(ids.size>40)throw Error('Import batch exceeds allowed size');
   return {groups,total:ids.size,ids:[...ids]};
  }
  async function approveImportedDirectorMemory(preview){
   if(!preview||!Array.isArray(preview.ids)||preview.total!==preview.ids.length||
      preview.total<1||preview.total>40||new Set(preview.ids).size!==preview.ids.length)
    throw Error('Invalid owner batch selection');
   await verifiedMemoryReviewer();
   // Reload the exact owner-visible preview before committing. Any change aborts.
   const current=await previewImportedDirectorMemory();
   if(current.total!==preview.total||
    current.ids.some(id=>!preview.ids.includes(id)))
    throw Error('Memory preview changed. Inspect the new selection.');
   const result=await withAuth('/rest/v1/rpc/paperworld_approve_imported_director_memories',{
    method:'POST',data:{p_ids:preview.ids}});
   if(result!==preview.total)
    throw Error('Approval count not verified; refresh owner memory');
   return {approved:result};
  }

  const missionFields='id,source_task_id,project_room,repository,title,brief,mode,status,created_at,updated_at';
  async function listMissions(){
   return withAuth('/rest/v1/paperworld_missions?select='+missionFields+'&order=created_at.desc&limit=500');
  }
  async function createMission(data){
   if(!data||!['town','workshop'].includes(data.project_room))throw Error('Unsupported mission room');
   const expected=data.project_room==='workshop'?'mr-tanq/concerts':'mr-tanq/paperworld';
   if(data.repository!==expected||data.mode!=='analysis_only')throw Error('Invalid mission permissions');
   const title=String(data.title||'').trim().slice(0,160),brief=String(data.brief||'').trim();
   if(!title||!brief||brief.length>6000)throw Error('Invalid mission brief');
   const source_task_id=String(data.source_task_id||'');
   if(!/^[0-9a-f-]{36}$/i.test(source_task_id))throw Error('Source task required');
   const rows=await withAuth('/rest/v1/paperworld_missions?select='+missionFields,{
    method:'POST',data:{source_task_id,project_room:data.project_room,repository:expected,title,brief,mode:'analysis_only',status:'draft'},
    extra:{Prefer:'return=representation'}
   });
   return rows[0];
  }
  async function setMissionStatus(id,status){
   if(!/^[0-9a-f-]{36}$/i.test(id)||!['draft','ready_for_review','cancelled'].includes(status))throw Error('Invalid mission');
   const rows=await withAuth('/rest/v1/paperworld_missions?id=eq.'+encodeURIComponent(id)+'&select='+missionFields,{
    method:'PATCH',data:{status},extra:{Prefer:'return=representation'}
   });
   if(!rows.length)throw Error('Mission not found');return rows[0];
  }
  async function deleteMission(id){
   if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid mission ID');
   await withAuth('/rest/v1/paperworld_missions?id=eq.'+encodeURIComponent(id),{method:'DELETE'});
  }
  const agentStore=()=>{const module=typeof globalThis!=='undefined'?globalThis.PaperworldAgentStore:null;if(!module)throw Error('Agent store not loaded');return module.create({transport:withAuth})};
  async function getAgentThread(agentId,createIfMissing=false){
   const store=agentStore();
   const previous=await store.threads();
   let thread=previous.find(t=>t.agent_id===agentId);
   if(!thread&&createIfMissing){
    try{thread=(await store.start(agentId))[0]}
    catch(e){if(!/409|duplicate|unique/i.test(e.message))throw e;thread=(await store.threads()).find(t=>t.agent_id===agentId)}
   }
   if(!thread&&createIfMissing)throw Error('Could not find your private conversation thread');
   return thread;
  }
  async function agentMessages(agentId){
   const thread=await getAgentThread(agentId);
   return thread?agentStore().history(thread.id):[];
  }
  async function sendAgentNote(agentId,text){
   const thread=await getAgentThread(agentId,true);
   return agentStore().say(thread.id,text);
  }
  const DIRECTOR_CHATS=new Set(['listening-director','pokemon-director',
   'studio-director','wellbeing-director']);
  async function askDirector(agentId,message,{saveNote=true}={}){
   if(!DIRECTOR_CHATS.has(agentId))throw Error('Unsupported Director');
   const text=String(message||'').trim();
   if(!text||text.length>1200)throw Error('Message must be 1–1200 characters');
   await ensureAuth();
   const thread=await getAgentThread(agentId,true);
   if(saveNote)await agentStore().say(thread.id,text);
   const payload={agentId,threadId:thread.id,requestId:crypto.randomUUID(),
    message:text,consent:'ONE_DIRECTOR_COPILOT_TURN_INCLUDED_ALLOWANCE'};
   try{
    const response=await fetcher(MATT_ORIGIN+'/chat/director',{
     method:'POST',redirect:'error',headers:{Authorization:'Bearer '+session.access_token,
      'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    let result={};
    try{result=await response.json()}catch(_){}
    if(!response.ok)throw Error((result.error||'Director unavailable')+
     ' (HTTP '+response.status+')');
    if(result.agentId!==agentId||result.executed!==true||
     result.aiTurns!==1||typeof result.content!=='string'||!result.content.trim())
     throw Error('Director response not verified');
    return result;
   }catch(e){e.noteSaved=saveNote;throw e}
  }
  // GitHub OAuth linking uses the current Supabase user, never a browser GitHub token.
  const MATT_ORIGIN='https://paperworld-matt-test-6hmd.onrender.com';
  async function mattOAuth(path){
   if(!session?.access_token)throw Error('Sign in to PAPERWORLD Cloud first');
   const response=await fetcher(MATT_ORIGIN+path,{
    method:'POST',headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},body:'{}',redirect:'error'
   });
   let result={};
   try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'GitHub connection unavailable')+
     ' (HTTP '+response.status+')');
   return result;
  }
  async function beginGithubLink(){
   const result=await mattOAuth('/auth/github/start');
   const u=new URL(result.authorizationUrl);
   if(u.origin!=='https://github.com'||u.pathname!=='/login/oauth/authorize')
    throw Error('Invalid GitHub authorization URL');
   return u.href;
  }
  async function githubLinkStatus(){return mattOAuth('/auth/github/status')}
  // Tests GitHub Copilot session.create without sending any message or
  // storing an additional chat note. Does not perform AI inference.
  async function diagnoseMattSession(){
   await ensureAuth();
   const thread=await getAgentThread('matt',true);
   const payload={threadId:thread.id,requestId:crypto.randomUUID(),
    consent:'SESSION_ONLY_NO_MODEL_CALL'};
   const response=await fetcher(MATT_ORIGIN+'/diagnostic/matt-session',{
    method:'POST',headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify(payload),redirect:'error'
   });
   let result={};
   try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Diagnostic failed')+
     (result.stage?' · '+result.stage:'')+
     (result.reason&&result.reason!=='unclassified'?' · '+result.reason:'')+
     ' (HTTP '+response.status+')');
   if(result.sessionCreated!==true||result.aiMessagesSent!==0)
    throw Error('Diagnostic result not verified');
   return result;
  }
  // Reload read-only job summaries and recorded stages; no AI request or credits.
  async function mattJobHistory(){
   await ensureAuth();
   const thread=await getAgentThread('matt',false);
   if(!thread)return {jobs:[],authority:'owner_editable_history_not_execution_proof'};
   const response=await fetcher(MATT_ORIGIN+'/history/matt/jobs',{
    method:'POST',redirect:'error',headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify({threadId:thread.id})
   });
   let result={};
   try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'History unavailable')+' (HTTP '+response.status+')');
   if(!Array.isArray(result.jobs)||result.authority!=='owner_editable_history_not_execution_proof')
    throw Error('Unverified history reply');
   return result;
  }
  // Owner-authenticated V5 Matt/Director handoffs; no model call or execution.
  async function teamHandoffHistory(){
   await ensureAuth();
   const thread=await getAgentThread('matt',false);
   if(!thread)return {jobs:[],authority:'recorded_handoffs_not_worker_execution'};
   const response=await fetcher(MATT_ORIGIN+'/history/matt/team',{
    method:'POST',redirect:'error',headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify({threadId:thread.id})
   });
   let result={};try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Team history unavailable')+
    ' (HTTP '+response.status+')');
   if(!Array.isArray(result.jobs)||
    result.authority!=='recorded_handoffs_not_worker_execution')
    throw Error('Unverified team handoff history');
   return result;
  }
  async function autonomousMissionAction(action,details={}){
   if(!['create','list','status','simulate'].includes(action))throw Error('Invalid mission action');
   await ensureAuth();
   const thread=await getAgentThread('matt',action==='create');
   if(!thread){
    if(action==='list')return {missions:[]};
    throw Error('Matt conversation unavailable');
   }
   const result=await fetcher(MATT_ORIGIN+'/autonomous/missions/'+action,{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({threadId:thread.id,...details})
   });
   let data={};try{data=await result.json()}catch(_){}
   if(!result.ok)throw Error((data.error||'Mission action unavailable')+
    ' (HTTP '+result.status+')');
   return data;
  }
  async function createAutonomousMission(projectId,goal){
   if(!['listening','pokemon','studio','wellbeing'].includes(projectId)||
    typeof goal!=='string'||!goal.trim()||goal.length>1200)
    throw Error('Invalid mission');
   const data=await autonomousMissionAction('create',{projectId,goal:goal.trim()});
   if(data?.mission?.status!=='draft'||data?.mission?.projectId!==projectId||
    data?.mission?.spendingAllowed!==false||data?.mission?.execution!=='not_started')
    throw Error('Unverified mission draft');
   return data.mission;
  }
  async function autonomousControllerStatus(){
   const result=await autonomousMissionAction('status');
   if(!result?.controller||
    !['active','not_verified'].includes(result.controller.supervisor)||
    result.controller.autonomousExecution!==false||
    result.controller.modelCallsEnabled!==false)
    throw Error('Unverified autonomous supervisor');
   return result.controller;
  }
  async function simulateAutonomousMission(missionId){
   if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(missionId||''))
    throw Error('Invalid mission id');
   const result=await autonomousMissionAction('simulate',{missionId});
   if(result?.queued!==true||result.missionId!==missionId||
    result.execution!=='simulation_only'||result.aiCalls!==0||
    result.realWork!==false)
    throw Error('Simulation was not verified');
   return result;
  }
  async function listAutonomousMissions(){
   const data=await autonomousMissionAction('list');
   if(!Array.isArray(data.missions))throw Error('Invalid mission history');
   return data.missions;
  }
  async function listeningProposalAction(action,details={}){
   if(!['list','reject','publish'].includes(action))throw Error('Invalid proposal action');
   await ensureAuth();
   const thread=await getAgentThread('matt',false);
   if(!thread){
    if(action==='list')return {proposals:[]};
    throw Error('Matt thread unavailable');
   }
   const payload={threadId:thread.id,...details};
   const response=await fetcher(MATT_ORIGIN+'/listening/proposals/'+action,{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify(payload)
   });
   let result={};
   try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Proposal action unavailable')+
    ' (HTTP '+response.status+')');
   return result;
  }
  async function listListeningProposals(){
   const result=await listeningProposalAction('list');
   if(!Array.isArray(result.proposals))throw Error('Unverified proposal response');
   return result.proposals;
  }
  async function rejectListeningProposal(jobId,digest){
   const result=await listeningProposalAction('reject',{jobId,digest});
   if(result.rejected!==true)throw Error('Rejection unverified');
   return true;
  }
  async function publishListeningProposal(jobId,digest){
   const result=await listeningProposalAction('publish',{
    jobId,digest,confirm:'CREATE_LISTENING_DRAFT_PR'
   });
   if(result.created!==true||result.draft!==true||
    !/^https:\/\/github\.com\/mr-tanq\/concerts\/pull\/[0-9]+$/.test(result.url||''))
    throw Error('Draft PR creation unverified');
   return result;
  }
  async function pokemonProposalAction(action,details={}){
   if(!['list','reject','publish'].includes(action))throw Error('Invalid Pokémon proposal action');
   await ensureAuth();
   const thread=await getAgentThread('matt',false);
   if(!thread){
    if(action==='list')return {proposals:[]};
    throw Error('Matt conversation required');
   }
   const response=await fetcher(MATT_ORIGIN+'/pokemon/proposals/'+action,{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify({threadId:thread.id,...details})
   });
   let body={};try{body=await response.json()}catch(_){}
   if(!response.ok)throw Error((body.error||'Pokémon proposal unavailable')+
    ' (HTTP '+response.status+')');
   return body;
  }
  async function listPokemonProposals(){
   const data=await pokemonProposalAction('list');
   if(!Array.isArray(data.proposals)||data.authority!=='owner_review_only')
    throw Error('Unverified private Pokémon proposals');
   return data.proposals;
  }
  async function rejectPokemonProposal(jobId,digest){
   const data=await pokemonProposalAction('reject',{jobId,digest});
   if(data.rejected!==true)throw Error('Unverified Pokémon rejection');
   return true;
  }
  async function publishPokemonProposal(jobId,digest){
   const data=await pokemonProposalAction('publish',{
    jobId,digest,confirm:'CREATE_POKEMON_DRAFT_PR'
   });
   if(data.created!==true||data.draft!==true||data.merged!==false||
    !/^https:\/\/github\.com\/mr-tanq\/pokemon-echoes\/pull\/[1-9][0-9]*$/.test(data.url||''))
    throw Error('Pokémon Draft PR unverified');
   return data;
  }
  // Private Crow production preview. This NEVER invokes Suno or uses credits.
  async function crowSunoPreview(brief){
   await ensureAuth();
   const thread=await getAgentThread('studio-director',true);
   const response=await fetcher(MATT_ORIGIN+'/suno/crow/propose',{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify({agentId:'studio-director',threadId:thread.id,
     brief,expectedCredits:null})
   });
   let result={};try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Crow preview unavailable')+
    ' (HTTP '+response.status+')');
   if(typeof result.proposalId!=='string'||result.requiresExplicitApproval!==true||
    result.expectedCredits!==null)throw Error('Unverified Crow preview');
   return result;
  }
  // Suno PKCE connection belongs to the authenticated Crow thread.
  async function sunoOauthRequest(action){
   if(!['start','status'].includes(action))throw Error('Invalid Suno OAuth action');
   await ensureAuth();
   const thread=await getAgentThread('studio-director',true);
   const response=await fetcher(MATT_ORIGIN+'/auth/suno/'+action,{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify({agentId:'studio-director',threadId:thread.id})
   });
   let result={};try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Suno connection unavailable')+
    ' (HTTP '+response.status+')');
   if(result.canGenerate!==false)throw Error('Unverified Suno OAuth state');
   return result;
  }
  async function beginSunoLink(){
   const result=await sunoOauthRequest('start');
   if(typeof result.authorizationUrl!=='string')
    throw Error('Suno OAuth not ready');
   const u=new URL(result.authorizationUrl);
   if(u.protocol!=='https:'||
     !(u.hostname==='suno.com'||u.hostname.endsWith('.suno.com')))
    throw Error('Unexpected Suno authorization host');
   return u.href;
  }
  async function diagnoseSunoConnection(){
   await ensureAuth();
   const thread=await getAgentThread('studio-director',true);
   const response=await fetcher(MATT_ORIGIN+'/auth/suno/diagnose',{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify({agentId:'studio-director',threadId:thread.id})
   });
   let result={};try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Suno diagnosis unavailable')+
    ' (HTTP '+response.status+')');
   if(result.service!=='suno_mcp'||result.canGenerate!==false||
      !['resourceAvailable','clientRegistrationSupported',
       'oauthAuthorized','toolsListed'].every(x=>typeof result[x]==='boolean')||
      !Number.isSafeInteger(result.toolCount)||result.toolCount<0||
      result.toolCount>100||typeof result.nextStep!=='string')
    throw Error('Unverified Suno diagnostic reply');
   return result;
  }
  async function inspectSunoTools(){
   await ensureAuth();
   const thread=await getAgentThread('studio-director',true);
   const response=await fetcher(MATT_ORIGIN+'/auth/suno/inspect-tools',{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify({agentId:'studio-director',threadId:thread.id})
   });
   let result={};try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Suno MCP tools unavailable')+
    ' (HTTP '+response.status+')');
   if(result.service!=='suno_mcp'||result.oauthAuthorized!==true||
      typeof result.toolsListed!=='boolean'||result.canGenerate!==false||
      !Number.isSafeInteger(result.toolCount)||result.toolCount<0||
      result.toolCount>100)throw Error('Unverified Suno MCP status');
   return result;
  }
  async function sunoLinkStatus(){
   const result=await sunoOauthRequest('status');
   if(typeof result.oauthAuthorized!=='boolean'||result.ephemeral!==true)
    throw Error('Unverified Suno link status');
   return result;
  }
  // OAuth discovery reads provider metadata only. Never connects or generates.
  async function crowSunoConnectionStatus(){
   await ensureAuth();
   const thread=await getAgentThread('studio-director',true);
   const response=await fetcher(MATT_ORIGIN+'/suno/crow/connection-status',{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({agentId:'studio-director',threadId:thread.id})
   });
   let result={};try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Suno status unavailable')+
    ' (HTTP '+response.status+')');
   if(result.service!=='suno_mcp'||typeof result.metadataAvailable!=='boolean'||
      result.oauthConnected!==false||result.canGenerate!==false)
    throw Error('Unverified Suno status');
   return result;
  }
  async function cancelCrowSunoPreview(proposalId){
   if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(proposalId||''))
    throw Error('Invalid Crow preview ID');
   await ensureAuth();
   const response=await fetcher(MATT_ORIGIN+'/suno/crow/cancel',{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,
     'Content-Type':'application/json'},
    body:JSON.stringify({proposalId})
   });
   let result={};try{result=await response.json()}catch(_){}
   if(!response.ok||result.cancelled!==true)
    throw Error((result.error||'Unable to cancel Crow preview')+
     ' (HTTP '+response.status+')');
   return true;
  }
  // Delegation is explicitly a separate, up-to-three Copilot-turn operation.
  // Do not silently send multiple model calls from the ordinary chat button.
  // Separate user-authorized five-call path for evidence-based Worker analysis.
  async function sourceFactWorker(message,{project,requestId}={}){
   const text=String(message||'').trim();
   if(!['listening','pokemon'].includes(project)||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId||'')||
    !text||text.length>1200)throw Error('Invalid source fact request');
   await ensureAuth();
   const thread=await getAgentThread('matt',false);
   if(!thread)throw Error('Verified Matt conversation required');
   const response=await fetcher(MATT_ORIGIN+'/delegate/matt/source-facts',{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({threadId:thread.id,requestId,project,
     message:text,consent:'V5_ONE_READ_ONLY_SOURCE_CHECK_NO_AI'})
   });
   let result={};try{result=await response.json()}catch(_){}
   if(!response.ok)throw Error((result.error||'Source facts unavailable')+
    ' (HTTP '+response.status+')');
   if(result.executed!==true||result.execution!=='read_only_source_facts'||
    result.modelCalls!==0||result.changedFiles!==0||result.createdPR!==false||
    result.requestId!==requestId||
    result.project!==project||!Array.isArray(result.evidence?.files))
    throw Error('Unverified source facts result');
   return result;
  }
  async function delegatePokemonWorker(message,{onStart,saveNote=true,requestId=null}={}){
   const text=String(message||'').trim();
   if(!text||text.length>1200)throw Error('Message must be 1–1200 characters');
   await ensureAuth();
   const thread=await getAgentThread('matt',true);
   if(saveNote)await agentStore().say(thread.id,text);
   if(requestId!==null&&!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId))
    throw Error('Invalid approved request ID');
   const payload={threadId:thread.id,requestId:requestId||crypto.randomUUID(),message:text,
    projectDirector:'pokemon-director',
    consent:'MATT_POKEMON_WORKER_READONLY_UP_TO_FIVE_AI_TURNS'};
   if(typeof onStart==='function')onStart(payload.requestId);
   try{
    const response=await fetcher(MATT_ORIGIN+'/delegate/matt/pokemon/worker',{
     method:'POST',headers:{Authorization:'Bearer '+session.access_token,
      'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error'
    });
    let result={};
    try{result=await response.json()}catch(_){}
    if(!response.ok)throw Error((result.error||'Pokémon Worker failed')+
     (result.stage?' · '+result.stage:'')+' (HTTP '+response.status+')');
    if(result.executed!==true||typeof result.content!=='string')
     throw Error('No verified Pokémon Worker response');
    return result;
   }catch(error){error.noteSaved=true;throw error}
  }
  async function delegateMattWorker(message,{onStart,saveNote=true,requestId=null}={}){
   const text=String(message||'').trim();
   if(!text||text.length>1200)throw Error('Message must be 1–1200 characters');
   await ensureAuth();
   const thread=await getAgentThread('matt',true);
   if(saveNote)await agentStore().say(thread.id,text);
   if(requestId!==null&&!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId))
    throw Error('Invalid approved request ID');
   const payload={threadId:thread.id,requestId:requestId||crypto.randomUUID(),message:text,
    consent:'MATT_DIRECTOR_WORKER_UP_TO_FIVE_AI_TURNS'};
   if(typeof onStart==='function')onStart(payload.requestId);
   try{
    const response=await fetcher(MATT_ORIGIN+'/delegate/matt/worker',{
     method:'POST',headers:{Authorization:'Bearer '+session.access_token,
      'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error'
    });
    let result={};
    try{result=await response.json()}catch(_){}
    if(!response.ok)throw Error((result.error||'Worker delegation failed')+
     (result.stage?' · '+result.stage:'')+' (HTTP '+response.status+')');
    if(result.executed!==true||typeof result.content!=='string')
     throw Error('No verified Worker response');
    return result;
   }catch(error){error.noteSaved=true;throw error}
  }
  async function delegateMatt(message,{targetDirector='auto',wellbeingConsent=false,conversation=null,onStart=null,onProgress=null}={}){
   const choices=['auto','listening-director','studio-director',
    'pokemon-director','wellbeing-director'];
   if(!choices.includes(targetDirector)||
    (targetDirector==='wellbeing-director'&&wellbeingConsent!==true)||
    (targetDirector!=='wellbeing-director'&&wellbeingConsent===true))
    throw Error('Explicit project selection and wellbeing consent required');
   const text=String(message||'').trim();
   if(!text||text.length>1200)throw Error('Message must be 1–1200 characters');
   await ensureAuth();
   const thread=await getAgentThread('matt',true);
   await agentStore().say(thread.id,text);
   const payload={threadId:thread.id,requestId:crypto.randomUUID(),message:text,
    consent:'MATT_DIRECTOR_UP_TO_THREE_AI_TURNS',targetDirector,
     ...(conversation?{conversation}:{}),
    ...(targetDirector==='wellbeing-director'&&wellbeingConsent===true?{
     wellbeingConsent:'SHARE_APPROVED_WELLBEING_MEMORY_FOR_THIS_TURN'
    }:{})};
   if(typeof onStart==='function')onStart(payload.requestId);
   try{
    const response=await fetcher(MATT_ORIGIN+'/delegate/matt',{
     method:'POST',headers:{Authorization:'Bearer '+session.access_token,
      'Content-Type':'application/json',
      ...(typeof onProgress==='function'?{Accept:'application/x-ndjson'}:{})},
     body:JSON.stringify(payload),redirect:'error'
    });
    let result={},reportedStatus=response.status;
    if(response.headers?.get?.('content-type')?.includes('application/x-ndjson')){
     if(!response.body?.getReader)throw Error('Progress stream unavailable');
     const reader=response.body.getReader(),decoder=new TextDecoder();
     let buffer='',size=0,gotResult=false;
     while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>65000)throw Error('Progress stream exceeded safe limit');
      buffer+=decoder.decode(value,{stream:true});
      let end;
      while((end=buffer.indexOf('\n'))>=0){
       const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
       if(!line.trim())continue;
       const event=JSON.parse(line);
       if(event.type==='progress'&&typeof onProgress==='function'){
        try{onProgress(event)}catch(_){}
       }else if(event.type==='result'&&!gotResult){
        gotResult=true;reportedStatus=event.status;result=event.body||{};
       }
      }
     }
     if(!gotResult)throw Error('Incomplete Matt progress stream');
    }else{
     try{result=await response.json()}catch(_){}
    }
    if(!response.ok||reportedStatus!==200)throw Error((result.error||'Delegation failed')+
     (result.stage?' · '+result.stage:'')+' (HTTP '+reportedStatus+')');
    if(result.executed!==true||typeof result.content!=='string')
     throw Error('No verified Matt delegation response');
    return result;
   }catch(error){
    error.noteSaved=true;
    throw error;
   }
  }
  async function askMatt(message){
   const text=String(message||'').trim();
   if(!text||text.length>1200)throw Error('Message must be 1–1200 characters');
   await ensureAuth();
   const thread=await getAgentThread('matt',true);
   // Human text is stored privately before making the separately confirmed call.
   await agentStore().say(thread.id,text);
   const payload={threadId:thread.id,requestId:crypto.randomUUID(),message:text,
     consent:'ONE_COPILOT_TURN_INCLUDED_ALLOWANCE'};
   let response;
   try{
    response=await fetcher(MATT_ORIGIN+'/chat/matt',{method:'POST',
     headers:{Authorization:'Bearer '+session.access_token,
      'Content-Type':'application/json'},
     body:JSON.stringify(payload),redirect:'error'});
    const result=await response.json();
    if(!response.ok)throw Error((result.error||'Copilot failed')+' (HTTP '+response.status+')');
    if(!result.executed||result.agentId!=='matt'||typeof result.content!=='string')
     throw Error('No real Matt reply returned');
    return result;
   }catch(error){
    error.noteSaved=true; // Do not resend the human note automatically.
    throw error;
   }
  }
  return {BASE,identity,signedIn,login,signup,signout,list,add,update,remove,prepareImport,importTasks,
   listMissions,createMission,setMissionStatus,deleteMission,
   createAutonomousMission,listAutonomousMissions,autonomousControllerStatus,simulateAutonomousMission,
   listDirectorMemory,verifiedMemoryReviewer,reviewDirectorMemory,proposeDirectorHistory,previewImportedDirectorMemory,approveImportedDirectorMemory,agentMessages,sendAgentNote,askDirector,beginGithubLink,githubLinkStatus,askMatt,delegateMatt,delegateMattWorker,delegatePokemonWorker,sourceFactWorker,mattJobHistory,teamHandoffHistory,diagnoseMattSession,
   listListeningProposals,rejectListeningProposal,publishListeningProposal,
   listPokemonProposals,rejectPokemonProposal,publishPokemonProposal,
   crowSunoPreview,cancelCrowSunoPreview,crowSunoConnectionStatus,
   beginSunoLink,sunoLinkStatus,inspectSunoTools,diagnoseSunoConnection};
 }
 return {BASE,KEY,TOKEN_STORAGE,createClient};
});
