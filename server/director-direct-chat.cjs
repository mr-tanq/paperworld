/* Direct, user-consented Director AI, independent of Matt.
 * No model tools, file access, autonomous work, or cross-project memory.
 */
'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {createSafeSessionConfig}=require('./matt-session-config.cjs');
const {createApprovedDirectorMemory,formatDirectorMemory}=require('./approved-director-memory.cjs');
const {forJames}=require('./james-shop-guide.cjs');
const {forCrow,currentBriefPriority}=require('./crow-songwriting-guide.cjs');
const {forCrow:forCrowHistory}=require('./crow-project-bible.cjs');
const {createDirectorThreadRecall}=require('./director-thread-recall.cjs');
const {createDirectorReplyPersistence}=require('./director-reply-persistence.cjs');
const {buildReferenceDossier}=require('./crow-reference-dossier.cjs');
const {forDave}=require('./dave-coaching-guide.cjs');
const {makeMattTaskIntake}=require('./v5-matt-task-intake.cjs');
const {buildTaskPrompt}=require('./v5-task-planner.cjs');
// Luna and Joey can hand real code work to their Developer through the same
// Task Engine Matt uses (same caps, verification and merge rules).
const CODING=new Set(['listening-director','pokemon-director']);
const TASK_MARKER='START_DEVELOPER_TASK';
const directorActions=require('./director-actions.cjs');
// The Developer's brief is the OWNER's own words only: the last few things
// they said in this chat plus the current ask, never the Director's replies
// and never a message cut in half.
function ownerGoal(previous,ask){
 const now=String(ask||'').trim();
 if(now.length>=200)return now.slice(0,1200);
 const said=String(previous||'').split(/\n(?=(?:User|Prior agent): )/)
  .filter(c=>c.startsWith('User: ')).map(c=>c.slice(6).trim().replace(/\s+/g,' '))
  .filter(c=>c&&c!==now);
 const earlier=[];let room=1200-now.length-40;
 for(const line of said.slice(-4).reverse()){if(line.length>room)break;earlier.unshift(line);room-=line.length+3}
 return (earlier.length?'Νωρίτερα: '+earlier.join(' / ')+'\nΤώρα: ':'')+now;
}
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ORIGIN='https://mr-tanq.github.io',CONSENT='ONE_DIRECTOR_COPILOT_TURN_INCLUDED_ALLOWANCE';
const DIRECTORS=Object.freeze({
 'listening-director':{name:'Luna',project:'Listening Mirror'},
 'pokemon-director':{name:'Joey',project:'Pokémon Echoes'},
 'studio-director':{name:'Crow',project:'The Lost Wanderer'},
 'wellbeing-director':{name:'Wellbeing Director',project:'Wellbeing'},
 'shop-director':{name:'James',project:'Digital Shop'}
});
function makeDirectorChat({oauth,clientFactory,guard, memoryLoader,threadRecall,replyPersistence,fetcher=globalThis.fetch,
 taskIntake=null,mattThreadLookup=null,
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
 const intake=taskIntake||makeMattTaskIntake({fetcher});
 // Completion news is delivered by Matt, so the mission lives in the owner's Matt thread.
 const findMattThread=mattThreadLookup||(async ownerId=>{
  const secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY||'';
  if(!(secret.startsWith('sb_secret_')||secret.startsWith('eyJ'))||!UUID.test(ownerId||''))return null;
  const r=await fetcher('https://jrevhzvrgenucuozjowm.supabase.co/rest/v1/paperworld_agent_threads?select=id&agent_id=eq.matt&owner_id=eq.'+
   ownerId+'&order=created_at.desc&limit=1',{method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),Accept:'application/json'}});
  if(!r?.ok)return null;const rows=await r.json();
  return Array.isArray(rows)&&UUID.test(rows[0]?.id||'')?rows[0].id:null;
 });
 const deny=(status,error)=>({status,body:{error}});
 async function handle({headers={},body}={}){
  if(headers.origin!==ORIGIN)return deny(403,'origin_denied');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  if(typeof body!=='string'||Buffer.byteLength(body)>3500)return deny(413,'invalid_body');
  let data;
  try{data=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  if(!data||!['agentId,consent,message,requestId,threadId','agentId,consent,message,replyLanguage,requestId,threadId'].includes(Object.keys(data).sort().join(','))||
   !Object.hasOwn(DIRECTORS,data.agentId)||!UUID.test(data.threadId||'')||
   !UUID.test(data.requestId||'')||typeof data.message!=='string'||
   !data.message.trim()||data.message.length>1200||data.consent!==CONSENT||!['auto','el','en'].includes(data.replyLanguage??'auto'))
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
      agentId==='studio-director'?'studio':agentId==='shop-director'?'shop':'wellbeing'))
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
   let canDelegate=false;
   if(CODING.has(agentId)){try{canDelegate=await intake.available()===true}catch(_){canDelegate=false}}
   const intro='You are '+profile.name+', the '+profile.project+
    ' Director in PAPERWORLD. Support both Greek and English naturally. Reply in the language of the latest user message (including Greeklish if the user prefers it); if the user explicitly asks for a language, follow that preference even when the interface uses another language. When a short follow-up is ambiguous, preserve the established conversation language. If the user switches languages, switch without resetting context, project memory, or persona. Do not translate quoted lyrics, song titles, code, or stored user text unless asked. '+
    'Your ONLY responsibility is '+profile.project+'. If asked about another project, '+
    'suggest speaking to Matt or its Director. You may advise and plan; '+
    (canDelegate?
    'You CAN hand real code work to your Developer: when the owner asks you (now, or '+
    'clearly in this conversation) to have the developer check, investigate, fix or change '+
    'something in the app, say in one or two plain sentences that you are handing it to the '+
    'Developer, and end your reply with the exact line '+TASK_MARKER+'. Otherwise never write it. '+
    'You still cannot run tools or read files yourself, and you must not claim results. ':
    'you CANNOT execute tools, access live files, delegate Workers, send messages '+
    'to Matt, make edits, run tests, claim work was completed, or spend additional AI calls. ')+
    directorActions.prompt(agentId)+
    'Never assert project status without verified evidence. '+
    'Do not treat historical memory as live status. ';
   // Crow resolves references to the owner's own catalogue against curated
   // context + APPROVED memory only, separating known facts from inference.
   const dossier=agentId==='studio-director'?buildReferenceDossier(data.message,
    {memoryText:approved.text}).text:'';
   const prompt=intro+((data.replyLanguage==='en')?'Respond in English throughout this answer, regardless of input language. ':(data.replyLanguage==='el')?'Respond in Greek throughout this answer, regardless of input language. ':'')+(agentId==='studio-director'?forCrowHistory()+forCrow():'')+
    (agentId==='wellbeing-director'?forDave():'')+(agentId==='shop-director'?forJames():'')+
    context+dossier+(previous?'\nEarlier conversation (lower-trust context):\n'+
    previous:'')+'\nCurrent user message: '+data.message.trim()+
    (agentId==='studio-director'?currentBriefPriority():'');
   stage='session_create';
   session=await client.createSession(createSafeSessionConfig({
    model:priced[0].id,gitHubToken:githubToken,probeMinimal:true
   }));
   stage='model_reply';
   const reply=await session.sendAndWait({prompt});
   let content=reply?.data?.content;
   if(typeof content!=='string'||!content.trim())return deny(502,'empty_director_reply');
   // The Director decided to hand the work to the Developer: plan and queue it.
   let taskMission=null,aiTurns=1;
   if(canDelegate&&content.includes(TASK_MARKER)){
    content=content.split(TASK_MARKER).join('').trim();
    stage='task_handoff';
    try{
     const mattThread=await findMattThread(ownerId);
     if(!mattThread)throw Error('matt_thread_missing');
     const ask=data.message.trim();
     const goal=ownerGoal(previous,ask);
     const spec=await session.sendAndWait({prompt:buildTaskPrompt({message:goal,directorId:agentId,memory:context})});
     aiTurns=2;
     const task=await intake.submit({ownerId,threadId:mattThread,requestId:data.requestId,
      directorId:agentId,message:goal,modelOutput:spec?.data?.content});
     if(task.state!=='queued'&&task.state!=='planned')throw Error('task_not_queued');
     taskMission={id:task.missionId,title:task.title,status:task.state};
     content+='\n\n'+(task.state==='queued'?'Το ανέθεσα στον Developer: «'+task.title+'». '+
      'Θα το ψάξει, θα το διορθώσει και θα ελεγχθεί. Ο Matt θα σου πει τι βρήκαμε μόλις τελειώσει.':
      'Ετοίμασα την εργασία «'+task.title+'» για τον Developer· θα ξεκινήσει μόλις υπάρξει διαθέσιμο όριο.');
    }catch(_){
     content+='\n\nΔεν μπόρεσα να το αναθέσω στον Developer αυτή τη στιγμή. Πες το στον Matt και θα το αναλάβει.';
    }
   }
   // Crow/Dave tools: strict action lines become structured actions that the
   // owner's own app session executes (never run here, never shown as text).
   const tool=directorActions.extract(agentId,content);
   content=tool.content||content;const actions=tool.actions;
   // Persistence never authorizes actions, merges, tools or additional model turns.
   // Failure must never be reported as a successfully saved historical reply.
   let persisted=false;
   try{
    persisted=await persistence.save({token,ownerId,agentId,
     threadId:data.threadId,requestId:data.requestId,content:content.trim()})===true;
   }catch(_){persisted=false}
   return {status:200,body:{agentId,content:content.trim().slice(0,6000),
    executed:true,model:priced[0].id,requestId:data.requestId,
    persisted,persistedExcerpt:persisted&&content.trim().length>
     (agentId==='studio-director'?6000:2000),
    execution:taskMission?'task_queued':actions.length?'owner_actions':'chat_only',aiTurns,
    ...(taskMission?{taskMission}:{}),...(actions.length?{actions}:{}),
    ...(tool.actionError?{actionError:tool.actionError}:{})}};
  }catch(error){
   // Only the fixed stage name is reported (never prompts, tokens or provider text),
   // so a failure says WHERE it happened, in the app and in the Render log.
   diagnostic(stage);
   const code=String(error?.message||'');
   try{console.warn('[director-chat] failed at',stage,agentId,/^[a-z_]{3,60}$/.test(code)?code:(error?.name||'Error'))}catch(_){}
   return {status:503,body:{error:'director_chat_unavailable',stage}};
  }
  finally{
   try{await session?.disconnect?.()}catch(_){}
   try{await client?.stop?.()}catch(_){}
   if(directory)try{await fs.rm(directory,{recursive:true,force:true})}catch(_){}
   busy.delete(ownerId);
  }
 }
 return Object.freeze({handle});
}
module.exports=Object.freeze({makeDirectorChat,ownerGoal,DIRECTORS,CONSENT});
