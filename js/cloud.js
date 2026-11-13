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
  return {BASE,identity,signedIn,login,signup,signout,list,add,update,remove,prepareImport,importTasks,
   listMissions,createMission,setMissionStatus,deleteMission};
 }
 return {BASE,KEY,TOKEN_STORAGE,createClient};
});
