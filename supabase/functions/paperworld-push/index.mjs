/* Paperworld phone notifications — sends Matt's updates (finished work,
 * stopped work, morning summary, reminders) as standard Web Push to the
 * owner's own subscribed devices. Cron-woken each minute; at most once per
 * message (push_sent ledger); dead subscriptions are removed. No model calls.
 */
import {sendPush} from './webpush.mjs';
const URL_BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PREFIX='@paperworld-matt:v1:';
const VAPID_PUBLIC='BLcC5py3RbGWyTtPIzE2lVRJrKuBKzsW8umfVhay_k0a1OADCwwbSvuLeXVrxl57JoI23DF9X365ySBpDg5z5gk';
const NAMES={matt:'Matt','listening-director':'Luna','pokemon-director':'Joey','studio-director':'Crow','wellbeing-director':'Dave'};
const respond=(status,body)=>new Response(JSON.stringify(body),{status,
 headers:{'content-type':'application/json','cache-control':'no-store'}});
// What the phone shows: who speaks and the first lines of the update.
function notificationFor(row){
 if(typeof row?.content!=='string'||!row.content.startsWith(PREFIX))return null;
 let data;try{data=JSON.parse(row.content.slice(PREFIX.length))}catch(_){return null}
 if(data?.kind!=='notification'||typeof data.text!=='string'||!data.text.trim())return null;
 const who=NAMES[data.director]||'Matt';
 const text=data.text.replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim();
 return {title:who==='Matt'?'Matt · PAPERWORLD':who+' μέσω Matt',
  body:text.length>180?text.slice(0,177)+'…':text,tag:'pw-'+row.id,url:'./?open=matt'};
}
function createPushSender({environment,fetcher=fetch,clock=Date.now}={}){
 const env=k=>environment?.(k);
 function dbKey(){
  try{const modern=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default;
   if(typeof modern==='string'&&modern.startsWith('sb_secret_'))return modern}catch(_){}
  const legacy=env('SUPABASE_SERVICE_ROLE_KEY');return typeof legacy==='string'&&legacy.length>20?legacy:null;
 }
 async function db(path,method='GET',body,prefer){
  const key=dbKey();if(!key)throw Error('backend_credential_unavailable');
  const res=await fetcher(URL_BASE+'/rest/v1/'+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),Accept:'application/json',
    'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!res?.ok)throw Error('database_request_failed');
  return res.status===204?null:res.json();
 }
 // The private key lives in the database Vault; the cron wake-up passes it
 // over HTTPS with the trigger secret (an env secret, if set, wins).
 function vapid(fromVault){
  let privateJwk=null;try{privateJwk=JSON.parse(env('PAPERWORLD_VAPID_PRIVATE_JWK')||fromVault||'null')}catch(_){}
  const publicKey=env('PAPERWORLD_VAPID_PUBLIC_KEY')||VAPID_PUBLIC;
  if(!privateJwk?.d||typeof publicKey!=='string'||publicKey.length<80)return null;
  return {privateJwk,publicKey,subject:'https://mr-tanq.github.io/paperworld/'};
 }
 async function runOnce({vaultKey}={}){
  const keys=vapid(vaultKey);if(!keys)return {state:'not_configured'};
  const subs=await db('paperworld_push_subscriptions_v1?select=owner_id,endpoint,p256dh,auth,created_at&limit=50');
  if(!Array.isArray(subs)||!subs.length)return {state:'idle',sent:0};
  // Only messages newer than the device's subscription, and never older than 6 h.
  const oldest=Math.max(clock()-6*3600000,Math.min(...subs.map(s=>Date.parse(s.created_at)||clock())));
  const rows=await db('paperworld_agent_messages?'+new URLSearchParams({
   select:'id,owner_id,content,created_at',role:'eq.agent',content:'like.'+PREFIX+'*',
   created_at:'gte.'+new Date(oldest).toISOString(),order:'created_at.asc',limit:'40'}));
  let sent=0,gone=0;
  for(const row of Array.isArray(rows)?rows:[]){
   const note=notificationFor(row);if(!note)continue;
   const mine=subs.filter(s=>s.owner_id===row.owner_id&&Date.parse(s.created_at)<=Date.parse(row.created_at));
   if(!mine.length)continue;
   // Claim first: a crash after this point can never send the same update twice.
   const claimed=await db('paperworld_push_sent_v1','POST',{message_id:row.id,owner_id:row.owner_id},
    'resolution=ignore-duplicates,return=representation');
   if(!Array.isArray(claimed)||!claimed.length)continue;
   for(const sub of mine){
    let r;try{r=await sendPush(sub,note,{vapid:keys,fetcher})}catch(_){r={state:'failed'}}
    if(r.state==='sent')sent++;
    if(r.state==='gone'){gone++;
     await db('paperworld_push_subscriptions_v1?endpoint=eq.'+encodeURIComponent(sub.endpoint),'DELETE').catch(()=>null)}
   }
  }
  return {state:'done',sent,gone};
 }
 async function handle(request){
  if(request.method!=='POST')return respond(405,{error:'method_not_allowed'});
  const secret=env('PAPERWORLD_DISPATCH_TRIGGER_SECRET');
  if(!secret||secret.length<32||!dbKey())return respond(503,{error:'credentials_unavailable'});
  if(request.headers.get('authorization')!=='Bearer '+secret)return respond(401,{error:'unauthorized'});
  let body={};try{body=await request.json()}catch(_){}
  try{return respond(200,await runOnce({vaultKey:typeof body?.vapid==='string'?body.vapid:null}))}catch(_){return respond(503,{error:'push_unavailable'})}
 }
 return Object.freeze({handle,runOnce});
}
export {createPushSender,notificationFor};
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function'){
 Deno.serve(createPushSender({environment:k=>Deno.env.get(k)}).handle);
}
