'use strict';
// James: the shop Director. His own project (research → digital products →
// sales); the owner approves once a week; spending ≤ 50 € and starts at 0.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeInitiativeProposals,jamesPrompt,parseIdeas}=require('../server/initiative-proposals.cjs');
const owner='11111111-1111-4111-8111-111111111111',token='33333333-3333-4333-8333-333333333333';
function fake({james=[],reply='[{"title":"Εκτυπώσιμο εβδομαδιαίο planner","why":"Ζητείται πολύ, 3-5€.","task":"PDF A4/A5, πώληση στο μαγαζί."},{"title":"Budget template για Google Sheets","why":"Σταθερή ζήτηση, 5€.","task":"Template με οδηγίες."}]'}={}){
 const posts=[],prompts=[];
 const fetcher=async(url,o={})=>{const m=o.method||'GET';
  const json=b=>({ok:true,status:200,json:async()=>b,text:async()=>JSON.stringify(b)});
  if(url.includes('paperworld_initiative_runs_v1'))return json([{token}]);
  if(url.includes('controller_v5'))return json([{initiatives_paused:false}]);
  if(url.includes('paperworld_agent_threads'))return json([{id:'44444444-4444-4444-8444-444444444444'}]);
  if(url.includes('director_id=eq.shop-director'))return json(james);
  if(url.includes('paperworld_proposals_v1')&&m==='GET')return json(url.includes('status=eq.proposed')?[{id:'open'}]:[]);
  if(m==='POST'){posts.push([url,JSON.parse(o.body)]);return {ok:true,status:201,text:async()=>'',json:async()=>null}}
  return json([]);};
 const clientFactory=async()=>({start:async()=>{},stop:async()=>{},
  listModels:async()=>[{id:'m',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1000}}}],
  createSession:async()=>({sendAndWait:async({prompt})=>{prompts.push(prompt);return {data:{content:reply}}},disconnect:async()=>{}})});
 const make=day=>makeInitiativeProposals({fetcher,clientFactory,secret:'x'.repeat(40),ownerId:owner,tokenFor:()=>'gho_TESTTOKEN123',clock:()=>Date.parse(day)});
 return {make,posts,prompts};
}
test('first day: James researches and proposes up to two ideas; Matt tells the owner',async()=>{
 const f=fake();const r=await f.make('2026-11-25T08:23:00Z').run({token});
 assert.equal(r.body.results.find(x=>x.director==='shop-director').state,'proposed');
 const rows=f.posts.filter(([u])=>u.includes('paperworld_proposals_v1')).map(([,b])=>b);
 assert.equal(rows.length,2);assert.ok(rows.every(b=>b.director_id==='shop-director'&&b.owner_id===owner));
 const note=JSON.parse(f.posts.find(([u,b])=>u.includes('agent_messages')&&b.content.includes('shop-director'))[1].content.slice(20));
 assert.match(note.text,/^🛍️ Ο James έκανε την έρευνα της εβδομάδας[\s\S]*Πες Ναι ή Όχι/);
 assert.match(f.prompts.find(p=>p.includes('Digital Shop Director')),/never invent statistics/);
});
test('weekly: only on Mondays after the first time; never more than two open ideas',async()=>{
 const wed=fake({james:[{title:'Παλιά',status:'declined'}]});
 assert.equal((await wed.make('2026-11-25T08:23:00Z').run({token})).body.results.find(x=>x.director==='shop-director'),undefined);
 const mon=fake({james:[{title:'Παλιά',status:'declined'},{title:'Ανοιχτή',status:'proposed'}]});
 await mon.make('2026-11-30T08:23:00Z').run({token});
 assert.equal(mon.posts.filter(([u])=>u.includes('paperworld_proposals_v1')).length,1,'one slot left');
 assert.match(mon.prompts.find(p=>p.includes('Digital Shop'))||'',/Παλιά \(declined\)/);
 const full=fake({james:[{title:'a',status:'proposed'},{title:'b',status:'proposed'}]});
 assert.equal((await full.make('2026-11-30T08:23:00Z').run({token})).body.results.find(x=>x.director==='shop-director').state,'waiting_for_owner');
 assert.equal(parseIdeas('nope').length,0);assert.equal(parseIdeas('[{"title":"x"}]').length,0);
});
test('hard rules are always in his prompt; spending cap 50 €',()=>{
 const p=jamesPrompt();
 assert.match(p,/never spend money without the owner's weekly "Ναι"; total spending can never exceed 50 EUR and starts at 0 EUR/);
 assert.match(p,/no copyrighted material, no brand imitation, no fake reviews, no spam/);
});
test('James is a resident everywhere the other Directors are',()=>{
 assert.equal(require('../js/agent-profiles.js').get('shop-director').name,'James');
 assert.equal(require('../js/agents.js').AGENTS['shop-director'].project,'shop');
 const chat=fs.readFileSync('server/director-direct-chat.cjs','utf8');
 assert.match(chat,/'shop-director':\{name:'James',project:'Digital Shop'\}/);assert.match(chat,/agentId==='shop-director'\?forJames\(\):''/);
 for(const f of ['server/supabase-identity-guard.cjs','server/director-reply-persistence.cjs','server/director-thread-recall.cjs',
  'js/cloud.js','js/agent-conversation-store.js','js/world-dialogue.js','js/village-board.js','js/team-panel.js','js/workspace.js'])
  assert.ok(fs.readFileSync(f,'utf8').includes('shop-director'),f);
 const sql=fs.readFileSync('sql/paperworld_james_v1.sql','utf8');
 for(const c of ['agent_threads','director_memory','paperworld_tasks','proposals_v1','missions_v5','steps_v5'])assert.ok(sql.includes(c),c);
});
