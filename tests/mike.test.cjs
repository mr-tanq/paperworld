'use strict';
// Mike, the markets Director: read-only, private, numbers from public prices
// (no AI), a short note every weekday evening and the week on Fridays.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const load=()=>import('../supabase/functions/mike-watch/index.mjs');
const day=(d,c)=>({day:d,close:c});
const holdings=[
 {symbol:'VWCE.DE',name:'All-World',quantity:10,avg_price:140,currency:'EUR'},
 {symbol:'MSFT',name:'Microsoft',quantity:2,avg_price:450,currency:'USD',dividend_date:'2026-12-10',dividend_per_share:0.5},
 {symbol:'ISLN.L',name:'Silver',quantity:5,avg_price:50,currency:'USD'}
];
const series=(...c)=>c.map((v,i)=>day('2026-11-'+String(19+i).padStart(2,'0'),v));
test('Chart parsing: daily closes, live price on the last bar, pence become pounds',async()=>{
 const {parseChart}=await load();
 const t=d=>Date.parse(d+'T14:30:00Z')/1000;
 const q=parseChart({chart:{result:[{meta:{currency:'USD',regularMarketPrice:101,regularMarketTime:t('2026-11-26')},timestamp:[t('2026-11-25'),t('2026-11-26')],
  indicators:{quote:[{close:[100,null]}]}}]}});
 assert.deepEqual(q,{currency:'USD',bars:[day('2026-11-25',100),day('2026-11-26',101)]});
 const p=parseChart({chart:{result:[{meta:{currency:'GBp',regularMarketPrice:250},timestamp:[t('2026-11-26')],indicators:{quote:[{close:[250]}]}}]}});
 assert.equal(p.currency,'GBP');assert.equal(p.bars[0].close,2.5);
 assert.equal(parseChart({}),null);
});
test('Day and week in EUR (FX of each day), movers and a missing price',async()=>{
 const {summarize,movers}=await load();
 const quotes={'VWCE.DE':{currency:'EUR',bars:series(150,151,152,153,154,155,160,163.2)},
  'MSFT':{currency:'USD',bars:series(500,500,500,500,500,500,508,490)}};
 const fx={USD:{bars:series(1.1,1.1,1.1,1.1,1.1,1.1,1.1,1.1)}};
 const s=summarize(holdings,quotes,fx,'2026-11-26');
 assert.equal(s.traded,2);assert.deepEqual(s.missing,['Silver']);
 const vw=s.lines.find(l=>l.symbol==='VWCE.DE');
 assert.ok(Math.abs(vw.pct-0.02)<1e-9);assert.ok(Math.abs(vw.eur-10*3.2)<1e-9);
 assert.ok(Math.abs(s.total-(10*163.2+2*490/1.1))<1e-9);
 assert.ok(Math.abs(s.change-(10*3.2+2*(490-508)/1.1))<1e-9);
 assert.ok(Math.abs(s.week-(10*(163.2-152)+2*(490-500)/1.1))<1e-9,'week = vs 5 trading days earlier');
 const m=movers(s.lines);assert.deepEqual(m.up.map(l=>l.name),['All-World']);assert.deepEqual(m.down.map(l=>l.name),['Microsoft']);
 // A market holiday: nothing traded today → no note.
 assert.equal(summarize(holdings,quotes,fx,'2026-11-27').traded,0);
});
test('Note: plain Greek with day, value, movers, Friday week, dividend; phone line has no euro amounts',async()=>{
 const {summarize,compose,dividendsSoon,nextWeekday}=await load();
 const quotes={'VWCE.DE':{currency:'EUR',bars:series(150,151,152,153,154,155,160,163.2)},
  'MSFT':{currency:'USD',bars:series(500,500,500,500,500,500,508,490)},'ISLN.L':{currency:'USD',bars:series(40,40,40,40,40,40,42,39)}};
 const s=summarize(holdings,quotes,{USD:{bars:series(1.1,1.1,1.1,1.1,1.1,1.1,1.1,1.1)}},'2026-11-26');
 assert.equal(nextWeekday('2026-11-27'),'2026-11-30');
 assert.deepEqual(dividendsSoon(holdings,'2026-12-09','2026-12-10').map(h=>h.name),['Microsoft']);
 assert.deepEqual(dividendsSoon(holdings,'2026-12-03','2026-12-04'),[]);
 const n=compose(s,{weekday:'Fri',dayLabel:'27/11',friday:true,dividends:dividendsSoon(holdings,'2026-12-09','2026-12-10')});
 assert.match(n.text,/^📈 Παρασκευή 27\/11: σήμερα [+−]\d+,\d%/);
 assert.match(n.text,/Πάνω: All-World \+2,0%\./);assert.match(n.text,/Κάτω: Silver −7,1%, Microsoft −3,5%\./);
 assert.match(n.text,/Η εβδομάδα: /);assert.match(n.text,/μέρισμα Microsoft \(1,00 \$ πριν τον φόρο\)/);
 assert.match(n.text,/Μόνο ενημέρωση, όχι συμβουλή\.$/);
 assert.doesNotMatch(n.phone,/€/,'lock screen shows percentages only');assert.match(n.phone,/Εβδομάδα: /);
});
test('mike-watch: secret-protected, weekdays only, writes the day and posts through Matt as Mike',async()=>{
 const {createMike}=await load();
 const calls=[];const t=d=>Date.parse(d+'T14:30:00Z')/1000;
 const chart=(cur,c)=>({chart:{result:[{meta:{currency:cur},timestamp:[t('2026-11-25'),t('2026-11-26')],indicators:{quote:[{close:c}]}}]}});
 const fetcher=async(url,opts={})=>{calls.push([url,opts.method||'GET',opts.body]);
  const ok=b=>({ok:true,status:200,json:async()=>b});
  if(url.includes('paperworld_mike_holdings_v1'))return ok([{owner_id:'o1',symbol:'VWCE.DE',name:'All-World',quantity:'10',avg_price:'140',currency:'EUR'}]);
  if(url.includes('finance.yahoo.com'))return ok(chart('EUR',[160,163.2]));
  if(url.includes('paperworld_autonomous_missions_v5'))return ok([{thread_id:'t1'}]);
  return {ok:true,status:201,json:async()=>null};
 };
 const env={PAPERWORLD_DISPATCH_TRIGGER_SECRET:'s'.repeat(40),SUPABASE_SERVICE_ROLE_KEY:'k'.repeat(40)};
 const mike=createMike({environment:k=>env[k],fetcher,clock:()=>Date.parse('2026-11-26T22:37:00Z')});
 assert.equal((await mike.handle(new Request('https://x',{method:'POST'}))).status,401);
 const r=await mike.runOnce();
 assert.deepEqual(r.results,[{state:'posted',holdings:1,missing:0}]);
 const daily=calls.find(c=>c[0].includes('paperworld_mike_daily_v1'));assert.equal(daily[1],'POST');
 assert.equal(JSON.parse(daily[2]).day,'2026-11-26');
 const msg=calls.find(c=>c[0].endsWith('paperworld_agent_messages'));const body=JSON.parse(msg[2]);
 const data=JSON.parse(body.content.replace('@paperworld-matt:v1:',''));
 assert.equal(data.director,'markets-director');assert.equal(data.kind,'notification');assert.equal(body.thread_id,'t1');
 const weekend=createMike({environment:k=>env[k],fetcher,clock:()=>Date.parse('2026-11-28T22:37:00Z')});
 assert.deepEqual(await weekend.runOnce(),{state:'weekend'});
 const src=fs.readFileSync('supabase/functions/mike-watch/index.mjs','utf8');
 assert.doesNotMatch(src,/copilot|openai|anthropic\.com|placeOrder|\/orders?\b/i,'no AI and no trading calls');
});
test('Phone push names Mike and James and never shows Mike\'s euro amounts',async()=>{
 const {notificationFor}=await import('../supabase/functions/paperworld-push/index.mjs');
 const row=d=>({id:'1',content:'@paperworld-matt:v1:'+JSON.stringify(d)});
 const n=notificationFor(row({kind:'notification',director:'markets-director',text:'σήμερα +0,4% (+€18). Αξία €5.120',phone:'Σήμερα +0,4%.'}));
 assert.equal(n.title,'Mike μέσω Matt');assert.equal(n.body,'Σήμερα +0,4%.');
 assert.equal(notificationFor(row({kind:'notification',director:'markets-director',text:'€5.120'})).body,'Νέα ενημέρωση για το χαρτοφυλάκιο.');
 assert.equal(notificationFor(row({kind:'notification',director:'shop-director',text:'x'})).title,'James μέσω Matt');
});
test('Mike chat: strict read-only rules and the owner\'s own portfolio via the owner token',async()=>{
 const {forMike,loadPortfolio,formatPortfolio}=require('../server/mike-markets-guide.cjs');
 const g=forMike({holdings:[{symbol:'MSFT',name:'Microsoft',quantity:2,avg_price:450,currency:'USD'}],days:[]});
 assert.match(g,/never buy or sell/);assert.match(g,/never tell the owner to buy, sell/);assert.match(g,/Microsoft \(MSFT\): 2 τεμ\./);
 assert.match(formatPortfolio([],[]),/no holdings saved yet/);
 let seen;const portfolio=await loadPortfolio({token:'t'.repeat(30),fetcher:async(url,o)=>{seen=o.headers.Authorization;return {ok:true,json:async()=>[]}}});
 assert.equal(seen,'Bearer '+'t'.repeat(30));assert.deepEqual(portfolio,{holdings:[],days:[]});
 assert.deepEqual(await loadPortfolio({token:''}),{holdings:[],days:[]});
 const chat=fs.readFileSync('server/director-direct-chat.cjs','utf8');
 assert.match(chat,/agentId==='markets-director'\?await loadPortfolio\(\{fetcher,token\}\):null/);
 assert.doesNotMatch(fs.readFileSync('js/agents.js','utf8'),/canDelegateTo:\[[^\]]*markets-director/,'Matt never routes to Mike (private)');
});
test('Work → Markets page and private tables (owner-only rows, server-only daily notes, weekday cron)',()=>{
 const ws=fs.readFileSync('js/workspace.js','utf8'),cloud=fs.readFileSync('js/cloud.js','utf8'),sql=fs.readFileSync('sql/paperworld_mike_v1.sql','utf8');
 assert.match(ws,/if\(p\.id==='markets'\)body\.append\(\.\.\.marketSections\(\)\)/);
 assert.match(ws,/const can=typeof ui\?\.listMikeHoldings==='function';/);
 assert.match(cloud,/paperworld_mike_holdings_v1\?select=symbol,name,quantity,avg_price,currency/);
 assert.match(sql,/using \(owner_id = auth\.uid\(\)\) with check \(owner_id = auth\.uid\(\)\)/);
 assert.match(sql,/revoke insert,update,delete on public\.paperworld_mike_daily_v1 from anon,authenticated/);
 assert.match(sql,/cron\.schedule\('paperworld-mike','37 22 \* \* 1-5'/);
});
