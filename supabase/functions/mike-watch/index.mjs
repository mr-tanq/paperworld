/* Mike, the PAPERWORLD markets Director — read-only portfolio watcher.
 * Every weekday after the US close (cron) he reads PUBLIC end-of-day prices
 * for what the owner holds, works out the day (and, on Fridays, the week) in
 * EUR and posts one short note through Matt's chat. No AI, no trading, no
 * advice: numbers only. The phone line shows percentages only (privacy).
 */
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PREFIX='@paperworld-matt:v1:';
const QUOTES='https://query1.finance.yahoo.com/v8/finance/chart/';
const UA={'User-Agent':'Mozilla/5.0 (compatible; paperworld-mike/1.0)',Accept:'application/json'};
const SYMBOL=/^[A-Z0-9][A-Z0-9.=^-]{0,19}$/;
const PUBLIC_KEY='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
// The owner's app may ask for live prices from these origins only.
const ORIGINS=new Set(['https://mr-tanq.github.io']);
const cors=origin=>ORIGINS.has(origin)?{'access-control-allow-origin':origin,'vary':'origin',
 'access-control-allow-headers':'authorization, content-type, apikey','access-control-allow-methods':'POST, OPTIONS'}:{};
const respond=(status,body,origin='')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...cors(origin)}});
const TZ='Europe/Amsterdam';
const dayOf=t=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date(t));
const weekdayOf=t=>new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short'}).format(new Date(t));
const GREEK_DAY={Mon:'Δευτέρα',Tue:'Τρίτη',Wed:'Τετάρτη',Thu:'Πέμπτη',Fri:'Παρασκευή',Sat:'Σάββατο',Sun:'Κυριακή'};
async function uuidFrom(text){
 const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).slice(0,16);
 b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
 const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
const num=(v,d=2)=>new Intl.NumberFormat('el-GR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Math.abs(v));
const pct=v=>(v>=0?'+':'−')+num(v*100,1)+'%';
const eur=v=>(v>=0?'+':'−')+'€'+num(v,0);
const money=v=>'€'+num(v,0);

// One public chart → the bars we need (UTC trading day + close), the latest
// price and its currency (pence become pounds).
function parseChart(json){
 const r=json?.chart?.result?.[0];if(!r)return null;
 const ts=Array.isArray(r.timestamp)?r.timestamp:[];
 const closes=r.indicators?.quote?.[0]?.close||[];
 let scale=1,currency=String(r.meta?.currency||'');
 if(currency==='GBp'||currency==='GBX'){scale=0.01;currency='GBP'}
 const bars=[];
 for(let i=0;i<ts.length;i++)if(Number.isFinite(closes[i])&&closes[i]>0)
  bars.push({day:new Date(ts[i]*1000).toISOString().slice(0,10),close:closes[i]*scale});
 const live=Number(r.meta?.regularMarketPrice)*scale;
 if(bars.length&&Number.isFinite(live)&&live>0){
  const liveDay=Number.isFinite(r.meta?.regularMarketTime)?new Date(r.meta.regularMarketTime*1000).toISOString().slice(0,10):bars.at(-1).day;
  if(liveDay===bars.at(-1).day)bars.at(-1).close=live;else if(liveDay>bars.at(-1).day)bars.push({day:liveDay,close:live});
 }
 return bars.length?{bars,currency}:null;
}
// Pure: today's and this week's change in EUR from holdings, quotes and FX.
// quotes[symbol]={bars,currency}; fx['USD'|'GBP']={bars} (units per 1 EUR).
function summarize(holdings,quotes,fx,today){
 const rate=(cur,day,which)=>{
  if(cur==='EUR')return 1;
  const b=fx[cur]?.bars;if(!b?.length)return null;
  const upto=b.filter(x=>x.day<=day);const pick=which==='prev'?upto.at(-2)||upto.at(-1):upto.at(-1);
  return (pick||b.at(-1)).close;
 };
 let total=0,before=0,weekBefore=0,weekNow=0,traded=0;const lines=[],missing=[];
 for(const h of holdings){
  const q=quotes[h.symbol];
  if(!q||!q.bars.length||(q.currency!==h.currency&&h.currency)){missing.push(h.name);continue}
  const bars=q.bars,last=bars.at(-1);
  const fresh=last.day===today;if(fresh)traded++;
  const prev=fresh?bars.at(-2):last;// not traded today: no change for it
  const fxNow=rate(q.currency,last.day),fxPrev=rate(q.currency,prev?.day||last.day,fresh?'prev':'now');
  if(!fxNow||!fxPrev||!prev){missing.push(h.name);continue}
  const nowEur=h.quantity*last.close/fxNow,prevEur=h.quantity*prev.close/fxPrev;
  total+=nowEur;before+=prevEur;
  const wk=bars.length>5?bars.at(-6):bars[0];const fxWk=rate(q.currency,wk.day)||fxNow;
  weekBefore+=h.quantity*wk.close/fxWk;weekNow+=nowEur;
  lines.push({symbol:h.symbol,name:h.name,pct:prev.close>0?last.close/prev.close-1:0,eur:nowEur-prevEur,value:nowEur,
   sinceBuy:h.avg_price>0?last.close/h.avg_price-1:null});
 }
 return {total,change:total-before,changePct:before>0?total/before-1:0,
  week:weekNow-weekBefore,weekPct:weekBefore>0?weekNow/weekBefore-1:0,lines,missing,traded};
}
// Who to mention: the best and worst of the day, plus any big move (≥3%).
function movers(lines){
 const sorted=[...lines].sort((a,b)=>b.pct-a.pct);
 const up=sorted.filter(l=>l.pct>0.0005),down=sorted.filter(l=>l.pct<-0.0005).reverse();
 const pick=(list)=>list.filter((l,i)=>i===0||Math.abs(l.pct)>=0.03).slice(0,3);
 return {up:pick(up),down:pick(down)};
}
function dividendsSoon(holdings,today,nextRun){
 return holdings.filter(h=>h.dividend_date&&h.dividend_date>today&&h.dividend_date<=nextRun);
}
// Pure: the chat text and the (shorter, no euro amounts) phone line.
function compose(sum,{weekday='Mon',dayLabel='',friday=false,dividends=[]}={}){
 const m=movers(sum.lines);
 const list=l=>l.map(x=>x.name+' '+pct(x.pct)).join(', ');
 const moves=(m.up.length?' Πάνω: '+list(m.up)+'.':'')+(m.down.length?' Κάτω: '+list(m.down)+'.':'');
 let text='📈 '+GREEK_DAY[weekday]+' '+dayLabel+': σήμερα '+pct(sum.changePct)+' ('+eur(sum.change)+'). '+
  'Το χαρτοφυλάκιο αξίζει περίπου '+money(sum.total)+'.'+moves;
 let phone='Σήμερα '+pct(sum.changePct)+'.'+moves;
 if(friday){text+=' Η εβδομάδα: '+pct(sum.weekPct)+' ('+eur(sum.week)+').';phone+=' Εβδομάδα: '+pct(sum.weekPct)+'.'}
 for(const d of dividends){
  const when=d.dividend_date.slice(8,10)+'/'+d.dividend_date.slice(5,7);
  text+=' Στις '+when+' πληρώνεται μέρισμα '+d.name+(d.dividend_per_share?' ('+num(d.dividend_per_share*d.quantity)+' '+
   (d.currency==='EUR'?'€':d.currency==='USD'?'$':'£')+' πριν τον φόρο)':'')+'.';
 }
 if(sum.missing.length)text+=' Δεν βρήκα τιμή για: '+sum.missing.slice(0,3).join(', ')+'.';
 text+=' Μόνο ενημέρωση, όχι συμβουλή.';
 return {text,phone};
}
function nextWeekday(day){
 const d=new Date(day+'T12:00:00Z');do{d.setUTCDate(d.getUTCDate()+1)}while([0,6].includes(d.getUTCDay()));
 return d.toISOString().slice(0,10);
}
function createMike({environment,fetcher=fetch,clock=Date.now}={}){
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
 const recent=new Map();// symbol -> {at,chart}: live views reuse a price for 60 s
 async function chart(symbol,{fresh=60000}={}){
  if(!SYMBOL.test(symbol))return null;
  const hit=recent.get(symbol);if(hit&&clock()-hit.at<fresh)return hit.chart;
  const c=await fetchChart(symbol);if(c)recent.set(symbol,{at:clock(),chart:c});return c;
 }
 async function fetchChart(symbol){
  try{const r=await fetcher(QUOTES+encodeURIComponent(symbol)+'?range=1mo&interval=1d',{headers:UA,redirect:'follow',signal:AbortSignal.timeout(8000)});
   return r?.ok?parseChart(await r.json()):null}catch(_){return null}
 }
 async function runOnce({force=false}={}){
  const now=clock(),weekday=weekdayOf(now);
  if(!force&&(weekday==='Sat'||weekday==='Sun'))return {state:'weekend'};
  const rows=await db('paperworld_mike_holdings_v1?select=owner_id,symbol,name,quantity,avg_price,currency,dividend_date,dividend_per_share&limit=200')||[];
  if(!rows.length)return {state:'no_holdings'};
  const symbols=[...new Set(rows.map(r=>r.symbol))].slice(0,40);
  const quotes={};
  for(const s of symbols){const c=await chart(s);if(c)quotes[s]=c}
  const fx={};
  for(const [cur,sym] of [['USD','EURUSD=X'],['GBP','EURGBP=X']])
   if(Object.values(quotes).some(q=>q.currency===cur)){const c=await chart(sym);if(c)fx[cur]=c}
  const today=new Date(now).toISOString().slice(0,10),local=dayOf(now);
  const owners=[...new Set(rows.map(r=>r.owner_id))];const results=[];
  for(const owner of owners)try{
   const mine=rows.filter(r=>r.owner_id===owner).map(r=>({...r,quantity:Number(r.quantity),avg_price:r.avg_price==null?null:Number(r.avg_price),
    dividend_per_share:r.dividend_per_share==null?null:Number(r.dividend_per_share)}));
   const sum=summarize(mine,quotes,fx,today);
   if(!sum.traded){results.push({state:'market_closed'});continue}
   await db('paperworld_mike_daily_v1?on_conflict=owner_id,day','POST',{owner_id:owner,day:local,total_eur:+sum.total.toFixed(2),
    change_eur:+sum.change.toFixed(2),change_pct:+(sum.changePct*100).toFixed(3),
    lines:sum.lines.map(l=>({symbol:l.symbol,name:l.name,pct:+(l.pct*100).toFixed(2),eur:+l.eur.toFixed(2),value:+l.value.toFixed(2),
     sinceBuy:l.sinceBuy==null?null:+(l.sinceBuy*100).toFixed(2)}))},'resolution=merge-duplicates,return=minimal');
   const ctx=(await db('paperworld_autonomous_missions_v5?select=thread_id&owner_id=eq.'+owner+'&engine=eq.v1&order=created_at.desc&limit=1'))?.[0];
   if(!ctx?.thread_id){results.push({state:'saved_no_thread'});continue}
   const note=compose(sum,{weekday,dayLabel:local.slice(8,10)+'/'+local.slice(5,7),friday:weekday==='Fri',
    dividends:dividendsSoon(mine,local,nextWeekday(local))});
   await db('paperworld_agent_messages','POST',{id:await uuidFrom('paperworld-mike:'+owner+':'+local),thread_id:ctx.thread_id,owner_id:owner,
    role:'agent',content:PREFIX+JSON.stringify({director:'markets-director',kind:'notification',text:note.text,phone:note.phone})},
    'resolution=ignore-duplicates,return=minimal');
   results.push({state:'posted',holdings:sum.lines.length,missing:sum.missing.length});
  }catch(_){results.push({state:'error'})}
  return {state:'done',results};
 }
 // Live view for the signed-in owner: their own holdings at the latest public
 // prices (US quotes are near real time, European exchanges about 15 min
 // behind). Read-only, no AI, nothing saved, nothing posted.
 async function ownerOf(token){
  if(typeof token!=='string'||token.length<20)return null;
  const r=await fetcher(BASE+'/auth/v1/user',{redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+token}}).catch(()=>null);
  if(!r?.ok)return null;const u=await r.json().catch(()=>null);
  return /^[0-9a-f-]{36}$/i.test(u?.id||'')?u.id:null;
 }
 async function live(owner){
  const rows=(await db('paperworld_mike_holdings_v1?select=symbol,name,quantity,avg_price,currency&owner_id=eq.'+owner+'&limit=40'))||[];
  if(!rows.length)return {state:'no_holdings'};
  const mine=rows.map(r=>({...r,quantity:Number(r.quantity),avg_price:r.avg_price==null?null:Number(r.avg_price)}));
  const quotes={};for(const s of [...new Set(mine.map(r=>r.symbol))]){const c=await chart(s);if(c)quotes[s]=c}
  const fx={};for(const [cur,sym] of [['USD','EURUSD=X'],['GBP','EURGBP=X']])
   if(Object.values(quotes).some(q=>q.currency===cur)){const c=await chart(sym);if(c)fx[cur]=c}
  const sum=summarize(mine,quotes,fx,new Date(clock()).toISOString().slice(0,10));
  const r2=v=>Math.round(v*100)/100;
  return {state:'live',at:new Date(clock()).toISOString(),total:r2(sum.total),change:r2(sum.change),changePct:r2(sum.changePct*100),
   open:sum.traded>0,missing:sum.missing,lines:sum.lines.map(l=>({symbol:l.symbol,name:l.name,price:r2(quotes[l.symbol].bars.at(-1).close),
    currency:quotes[l.symbol].currency,pct:r2(l.pct*100),value:r2(l.value),eur:r2(l.eur),sinceBuy:l.sinceBuy==null?null:r2(l.sinceBuy*100)}))};
 }
 async function handle(request){
  const origin=request.headers.get('origin')||'';
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=='POST')return respond(405,{error:'method_not_allowed'},origin);
  const secret=env('PAPERWORLD_DISPATCH_TRIGGER_SECRET');
  if(!secret||secret.length<32||!dbKey())return respond(503,{error:'credentials_unavailable'},origin);
  const auth=request.headers.get('authorization')||'';
  const body=await request.json().catch(()=>({}));
  if(auth==='Bearer '+secret){
   try{return respond(200,await runOnce({force:body?.force===true}))}catch(_){return respond(503,{error:'mike_unavailable'})}
  }
  if(body?.live!==true)return respond(401,{error:'unauthorized'},origin);
  const owner=await ownerOf(auth.replace(/^Bearer /,''));
  if(!owner)return respond(401,{error:'unauthorized'},origin);
  try{return respond(200,await live(owner),origin)}catch(_){return respond(503,{error:'prices_unavailable'},origin)}
 }
 return Object.freeze({handle,runOnce});
}
export {createMike,parseChart,summarize,movers,compose,dividendsSoon,nextWeekday};
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function'){
 Deno.serve(createMike({environment:k=>Deno.env.get(k)}).handle);
}
