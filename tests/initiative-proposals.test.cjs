'use strict';
// Initiatives phase B: once a week each Director stores ONE idea from approved
// memory; Matt tells the owner; nothing starts until the owner says "Ναι".
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeInitiativeProposals,parseIdea}=require('../server/initiative-proposals.cjs');
const owner='11111111-1111-4111-8111-111111111111',token='33333333-3333-4333-8333-333333333333';
test('ideas are parsed strictly and bounded',()=>{
 assert.deepEqual(parseIdea('Ορίστε: {"title":"Νέα σελίδα φεστιβάλ","why":"Θα τα βρίσκεις πιο γρήγορα.","task":"Φτιάξε λίστα φεστιβάλ ανά μήνα."}'),
  {title:'Νέα σελίδα φεστιβάλ',why:'Θα τα βρίσκεις πιο γρήγορα.',task:'Φτιάξε λίστα φεστιβάλ ανά μήνα.'});
 assert.equal(parseIdea('no json'),null);assert.equal(parseIdea('{"title":"x"}'),null);
 assert.ok(parseIdea(JSON.stringify({title:'t'.repeat(300),why:'w',task:'k'})).title.length<=80);
});
function fake({claimed=true,open=[],memory=[{title:'Μάθημα',body:'κάτι'}]}={}){
 const posts=[],calls=[];
 const fetcher=async(url,o={})=>{const m=o.method||'GET';calls.push([m,url]);
  const json=b=>({ok:true,status:200,json:async()=>b});
  if(url.includes('paperworld_initiative_runs_v1'))return json(claimed?[{token}]:[]);
  if(url.includes('paperworld_agent_threads'))return json([{id:'44444444-4444-4444-8444-444444444444'}]);
  if(url.includes('paperworld_proposals_v1')&&m==='GET')return json(url.includes('listening')?open:[]);
  if(url.includes('paperworld_director_memory'))return json(url.includes('studio')?[]:memory);
  if(m==='POST'){posts.push([url,JSON.parse(o.body)]);return json([{id:'p1'}])}
  return json([]);
 };
 const prompts=[];
 const clientFactory=async()=>({start:async()=>{},stop:async()=>{},
  listModels:async()=>[{id:'m',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1000}}}],
  createSession:async()=>({sendAndWait:async({prompt})=>{prompts.push(prompt);
   return {data:{content:'{"title":"Ιδέα","why":"Γιατί αξίζει.","task":"Κάνε αυτό."}'}}},disconnect:async()=>{}})});
 const api=makeInitiativeProposals({fetcher,clientFactory,secret:'x'.repeat(40),ownerId:owner,tokenFor:()=>'gho_TESTTOKEN123'});
 return {api,posts,calls,prompts};
}
test('one idea per Director with memory; open ideas are not repeated; Matt announces each',async()=>{
 const f=fake({open:[{id:'old'}]});
 const r=await f.api.run({token});
 assert.equal(r.status,200);
 const states=Object.fromEntries(r.body.results.map(x=>[x.director,x.state]));
 assert.deepEqual(states,{'listening-director':'waiting_for_owner','pokemon-director':'proposed','studio-director':'no_memory'});
 assert.equal(f.prompts.length,1,'one AI turn for the one Director who needed it');
 assert.match(f.prompts[0],/OWNER-APPROVED NOTES/);
 const note=f.posts.find(([u])=>u.includes('paperworld_agent_messages'))[1];
 assert.match(note.content,/💡 Ο Joey προτείνει: «Ιδέα»/);
 assert.ok(f.calls.some(([,u])=>u.includes('sensitivity=eq.standard')),'private memory never used');
});
test('only the database\'s fresh single-use token can start a run',async()=>{
 const f=fake({claimed:false});
 assert.equal((await f.api.run({token})).status,401);
 assert.equal((await f.api.run({token:'nope'})).status,401);
 assert.equal(f.prompts.length,0);
});
test('app: ideas with Ναι/Όχι; "Ναι" hands the idea to the Director; SQL is owner-only',()=>{
 const ws=fs.readFileSync('js/workspace.js','utf8');
 assert.match(ws,/section\('💡 Προτάσεις της ομάδας','Τίποτα δεν ξεκινά χωρίς το «Ναι» σου\.'/);
 assert.match(ws,/cloud\(\)\.decideProposal\(p\.id,accept\)/);
 assert.match(fs.readFileSync('js/world-dialogue.js','utf8'),/const send=arguments\[1\]\?\.send===true;/);
 const sql=fs.readFileSync('sql/paperworld_proposals_v1.sql','utf8');
 assert.match(sql,/where id=p_id and owner_id=auth\.uid\(\) and status='proposed'/);
 assert.match(sql,/grant select on public\.paperworld_proposals_v1 to authenticated;/);
 assert.match(fs.readFileSync('server/render-matt.cjs','utf8'),/req\.url==='\/initiative\/propose'/);
});
