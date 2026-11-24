/* Paperworld initiatives, phase A — the Directors' "eyes".
 * Once a day Luna (concerts) and Joey (pokemon-echoes) look at their repo's
 * scheduled/push workflows on main. When a workflow's LATEST run failed (hard
 * evidence, no AI used to look), the Director starts a fix through the normal
 * Task Engine (same budget caps, trusted tests, auto-merge rule) and Matt says
 * so in the owner's chat. Rules that keep it calm:
 *  - at most 1 initiative per Director per day and 2 in total (Amsterdam day);
 *  - never the same problem twice: a workflow that already had an initiative
 *    in the last 7 days is left alone (the owner hears about it instead);
 *  - a pause switch: controller.initiatives_paused (or env) stops everything.
 */
import {REGISTRY} from './projects.mjs';
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PREFIX='@paperworld-matt:v1:';
const PER_DIRECTOR=1,PER_DAY=2,COOLDOWN_DAYS=7;
const EVENTS=new Set(['schedule','push']);
const IGNORE=/paperworld|copilot|generate-supabase-migration/i;
const NAME={listening:'Η Luna',pokemon:'Ο Joey'};
const DIRECTOR={listening:'listening-director',pokemon:'pokemon-director'};
const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const weekday=t=>new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Amsterdam',weekday:'short'}).format(new Date(t));
const isSunday=t=>weekday(t)==='Sun';
const amsterdamDay=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam'}).format(new Date(t));
async function uuidFrom(text){
 const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).slice(0,16);
 b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
 const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
// Weekly meeting (Sunday): Matt sums up the last 7 days from real records
// only. An original attempt that was redone automatically is not counted as
// "needed you" (the redo is what counts). Pure, so it is easy to test.
function weekly(missions,proposals=0){
 const rows=(Array.isArray(missions)?missions:[]).filter(m=>NAME[m?.project_id]);
 const redone=new Set(rows.map(m=>m.policy?.retryOf).filter(Boolean));
 const per={},count=k=>Object.values(per).reduce((a,p)=>a+p[k],0);
 for(const m of rows){
  if(redone.has(m.id))continue;
  const p=per[m.project_id]||(per[m.project_id]={alone:0,checked:0,ready:0,you:0,running:0});
  if(m.status==='completed')p[m.report?.merged===true?'alone':'ready']++;
  else if(m.status==='needs_you'&&m.last_error==='agent_no_changes')p.checked++;
  else if(m.status==='needs_you'||m.status==='failed')p.you++;
  else if(['queued','running','working','verifying','paused_budget','planned'].includes(m.status))p.running++;
 }
 const initiatives=rows.filter(m=>m.policy?.initiative===true).length;
 const part=(n,one,many)=>n===1?one:n+' '+many;
 const lines=Object.entries(per).map(([id,p])=>{
  const bits=[];
  if(p.alone)bits.push(part(p.alone,'1 αλλαγή μπήκε μόνη της','αλλαγές μπήκαν μόνες τους'));
  if(p.checked)bits.push(part(p.checked,'1 έλεγχος χωρίς να χρειαστεί αλλαγή','έλεγχοι χωρίς να χρειαστεί αλλαγή'));
  if(p.ready)bits.push(part(p.ready,'1 είναι έτοιμη για έλεγχο','είναι έτοιμες για έλεγχο'));
  if(p.you)bits.push(part(p.you,'1 σταμάτησε και θέλει εσένα','σταμάτησαν και θέλουν εσένα'));
  if(p.running)bits.push(part(p.running,'1 τρέχει ακόμα','τρέχουν ακόμα'));
  return bits.length?NAME[id].replace(/^(Η|Ο) /,'')+': '+bits.join(', '):null;
 }).filter(Boolean);
 const head='Εβδομαδιαία συνάντηση στο Town Hall 🏛️ ';
 const body=lines.length?'Οι τελευταίες 7 μέρες · '+lines.join(' · ')+'.':'Ήσυχη εβδομάδα: καμία εργασία τις τελευταίες 7 μέρες.';
 const extra=[initiatives?'Πρωτοβουλίες της ομάδας: '+initiatives+'.':'',
  proposals?part(proposals,'1 πρόταση περιμένει την απόφασή σου (Εργασίες).',
   'προτάσεις περιμένουν την απόφασή σου (Εργασίες).'):''].filter(Boolean).join(' ');
 return {text:(head+body+(extra?' '+extra:'')).slice(0,900),alone:count('alone'),you:count('you'),
  running:count('running'),ready:count('ready'),initiatives,proposals};
}
// The workflows whose newest completed run on main failed.
function failingWorkflows(runs){
 const latest=new Map();
 for(const r of Array.isArray(runs)?runs:[]){
  if(r?.head_branch!=='main'||r.status!=='completed'||!EVENTS.has(r.event))continue;
  if(IGNORE.test(r.path||'')||IGNORE.test(r.name||''))continue;
  const prev=latest.get(r.workflow_id);
  if(!prev||Date.parse(r.created_at)>Date.parse(prev.created_at))latest.set(r.workflow_id,r);
 }
 return [...latest.values()].filter(r=>['failure','timed_out','startup_failure'].includes(r.conclusion))
  .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
}
function brief(projectId,run,job){
 const who=NAME[projectId],cfg=REGISTRY[projectId];
 const where=job?' (βήμα «'+job.step+'» της εργασίας «'+job.name+'»)':'';
 const goal=(who+' είδε ότι απέτυχε η αυτόματη εργασία «'+run.name+'»'+where+'. Βρες την αιτία και διόρθωσέ την.').slice(0,1200);
 const summary=('The scheduled/push workflow "'+run.name+'" ('+run.path+') failed on main: '+run.html_url+
  (job?' — failed job "'+job.name+'", step "'+job.step+'".':'.')+
  ' Read the run logs, find the root cause and make the smallest fix in the project code so the workflow succeeds again. '+
  'Do not edit .github/ files. If the cause is outside the code (expired secret, provider outage), change nothing and explain why in the PR.').slice(0,800);
 const spec={projectId,directorId:DIRECTOR[projectId],repository:cfg.repository,
  title:('Διόρθωση: απέτυχε το «'+run.name+'»').slice(0,120),summary,
  acceptance:['The root cause of the failing "'+String(run.name).slice(0,120)+'" run is identified in the PR description',
   'The fix is the smallest change in project code; workflow files are untouched','All required tests pass'],
  requiredTests:[...cfg.testIds],allowedPaths:[...cfg.allowedPaths].slice(0,8),maxFiles:6,noAutoMerge:true,noAutoDeploy:true};
 return {goal,spec};
}
function createWatcher({environment,fetcher=fetch,clock=Date.now}={}){
 const env=k=>environment?.(k);
 function dbKey(){
  try{const m=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default;if(typeof m==='string'&&m.startsWith('sb_secret_'))return m}catch(_){}
  const l=env('SUPABASE_SERVICE_ROLE_KEY');return typeof l==='string'&&l.length>20?l:null;
 }
 async function db(path,method='GET',body,prefer){
  const key=dbKey();if(!key)throw Error('backend_credential_unavailable');
  const r=await fetcher(BASE+'/rest/v1/'+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),Accept:'application/json',
    'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!r?.ok)throw Error('database_request_failed');
  return r.status===204?null:r.json();
 }
 async function gh(path){
  const token=env('GITHUB_COPILOT_USER_TOKEN');if(!token)throw Error('github_credential_unavailable');
  const r=await fetcher('https://api.github.com'+path,{redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token,'User-Agent':'paperworld-watch'}});
  if(!r?.ok)throw Error('github_http_'+(r?.status||0));
  return r.json();
 }
 async function failedJob(repo,runId){
  try{const d=await gh('/repos/'+repo+'/actions/runs/'+runId+'/jobs?per_page=30');
   const job=(d?.jobs||[]).find(j=>j.conclusion==='failure');if(!job)return null;
   const step=(job.steps||[]).find(s=>s.conclusion==='failure');
   return {name:String(job.name).slice(0,80),step:String(step?.name||'?').slice(0,80)};
  }catch(_){return null}
 }
 // Morning health check: Matt writes ONLY when something needs attention,
 // at most once a day (deterministic message id). No AI, read-only checks.
 async function health(){
  const problems=[];
  try{const t=env('GITHUB_COPILOT_USER_TOKEN');
   const r=await fetcher('https://api.github.com/user',{redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+t,'User-Agent':'paperworld-watch'}});
   if(!r?.ok)problems.push('το κλειδί του Developer στο GitHub δεν δουλεύει (χρειάζεται ανανέωση)');
  }catch(_){problems.push('δεν μπόρεσα να ελέγξω το GitHub')}
  const has=async t=>{try{const r=await db(t+'?select=updated_at&limit=1');return Array.isArray(r)&&r.length>0}catch(_){return null}};
  if(await has('paperworld_github_links_v1')===false)problems.push('η σύνδεσή σου στο GitHub λείπει (Ρυθμίσεις → GitHub → Σύνδεση)');
  if(await has('paperworld_suno_links_v1')===false)problems.push('το Suno δεν είναι συνδεδεμένο (Music Studio του Crow → Σύνδεση Suno)');
  let stuck=[];
  try{stuck=await db('paperworld_autonomous_missions_v5?select=id,goal,project_id&status=in.(queued,running,working,verifying)'+
   '&updated_at=lt.'+new Date(clock()-2*3600e3).toISOString()+'&limit=5')||[]}catch(_){}
  for(const m of stuck)problems.push('η εργασία «'+String(m.goal||'').replace(/\s+/g,' ').slice(0,60)+'» δεν προχωράει εδώ και 2+ ώρες');
  if(!problems.length)return {state:'healthy'};
  const ctx=(await db('paperworld_autonomous_missions_v5?select=owner_id,thread_id&engine=eq.v1&order=created_at.desc&limit=1').catch(()=>null))?.[0];
  if(!ctx?.owner_id)return {state:'problems',count:problems.length};
  const day=amsterdamDay(clock());
  await db('paperworld_agent_messages','POST',{id:await uuidFrom('paperworld-health:'+day),thread_id:ctx.thread_id,owner_id:ctx.owner_id,
   role:'agent',content:PREFIX+JSON.stringify({director:'matt',kind:'notification',
    text:'Πρωινός έλεγχος: '+problems.slice(0,4).join('· ')+'.'})},'resolution=ignore-duplicates,return=minimal').catch(()=>null);
  return {state:'problems',count:problems.length};
 }
 async function weeklyMeeting(){
  if(!isSunday(clock()))return {state:'not_sunday'};
  const ctx=(await db('paperworld_autonomous_missions_v5?select=owner_id,thread_id&engine=eq.v1&order=created_at.desc&limit=1'))?.[0];
  if(!ctx?.owner_id||!ctx?.thread_id)return {state:'no_owner_context'};
  const since=new Date(clock()-7*864e5).toISOString();
  const missions=await db('paperworld_autonomous_missions_v5?select=id,project_id,status,report,policy,last_error,created_at&engine=eq.v1'+
   '&owner_id=eq.'+ctx.owner_id+'&created_at=gte.'+since+'&limit=200');
  let proposals=0;
  try{proposals=((await db('paperworld_proposals_v1?select=id&status=eq.proposed&owner_id=eq.'+ctx.owner_id+'&limit=50'))||[]).length}catch(_){}
  const sum=weekly(missions,proposals);
  await db('paperworld_agent_messages','POST',{id:await uuidFrom('paperworld-weekly:'+amsterdamDay(clock())),thread_id:ctx.thread_id,
   owner_id:ctx.owner_id,role:'agent',content:PREFIX+JSON.stringify({director:'matt',kind:'notification',text:sum.text})},
   'resolution=ignore-duplicates,return=minimal');
  return {state:'posted',alone:sum.alone,you:sum.you};
 }
 // Dave's initiative (Wednesday): a calm check-in ONLY when things the owner
 // saved in the Wellbeing list have waited 3+ days. The phone text never names
 // them (privacy); no AI, once per Wednesday, stopped by the pause switch.
 async function daveCheckIn(){
  if(weekday(clock())!=='Wed')return {state:'not_today'};
  const ctx=(await db('paperworld_autonomous_missions_v5?select=owner_id,thread_id&engine=eq.v1&order=created_at.desc&limit=1'))?.[0];
  if(!ctx?.owner_id||!ctx?.thread_id)return {state:'no_owner_context'};
  const rows=await db('paperworld_tasks?select=id&owner_id=eq.'+ctx.owner_id+'&room=eq.wellbeing&status=eq.todo'+
   '&created_at=lt.'+new Date(clock()-3*864e5).toISOString()+'&limit=50');
  const n=Array.isArray(rows)?rows.length:0;
  if(!n)return {state:'nothing_waiting'};
  const text='Ο Dave ρωτάει πώς πας 🌿 '+(n===1?'Ένα πράγμα στη λίστα σου στο Wellbeing περιμένει':
   n+' πράγματα στη λίστα σου στο Wellbeing περιμένουν')+' λίγες μέρες. Αν θες, πες του τι να κρατήσετε, τι να αλλάξετε ή τι να αφήσετε. Χωρίς πίεση.';
  await db('paperworld_agent_messages','POST',{id:await uuidFrom('paperworld-dave-checkin:'+amsterdamDay(clock())),thread_id:ctx.thread_id,
   owner_id:ctx.owner_id,role:'agent',content:PREFIX+JSON.stringify({director:'wellbeing-director',kind:'notification',text})},
   'resolution=ignore-duplicates,return=minimal');
  return {state:'posted',waiting:n};
 }
 async function runOnce(){
  // The pause switch column may not exist yet: fall back to the basic row.
  const ctrl=(await db('paperworld_autonomous_controller_v5?select=engine,dispatch_enabled,initiatives_paused&singleton=eq.true&limit=1')
   .catch(()=>db('paperworld_autonomous_controller_v5?select=engine,dispatch_enabled&singleton=eq.true&limit=1')).catch(()=>null))?.[0];
  let checked=null;try{checked=await health()}catch(_){checked={state:'health_unavailable'}}
  let week=null;try{week=await weeklyMeeting()}catch(_){week={state:'weekly_unavailable'}}
  if(week?.state!=='not_sunday')checked={...checked,weekly:week};
  if(ctrl&&ctrl.initiatives_paused!==true&&env('PAPERWORLD_INITIATIVES_PAUSED')!=='1'){
   let dave=null;try{dave=await daveCheckIn()}catch(_){dave={state:'dave_unavailable'}}
   if(dave?.state!=='not_today')checked={...checked,dave};
  }
  if(!ctrl||ctrl.engine!=='v1'||ctrl.dispatch_enabled!==true)return {state:'disabled',health:checked};
  if(ctrl.initiatives_paused===true||env('PAPERWORLD_INITIATIVES_PAUSED')==='1')return {state:'paused',health:checked};
  const since=new Date(clock()-COOLDOWN_DAYS*864e5).toISOString();
  const recent=await db('paperworld_autonomous_missions_v5?select=id,project_id,policy,created_at&created_at=gte.'+since+
   '&policy->>initiative=eq.true&limit=100');
  const today=amsterdamDay(clock());
  const todays=(recent||[]).filter(m=>amsterdamDay(m.created_at)===today);
  const results=[];
  for(const projectId of ['listening','pokemon'])try{
   if(todays.length>=PER_DAY)break;
   if(todays.filter(m=>m.project_id===projectId).length>=PER_DIRECTOR)continue;
   const repo=REGISTRY[projectId].repository;
   let runs;try{runs=(await gh('/repos/'+repo+'/actions/runs?branch=main&status=completed&per_page=60'))?.workflow_runs}
   catch(_){results.push({projectId,state:'github_unavailable'});continue}
   const handled=new Set((recent||[]).filter(m=>m.project_id===projectId).map(m=>String(m.policy?.initiativeWorkflow)));
   const target=failingWorkflows(runs).find(r=>!handled.has(String(r.workflow_id)));
   if(!target){results.push({projectId,state:'all_green'});continue}
   // Owner, Matt thread and policy come from this project's own latest mission.
   const last=(await db('paperworld_autonomous_missions_v5?select=owner_id,thread_id,policy&project_id=eq.'+projectId+
    '&engine=eq.v1&order=created_at.desc&limit=1'))?.[0];
   if(!last?.owner_id||!last?.thread_id){results.push({projectId,state:'no_owner_context'});continue}
   const job=await failedJob(repo,target.id);
   const {goal,spec}=brief(projectId,target,job);
   const key='ci:'+target.workflow_id+':'+target.head_sha;
   const id=await uuidFrom('paperworld-initiative:'+projectId+':'+key);
   const {retryOf,retryReason,...base}=last.policy||{};
   const exists=(await db('paperworld_autonomous_missions_v5?select=id,status&id=eq.'+id+'&limit=1'))?.[0];
   if(!exists){
    await db('paperworld_autonomous_missions_v5','POST',{id,owner_id:last.owner_id,thread_id:last.thread_id,
     project_id:projectId,goal,status:'draft',policy:{...base,initiative:true,initiativeKey:key,
      initiativeWorkflow:String(target.workflow_id),initiativeRun:target.html_url}},'return=representation');
   }
   const now=(await db('paperworld_autonomous_missions_v5?select=status&id=eq.'+id+'&limit=1'))?.[0];
   if(now?.status==='draft'&&await db('rpc/paperworld_v5_plan_task','POST',{p_mission:id,p_spec:spec})!==true){
    results.push({projectId,state:'plan_refused'});continue}
   const queued=await db('rpc/paperworld_v5_queue_task','POST',{p_mission:id});
   todays.push({project_id:projectId});
   // Matt tells the owner right away (also reaches the phone).
   const text=NAME[projectId]+' είδε ότι απέτυχε η αυτόματη εργασία «'+String(target.name).slice(0,80)+'» και την έδωσε '+
    (projectId==='listening'?'μόνη της':'μόνος του')+' στον Developer να τη διορθώσει. Θα σου πω τι βρήκαμε.';
   await db('paperworld_agent_messages','POST',{id:await uuidFrom('paperworld-initiative-note:'+id),thread_id:last.thread_id,
    owner_id:last.owner_id,role:'agent',content:PREFIX+JSON.stringify({director:DIRECTOR[projectId],
     text,kind:'notification'})},
    'resolution=ignore-duplicates,return=minimal').catch(()=>null);
   results.push({projectId,state:queued===true?'initiative_queued':'initiative_planned',missionId:id});
  }catch(_){results.push({projectId,state:'error'})}
  return {state:'done',results,health:checked};
 }
 async function handle(request){
  if(request.method!=='POST')return respond(405,{error:'method_not_allowed'});
  const secret=env('PAPERWORLD_DISPATCH_TRIGGER_SECRET');
  if(!secret||secret.length<32||!dbKey())return respond(503,{error:'credentials_unavailable'});
  if(request.headers.get('authorization')!=='Bearer '+secret)return respond(401,{error:'unauthorized'});
  try{return respond(200,await runOnce())}catch(_){return respond(503,{error:'watch_unavailable'})}
 }
 return Object.freeze({handle,runOnce});
}
export {createWatcher,failingWorkflows,brief,amsterdamDay,weekly,isSunday,weekday};
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function'){
 Deno.serve(createWatcher({environment:k=>Deno.env.get(k)}).handle);
}
