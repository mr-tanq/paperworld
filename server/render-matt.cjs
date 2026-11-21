/* PAPERWORLD Render Free server. AI gated by owner auth, consent and model quota.
 * Never log or return OAuth tokens. No autonomous tools or background work.
 */
'use strict';
const http=require('node:http');
const {createGithubOAuth,APP_ORIGIN}=require('./github-oauth.cjs');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {makeChatCredential}=require('./matt-durable-credential.cjs');
const {makeMattChat}=require('./matt-live-chat.cjs');
const {makeDirectorChat}=require('./director-direct-chat.cjs');
const {createCrowSunoPreviewApi}=require('./crow-suno-preview-api.cjs');
const {createSunoConnectionStatus}=require('./suno-connection-status.cjs');
const {createSunoOAuthClient}=require('./suno-oauth-client.cjs');
const {makeDelegation}=require('./matt-delegation.cjs');
const {makeWorkerDelegation}=require('./matt-worker-delegation.cjs');
const {makePokemonWorkerDelegation}=require('./pokemon-worker-delegation.cjs');
const {makePokemonProposalStore}=require('./v5-pokemon-proposal-store.cjs');
const {makePokemonProposalApi}=require('./v5-pokemon-proposal-api.cjs');
const {makeAutonomousMissionApi}=require('./v5-autonomous-mission-api.cjs');
const {makeRoutineOwnerApi}=require('./routine-owner-api.cjs');
const {makeSystemHealth}=require('./system-health.cjs');
const {makeSourceFactWorker}=require('./v5-source-fact-worker.cjs');
const {makeJobHistoryApi}=require('./agent-job-history-api.cjs');
const {makeTeamHandoffLedger}=require('./team-handoff-ledger-v5.cjs');
const {makeLearningProposalApi}=require('./director-learning-proposal-api.cjs');
const {createProposalMemory}=require('./listening-proposal-memory.cjs');
const {createDurableApprovalStore}=require('./listening-approval-store.cjs');
const {createListeningProposalApi}=require('./listening-proposal-api.cjs');
const {createCopilotClient}=require('./copilot-client-loader.cjs');
function response(res,status,body){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options':'DENY'});
 res.end(JSON.stringify(body));
}
function createRenderMattServer({oauth=createGithubOAuth({
  clientId:process.env.GITHUB_OAUTH_CLIENT_ID,
  clientSecret:process.env.GITHUB_OAUTH_CLIENT_SECRET,
  supabaseUrl:'https://jrevhzvrgenucuozjowm.supabase.co',
  supabaseKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL'
 }),chatFactory=({oauth})=>makeMattChat({oauth,clientFactory:createCopilotClient}),
 directorChatFactory=({oauth})=>makeDirectorChat({oauth,clientFactory:createCopilotClient}),
 delegationFactory=({oauth})=>makeDelegation({oauth,clientFactory:createCopilotClient}),
 workerFactory=({oauth,proposalMemory})=>makeWorkerDelegation({oauth,proposalMemory,clientFactory:createCopilotClient}),
 pokemonWorkerFactory=({oauth,pokemonProposalStore})=>makePokemonWorkerDelegation({oauth,pokemonProposalStore,clientFactory:createCopilotClient}),
 historyFactory=()=>makeJobHistoryApi(),
 systemHealthFactory=()=>makeSystemHealth(),
 routineOwnerApiFactory=()=>makeRoutineOwnerApi(),
 crowSunoPreviewFactory=()=>createCrowSunoPreviewApi(),
 sunoStatusFactory=()=>createSunoConnectionStatus(),
 sunoOAuthFactory=()=>createSunoOAuthClient(),
 proposalApiFactory=({oauth,memory,store})=>createListeningProposalApi({oauth,memory,store})}={}){
 let live,directorChat,delegation,worker,pokemonWorker,history,proposalApi,crowSunoPreview,sunoStatus,sunoOAuth;
 let teamLedger,learningProposalApi;
 let sourceFactWorker;
 let proposalMemory,approvalStore;
 let pokemonProposalStore,pokemonProposalApi;
 let autonomousMissionApi,routineOwnerApi,systemHealth;
 let chatCredential;
 const getChatCredential=()=>{
  if(!chatCredential)chatCredential=typeof oauth?.getLinkedToken==='function'?
   makeChatCredential({oauth}):oauth;
  return chatCredential;
 };
 function getProposalMemory(){
  if(proposalMemory!==undefined)return proposalMemory;
  try{proposalMemory=createProposalMemory()}catch(_){proposalMemory=null}
  return proposalMemory;
 }
 function getApprovalStore(){
  if(approvalStore!==undefined)return approvalStore;
  try{approvalStore=createDurableApprovalStore()}catch(_){approvalStore=null}
  return approvalStore;
 }
 function getRoutineOwnerApi(){if(!routineOwnerApi)routineOwnerApi=routineOwnerApiFactory();return routineOwnerApi}
 function getSystemHealth(){if(!systemHealth)systemHealth=systemHealthFactory();return systemHealth}
 function getAutonomousMissionApi(){
  if(!autonomousMissionApi)autonomousMissionApi=makeAutonomousMissionApi();
  return autonomousMissionApi;
 }
 function getPokemonProposalStore(){
  if(pokemonProposalStore!==undefined)return pokemonProposalStore;
  try{pokemonProposalStore=makePokemonProposalStore()}
  catch(_){pokemonProposalStore=null}
  return pokemonProposalStore;
 }
 function getPokemonProposalApi(){
  if(!pokemonProposalApi)pokemonProposalApi=makePokemonProposalApi({
   oauth,store:getPokemonProposalStore()});
  return pokemonProposalApi;
 }
 function getProposalApi(){
  if(!proposalApi)proposalApi=proposalApiFactory({oauth,
   memory:getProposalMemory(),store:getApprovalStore()});
  return proposalApi;
 }
 function getLive(){if(!live)live=chatFactory({oauth:getChatCredential()});return live}
 function getDirectorChat(){if(!directorChat)directorChat=directorChatFactory({oauth:getChatCredential()});return directorChat}
 function getDelegation(){if(!delegation)delegation=delegationFactory({oauth:getChatCredential()});return delegation}
 function getWorker(){if(!worker)worker=workerFactory({oauth,proposalMemory:getProposalMemory()});return worker}
 function getPokemonWorker(){if(!pokemonWorker)pokemonWorker=pokemonWorkerFactory({oauth,pokemonProposalStore:getPokemonProposalStore()});return pokemonWorker}
 function getHistory(){if(!history)history=historyFactory();return history}
 function getTeamLedger(){if(!teamLedger)teamLedger=makeTeamHandoffLedger();return teamLedger}
 function getLearningProposalApi(){if(!learningProposalApi)learningProposalApi=makeLearningProposalApi();return learningProposalApi}
 function getSourceFactWorker(){if(!sourceFactWorker)sourceFactWorker=makeSourceFactWorker({oauth});return sourceFactWorker}
 function getCrowSunoPreview(){if(!crowSunoPreview)crowSunoPreview=crowSunoPreviewFactory();return crowSunoPreview}
 function getSunoStatus(){if(!sunoStatus)sunoStatus=sunoStatusFactory();return sunoStatus}
 function getSunoOAuth(){if(!sunoOAuth)sunoOAuth=sunoOAuthFactory();return sunoOAuth}
 const server=http.createServer(async(req,res)=>{
  // Never enable CORS or accept browser credentials until a full OAuth review.
  if(req.method==='GET'&&req.url==='/health')
   return response(res,200,{service:'paperworld-matt',reachable:true,aiEnabled:true,stage:'authenticated-chat-guarded'});
  if(req.url==='/auth/github/callback' || req.url?.startsWith('/auth/github/callback?')){
   const result=await oauth.callback({url:req.url});
   res.writeHead(result.status,result.headers);res.end();return;
  }
  // Owner-started Suno OAuth PKCE. Tokens never enter a browser response.
  // No MCP tools/generation are available in this release.
  if(req.method==='GET'&&req.url==='/auth/suno/client-metadata'){
   return response(res,200,getSunoOAuth().clientMetadata());
  }
  if(req.method==='GET'&&
      (req.url==='/auth/suno/callback'||req.url?.startsWith('/auth/suno/callback?'))){
   const result=await getSunoOAuth().callback({url:req.url});
   res.writeHead(result.status,result.headers);res.end();return;
  }
  const sunoAuthAction={'/auth/suno/start':'start',
   '/auth/suno/status':'status',
   '/auth/suno/inspect-tools':'inspectTools',
   '/auth/suno/voices':'listVoices',
   '/auth/suno/diagnose':'diagnose',
   '/auth/suno/create-song':'createSong'}[req.url];
  if(sunoAuthAction){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   let parts=[],size=0;
   try{
    for await(const chunk of req){
     size+=chunk.length;
     if(size>(sunoAuthAction==='createSong'?11000:256))
       return response(res,413,{error:'request_too_large'});
     parts.push(chunk);
    }
    const result=await getSunoOAuth()[sunoAuthAction]({
     headers:req.headers,body:Buffer.concat(parts).toString('utf8')});
    res.writeHead(result.status,result.headers);
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'suno_oauth_unavailable'})}
  }
  const isOAuth=req.url==='/auth/github/start'||req.url==='/auth/github/status';
  if(isOAuth){
   const origin=req.headers.origin;
   if(origin===APP_ORIGIN&&req.method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'authorization,content-type',
      'Access-Control-Max-Age':'600','Vary':'Origin'});res.end();return;
   }
   if(req.method!=='POST'){response(res,405,{error:'method_not_allowed'});return}
   try{
    const action=req.url.endsWith('/start')?oauth.start:oauth.status;
    const result=await action({headers:req.headers});
    if(action===oauth.status&&result.status===200&&
       result.body&&typeof oauth.getLinkedToken==='function'){
     // Chat readiness is an optional secondary signal. Its failure must not
     // hide a verified GitHub OAuth status behind a generic HTTP 503.
     try{
      const guard=createSupabaseGuard({
       baseUrl:'https://jrevhzvrgenucuozjowm.supabase.co',
       publicKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL'});
      const ready=await getChatCredential().chatStatus({
       headers:req.headers,authenticate:async h=>{
        const auth=String(h.authorization||'');
        const profile=await guard.authenticate(auth.slice(7));
        return profile.ownerId;
       }});
      if(ready)result.body={...result.body,chatConnected:true};
     }catch(_){/* OAuth status is already independently authenticated. */}
    }
    res.writeHead(result.status,result.headers);res.end(JSON.stringify(result.body));return;
   }catch(_){response(res,503,{error:'oauth_unavailable'});return}
  }
  // Explicit owner-selected correction from a saved human message.
  // Never triggered by AI messages; proposes memory, never approves it.
  if(req.url==='/director/memory/propose-correction'){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   try{
    const parts=[];let size=0;
    for await(const chunk of req){
     size+=chunk.length;
     if(size>1200)return response(res,413,{error:'request_too_large'});
     parts.push(chunk);
    }
    const result=await getLearningProposalApi().handle({
     headers:req.headers,body:Buffer.concat(parts).toString('utf8')});
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
     'Access-Control-Allow-Origin':APP_ORIGIN,'Cache-Control':'no-store',
     'X-Content-Type-Options':'nosniff','Vary':'Origin'});
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'learning_api_unavailable'})}
  }
  const proposalAction={
   '/listening/proposals/list':'list',
   '/listening/proposals/reject':'reject',
   '/listening/proposals/publish':'publish'
  }[req.url];
  if(proposalAction){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   try{
    let parts=[],size=0;
    for await(const chunk of req){
     size+=chunk.length;
     if(size>1600)return response(res,413,{error:'request_too_large'});
     parts.push(chunk);
    }
    try{await oauth?.hydrate?.()}catch(_){}
    const result=await getProposalApi().handle({headers:req.headers,
     body:Buffer.concat(parts).toString('utf8'),action:proposalAction});
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
     'Access-Control-Allow-Origin':APP_ORIGIN,'Cache-Control':'no-store',
     'X-Content-Type-Options':'nosniff','Vary':'Origin'});
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'proposal_api_unavailable'})}
  }
  const pokemonAction={
   '/pokemon/proposals/list':'list',
   '/pokemon/proposals/reject':'reject',
   '/pokemon/proposals/publish':'publish'
  }[req.url];
  if(pokemonAction){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   try{
    const parts=[];let size=0;
    for await(const chunk of req){
     size+=chunk.length;
     if(size>2200)return response(res,413,{error:'request_too_large'});
     parts.push(chunk);
    }
    try{await oauth?.hydrate?.()}catch(_){}
    const result=await getPokemonProposalApi().handle({
     headers:req.headers,body:Buffer.concat(parts).toString('utf8'),
     action:pokemonAction});
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
     'Access-Control-Allow-Origin':APP_ORIGIN,'Cache-Control':'no-store',
     'X-Content-Type-Options':'nosniff','Vary':'Origin'});
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'pokemon_proposal_api_unavailable'})}
  }
  // Owner-only, read-only system health (no AI, no writes).
  if(req.url==='/health/system'){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   try{
    const result=await getSystemHealth().handle({headers:req.headers});
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
     'Access-Control-Allow-Origin':APP_ORIGIN,'Cache-Control':'no-store',
     'Vary':'Origin','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'health_unavailable'})}
  }
  const routineAction={
   '/routines/preview':'preview','/routines/create':'create',
   '/routines/list':'list','/routines/enable':'enable',
   '/routines/pause':'pause','/routines/update':'update'
  }[req.url];
  if(routineAction){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   try{
    const parts=[];let size=0;
    for await(const chunk of req){
     size+=chunk.length;
     if(size>1800)return response(res,413,{error:'request_too_large'});
     parts.push(chunk);
    }
    const result=await getRoutineOwnerApi().handle({headers:req.headers,
     body:Buffer.concat(parts).toString('utf8'),action:routineAction});
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
     'Access-Control-Allow-Origin':APP_ORIGIN,'Cache-Control':'no-store',
     'Vary':'Origin','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'routine_api_unavailable'})}
  }
  const missionAction={'/autonomous/missions/create':'create',
   '/autonomous/missions/list':'list',
   '/autonomous/missions/status':'status',
   '/autonomous/missions/simulate':'simulate',
   '/autonomous/missions/pilot':'pilot'}[req.url];
  if(missionAction){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   try{
    const chunks=[];let total=0;
    for await(const chunk of req){
     total+=chunk.length;
     if(total>5500)return response(res,413,{error:'request_too_large'});
     chunks.push(chunk);
    }
    const result=await getAutonomousMissionApi().handle({
     headers:req.headers,body:Buffer.concat(chunks).toString('utf8'),action:missionAction});
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
     'Access-Control-Allow-Origin':APP_ORIGIN,'Cache-Control':'no-store',
     'Vary':'Origin','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'autonomous_missions_unavailable'})}
  }
  // Privately preview/cancel a Crow production brief. No Suno OAuth or
  // provider execution routes exist here; the backend spends zero credits.
  const crowAction={
   '/suno/crow/propose':'propose',
   '/suno/crow/cancel':'cancel',
   '/suno/crow/connection-status':'connection-status'
  }[req.url];
  if(crowAction){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Access-Control-Max-Age':'600','Vary':'Origin'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   let parts=[],size=0;
   try{
    for await(const chunk of req){
     size+=chunk.length;
     if(size>11000)return response(res,413,{error:'request_too_large'});
     parts.push(chunk);
    }
    const payload=Buffer.concat(parts).toString('utf8');
    const result=crowAction==='connection-status'?
      await getSunoStatus().handle({headers:req.headers,body:payload}):
      await getCrowSunoPreview().handle({headers:req.headers,body:payload,action:crowAction});
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
     'Access-Control-Allow-Origin':APP_ORIGIN,'Cache-Control':'no-store',
     'X-Content-Type-Options':'nosniff','Vary':'Origin'});
    res.end(JSON.stringify(result.body));return;
   }catch(_){return response(res,503,{error:'crow_suno_preview_unavailable'})}
  }
  const isMattRequest=req.url==='/chat/director'||req.url==='/chat/matt'||req.url==='/diagnostic/matt-session'||
   req.url==='/delegate/matt'||req.url==='/delegate/matt/worker'||
   req.url==='/delegate/matt/pokemon/worker'||
   req.url==='/delegate/matt/source-facts'||
   req.url==='/history/matt/jobs'||req.url==='/history/matt/team';
  if(isMattRequest){
   if(req.method==='OPTIONS'&&req.headers.origin===APP_ORIGIN){
    res.writeHead(204,{'Access-Control-Allow-Origin':APP_ORIGIN,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'authorization,content-type',
     'Vary':'Origin','Access-Control-Max-Age':'600'});res.end();return;
   }
   if(req.method!=='POST')return response(res,405,{error:'method_not_allowed'});
   if(req.headers.origin!==APP_ORIGIN)return response(res,403,{error:'origin_denied'});
   let parts=[],total=0;
   try{
    for await(const chunk of req){
     total+=chunk.length;
     if(total>(req.url==='/delegate/matt'?26000:4000)){res.writeHead(413,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'request_too_large'}));return}
     parts.push(chunk);
    }
    // Restore the owner's saved GitHub link after a restart (throttled, never throws).
    try{await oauth?.hydrate?.()}catch(_){}
    const gateway=req.url==='/chat/director'?getDirectorChat():
      req.url==='/history/matt/jobs'?getHistory():
      req.url==='/history/matt/team'?getTeamLedger():
      req.url==='/delegate/matt/worker'?getWorker():
      req.url==='/delegate/matt/pokemon/worker'?getPokemonWorker():
      req.url==='/delegate/matt/source-facts'?getSourceFactWorker():
      req.url==='/delegate/matt'?getDelegation():getLive();
    const action=req.url==='/diagnostic/matt-session'?gateway.diagnose:gateway.handle;
    if(typeof action!=='function')return response(res,503,{error:'diagnostic_not_configured'});
    // NDJSON streams verified routing stages in the SAME consented AI call.
    // Legacy JSON requests retain their original response and status codes.
    const wantsStages=req.url==='/delegate/matt'&&
     typeof req.headers.accept==='string'&&
     req.headers.accept.includes('application/x-ndjson');
    let streaming=false;
    const headers={'Content-Type':'application/x-ndjson; charset=utf-8',
     'Cache-Control':'no-store','Access-Control-Allow-Origin':APP_ORIGIN,
     'Vary':'Origin','X-Content-Type-Options':'nosniff'};
    const onProgress=event=>{
     const team=['listening-director','studio-director','pokemon-director'];
     if(!wantsStages||!event||
      !['routed','director_reported','consulted'].includes(event.stage)||
      !team.includes(event.directorId)||
      (event.stage==='consulted'&&(!team.includes(event.consultedId)||event.consultedId===event.directorId)))return;
     if(!streaming){res.writeHead(200,headers);streaming=true}
     res.write(JSON.stringify({type:'progress',stage:event.stage,
      directorId:event.directorId,
      ...(event.stage==='consulted'?{consultedId:event.consultedId}:{})})+'\n');
    };
    const result=await action({headers:req.headers,
      body:Buffer.concat(parts).toString('utf8'),onProgress});
    if(streaming){
     res.end(JSON.stringify({type:'result',status:result.status,body:result.body})+'\n');
    }else{
     res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store','Access-Control-Allow-Origin':APP_ORIGIN,
      'Vary':'Origin','X-Content-Type-Options':'nosniff'});
     res.end(JSON.stringify(result.body));
    }
    return;
   }catch(_){return response(res,503,{error:'chat_unavailable'})}
  }
  return response(res,404,{error:'not_found'});
 });
 server.requestTimeout=10000;
 server.headersTimeout=5000;
 server.maxRequestsPerSocket=20;
 function listen({port=process.env.PORT===undefined?8787:Number(process.env.PORT),host='0.0.0.0'}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
  return new Promise((resolve,reject)=>{
   server.once('error',reject);
   server.listen(port,host,()=>{server.removeListener('error',reject);resolve(server.address())});
  });
 }
 return Object.freeze({server,listen,close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))});
}
if(require.main===module){
 createRenderMattServer().listen().then(()=>process.stdout.write('PAPERWORLD Matt server ready (AI guarded; no model call during startup)\n'))
  .catch(()=>{process.stderr.write('PAPERWORLD hosting check failed\n');process.exitCode=1});
}
module.exports=Object.freeze({createRenderMattServer});
