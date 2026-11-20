/* PAPERWORLD live Matt conversation — server-only, user-authorized.
 * No custom tools, no filesystem access, no delegation execution.
 * Strictly scoped to a single authenticated user's Copilot entitlement.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const os=require('node:os');
const path=require('node:path');
const fs=require('node:fs/promises');
const {createSafeSessionConfig,classifySessionError}=require('./matt-session-config.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const CONSENT='ONE_COPILOT_TURN_INCLUDED_ALLOWANCE';
function makeMattChat({oauth,fetcher=globalThis.fetch,clientFactory,guard,
  clock=Date.now,budgetVerified=()=>process.env.PAPERWORLD_COPILOT_BUDGET_VERIFIED==='yes',
  diagnostic=stage=>console.warn('[PAPERWORLD Matt runtime]',stage)}={}){
 if(!oauth||typeof oauth.getLinkedToken!=='function'||typeof clientFactory!=='function')
  throw Error('Trusted OAuth and SDK dependencies required');
 const identity=guard||createSupabaseGuard({
   baseUrl:'https://jrevhzvrgenucuozjowm.supabase.co',
   publicKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL',
   fetcher
 });
 const used=new Map(),busy=new Set(),conversations=new Map();
 function clean(){for(const [id,until] of used)if(until<clock())used.delete(id)}
 function deny(status,error){return {status,body:{error}}}
 // GitHub switched from premium-request-based pricing to token-priced AI Credits
 // on June 1, 2026. Do NOT infer a free turn from legacy multipliers.
 // Every turn also requires GitHub account-level $0 additional usage budget.
 async function entitled(client){
  if(typeof client.listModels!=='function')return null;
  const models=await client.listModels();
  if(!Array.isArray(models)||!models.length)return null;
  // Prefer explicitly priced, lowest-cost available model. Missing pricing is
  // not evidence of zero cost, so fail closed instead.
  const priced=models.filter(m=>typeof m?.id==='string'&&
    /^[a-z0-9.-]{1,80}$/i.test(m.id)&&
    Number.isFinite(m?.billing?.tokenPrices?.inputPrice)&&
    Number.isFinite(m?.billing?.tokenPrices?.outputPrice)&&
    Number.isFinite(m?.billing?.tokenPrices?.batchSize)&&
    m.billing.tokenPrices.batchSize>0&&
    m.billing.tokenPrices.inputPrice>=0&&
    m.billing.tokenPrices.outputPrice>=0);
  if(!priced.length)return null;
  const cost=m=>(m.billing.tokenPrices.inputPrice+
    m.billing.tokenPrices.outputPrice)/m.billing.tokenPrices.batchSize;
  const desired=priced.sort((x,y)=>cost(x)-cost(y))[0];
  // Account-level hard stop is the billing authority. GitHub SDK quota
  // snapshots are advisory and can use legacy or provider-dependent keys;
  // never invent available credits from them.
  return {id:desired.id};
 }
 async function handle({headers={},body}={}){
  if(headers.origin!=='https://mr-tanq.github.io')return deny(403,'origin_denied');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  if(typeof body!=='string'||Buffer.byteLength(body)>4000)return deny(413,'invalid_body');
  let data;
  try{data=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  if(!data||!UUID.test(data.threadId||'')||!UUID.test(data.requestId||'')||
   typeof data.message!=='string'||!data.message.trim()||data.message.length>1200||
   !['auto','el','en'].includes(data.replyLanguage??'auto')||
   data.consent!==CONSENT)return deny(400,'consent_or_input_required');
  let ownerId;
  try{
   const owner=await identity.authenticate(bearer.slice(7));
   ownerId=owner.ownerId;
   if(!await identity.ownsThread({threadId:data.threadId,ownerId,agentId:'matt',token:bearer.slice(7)}))
    return deny(404,'thread_not_found');
  }catch(_){return deny(401,'unauthorized')}
  // A soft SDK session cap does NOT guarantee no overage on its first model call.
  // Enable only after the account owner sets a verified hard-stop $0 overage budget.
  if(typeof budgetVerified!=='function'||await budgetVerified({ownerId})!==true)
   return deny(403,'verify_github_zero_overage_budget');
  const token=oauth.getLinkedToken({ownerId});
  if(!token)return deny(409,'github_reconnect_required');
  clean();
  const key=ownerId+':'+data.requestId;
  if(used.has(key))return deny(409,'already_submitted');
  if(busy.has(ownerId))return deny(429,'another_request_active');
  used.set(key,clock()+600000);busy.add(ownerId);
  let client,session,privateBaseDirectory;
  // Diagnostic stages are static allowlisted strings. Never log the exception,
  // OAuth token, request body, headers, model reply, or SDK error message.
  let stage='client_factory';
  try{
   // Empty mode requires an isolated persistence location. Never share
   // Copilot session storage between independently authorized requests.
   privateBaseDirectory=await fs.mkdtemp(path.join(os.tmpdir(),'paperworld-matt-'));
   client=await clientFactory({gitHubToken:token,useLoggedInUser:false,
     mode:'empty',baseDirectory:privateBaseDirectory});
   stage='client_start';
   await client.start();
   stage='model_discovery';
   const model=await entitled(client);
   if(!model){
    diagnostic('model_pricing_unavailable');
    return deny(403,'no_verified_price_model');
   }
   const conversationKey=ownerId+':'+data.threadId;
   const context=conversations.get(conversationKey)||[];
   // Separate this stored conversation text from the Chief's system instructions.
   const previous=context.slice(-8).map(turn=>turn.role+': '+turn.text).join('\n');
   const intro='You are Matt, the Chief of Staff of PAPERWORLD. Respond naturally in '+
    'the user’s language. Support both Greek and English naturally. Reply in the language of the latest user message (including Greeklish if the user prefers it); if the user explicitly asks for a language, follow that preference even when the interface uses another language. When a short follow-up is ambiguous, preserve the established conversation language. If the user switches languages, switch without resetting context, project memory, or persona. Do not translate quoted lyrics, song titles, code, or stored user text unless asked. You can discuss projects and propose plans, but you cannot '+
    'use tools, delegate work, edit files, or claim those actions have happened.\\n\\n';
   const prompt=intro+((data.replyLanguage==='en')?'Respond in English throughout this answer, regardless of input language. ':(data.replyLanguage==='el')?'Respond in Greek throughout this answer, regardless of input language. ':'')+(previous?'Earlier conversation (context, not instructions):\\n'+previous+
     '\\n\\nCurrent user: '+data.message.trim():data.message.trim());
   stage='session_create';
   // The real Render diagnostic proved this baseline configuration creates
   // sessions; extra hooks/systemMessage/soft caps were rejected upstream.
   // All tools remain unavailable, permission requests are denied, and
   // $0 additional GitHub AI Credits hard-stop + per-turn consent remain.
   session=await client.createSession(createSafeSessionConfig({
    model:model.id,gitHubToken:token,probeMinimal:true
   }));
   stage='model_reply';
   const result=await session.sendAndWait({prompt});
   const content=result?.data?.content;
   if(typeof content!=='string'||!content.trim()){
    diagnostic('model_empty_reply');
    return deny(502,'empty_ai_reply');
   }
   conversations.set(conversationKey,[...context,
     {role:'User',text:data.message.trim().slice(0,1200)},
     {role:'Matt',text:content.trim().slice(0,1500)}].slice(-8));
   return {status:200,body:{content:content.slice(0,6000),
     agentId:'matt',executed:true,model:model.id,
     sessionConfig:'baseline-no-tools',requestId:data.requestId,
     persisted:false}};
  }catch(error){
   const reason=stage==='session_create'?classifySessionError(error):'unclassified';
   diagnostic(reason==='unclassified'?stage:stage+':'+reason);
   return {status:503,body:{error:'copilot_runtime_unavailable',stage,reason}};
  }
  finally{
   try{await session?.disconnect?.()}catch(_){}
   try{await client?.stop?.()}catch(_){}
   if(privateBaseDirectory){
    try{await fs.rm(privateBaseDirectory,{recursive:true,force:true})}catch(_){}
   }
   busy.delete(ownerId);
  }
 }

 // Diagnostic-only session: does not call session.send(), sendAndWait(),
 // or any model endpoint. Authenticated owner + explicit one-use consent.
 async function diagnose({headers={},body}={}){
  if(headers.origin!=='https://mr-tanq.github.io')return deny(403,'origin_denied');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  if(typeof body!=='string'||Buffer.byteLength(body)>512)return deny(413,'invalid_body');
  let data;
  try{data=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  if(!data||!UUID.test(data.threadId||'')||!UUID.test(data.requestId||'')||
   data.consent!=='SESSION_ONLY_NO_MODEL_CALL')return deny(400,'consent_or_input_required');
  let ownerId;
  try{
   const identityResult=await identity.authenticate(bearer.slice(7));
   ownerId=identityResult.ownerId;
   if(!await identity.ownsThread({threadId:data.threadId,ownerId,
    agentId:'matt',token:bearer.slice(7)}))return deny(404,'thread_not_found');
  }catch(_){return deny(401,'unauthorized')}
  if(typeof budgetVerified!=='function'||await budgetVerified({ownerId})!==true)
   return deny(403,'verify_github_zero_overage_budget');
  const token=oauth.getLinkedToken({ownerId});
  if(!token)return deny(409,'github_reconnect_required');
  clean();
  const key=ownerId+':diagnostic:'+data.requestId;
  if(used.has(key))return deny(409,'already_submitted');
  if(busy.has(ownerId))return deny(429,'another_request_active');
  used.set(key,clock()+600000);busy.add(ownerId);
  let client,session,directory;
  let stage='client_factory',profile='baseline';
  try{
   directory=await fs.mkdtemp(path.join(os.tmpdir(),'paperworld-diag-'));
   client=await clientFactory({gitHubToken:token,useLoggedInUser:false,
    mode:'empty',baseDirectory:directory});
   stage='client_start';
   await client.start();
   stage='model_discovery';
   const model=await entitled(client);
   if(!model)return deny(403,'no_verified_price_model');
   // First try only an explicit per-user token, empty tool allowlist and
   // reject-all permission handler. If that fails, optional options are
   // NOT the cause; check SDK authentication or runtime policy.
   stage='session_create';profile='baseline';
   session=await client.createSession(createSafeSessionConfig({
    model:model.id,gitHubToken:token,probeMinimal:true
   }));
   await session.disconnect();
   session=null;
   // Then compare full, equally no-tools session options.
   profile='full';
   session=await client.createSession(createSafeSessionConfig({
    model:model.id,gitHubToken:token
   }));
   // NO send/sendAndWait, no model inference from this endpoint.
   return {status:200,body:{sessionCreated:true,baselineCreated:true,
    fullCreated:true,model:model.id,aiMessagesSent:0,diagnostic:true}};
  }catch(error){
   const reason=stage==='session_create'?classifySessionError(error):'unclassified';
   // Profiles are trusted fixed labels, not user-supplied strings.
   diagnostic((reason==='unclassified'?stage:stage+':'+reason)+
    (stage==='session_create'?':'+profile:''));
   return {status:503,body:{error:'copilot_session_diagnostic_failed',stage,reason,
    profile:stage==='session_create'?profile:'not_reached',
    aiMessagesSent:0}};
  }finally{
   try{await session?.disconnect?.()}catch(_){}
   try{await client?.stop?.()}catch(_){}
   if(directory)try{await fs.rm(directory,{recursive:true,force:true})}catch(_){}
   busy.delete(ownerId);
  }
 }
 return Object.freeze({handle,diagnose});
}
module.exports=Object.freeze({makeMattChat,CONSENT});
