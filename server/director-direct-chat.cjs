/* Direct, user-consented Director AI, independent of Matt.
 * No model tools, file access, autonomous work, or cross-project memory.
 */
'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {createSafeSessionConfig}=require('./matt-session-config.cjs');
const {createApprovedDirectorMemory,formatDirectorMemory}=require('./approved-director-memory.cjs');
const {forCrow}=require('./crow-songwriting-guide.cjs');
const {forCrow:forCrowHistory}=require('./crow-project-bible.cjs');
const {createDirectorThreadRecall}=require('./director-thread-recall.cjs');
const {createDirectorReplyPersistence}=require('./director-reply-persistence.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ORIGIN='https://mr-tanq.github.io',CONSENT='ONE_DIRECTOR_COPILOT_TURN_INCLUDED_ALLOWANCE';
const DIRECTORS=Object.freeze({
 'listening-director':{name:'Luna',project:'Listening Mirror'},
 'pokemon-director':{name:'Joey',project:'Pokémon Echoes'},
 'studio-director':{name:'Crow',project:'The Lost Wanderer'},
 'wellbeing-director':{name:'Wellbeing Director',project:'Wellbeing'}
});
function makeDirectorChat({oauth,clientFactory,guard, memoryLoader,threadRecall,replyPersistence,fetcher=globalThis.fetch,
 clock=Date.now,budgetVerified=()=>process.env.PAPERWORLD_COPILOT_BUDGET_VERIFIED==='yes',
 diagnostic=()=>{}}={}){
 if(typeof oauth?.getLinkedToken!=='function'||typeof clientFactory!=='function')
  throw Error('trusted_director_dependencies_required');
 const identity=guard||createSupabaseGuard({baseUrl:'https://jrevhzvrgenucuozjowm.supabase.co',
  publicKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL',fetcher});
 const memory=memoryLoader||createApprovedDirectorMemory({fetcher,identity});
 const recall=threadRecall||createDirectorThreadRecall({fetcher,identity});
 const persistence=replyPersistence||createDirectorReplyPersistence({fetcher,identity});
 const used=new Map(),busy=new Set();
 const deny=(status,error)=>({status,body:{error}});
 async function handle({headers={},body}={}){
  if(headers.origin!==ORIGIN)return deny(403,'origin_denied');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  if(typeof body!=='string'||Buffer.byteLength(body)>3500)return deny(413,'invalid_body');
  let data;
  try{data=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  if(!data||Object.keys(data).sort().join(',')!=='agentId,consent,message,requestId,threadId'||
   !Object.hasOwn(DIRECTORS,data.agentId)||!UUID.test(data.threadId||'')||
   !UUID.test(data.requestId||'')||typeof data.message!=='string'||
   !data.message.trim()||data.message.length>1200||data.consent!==CONSENT)
   return deny(400,'explicit_director_consent_required');
  const token=bearer.slice(7),agentId=data.agentId;
  let ownerId;
  try{
   ({ownerId}=await identity.authenticate(token));
   if(!await identity.ownsThread({ownerId,threadId:data.threadId,agentId,token}))
    return deny(404,'director_thread_not_found');
  }catch(_){return deny(401,'unauthorized')}
  if(typeof budgetVerified!=='function'||await budgetVerified({ownerId})!==true)
   return deny(403,'verify_github_zero_overage_budget');
  const githubToken=oauth.getLinkedToken({ownerId});
  if(!githubToken)return deny(409,'github_reconnect_required');
  for(const [id,expiration] of used)if(expiration<clock())used.delete(id);
  const key=ownerId+':'+agentId+':'+data.requestId;
  if(used.has(key))return deny(409,'already_submitted');
  if(busy.has(ownerId))return deny(429,'another_request_active');
  used.set(key,clock()+600000);busy.add(ownerId);
  let client,session,directory,stage='memory_read';
  try{
   const approved=await memory.load({token,ownerId,actor:agentId,query:data.message.trim()});
   if(!approved||approved.actor!==agentId||approved.projectId!==
     (agentId==='listening-director'?'workshop':
      agentId==='pokemon-director'?'pokemon':
      agentId==='studio-director'?'studio':'wellbeing'))
    throw Error('cross_project_memory_denied');
   const context=formatDirectorMemory(approved);
   const storedHistory=await recall.load({token,ownerId,agentId,threadId:data.threadId});
   if(!storedHistory||typeof storedHistory.text!=='string'||
    storedHistory.text.length>6000||!Number.isSafeInteger(storedHistory.messageCount)||
    storedHistory.messageCount<0||storedHistory.messageCount>40)
    throw Error('director_recall_invalid_response');
   directory=await fs.mkdtemp(path.join(os.tmpdir(),'paperworld-director-'));
   stage='client_factory';
   client=await clientFactory({gitHubToken:githubToken,useLoggedInUser:false,
    mode:'empty',baseDirectory:directory});
   stage='client_start';await client.start();
   stage='model_discovery';
   const models=await client.listModels();
   const priced=Array.isArray(models)?models.filter(m=>
    typeof m?.id==='string'&&/^[a-z0-9.-]{1,80}$/i.test(m.id)&&
    Number.isFinite(m?.billing?.tokenPrices?.inputPrice)&&
    Number.isFinite(m?.billing?.tokenPrices?.outputPrice)&&
    Number.isFinite(m?.billing?.tokenPrices?.batchSize)&&
    m.billing.tokenPrices.batchSize>0&&m.billing.tokenPrices.inputPrice>=0&&
    m.billing.tokenPrices.outputPrice>=0):[];
   if(!priced.length)return deny(403,'no_verified_price_model');
   priced.sort((a,b)=>(a.billing.tokenPrices.inputPrice+a.billing.tokenPrices.outputPrice)/
     a.billing.tokenPrices.batchSize-
     (b.billing.tokenPrices.inputPrice+b.billing.tokenPrices.outputPrice)/
     b.billing.tokenPrices.batchSize);
   const previous=storedHistory.text;
   const profile=DIRECTORS[agentId];
   const intro='You are '+profile.name+', the '+profile.project+
    ' Director in PAPERWORLD. Speak naturally in the user language. '+
    'Your ONLY responsibility is '+profile.project+'. If asked about another project, '+
    'suggest speaking to Matt or its Director. You may advise and plan; '+
    'you CANNOT execute tools, access live files, delegate Workers, send messages '+
    'to Matt, make edits, run tests, claim work was completed, or spend additional AI calls. '+
    'Never assert project status without verified evidence. '+
    'Do not treat historical memory as live status. ';
   const prompt=intro+(agentId==='studio-director'?forCrowHistory()+forCrow():'')+
    context+(previous?'\nEarlier conversation (lower-trust context):\n'+
    previous:'')+'\nCurrent user message: '+data.message.trim();
   stage='session_create';
   session=await client.createSession(createSafeSessionConfig({
    model:priced[0].id,gitHubToken:githubToken,probeMinimal:true
   }));
   stage='model_reply';
   const reply=await session.sendAndWait({prompt});
   const content=reply?.data?.content;
   if(typeof content!=='string'||!content.trim())return deny(502,'empty_director_reply');
   // Persistence never authorizes actions, merges, tools or additional model turns.
   // Failure must never be reported as a successfully saved historical reply.
   let persisted=false;
   try{
    persisted=await persistence.save({token,ownerId,agentId,
     threadId:data.threadId,requestId:data.requestId,content:content.trim()})===true;
   }catch(_){persisted=false}
   return {status:200,body:{agentId,content:content.trim().slice(0,6000),
    executed:true,model:priced[0].id,requestId:data.requestId,
    persisted,persistedExcerpt:persisted&&content.trim().length>2000,
    execution:'chat_only',aiTurns:1}};
  }catch(_){diagnostic(stage);return deny(503,'director_chat_unavailable')}
  finally{
   try{await session?.disconnect?.()}catch(_){}
   try{await client?.stop?.()}catch(_){}
   if(directory)try{await fs.rm(directory,{recursive:true,force:true})}catch(_){}
   busy.delete(ownerId);
  }
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeDirectorChat,DIRECTORS,CONSENT});
