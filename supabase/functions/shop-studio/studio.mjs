/* James's production line (no AI here). For each product the owner approved:
 *  spec    → render the PDF, store it PRIVATELY (bucket shop-files), put the
 *            watermarked preview + catalogue entry in the public storefront
 *            through a pull request → listing
 *  listing → merge ONLY when the storefront's own tests passed on that exact
 *            commit → listed, and Matt tells the owner.
 * Dependencies are injected so it is fully testable. */
import {validateSpec,previewSvg,renderPdf} from './layout.mjs';
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const REPO='mr-tanq/paperworld-shop';
const PREFIX='@paperworld-matt:v1:';
const b64=s=>{const bytes=typeof s==='string'?new TextEncoder().encode(s):s;let bin='';
 for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin)};
const unb64=s=>new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\n/g,'')),c=>c.charCodeAt(0)));
function createStudio({environment,fetcher=fetch,PDFLib,clock=Date.now}={}){
 const env=k=>environment?.(k);
 function key(){try{const m=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default;if(typeof m==='string'&&m.startsWith('sb_secret_'))return m}catch(_){}
  const l=env('SUPABASE_SERVICE_ROLE_KEY');return typeof l==='string'&&l.length>20?l:null}
 const authH=k=>({apikey:k,...(k.startsWith('eyJ')?{Authorization:'Bearer '+k}:{})});
 async function db(path,method='GET',body,prefer){
  const k=key();if(!k)throw Error('backend_credential_unavailable');
  const r=await fetcher(BASE+'/rest/v1/'+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{...authH(k),Accept:'application/json','Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!r?.ok)throw Error('database_request_failed');
  return r.status===204||r.status===201&&prefer?.includes('minimal')?null:r.json();
 }
 async function store(path,bytes){
  const k=key();
  const r=await fetcher(BASE+'/storage/v1/object/shop-files/'+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
   headers:{...authH(k),Authorization:'Bearer '+k,'Content-Type':'application/pdf','x-upsert':'true'},body:bytes});
  if(!r?.ok)throw Error('file_store_failed');
 }
 async function gh(path,{method='GET',body,ok404=false}={}){
  const t=env('GITHUB_COPILOT_USER_TOKEN');if(!t)throw Error('github_credential_unavailable');
  const r=await fetcher('https://api.github.com/repos/'+REPO+path,{method,redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+t,'User-Agent':'paperworld-shop',
    ...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(ok404&&r?.status===404)return null;
  if(r?.status===422&&method==='POST'&&path==='/git/refs')return {exists:true};
  if(!r?.ok)throw Error('github_http_'+(r?.status||0));
  return r.status===204?null:r.json();
 }
 async function putFile(branch,path,content,message){
  const cur=await gh('/contents/'+path+'?ref='+encodeURIComponent(branch),{ok404:true});
  await gh('/contents/'+path,{method:'PUT',body:{message,content:b64(content),branch,...(cur?.sha?{sha:cur.sha}:{})}});
 }
 async function notify(ownerId,text){
  const t=(await db('paperworld_agent_threads?select=id&owner_id=eq.'+ownerId+'&agent_id=eq.matt&order=created_at.asc&limit=1'))?.[0];
  if(!t?.id)return;
  await db('paperworld_agent_messages','POST',{thread_id:t.id,owner_id:ownerId,role:'agent',
   content:PREFIX+JSON.stringify({director:'shop-director',kind:'notification',text})},'return=minimal').catch(()=>null);
 }
 const setRow=(id,patch)=>db('paperworld_shop_products_v1?id=eq.'+id,'PATCH',{...patch,updated_at:new Date(clock()).toISOString()},'return=minimal');
 async function list(p){
  const s=validateSpec(p.spec);
  if(s.slug!==p.slug)throw Error('slug_mismatch');
  const pdf=await renderPdf(s,PDFLib);
  const fileKey=s.slug+'.pdf';
  await store(fileKey,pdf);
  const main=await gh('/git/ref/heads/main');const branch='james/'+s.slug;
  const made=await gh('/git/refs',{method:'POST',body:{ref:'refs/heads/'+branch,sha:main.object.sha}});
  // A product made again (improved) reuses its own studio branch: start it from main.
  if(made?.exists)await gh('/git/refs/heads/'+branch,{method:'PATCH',body:{sha:main.object.sha,force:true}});
  await putFile(branch,'assets/previews/'+s.slug+'.svg',previewSvg(s),'Preview: '+s.title);
  const cat=await gh('/contents/products.json?ref='+encodeURIComponent(branch));
  const data=JSON.parse(unb64(cat.content));
  const entry={slug:s.slug,title:s.title,summary:s.summary,...(s.description?{description:s.description}:{}),
   price_eur:s.price_eur,status:'soon',preview:'./assets/previews/'+s.slug+'.svg',file_key:fileKey};
  data.products=[...(data.products||[]).filter(x=>x.slug!==s.slug),entry];
  await putFile(branch,'products.json',JSON.stringify(data,null,2)+'\n','Catalogue: '+s.title);
  const open=await gh('/pulls?state=open&head='+REPO.split('/')[0]+':'+encodeURIComponent(branch));
  const pr=open?.[0]||await gh('/pulls',{method:'POST',body:{title:'New product: '+s.title,head:branch,base:'main',
   body:'Cause: Ο James έφτιαξε νέο προϊόν μετά το «Ναι» σου.\nFix: Μπαίνει στη βιτρίνα ως «Coming soon» με προεπισκόπηση· το αρχείο μένει ιδιωτικό.\n\nMade automatically by the PAPERWORLD shop studio.'}});
  await setRow(p.id,{status:'listing',pr_number:pr.number,file_key:fileKey,last_error:null});
  return {slug:s.slug,state:'listing',pr:pr.number};
 }
 async function finish(p){
  const pr=await gh('/pulls/'+p.pr_number);
  if(pr.merged){await setRow(p.id,{status:'listed'});return {slug:p.slug,state:'listed'}}
  if(pr.state!=='open'){await setRow(p.id,{status:'failed',last_error:'pr_closed'});return {slug:p.slug,state:'failed'}}
  const runs=await gh('/commits/'+pr.head.sha+'/check-runs');
  const test=(runs?.check_runs||[]).find(r=>r.name==='test');
  if(test?.status==='completed'&&test.conclusion==='success'){
   const m=await gh('/pulls/'+p.pr_number+'/merge',{method:'PUT',body:{sha:pr.head.sha,merge_method:'squash'}});
   if(m?.merged!==true)return {slug:p.slug,state:'waiting'};
   await setRow(p.id,{status:'listed'});
   await notify(p.owner_id,'🛍️ Ο James έβαλε νέο προϊόν στη βιτρίνα: «'+String(p.spec?.title||p.slug).slice(0,60)+
    '». Φαίνεται ως «Coming soon» μέχρι να συνδεθεί το Stripe. https://mr-tanq.github.io/paperworld-shop/');
   return {slug:p.slug,state:'listed'};
  }
  if(test?.status==='completed'){await setRow(p.id,{status:'failed',last_error:'storefront_tests_failed'});
   await notify(p.owner_id,'Ο James δεν έβαλε το «'+String(p.spec?.title||p.slug).slice(0,60)+'» στη βιτρίνα: δεν πέρασε τους ελέγχους του μαγαζιού.');
   return {slug:p.slug,state:'failed'}}
  if(clock()-Date.parse(p.updated_at)>3*3600e3){await setRow(p.id,{status:'failed',last_error:'storefront_tests_timeout'});return {slug:p.slug,state:'failed'}}
  return {slug:p.slug,state:'waiting'};
 }
 async function runOnce(){
  const rows=await db('paperworld_shop_products_v1?select=id,owner_id,slug,spec,status,pr_number,updated_at&status=in.(spec,listing)&order=created_at.asc&limit=3');
  const results=[];
  for(const p of rows||[]){
   try{results.push(p.status==='spec'?await list(p):await finish(p))}
   catch(e){const code=/^[a-z0-9_]{1,60}$/.test(e?.message||'')?e.message:'studio_error';
    console.error(JSON.stringify({event:'shop_studio_error',code}));
    await setRow(p.id,{last_error:code}).catch(()=>null);results.push({slug:p.slug,state:'error',code})}
  }
  return {state:'done',results};
 }
 async function handle(request){
  if(request.method!=='POST')return new Response('{"error":"method_not_allowed"}',{status:405});
  const secret=env('PAPERWORLD_DISPATCH_TRIGGER_SECRET');
  if(!secret||secret.length<32||!key())return new Response('{"error":"credentials_unavailable"}',{status:503});
  if(request.headers.get('authorization')!=='Bearer '+secret)return new Response('{"error":"unauthorized"}',{status:401});
  try{return new Response(JSON.stringify(await runOnce()),{headers:{'content-type':'application/json'}})}
  catch(_){return new Response('{"error":"studio_unavailable"}',{status:503})}
 }
 return Object.freeze({handle,runOnce});
}
export {createStudio};
