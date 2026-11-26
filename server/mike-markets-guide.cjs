'use strict';
/* Mike, the PAPERWORLD markets Director: watches the owner's stocks and ETFs.
 * Hard rules the model is given every turn, plus the owner's own holdings and
 * last daily notes read with the OWNER's token (database row security decides
 * what is visible). Numbers come from the database, never from the model. */
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const KEY='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const GUIDE=[
 'YOUR PROJECT: Markets. You watch the owner\'s own stocks and ETFs (held at DEGIRO) and explain',
 'in plain, calm language what moved and why it may have moved (only well-known, general reasons;',
 'say clearly when you are not sure). You are READ-ONLY and PRIVATE.',
 'HARD RULES: never buy or sell anything and never say you did; never tell the owner to buy, sell,',
 'hold or time the market; no price targets or predictions; no tax or legal advice. If asked for',
 'advice, explain the facts and trade-offs neutrally (e.g. diversification, costs, risk) and say',
 'the decision is theirs, and for personal advice a licensed adviser is the right person.',
 'Use ONLY the portfolio numbers given below; never invent prices, returns, news or dates. If the',
 'numbers below are missing or old, say so. Never repeat the owner\'s holdings to anyone else.',
 'Keep answers short: a few sentences, simple Greek unless the owner writes in another language.'
].join('\n');
const clean=(v,max=80)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const n=v=>Number.isFinite(Number(v))?Number(v):null;
function formatPortfolio(holdings=[],days=[]){
 const rows=(Array.isArray(holdings)?holdings:[]).slice(0,40).map(h=>'- '+clean(h.name)+' ('+clean(h.symbol,20)+'): '+
  n(h.quantity)+' τεμ.'+(n(h.avg_price)?', μέση τιμή αγοράς '+n(h.avg_price)+' '+clean(h.currency,3):'')+
  (h.dividend_date?', μέρισμα '+clean(h.dividend_date,10):''));
 const recent=(Array.isArray(days)?days:[]).slice(0,5).map(d=>'- '+clean(d.day,10)+': αξία €'+n(d.total_eur)+
  ', μέρα '+n(d.change_pct)+'%'+(Array.isArray(d.lines)?' ('+d.lines.slice(0,10).map(l=>clean(l.name,40)+' '+n(l.pct)+'%'+
   (n(l.sinceBuy)!==null?', από αγορά '+n(l.sinceBuy)+'%':'')).join('; ')+')':''));
 return '\nOWNER PORTFOLIO (private, from the database):\n'+(rows.length?rows.join('\n'):'- (no holdings saved yet)')+
  '\nLAST DAILY NOTES:\n'+(recent.length?recent.join('\n'):'- (none yet)')+'\nEND PORTFOLIO.\n';
}
async function loadPortfolio({fetcher=globalThis.fetch,token}={}){
 if(typeof token!=='string'||token.length<20)return {holdings:[],days:[]};
 const get=async path=>{
  try{const r=await fetcher(BASE+'/rest/v1/'+path,{redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{apikey:KEY,Authorization:'Bearer '+token,Accept:'application/json'}});
   const j=r?.ok?await r.json():[];return Array.isArray(j)?j:[]}catch(_){return []}
 };
 const [holdings,days]=await Promise.all([
  get('paperworld_mike_holdings_v1?select=symbol,name,quantity,avg_price,currency,dividend_date&order=name.asc&limit=40'),
  get('paperworld_mike_daily_v1?select=day,total_eur,change_pct,lines&order=day.desc&limit=5')]);
 return {holdings,days};
}
function forMike(portfolio={}){
 return '\nMIKE – MARKETS GUIDE:\n'+GUIDE+'\nEND GUIDE.\n'+formatPortfolio(portfolio.holdings,portfolio.days);
}
module.exports=Object.freeze({forMike,loadPortfolio,formatPortfolio,GUIDE});
