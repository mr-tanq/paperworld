/* PAPERWORLD V5 — real, zero-model, owner-approved source fact gathering.
 * Only fixed GitHub paths from registered project readers. No AI calls or
 * model-selected URLs; no writes, branches, PRs, shell, scheduled work.
 */
'use strict';
const {createSupabaseGuard}=require('./supabase-identity-guard.cjs');
const {createRepoReader}=require('./listening-repo-reader.cjs');
const {createPokemonRepoReader}=require('./pokemon-repo-reader.cjs');
const {makeWorkerRunJournal}=require('./worker-run-journal-v5.cjs');
const {makeTeamHandoffLedger}=require('./team-handoff-ledger-v5.cjs');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ORIGIN='https://mr-tanq.github.io';
const CONSENT='V5_ONE_READ_ONLY_SOURCE_CHECK_NO_AI';
const ROUTES=Object.freeze({
 listening:Object.freeze({director:'listening-director',worker:'listening-developer'}),
 pokemon:Object.freeze({director:'pokemon-director',worker:'pokemon-developer'})
});
function listeningCategory(text){
 if(/(?:poster|festival|artwork|image|photo|εικόν|φωτογραφ|αφίσ)/i.test(text))return 'artwork';
 if(/(?:ticket|ticketswap|εισιτήρ)/i.test(text))return 'ticketing';
 return 'general';
}
function makeSourceFactWorker({oauth,guard=null,fetcher=globalThis.fetch,
 listing=createRepoReader({fetcher}),pokemon=createPokemonRepoReader({fetcher}),
 journal=makeWorkerRunJournal({fetcher}),
 handoffs=makeTeamHandoffLedger({fetcher}),
 diagnostic=()=>{}}={}){
 if(typeof oauth?.getLinkedToken!=='function'||!journal?.claim||
  !journal?.finish||!listing?.read||!pokemon?.readProjectConfig||
  !handoffs?.verifyWorkerRequest)throw Error('source_fact_dependencies_required');
 const identity=guard||createSupabaseGuard({baseUrl:
  'https://jrevhzvrgenucuozjowm.supabase.co',
  publicKey:'sb_publishable_I6J83nHsrxP_URkHATH7zw_t0UEcySL',fetcher});
 async function handle({headers={},body}={}){
  const deny=(status,error)=>({status,body:{error}});
  if(headers.origin!==ORIGIN)return deny(403,'origin_denied');
  const bearer=headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9_.-]{12,4096}$/.test(bearer))return deny(401,'unauthorized');
  if(typeof body!=='string'||Buffer.byteLength(body)>2500)return deny(400,'invalid_request');
  let input;try{input=JSON.parse(body)}catch(_){return deny(400,'invalid_json')}
  const route=ROUTES[input?.project];
  if(!route||![input.threadId,input.requestId].every(x=>UUID.test(x||''))||
   input.consent!==CONSENT||typeof input.message!=='string'||
   !input.message.trim()||input.message.length>1200)
   return deny(400,'explicit_source_read_consent_required');
  let ownerId;
  try{
   const token=bearer.slice(7);
   ({ownerId}=await identity.authenticate(token));
   if(!await identity.ownsThread({ownerId,threadId:input.threadId,
    agentId:'matt',token}))return deny(404,'thread_not_found');
  }catch(_){return deny(401,'unauthorized')}
  if(journal.configured!==true||handoffs.configured!==true)
   return deny(503,'durable_execution_store_required');
  const githubToken=oauth.getLinkedToken({ownerId});
  if(!githubToken)return deny(409,'github_reconnect_required');
  try{
   const existing=await handoffs.verifyWorkerRequest({ownerId,threadId:input.threadId,
    requestId:input.requestId,project:input.project,workerId:route.worker,
    message:input.message});
   if(existing?.matched!==true)throw Error('saved_handoff_required');
  }catch(_){return deny(409,'source_handoff_unverified')}
  // The unique DB receipt prevents an owner's repeated press, cross-instance
  // duplicate and rerun after a Render crash from consuming another GitHub read.
  try{
   await journal.claim({ownerId,threadId:input.threadId,
    requestId:input.requestId,project:input.project,summary:input.message});
  }catch(_){return deny(409,'source_request_already_started_or_unavailable')}
  let done=false;
  try{
   let source;
   if(input.project==='listening'){
    const category=listeningCategory(input.message);
    source=await listing.read(category,{token:githubToken});
    if(source.repository!=='mr-tanq/concerts'||source.ref!=='main'||
     source.readOnly!==true||!Array.isArray(source.files)||
     source.files.length<1||source.files.length>3||
     source.files.some(f=>!listing.FILES[category].includes(f.path)||
      !/^[a-f0-9]{40}$/i.test(f.sha||'')))
     throw Error('unverified_listening_source');
   }else{
    const expanded=typeof pokemon.readProjectFiles==='function';
    // Server chooses one bounded source category from the approved task;
    // no arbitrary file path, repository or branch can enter via the browser.
    const category=/battle|catch|combat|μάχ|σύλληψ/i.test(input.message)?'battle':
     /dialog|npc|διάλογ|συνομιλ/i.test(input.message)?'dialogue':
     /map|route|alder|lab|collision|χάρτ|διαδρομ/i.test(input.message)?'map':'core';
    const packet=expanded?
     await pokemon.readProjectFiles({token:githubToken,category}):
     await pokemon.readProjectConfig({token:githubToken});
    if(packet.repository!=='mr-tanq/pokemon-echoes'||packet.ref!=='main'||
     packet.readOnly!==true||(expanded&&packet.sourceUntrusted!==true))
     throw Error('unverified_pokemon_source');
    const files=expanded?packet.files:[{path:packet.path,sha:packet.sha}];
    if(!Array.isArray(files)||files.length<1||files.length>4||
     files.some(f=>! /^[a-f0-9]{40}$/i.test(f.sha||'')||
      (expanded?!pokemon.GROUPS?.[category]?.includes(f.path):
       f.path!=='project.godot')))
     throw Error('unverified_pokemon_source');
    source={repository:packet.repository,ref:packet.ref,readOnly:true,
     files:files.map(f=>({path:f.path,sha:f.sha}))};
   }
   const files=source.files.map(x=>({path:x.path,sha:x.sha}));
   await journal.finish({ownerId,requestId:input.requestId,status:'reported',
    summary:'Verified source read of '+files.length+' fixed repository file(s); zero AI calls'});
   done=true;
   return {status:200,body:{executed:true,delegated:true,project:input.project,
    workerId:route.worker,requestId:input.requestId,
    execution:'read_only_source_facts',aiTurns:0,modelCalls:0,
    changedFiles:0,createdPR:false,deployed:false,
    evidence:{repository:source.repository,ref:source.ref,files},
    content:'Έλεγξα '+files.length+' πραγματικά αρχεία του '+
     source.repository+' μέσω GitHub. Δεν έγινε χρήση AI, αλλαγή κώδικα, PR ή deployment.'}};
  }catch(_){
   diagnostic('source_facts_unavailable');
   return deny(503,'source_facts_unavailable');
  }finally{
   if(!done)try{
    await journal.finish({ownerId,requestId:input.requestId,status:'failed',
     summary:'Fixed-source read interrupted; requires new owner-approved request'});
   }catch(_){diagnostic('source_facts_journal_finish_unavailable')}
  }
 }
 return Object.freeze({handle,CONSENT});
}
module.exports=Object.freeze({makeSourceFactWorker,CONSENT,listeningCategory});
