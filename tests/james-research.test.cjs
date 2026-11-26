'use strict';
// James researches EVERY day from real public signals and keeps a journal;
// strong findings (4-5/5) become proposals at once; products are Etsy-ready.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../server/james-research.cjs');
test('signals: rotating Google suggestions and community top posts; failures are skipped',async()=>{
 const urls=[];
 const fetcher=async url=>{urls.push(url);const json=b=>({ok:true,status:200,json:async()=>b});
  if(url.startsWith('https://suggestqueries.google.com/'))return json(['seed',['budget planner for students','budget planner for couples']]);
  if(url.includes('reddit.com/r/Etsy/'))return {ok:false,status:429};
  if(url.startsWith('https://www.reddit.com/'))return json({data:{children:[{data:{title:'I finally track my spending monthly',score:120}},{data:{title:'NSFW stuff',score:5}}]}});
  return json({})};
 const s=await R.gatherSignals({fetcher,clock:()=>Date.parse('2026-11-26T08:23:00Z')});
 assert.ok(s.searches.length>=1&&s.searches.every(x=>x.suggestions.length));
 assert.ok(s.talk.every(t=>t.posts.every(p=>!/nsfw/i.test(p.title))));
 assert.equal(urls.filter(u=>u.includes('suggestqueries')).length,4);assert.equal(urls.filter(u=>u.includes('reddit')).length,4);
 const other=await R.gatherSignals({fetcher:async()=>({ok:false,status:500}),clock:()=>Date.parse('2026-11-27T08:23:00Z')});
 assert.deepEqual(other,{searches:[],talk:[]});
});
test('notes: strict, bounded; prompt demands quoted evidence and no invented numbers',()=>{
 const n=R.parseNote('x {"niche":"Students","product":"Budget planner","channel":"etsy","why":"Many searches","evidence":["budget planner for students"],"confidence":9}');
 assert.equal(n.confidence,5);assert.equal(n.channel,'etsy');assert.deepEqual(n.evidence,['budget planner for students']);
 assert.equal(R.parseNote('{"niche":"x"}'),null);
 const p=R.researchPrompt({signals:{searches:[],talk:[]}});
 assert.match(p,/Use ONLY the signals below as evidence and quote them/);assert.match(p,/Never invent numbers/);
});
test('daily: research every day; propose when the finding is strong (4-5), even mid-week',async()=>{
 const {makeInitiativeProposals}=require('../server/initiative-proposals.cjs');
 const OWNER='11111111-1111-4111-8111-111111111111',token='33333333-3333-4333-8333-333333333333';
 const run=async(noteReply)=>{const posts=[],prompts=[];
  const fetcher=async(url,o={})=>{const m=o.method||'GET';const json=b=>({ok:true,status:200,json:async()=>b,text:async()=>JSON.stringify(b)});
   if(url.includes('paperworld_initiative_runs_v1'))return json([{token}]);
   if(url.includes('controller_v5'))return json([{initiatives_paused:false}]);
   if(url.includes('paperworld_agent_threads'))return json([{id:'44444444-4444-4444-8444-444444444444'}]);
   if(url.includes('paperworld_shop_research_v1')&&m==='GET')return json([]);
   if(url.includes('director_id=eq.shop-director'))return json([{title:'Old',status:'declined'}]);
   if(url.includes('paperworld_proposals_v1')&&m==='GET')return json(url.includes('status=eq.proposed')?[{id:'open'}]:[]);
   if(m==='POST'){posts.push([url,JSON.parse(o.body)]);return {ok:true,status:201,text:async()=>'',json:async()=>null}}
   return json([])};
  const clientFactory=async()=>({start:async()=>{},stop:async()=>{},listModels:async()=>[{id:'m',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1}}}],
   createSession:async()=>({sendAndWait:async({prompt})=>{prompts.push(prompt);return {data:{content:prompt.includes('TODAY\'S SIGNALS')?noteReply:
    '[{"title":"Student budget planner 2027","why":"Searches show it.","task":"PDF on Etsy."}]'}}},disconnect:async()=>{}})});
  const r=await makeInitiativeProposals({fetcher,clientFactory,secret:'x'.repeat(40),ownerId:OWNER,tokenFor:()=>'gho_x',
   clock:()=>Date.parse('2026-11-26T08:23:00Z')}).run({token});return {r,posts,prompts}};
 const strong=await run('{"niche":"Students","product":"Budget planner 2027","channel":"etsy","why":"w","evidence":["e"],"confidence":4}');
 const saved=strong.posts.find(([u])=>u.includes('paperworld_shop_research_v1'))[1];
 assert.equal(saved.day,'2026-11-26');assert.equal(saved.confidence,4);assert.equal(saved.owner_id,OWNER);
 assert.equal(strong.r.body.results.find(x=>x.director==='shop-director'&&!x.step).state,'proposed','a Thursday proposal because the finding is strong');
 const weak=await run('{"niche":"Students","product":"x","channel":"etsy","why":"w","evidence":[],"confidence":2}');
 assert.equal(weak.r.body.results.find(x=>x.director==='shop-director'&&!x.step),undefined,'weak finding mid-week: keep researching');
 assert.ok(weak.posts.some(([u])=>u.includes('paperworld_shop_research_v1')),'the note is still kept in the journal');
});
test('products are Etsy-ready: 13 short tags, searchable title, honest AI note always added',async()=>{
 const {validateSpec,AI_NOTE}=await import('../supabase/functions/shop-studio/layout.mjs');
 const s=validateSpec({template:'habit_tracker',accent:'sage',slug:'student-habits',title:'Student Habit Tracker',summary:'s',
  description:'For students.',price_eur:3,etsy_title:'2027 Habit Tracker for Students | Printable A4 PDF',
  tags:['Habit Tracker','habit tracker','student planner','printable','a4 pdf','2027 planner','study habits','self care','goal tracker','routine','monthly tracker','minimalist','digital download','extra'],params:{habits:['a','b','c']}});
 assert.equal(s.tags.length,13);assert.equal(s.tags[0],'habit tracker');assert.ok(s.description.endsWith(AI_NOTE));
 assert.throws(()=>validateSpec({template:'habit_tracker',accent:'sage',slug:'x-y-z',title:'T',summary:'s',price_eur:3,tags:['this tag is far too long for etsy'],params:{habits:['a','b','c']}}));
 assert.match(fs.readFileSync('server/james-shop-builder.cjs','utf8'),/"tags": exactly 13 search phrases|exactly 13 search phrases/);
 assert.match(fs.readFileSync('sql/paperworld_shop_research_v1.sql','utf8'),/unique\(owner_id,day\)/);
});
