/* Shop delivery: after a Stripe payment the buyer's thanks page asks for the
 * file. We ask STRIPE (never the browser) whether that checkout session is
 * paid, find which product it was (price → product metadata paperworld_slug),
 * and return a personal signed link to the PRIVATE file that expires in 1 h.
 * Without a Stripe key it only answers "payments not connected yet". */
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const ORIGIN='https://mr-tanq.github.io';
const SESSION=/^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
function createDelivery({environment,fetcher=fetch}={}){
 const env=k=>environment?.(k);
 const cors={'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Cache-Control':'no-store','content-type':'application/json'};
 const out=(status,body)=>new Response(JSON.stringify(body),{status,headers:cors});
 function key(){try{const m=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default;if(typeof m==='string'&&m.startsWith('sb_secret_'))return m}catch(_){}
  const l=env('SUPABASE_SERVICE_ROLE_KEY');return typeof l==='string'&&l.length>20?l:null}
 async function handle(request){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
  if(request.method!=='GET')return out(405,{error:'method_not_allowed'});
  const id=new URL(request.url).searchParams.get('session_id')||'';
  if(!SESSION.test(id))return out(400,{error:'invalid_session'});
  const stripe=env('STRIPE_SECRET_KEY');const k=key();
  if(!/^(rk|sk)_(live|test)_[A-Za-z0-9]{10,}$/.test(stripe||''))return out(503,{error:'payments_not_connected'});
  if(!k)return out(503,{error:'credentials_unavailable'});
  try{
   const r=await fetcher('https://api.stripe.com/v1/checkout/sessions/'+id+'?expand[]=line_items.data.price.product',
    {headers:{Authorization:'Bearer '+stripe},redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!r?.ok)return out(404,{error:'session_not_found'});
   const s=await r.json();
   if(s?.payment_status!=='paid'||s?.status!=='complete')return out(402,{error:'not_paid'});
   const slug=s?.line_items?.data?.[0]?.price?.product?.metadata?.paperworld_slug;
   if(!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug||''))return out(404,{error:'product_unknown'});
   const h={apikey:k,...(k.startsWith('eyJ')?{Authorization:'Bearer '+k}:{}),Accept:'application/json'};
   const row=(await (await fetcher(BASE+'/rest/v1/paperworld_shop_products_v1?select=slug,file_key,spec&slug=eq.'+slug+'&status=in.(listed,live)&limit=1',
    {headers:h,redirect:'error',signal:AbortSignal.timeout(8000)})).json())?.[0];
   if(!row?.file_key)return out(404,{error:'product_unknown'});
   const sg=await fetcher(BASE+'/storage/v1/object/sign/shop-files/'+row.file_key,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{...h,Authorization:'Bearer '+k,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600})});
   const signed=await sg.json();
   if(!sg.ok||typeof signed?.signedURL!=='string')return out(503,{error:'link_unavailable'});
   return out(200,{url:BASE+'/storage/v1'+signed.signedURL+'&download='+encodeURIComponent(row.file_key),title:String(row.spec?.title||slug).slice(0,80)});
  }catch(_){return out(503,{error:'delivery_unavailable'})}
 }
 return Object.freeze({handle});
}
export {createDelivery};
