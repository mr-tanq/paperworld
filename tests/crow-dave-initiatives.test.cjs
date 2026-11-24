'use strict';
// Δ: Crow and Dave take initiative too, calmly and privately.
//  - Crow (Thursday): writes ONE new song into his chat, ready for the Music
//    Studio; nothing goes to Suno and no credits are used without the owner.
//  - Dave (Wednesday): a check-in only when Wellbeing items waited 3+ days;
//    the phone text never names them. Both stop with the pause switch.
const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitiativeProposals,songPrompt}=require('../server/initiative-proposals.cjs');
const owner='11111111-1111-4111-8111-111111111111',token='33333333-3333-4333-8333-333333333333';
const MATT='44444444-4444-4444-8444-444444444444',CROW='55555555-5555-4555-8555-555555555555';
const SONG='Ένα τραγούδι για τον δρόμο της επιστροφής.\nTITLE: Lanterns on the Ridge\nSUNO STYLE PROMPT: dark folk, nylon guitar, warm male vocal\nLYRICS:\n[Verse]\nWalking where the old roads bend\n[Chorus]\nLanterns on the ridge again\n[End]';
function crowFake({reply=SONG,paused=false,existing=[]}={}){
 const posts=[],prompts=[];
 const fetcher=async(url,o={})=>{const m=o.method||'GET';
  const json=b=>({ok:true,status:200,json:async()=>b,text:async()=>JSON.stringify(b)});
  if(url.includes('paperworld_initiative_runs_v1'))return json([{token}]);
  if(url.includes('controller_v5'))return json([{initiatives_paused:paused}]);
  if(url.includes('paperworld_agent_threads'))return json([{id:url.includes('studio-director')?CROW:MATT}]);
  if(url.includes('paperworld_proposals_v1')&&m==='GET')return json(url.includes('status=eq.proposed')?[{id:'open'}]:[]);
  if(url.includes('paperworld_director_memory'))return json([{title:'Ήχος',body:'σκοτεινό folk'}]);
  if(url.includes('paperworld_agent_messages')&&m==='GET')
   return json(url.includes('select=id&id=eq.')?existing:[{content:SONG.replace('Lanterns on the Ridge\nSUNO','Old Song\nSUNO')}]);
  if(m==='POST'){posts.push([url,JSON.parse(o.body),o.headers.Prefer]);return {ok:true,status:201,text:async()=>'',json:async()=>null}}
  return json([]);};
 const clientFactory=async()=>({start:async()=>{},stop:async()=>{},
  listModels:async()=>[{id:'m',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1000}}}],
  createSession:async()=>({sendAndWait:async({prompt})=>{prompts.push(prompt);return {data:{content:reply}}},disconnect:async()=>{}})});
 const make=day=>makeInitiativeProposals({fetcher,clientFactory,secret:'x'.repeat(40),ownerId:owner,
  tokenFor:()=>'gho_TESTTOKEN123',clock:()=>Date.parse(day)});
 return {make,posts,prompts};
}
const THU='2026-11-26T08:23:00Z',TUE='2026-11-24T08:23:00Z';
test('Crow writes one song on Thursday into his chat; Matt says no credits were used',async()=>{
 const f=crowFake();const r=await f.make(THU).run({token});
 const crow=r.body.results.find(x=>x.director==='studio-director'&&x.state==='song_written');
 assert.equal(crow.title,'Lanterns on the Ridge');
 const msg=f.posts.find(([u,b])=>u.includes('paperworld_agent_messages')&&b.thread_id===CROW)[1];
 assert.equal(msg.role,'agent');assert.equal(msg.owner_id,owner);assert.match(msg.content,/^Ένα τραγούδι[\s\S]*TITLE: Lanterns[\s\S]*\[End\]$/);
 const note=JSON.parse(f.posts.find(([u,b])=>b.thread_id===MATT)[1].content.slice('@paperworld-matt:v1:'.length));
 assert.equal(note.director,'studio-director');assert.equal(note.kind,'notification');
 assert.match(note.text,/Ο Crow έγραψε μόνος του ένα νέο τραγούδι: «Lanterns on the Ridge»[\s\S]*Στο Suno πάει μόνο αν το στείλεις εσύ/);
 assert.ok(f.posts.every(([u])=>!/suno/i.test(u)),'never calls Suno');
 const p=f.prompts.find(x=>x.includes('On your own initiative'));
 assert.match(p,/EARLIER SONG TITLES[\s\S]*Old Song/);assert.match(p,/OWNER-APPROVED NOTES/);assert.match(p,/Never use the word "skunk"/);
});
test('Crow: not on other days, once per day, never a blocked word, incomplete or paused',async()=>{
 const other=crowFake();const r=await other.make(TUE).run({token});
 assert.ok(!r.body.results.some(x=>x.director==='studio-director'&&/song/.test(x.state)));assert.equal(other.prompts.length,0);
 const twice=crowFake({existing:[{id:'x'}]});
 assert.ok((await twice.make(THU).run({token})).body.results.some(x=>x.state==='already_written'));assert.equal(twice.prompts.length,0);
 const bad=crowFake({reply:SONG.replace('Walking','A skunk walking')});
 assert.ok((await bad.make(THU).run({token})).body.results.some(x=>x.state==='song_blocked_word'));
 assert.equal(bad.posts.length,0);
 const half=crowFake({reply:'TITLE: x'});
 assert.ok((await half.make(THU).run({token})).body.results.some(x=>x.state==='song_incomplete'));
 const paused=crowFake({paused:true});
 assert.ok((await paused.make(THU).run({token})).body.results.some(x=>x.state==='paused'));assert.equal(paused.prompts.length,0);
 assert.match(songPrompt('','' ),/TITLE: <title>\nSUNO STYLE PROMPT/);
});
function daveFake({waiting=2,paused=false}={}){
 const posts=[];const calls=[];
 const fetcher=async(url,o={})=>{calls.push(url);const json=b=>({ok:true,status:200,json:async()=>b});
  if(url.includes('api.github.com'))return json(url.endsWith('/user')?{login:'x'}:{workflow_runs:[]});
  if(url.includes('_links_v1'))return json([{updated_at:'x'}]);
  if(url.includes('controller_v5'))return json([{engine:'v1',dispatch_enabled:true,initiatives_paused:paused}]);
  if(url.includes('paperworld_tasks'))return json(Array.from({length:waiting},(_,i)=>({id:String(i)})));
  if(url.includes('paperworld_agent_messages')){posts.push(JSON.parse(o.body));return {ok:true,status:201,json:async()=>null}}
  if(url.includes('order=created_at.desc'))return json([{owner_id:owner,thread_id:MATT,policy:{}}]);
  return json([]);};
 return {fetcher,posts,calls};
}
test('Dave checks in on Wednesday only when Wellbeing items waited; never names them',async()=>{
 const {createWatcher}=await import('../supabase/functions/paperworld-watch/index.mjs');
 const env=k=>({SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40),GITHUB_COPILOT_USER_TOKEN:'t'.repeat(30)})[k];
 const wed=daveFake();const r=await createWatcher({environment:env,fetcher:wed.fetcher,clock:()=>Date.parse('2026-11-25T06:47:00Z')}).runOnce();
 assert.equal(r.health.dave.state,'posted');assert.equal(r.health.dave.waiting,2);
 const data=JSON.parse(wed.posts.find(p=>p.content.includes('Dave'))?.content.slice('@paperworld-matt:v1:'.length));
 assert.equal(data.director,'wellbeing-director');assert.equal(data.kind,'notification');
 assert.match(data.text,/^Ο Dave ρωτάει πώς πας 🌿 2 πράγματα στη λίστα σου στο Wellbeing περιμένουν/);
 assert.ok(wed.calls.some(u=>u.includes('room=eq.wellbeing')&&u.includes('status=eq.todo')&&u.includes('created_at=lt.')));
 assert.ok(wed.calls.every(u=>!u.includes('paperworld_tasks')||u.includes('select=id&')),'reads only ids, never titles or notes');
 for(const [f,clock,state] of [[daveFake({waiting:0}),'2026-11-25T06:47:00Z','nothing_waiting'],[daveFake(),'2026-11-24T06:47:00Z',undefined],
  [daveFake({paused:true}),'2026-11-25T06:47:00Z',undefined]]){
  const out=await createWatcher({environment:env,fetcher:f.fetcher,clock:()=>Date.parse(clock)}).runOnce();
  assert.equal(out.health?.dave?.state,state);assert.equal(f.posts.filter(p=>p.content.includes('Dave')).length,0);
 }
});
