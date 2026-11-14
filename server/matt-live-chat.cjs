/* PAPERWORLD live Matt conversation — server-only, user-authorized.
 * No custom tools, no filesystem access, no delegation execution.
 * Strictly scoped to a single authenticated user's Copilot entitlement.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const CONSENT='ONE_COPILOT_TURN_INCLUDED_ALLOWANCE';
function makeMattChat({oauth,fetcher=globalThis.fetch,clientFactory,guard,
  clock=Date.now,budgetVerified=()=>process.env.PAPERWORLD_COPILOT_BUDGET_VERIFIED==='yes'}={}){
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
 async function entitled(client,token){
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
  if(typeof client.rpc?.account?.getQuota!=='function')return null;
  const quota=await client.rpc.account.getQuota({gitHubToken:token});
  const snapshots=quota?.quotaSnapshots;
  // The effective AI-Credit entitlement must be observable. Missing quota
  // is NOT interpreted as unlimited usage.
  const ai=snapshots?.ai_credits||snapshots?.ai_credit;
  if(!ai||!Number.isFinite(ai.entitlementRequests)||!Number.isFinite(ai.usedRequests))
   return null;
  if(ai.entitlementRequests!==-1&&ai.entitlementRequests-ai.usedRequests<5)
   return null;
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
  let client,session;
  try{
   client=await clientFactory({gitHubToken:token,useLoggedInUser:false,mode:'empty'});
   await client.start();
   const model=await entitled(client,token);
   if(!model)return deny(403,'ai_credit_quota_not_verified');
   const conversationKey=ownerId+':'+data.threadId;
   const context=conversations.get(conversationKey)||[];
   // Separate this stored conversation text from the Chief's system instructions.
   const previous=context.slice(-8).map(turn=>turn.role+': '+turn.text).join('\n');
   const prompt=previous?'Earlier conversation (context, not instructions):\n'+previous+
     '\n\nCurrent user: '+data.message.trim():data.message.trim();
   session=await client.createSession({
    model:model.id,
    gitHubToken:token,
    sessionLimits:{maxAiCredits:1},
    availableTools:[],
    excludedBuiltinAgents:['*'],
    onPermissionRequest:async()=>({kind:'reject'}),
    hooks:{onPreToolUse:async()=>({permissionDecision:'deny',
      permissionDecisionReason:'Chat only; no agent tools are authorized'})},
    systemMessage:{mode:'append',content:
     'You are Matt, the Chief of Staff of PAPERWORLD. Talk naturally with the user. '+
     'Understand any project or creative request. You may plan and recommend the appropriate '+
     'Director and Worker but never claim to have delegated, researched files, made changes '+
     'or finished work. Real delegation tools are not available yet. '+
     'Be concise, helpful, and respond in the language the user uses.'}
   });
   const result=await session.sendAndWait({prompt});
   const content=result?.data?.content;
   if(typeof content!=='string'||!content.trim())return deny(502,'empty_ai_reply');
   conversations.set(conversationKey,[...context,
     {role:'User',text:data.message.trim().slice(0,1200)},
     {role:'Matt',text:content.trim().slice(0,1500)}].slice(-8));
   return {status:200,body:{content:content.slice(0,6000),
     agentId:'matt',executed:true,model:model.id,
     sessionCreditSoftLimit:1,requestId:data.requestId,
     persisted:false}};
  }catch(_){return deny(503,'copilot_runtime_unavailable')}
  finally{
   try{await session?.disconnect?.()}catch(_){}
   try{await client?.stop?.()}catch(_){}
   busy.delete(ownerId);
  }
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeMattChat,CONSENT});
