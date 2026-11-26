'use strict';
/* James turns an approved idea into a product spec (one AI turn, owner's own
 * Copilot allowance). Called by the app right after the owner's "Ναι" on one
 * of James's shop ideas. The spec is validated by the SAME template code that
 * renders the product; anything else is refused. No money, no publishing here:
 * the shop-studio function makes the file and lists it after the storefront
 * tests pass. */
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createSafeSessionConfig}=require('./matt-session-config.cjs');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {forJames}=require('./james-shop-guide.cjs');
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
const PUB='sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL';
const ORIGIN='https://mr-tanq.github.io';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const layout=()=>import('../supabase/functions/shop-studio/layout.mjs');
function specPrompt(idea){
 return 'You are James, the Digital Shop Director in PAPERWORLD.'+forJames()+
  'The owner approved this idea. Turn it into ONE printable product using one of our templates.\n'+
  'IDEA: '+JSON.stringify({title:idea.title,why:idea.why,task:idea.task})+'\n'+
  'Templates: "weekly_planner" (params: weeks 1-52, focus: exactly 3 short section names), '+
  '"habit_tracker" (params: habits: 3-12 short habit names, months 1-12), '+
  '"budget_planner" (params: income: 1-6 names, expenses: 4-14 names, months 1-12).\n'+
  'Accent colour: one of terracotta, sage, navy, plum, ochre, slate. Price in EUR between 1 and 29 (realistic for a printable).\n'+
  'All product text in ENGLISH, plain ASCII only (no emoji, no curly quotes), title max 60 chars, honest summary max 200 chars, '+
  'description max 800 chars (what is inside, who it is for, A4 printable PDF). Pick the template that best serves the idea.\n'+
  'Return ONLY one JSON object: {"template":"…","accent":"…","slug":"lowercase-words-with-dashes","title":"…","subtitle":"…",'+
  '"summary":"…","description":"…","price_eur":4,"params":{…}}.';
}
function parseSpec(text){const m=String(text||'').match(/\{[\s\S]*\}/);if(!m)return null;try{return JSON.parse(m[0])}catch(_){return null}}
function makeJamesShopBuilder({fetcher=globalThis.fetch,clientFactory,tokenFor,secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY,
 guard=createSupabaseGuard({baseUrl:BASE,publicKey:PUB,fetcher})}={}){
 async function db(p,method='GET',body){
  const r=await fetcher(BASE+'/rest/v1/'+p,{method,redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{apikey:secret,...(String(secret).startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    Accept:'application/json','Content-Type':'application/json',...(method==='POST'?{Prefer:'return=representation'}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!r?.ok)throw Error('database_request_failed');
  return r.json();
 }
 async function ask(prompt,githubToken){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'paperworld-james-'));let client,session;
  try{
   client=await clientFactory({gitHubToken:githubToken,useLoggedInUser:false,mode:'empty',baseDirectory:dir});
   await client.start();
   const models=(await client.listModels()||[]).filter(m=>/^[a-z0-9.-]{1,80}$/i.test(m?.id||'')&&
    Number.isFinite(m?.billing?.tokenPrices?.inputPrice)&&Number.isFinite(m?.billing?.tokenPrices?.outputPrice)&&m.billing.tokenPrices.batchSize>0)
    .sort((a,b)=>(a.billing.tokenPrices.inputPrice+a.billing.tokenPrices.outputPrice)/a.billing.tokenPrices.batchSize-
     (b.billing.tokenPrices.inputPrice+b.billing.tokenPrices.outputPrice)/b.billing.tokenPrices.batchSize);
   if(!models.length)throw Error('no_verified_price_model');
   session=await client.createSession(createSafeSessionConfig({model:models[0].id,gitHubToken:githubToken,probeMinimal:true}));
   return (await session.sendAndWait({prompt}))?.data?.content||'';
  }finally{try{await session?.disconnect?.()}catch(_){}try{await client?.stop?.()}catch(_){}
   try{await fs.rm(dir,{recursive:true,force:true})}catch(_){}}
 }
 async function handle({headers={},body}={}){
  const deny=(status,error)=>({status,body:{error}});
  if(headers.origin!==ORIGIN)return deny(403,'origin_denied');
  if(typeof secret!=='string'||secret.length<20)return deny(503,'not_configured');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  let input;try{input=JSON.parse(body||'')}catch(_){return deny(400,'invalid_json')}
  if(!input||Object.keys(input).join(',')!=='proposalId'||!UUID.test(input.proposalId))return deny(400,'invalid_request');
  let ownerId;try{({ownerId}=await guard.authenticate(bearer.slice(7)))}catch(_){return deny(401,'unauthorized')}
  try{
   const idea=(await db('paperworld_proposals_v1?select=id,title,why,task,status,director_id&id=eq.'+input.proposalId+
    '&owner_id=eq.'+ownerId+'&limit=1'))?.[0];
   if(!idea||idea.director_id!=='shop-director'||idea.status!=='accepted')return deny(409,'idea_not_approved');
   const made=(await db('paperworld_shop_products_v1?select=slug,status&proposal_id=eq.'+idea.id+'&limit=1'))?.[0];
   if(made)return {status:200,body:{state:'already_building',slug:made.slug}};
   const githubToken=tokenFor?.({ownerId});
   if(typeof githubToken!=='string')return deny(409,'github_not_linked');
   const {validateSpec}=await layout();
   let spec=null;
   for(let attempt=0;attempt<2&&!spec;attempt++){
    try{spec=validateSpec(parseSpec(await ask(specPrompt(idea),githubToken)))}catch(_){spec=null}
   }
   if(!spec)return deny(422,'spec_invalid');
   const taken=new Set(((await db('paperworld_shop_products_v1?select=slug&slug=like.'+spec.slug+'*&limit=20'))||[]).map(r=>r.slug));
   let slug=spec.slug;for(let n=2;taken.has(slug);n++)slug=spec.slug.slice(0,55)+'-'+n;
   const row=(await db('paperworld_shop_products_v1','POST',{owner_id:ownerId,proposal_id:idea.id,slug,spec:{...spec,slug},status:'spec'}))?.[0];
   return {status:201,body:{state:'building',slug,title:spec.title,price_eur:spec.price_eur,template:spec.template,id:row?.id||null}};
  }catch(_){return deny(503,'shop_builder_unavailable')}
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeJamesShopBuilder,specPrompt,parseSpec});
