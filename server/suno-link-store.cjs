'use strict';
/* Durable, encrypted Suno link for the owner, so Crow's Suno connection
 * survives Render deploys and is refreshed instead of silently expiring.
 * Tokens are sealed with AES-256-GCM (key derived from the server's secret)
 * before they leave the process; the table is service-role only. Any storage
 * problem degrades to the old in-memory behaviour, never to a broken chat.
 */
const {createCipheriv,createDecipheriv,randomBytes,hkdfSync}=require('node:crypto');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const OWNER=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function keyFrom(secret,purpose='paperworld-suno-link-v1'){
 return Buffer.from(hkdfSync('sha256',Buffer.from(secret,'utf8'),Buffer.from('paperworld'),
  Buffer.from(purpose),32));
}
function seal(key,value){
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);
 const body=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);
 return 'v1.'+Buffer.concat([iv,c.getAuthTag(),body]).toString('base64url');
}
function open(key,sealed){
 if(typeof sealed!=='string'||!sealed.startsWith('v1.'))return null;
 try{const raw=Buffer.from(sealed.slice(3),'base64url');
  const d=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));d.setAuthTag(raw.subarray(12,28));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(28)),d.final()]).toString('utf8'));
 }catch(_){return null}
}
// One sealed link per owner in a service-role-only table (Suno, GitHub).
function makeSealedLinkStore({table,purpose,fetcher=globalThis.fetch,secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 if(!/^paperworld_[a-z]+_links_v1$/.test(table||''))throw Error('sealed_table_required');
 const enabled=typeof secret==='string'&&secret.length>=20&&typeof fetcher==='function';
 const key=enabled?keyFrom(secret,purpose):null;
 const headers=()=>({apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
  'Content-Type':'application/json',Accept:'application/json'});
 async function call(path,init){
  const r=await fetcher(BASE+'/rest/v1/'+path,{redirect:'error',signal:AbortSignal.timeout(6000),...init,headers:{...headers(),...(init.headers||{})}});
  if(!r?.ok)throw Error('suno_link_store_unavailable');
  return r.status===204?null:r.json();
 }
 async function save(ownerId,link){
  if(!enabled||!OWNER.test(ownerId||''))return false;
  try{await call(table,{method:'POST',
    headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({owner_id:ownerId,sealed:seal(key,link),updated_at:new Date().toISOString()})});return true}
  catch(_){return false}
 }
 async function load(ownerId){
  if(!enabled||!OWNER.test(ownerId||''))return null;
  try{const rows=await call(table+'?select=sealed&owner_id=eq.'+ownerId+'&limit=1',{method:'GET'});
   return Array.isArray(rows)&&rows[0]?open(key,rows[0].sealed):null}
  catch(_){return null}
 }
 async function remove(ownerId){
  if(!enabled||!OWNER.test(ownerId||''))return false;
  try{await call(table+'?owner_id=eq.'+ownerId,{method:'DELETE'});return true}catch(_){return false}
 }
 async function loadAll(){
  if(!enabled)return [];
  try{const rows=await call(table+'?select=owner_id,sealed&limit=20',{method:'GET'});
   return (Array.isArray(rows)?rows:[]).flatMap(r=>{const v=OWNER.test(r?.owner_id||'')?open(key,r.sealed):null;
    return v?[{ownerId:r.owner_id,link:v}]:[]})}
  catch(_){return []}
 }
 return Object.freeze({enabled,save,load,loadAll,remove});
}
const makeSunoLinkStore=(o={})=>makeSealedLinkStore({...o,table:'paperworld_suno_links_v1',purpose:'paperworld-suno-link-v1'});
const makeGithubLinkStore=(o={})=>makeSealedLinkStore({...o,table:'paperworld_github_links_v1',purpose:'paperworld-github-link-v1'});
module.exports=Object.freeze({makeSunoLinkStore,makeGithubLinkStore,makeSealedLinkStore,seal,open,keyFrom});
