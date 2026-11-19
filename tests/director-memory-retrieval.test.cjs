'use strict';
// Director memory retrieval: approved knowledge must reach Crow, misspelled
// references must resolve, and missing facts must be named — never invented.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {buildReferenceDossier,resolve}=require('../server/crow-reference-dossier.cjs');
const {projectContext,nearWord,memoryTerms}=require('../server/director-memory-policy.cjs');
const {formatDirectorMemory}=require('../server/approved-director-memory.cjs');
const {makeDirectorChat,CONSENT}=require('../server/director-direct-chat.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const thread='22222222-2222-4222-8222-222222222222';
const at='2026-11-12T10:00:00.000Z';
let n=0;
const entry=(title,body,extra={})=>({id:'00000000-0000-4000-8000-'+String(++n).padStart(12,'0'),
 projectId:'studio',kind:'decision',status:'approved',title,body,sourceType:'conversation',
 sourceRef:'chat-summary:test',observedAt:at,version:1,sensitivity:'standard',...extra});

test('Typo-tolerant matching links "smokey" to the approved "Smoky Dreams" note',()=>{
 assert.equal(nearWord('smokey','smoky'),true);
 assert.equal(nearWord('dreams','dream'),true);
 assert.equal(nearWord('tempo','albums'),false);
 const filler=Array.from({length:30},(_,i)=>entry('Unrelated preference '+i,'x'.repeat(220)));
 const target=entry('No Destination album V re-evaluation',
  'Album V was rejected except for Smoky Dreams.',{observedAt:'2026-09-01T10:00:00.000Z'});
 const ctx=projectContext([...filler,target],{actor:'studio-director',projectId:'studio',
  maxChars:2000,query:'Θέλω ένα τραγούδι που να θυμίζει το smokey dreams'});
 // The relevant (older) note outranks newer filler and survives the budget.
 assert.match(ctx.text,/^\[decision \| No Destination album V re-evaluation/);
 assert.deepEqual([...ctx.relevant],['No Destination album V re-evaluation']);
 assert.match(formatDirectorMemory(ctx),/Most relevant approved notes for this request: "No Destination album V re-evaluation"/);
 assert.match(formatDirectorMemory(ctx),/KNOWLEDGE USE: consult the approved memory above BEFORE asking/);
});
test('Proposed, rejected and other-project memories never reach the Director context',()=>{
 const ctx=projectContext([
  entry('Approved fact','A'),entry('Pending idea','Smoky Dreams was organic',{status:'proposed'}),
  entry('Rejected idea','B',{status:'rejected'})],
  {actor:'studio-director',projectId:'studio',query:'smoky dreams'});
 assert.equal(ctx.included,1);
 assert.doesNotMatch(ctx.text,/Pending idea|Rejected idea|organic/);
 assert.throws(()=>projectContext([entry('x','y',{projectId:'pokemon'})],
  {actor:'studio-director',projectId:'studio'}),/mixed_project_records_denied|memory_access_denied/);
});
test('Reference dossier separates known facts, labelled inference and named unknowns',()=>{
 const memoryText='[decision | No Destination album V re-evaluation | conversation: x | v1]\n'+
  'Album V concept was rejected except for Smoky Dreams.';
 const {text,references}=buildReferenceDossier('Θέλω ένα τραγούδι που να θυμίζει το smokey dreams',{memoryText});
 assert.deepEqual(references,[{type:'song',title:'Smoky Dreams',era:'album-v'}]);
 assert.match(text,/KNOWN: .*only Smoky Dreams was kept/);
 assert.match(text,/Approved memory notes mentioning it: No Destination album V re-evaluation/);
 assert.match(text,/NEIGHBOURING CONTEXT \(inference only, label it as such\)/);
 assert.match(text,/UNKNOWN \(no approved source\): exact tempo, instrumentation, vocal delivery, structure, original lyrics, audio/);
 assert.match(text,/Do NOT reply with a questionnaire/);
 assert.match(text,/name at most ONE specific uncertainty/);
 assert.match(text,/Never claim to know or quote the original song's lyrics, audio/);
 // Album II has an owner-described palette; no "inference" is needed there.
 const aftermath=buildReferenceDossier('ένα τραγούδι στο στυλ του Aftermath');
 assert.equal(aftermath.references[0].era,'album-ii');
 assert.match(aftermath.text,/trip-hop/);
});
test('Generic words do not falsely resolve to catalogue songs',()=>{
 for(const message of ['change the tempo please','the crow should sound darker',
  'Γράψε κάτι για την αλλαγή','write a love song'])
  assert.deepEqual(resolve(message).filter(h=>h.type==='song'),[],message);
 assert.equal(resolve('το τραγούδι «Change» ξανά')[0]?.title,'Change');
 assert.ok(memoryTerms('smokey dreams').includes('smokey'));
});
test('Crow direct chat sends approved memory + dossier, with the query used for ranking',async()=>{
 const seen={prompts:[],queries:[]};
 const api=makeDirectorChat({
  oauth:{getLinkedToken:()=>'gho_TEST123456789'},
  guard:{authenticate:async()=>({ownerId:owner}),ownsThread:async()=>true},
  memoryLoader:{load:async a=>{seen.queries.push(a.query);return {actor:'studio-director',projectId:'studio',
   text:'[decision | No Destination album V re-evaluation | conversation: x | v1]\nAlbum V rejected except Smoky Dreams.',
   included:1,relevant:['No Destination album V re-evaluation'],capabilitiesGranted:[],untrustedContent:true}}},
  threadRecall:{load:async()=>({text:'',messageCount:0})},
  replyPersistence:{save:async()=>false},budgetVerified:()=>true,
  clientFactory:async()=>({start:async()=>{},stop:async()=>{},
   listModels:async()=>[{id:'m',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1}}}],
   createSession:async()=>({sendAndWait:async({prompt})=>{seen.prompts.push(prompt);
    return {data:{content:'proposal'}}},disconnect:async()=>{}})})
 });
 const r=await api.handle({headers:{origin:'https://mr-tanq.github.io',authorization:'Bearer aaa.bbb.fake12345678'},
  body:JSON.stringify({agentId:'studio-director',threadId:thread,requestId:'33333333-3333-4333-8333-333333333333',
   message:'Θέλω ένα τραγούδι που να θυμίζει το smokey dreams',consent:CONSENT})});
 assert.equal(r.status,200);
 assert.deepEqual(seen.queries,['Θέλω ένα τραγούδι που να θυμίζει το smokey dreams']);
 const prompt=seen.prompts[0];
 assert.match(prompt,/Most relevant approved notes for this request/);
 assert.match(prompt,/OWNER CATALOGUE REFERENCE DOSSIER/);
 assert.match(prompt,/SONG "Smoky Dreams"/);
 // Memory and dossier come before the user's message, not after it.
 assert.ok(prompt.indexOf('REFERENCE DOSSIER')<prompt.indexOf('Current user message'));
});
test('Matt → Crow delegation ranks memory by the request and includes the dossier',()=>{
 const src=fs.readFileSync('server/matt-delegation.cjs','utf8');
 assert.match(src,/approvedMemory\.load\(\{\s*token:bearer\.slice\(7\),ownerId,actor:route,query:data\.message\.trim\(\)/);
 assert.match(src,/route==='studio-director'\?buildReferenceDossier\(data\.message,\s*\{memoryText:memory\.text\}\)\.text/);
 const guide=fs.readFileSync('server/crow-songwriting-guide.cjs','utf8');
 assert.match(guide,/does NOT apply to the owner\\'s own Lost Wanderer catalogue/);
});
