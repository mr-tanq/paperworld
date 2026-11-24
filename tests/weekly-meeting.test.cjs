'use strict';
// Γ: every Sunday Matt sums up the week in the owner's chat (and phone), and at
// the Town Hall table he says the same from real records only.
const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../supabase/functions/paperworld-watch/index.mjs');
const owner='11111111-1111-4111-8111-111111111111',thread='22222222-2222-4222-8222-222222222222';
test('weekly summary counts real outcomes; a redone attempt does not count as "needed you"',async()=>{
 const {weekly}=await load();
 const s=weekly([
  {id:'a',project_id:'listening',status:'completed',report:{merged:true},policy:{}},
  {id:'b',project_id:'listening',status:'completed',report:{merged:true},policy:{initiative:true}},
  {id:'c',project_id:'pokemon',status:'needs_you',policy:{}},
  {id:'d',project_id:'pokemon',status:'completed',report:{merged:true},policy:{retryOf:'c'}},
  {id:'e',project_id:'pokemon',status:'needs_you',policy:{}},
  {id:'f',project_id:'pokemon',status:'working',policy:{}},
  {id:'g',project_id:'studio',status:'completed',policy:{}}],2);
 assert.equal(s.alone,3);assert.equal(s.you,1);assert.equal(s.running,1);assert.equal(s.initiatives,1);
 assert.match(s.text,/^Εβδομαδιαία συνάντηση στο Town Hall/);
 assert.match(s.text,/Luna: 2 αλλαγές μπήκαν μόνες τους/);
 assert.match(s.text,/Joey: 1 αλλαγή μπήκε μόνη της, 1 σταμάτησε και θέλει εσένα, 1 τρέχει ακόμα/);
 assert.match(s.text,/Πρωτοβουλίες της ομάδας: 1\. 2 προτάσεις περιμένουν την απόφασή σου/);
 assert.match(weekly([],0).text,/Ήσυχη εβδομάδα/);
});
test('only on Sunday (Amsterdam), once per day, as a phone notification from Matt',async()=>{
 const {createWatcher,isSunday}=await load();
 assert.equal(isSunday(Date.parse('2026-11-22T06:47:00Z')),true);
 assert.equal(isSunday(Date.parse('2026-11-23T06:47:00Z')),false);
 const make=clock=>{const posts=[];const fetcher=async(url,o={})=>{const json=b=>({ok:true,status:200,json:async()=>b});
   if(url.includes('api.github.com'))return json(url.endsWith('/user')?{login:'x'}:{workflow_runs:[]});
   if(url.includes('_links_v1'))return json([{updated_at:'x'}]);
   if(url.includes('controller_v5'))return json([{engine:'v1',dispatch_enabled:true,initiatives_paused:false}]);
   if(url.includes('paperworld_proposals_v1'))return json([{id:1}]);
   if(url.includes('paperworld_agent_messages')){posts.push({body:JSON.parse(o.body),prefer:o.headers.Prefer});return {ok:true,status:201,json:async()=>null}}
   if(url.includes('status=in.'))return json([]);
   if(url.includes('created_at=gte')&&url.includes('owner_id=eq.'))return json([{id:'a',project_id:'listening',status:'completed',report:{merged:true},policy:{}}]);
   if(url.includes('order=created_at.desc'))return json([{owner_id:owner,thread_id:thread,policy:{}}]);
   return json([]);};
  return {posts,w:createWatcher({environment:k=>({SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40),GITHUB_COPILOT_USER_TOKEN:'t'.repeat(30)})[k],fetcher,clock})};};
 const sun=make(()=>Date.parse('2026-11-22T06:47:00Z'));
 const r=await sun.w.runOnce();
 assert.equal(r.health.weekly.state,'posted');
 const post=sun.posts.find(p=>p.body.content.includes('Εβδομαδιαία'));
 const data=JSON.parse(post.body.content.slice('@paperworld-matt:v1:'.length));
 assert.equal(data.director,'matt');assert.equal(data.kind,'notification');
 assert.match(data.text,/Luna: 1 αλλαγή μπήκε μόνη της.*1 πρόταση περιμένει/);
 assert.equal(post.body.owner_id,owner);assert.match(post.prefer,/ignore-duplicates/);
 const mon=make(()=>Date.parse('2026-11-23T06:47:00Z'));await mon.w.runOnce();
 assert.equal(mon.posts.filter(p=>p.body.content.includes('Εβδομαδιαία')).length,0);
});
test('Town Hall: Matt says this week from real missions',()=>{
 const P=require('../js/proof.js'),T=require('../js/town-hall-interior.js');
 const now=Date.parse('2026-11-22T10:00:00Z');
 const m=(o)=>({projectId:'listening',createdAt:'2026-11-21T10:00:00Z',updatedAt:'2026-11-21T10:30:00Z',...o});
 assert.equal(P.weekLine([m({status:'completed',report:{merged:true}}),m({status:'completed',report:{merged:true}}),m({status:'needs_you'})],now),
  'Αυτή την εβδομάδα: 2 αλλαγές μπήκαν μόνες τους, 1 θέλει εσένα.');
 assert.match(P.weekLine([m({createdAt:'2026-11-01T10:00:00Z',status:'completed'})],now),/Ήσυχη εβδομάδα/);
 assert.equal(T.seatLines({matt:{text:'Αυτή την εβδομάδα: x.'}}).matt,'Αυτή την εβδομάδα: x.');
 assert.match(T.seatLines({}).matt,/Καλώς ήρθες/);
});
