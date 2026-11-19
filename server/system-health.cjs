/* PAPERWORLD system health — owner-only, low-cost, read-only.
 * One request = a handful of bounded REST reads. No AI calls, no writes, no
 * external services, no secrets in the answer. Global data is reduced to
 * freshness/flags; counts are the requesting owner's own records only.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PUB='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const ORIGIN='https://mr-tanq.github.io';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const AUTH=/^Bearer [A-Za-z0-9_.-]{12,4096}$/;
const STARTED=Date.now();
// Heartbeat is every 5 minutes; allow one missed tick before "late".
function heartbeatState(lastTickAt,now){
 const at=Date.parse(lastTickAt||'');
 if(!Number.isFinite(at))return {state:'unknown'};
 const minutes=Math.max(0,Math.round((now-at)/60000));
 return {state:minutes<=11?'ok':minutes<=60?'late':'stopped',lastTickAt:new Date(at).toISOString(),minutes};
}
function makeSystemHealth({fetcher=globalThis.fetch,secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY,
 identity,baseUrl=BASE,publicKey=PUB,now=()=>Date.now(),env=process.env}={}){
 const guard=identity||createSupabaseGuard({fetcher,baseUrl,publicKey});
 const validSecret=typeof secret==='string'&&(secret.startsWith('sb_secret_')||secret.startsWith('eyJ'));
 async function read(resource){
  const response=await fetcher(baseUrl+'/rest/v1/'+resource,{method:'GET',redirect:'error',
   signal:AbortSignal.timeout(8000),headers:{apikey:secret,
    ...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),Accept:'application/json'}});
  if(response?.status===404)return {missing:true};
  if(!response?.ok)throw Error('health_read_failed');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('health_read_invalid');
  return {rows};
 }
 // Each probe degrades to "unknown"; one failing probe never hides the rest.
 async function probe(fn){try{return await fn()}catch(_){return {state:'unknown'}}}
 async function handle({headers={}}={}){
  if(headers.origin!==ORIGIN)return {status:403,body:{error:'origin_denied'}};
  if(!AUTH.test(headers.authorization||''))return {status:401,body:{error:'unauthorized'}};
  let ownerId;
  try{ownerId=(await guard.authenticate(headers.authorization.slice(7)))?.ownerId}
  catch(_){return {status:401,body:{error:'unauthorized'}}}
  if(!UUID.test(ownerId||''))return {status:401,body:{error:'unauthorized'}};
  const t=now();
  const report={checkedAt:new Date(t).toISOString(),aiCalls:0,
   server:{state:'ok',uptimeMinutes:Math.round((t-STARTED)/60000),
    release:/^[0-9a-f]{7,40}$/.test(env.RENDER_GIT_COMMIT||'')?env.RENDER_GIT_COMMIT.slice(0,7):null},
   config:{database:validSecret,aiBudgetVerified:env.PAPERWORLD_COPILOT_BUDGET_VERIFIED==='yes'}};
  if(!validSecret){
   return {status:200,body:{...report,heartbeat:{state:'unknown'},work:{state:'unknown'},
    routines:{state:'unknown'},overall:'attention'}};
  }
  const [controller,stalled,uncertain,routines,claims]=await Promise.all([
   probe(async()=>{
    const r=await read('paperworld_autonomous_controller_v5?select=last_tick_at,last_error,dispatch_enabled,'+
     'sessions_per_day,sessions_per_month,credit_snapshot_at&limit=1');
    if(r.missing||!r.rows.length)return {state:'unknown'};
    const c=r.rows[0];
    return {...heartbeatState(c.last_tick_at,t),hasError:!!c.last_error,dispatchEnabled:c.dispatch_enabled===true,
     sessionsPerDay:Number.isInteger(c.sessions_per_day)?c.sessions_per_day:null,
     sessionsPerMonth:Number.isInteger(c.sessions_per_month)?c.sessions_per_month:null,
     creditSnapshot:c.credit_snapshot_at?'recorded':'missing'};
   }),
   probe(async()=>{
    const since=new Date(t-2*3600000).toISOString();
    const r=await read('paperworld_autonomous_missions_v5?select=id&owner_id=eq.'+ownerId+
     '&status=in.(queued,running,working,verifying)&updated_at=lt.'+encodeURIComponent(since)+'&limit=20');
    return r.missing?{state:'unknown'}:{state:r.rows.length?'attention':'ok',stalled:r.rows.length};
   }),
   probe(async()=>{
    const r=await read('paperworld_autonomous_effects_v5?select=effect_key&owner_id=eq.'+ownerId+
     '&state=eq.uncertain&limit=20');
    return r.missing?{state:'unknown'}:{state:r.rows.length?'attention':'ok',uncertain:r.rows.length};
   }),
   probe(async()=>{
    const r=await read('paperworld_routines_v1?select=id,enabled&owner_id=eq.'+ownerId+'&limit=30');
    return r.missing?{state:'not_installed'}:
     {state:'ok',installed:true,total:r.rows.length,enabled:r.rows.filter(x=>x.enabled).length};
   }),
   probe(async()=>{
    const r=await read('paperworld_suno_create_claims?select=owner_id&limit=0');
    return {state:r.missing?'not_installed':'ok'};
   })
  ]);
  const work={state:[stalled.state,uncertain.state].includes('attention')?'attention':
   [stalled.state,uncertain.state].includes('unknown')?'unknown':'ok',
   stalled:stalled.stalled??null,uncertain:uncertain.uncertain??null};
  const overall=controller.state==='ok'&&!controller.hasError&&work.state==='ok'?'ok':
   controller.state==='stopped'||controller.hasError?'problem':'attention';
  return {status:200,body:{...report,heartbeat:controller,work,routines,songClaims:claims,overall}};
 }
 return Object.freeze({handle,heartbeatState});
}
module.exports=Object.freeze({makeSystemHealth,heartbeatState});
