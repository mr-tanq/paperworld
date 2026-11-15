'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const hub=require('../js/human-first-hub.js');
const town=require('../js/town-hall-briefing.js');
const review=require('../js/listening-review.js');
const jobId='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const sha='a'.repeat(40),digest='b'.repeat(64);
const source='js/festival-artwork.js';
const plan={kind:'paperworld-listening-change-proposal-v1',jobId,
 repository:'mr-tanq/concerts',baseRef:'main',summary:'Να απορρίπτονται αφίσες λάθος χρονιάς',
 edits:[{path:source,expectedSha:sha,replacement:'export const safe = true;'}],
 execution:'none',approvalRequired:true,canWrite:false,canDeploy:false};
const evidence={repository:'mr-tanq/concerts',ref:'main',readOnly:true,
 files:[{path:source,sha,lines:'L1 export const safe = false;'}]};
const proposal={jobId,status:'pending_review',digest,plan,evidence,
 createdAt:'2026-11-15T22:32:00Z'};
const job={id:jobId,project:'Listening Mirror',
 summary:'Αφίσες από λάθος χρονιά',createdAt:'2026-11-15T22:30:00Z',
 events:[{state:'created',actor:'matt'},
  {state:'evidence_read',actor:'listening-developer'},
  {state:'reported',actor:'matt'}]};
const otherJob={...job,id:other,summary:'Άλλη έρευνα',events:[{state:'reported',actor:'matt'}]};
const task={id:'task123',room:'pokemon',title:'Ολοκλήρωση Route 1',status:'todo',
 created:Date.parse('2026-11-15T22:00:00Z')};
const prior=globalThis.PaperworldListeningReview;
globalThis.PaperworldListeningReview=review;
globalThis.PaperworldHumanFirstHub=hub;
function fixture(){return {jobs:[job,otherJob],proposals:[proposal],tasks:[task]}}
class FakeElement{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.hidden=false;
  this.className='';this.textContent='';this.attrs={};}
 append(...items){this.children.push(...items)}
 replaceChildren(...items){this.children=[...items]}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,cb){this.listeners[k]=cb}
 querySelectorAll(selector){return this.findAll(x=>x.className?.split(' ').includes(selector.slice(1)))}
 findAll(fn){return [this,...this.children.flatMap(x=>x.findAll?.(fn)||[])].filter(fn)}
 scrollIntoView(){}
}
function withDOM(fn){
 const doc=global.document,win=global.window;
 const restore=()=>{global.document=doc;global.window=win};
 global.document={createElement:tag=>new FakeElement(tag),addEventListener(){}};
 global.window={confirm:()=>true};
 try{
  const result=fn();
  if(result?.then)return result.finally(restore);
  restore();return result;
 }catch(e){restore();throw e}
}
test('Owner-scoped real jobs and verified review proposal collapse into ONE clear decision',()=>{
 const result=hub.project(fixture());
 assert.equal(result.counts.decision,1);
 assert.equal(result.rows.filter(x=>x.id===jobId).length,1);
 const reviewRow=result.rows.find(x=>x.id===jobId);
 assert.equal(reviewRow.stage,'decision');
 assert.equal(reviewRow.request,'Αφίσες από λάθος χρονιά');
 assert.equal(reviewRow.files.length,1);
 assert.equal(reviewRow.summary,plan.summary);
 assert.equal(result.rows.find(x=>x.id===other).stage,'diagnosed');
 assert.equal(result.rows.find(x=>x.kind==='manual').stage,'planned');
 assert.ok(Object.isFrozen(result.rows));
});
test('Historical reported status never masquerades as a completed code fix',()=>{
 const r=hub.project({jobs:[otherJob]});
 assert.equal(r.counts.decision,0);
 assert.equal(r.rows[0].stage,'diagnosed');
 assert.match(hub.stateLabel(r.rows[0].stage),/χωρίς έτοιμη λύση/);
});
test('No invented jobs, malformed review IDs, stale or mismatched source are admitted',()=>{
 for(const x of [
  {...proposal,digest:'bad'},
  {...proposal,plan:{...plan,canWrite:true}},
  {...proposal,plan:{...plan,edits:[{...plan.edits[0],path:'../../secrets'}]}},
  {...proposal,evidence:{...evidence,files:[{...evidence.files[0],sha:'c'.repeat(40)}]}},
  {...proposal,status:'draft_created',draftUrl:'https://evil.invalid/pull/33'},
  {...proposal,jobId:other}
 ]){
  const r=hub.project({jobs:[],proposals:[x],tasks:[]});
  assert.equal(r.rows.length,0);
 }
 assert.equal(hub.project({jobs:[{...job,project:'Other'}]}).rows.length,0);
});
test('Status after Draft PR is prepared, NOT applied or completed',()=>{
 const r=hub.project({proposals:[{...proposal,status:'draft_created',
  draftUrl:'https://github.com/mr-tanq/concerts/pull/17'}]});
 assert.equal(r.rows[0].stage,'prepared');
 assert.match(hub.stateLabel(r.rows[0].stage),/δεν εφαρμόστηκε/);
});
test('Human First decisions use readable text nodes, optional code disclosure and no embedded execution',async()=>{
 await withDOM(async()=>{
  const host=new FakeElement('section');
  let approval=0,reads=0;
  const view=hub.create(host,{load:async()=>{reads++;return fixture()},
   approve:async()=>{approval++},reject:async()=>{}});
  view.setData(fixture());
  assert.equal(view.snapshot.counts.decision,1);
  const all=host.findAll(()=>true);
  assert.ok(all.some(x=>x.tag==='details'&&x.className==='human-hub-technical'));
  const btn=all.find(x=>x.textContent==='Εγκρίνω την προετοιμασία');
  assert.ok(btn&&typeof btn.listeners.click==='function');
  // Simulate owner refusing confirmation: NO publisher call.
  global.window.confirm=()=>false;
  await btn.listeners.click();
  assert.equal(approval,0);
  global.window.confirm=()=>true;
  await btn.listeners.click();
  assert.equal(approval,1);
  assert.ok(reads>=1);
 });
});
test('Compact Messenger inbox is hidden unless an actual persisted pending decision exists',()=>{
 withDOM(()=>{
  const host=new FakeElement('div');
  const view=hub.create(host,{compact:true,load:async()=>({jobs:[],proposals:[],tasks:[]})});
  view.setData({jobs:[],proposals:[],tasks:[]});
  assert.equal(host.hidden,true);
  view.setData(fixture());
  assert.equal(host.hidden,false);
  assert.equal(host.findAll(x=>x.textContent==='Εγκρίνω την προετοιμασία').length,1);
 });
});
test('Town Hall agenda is derived from same verified jobs and never invents a meeting',()=>{
 const a=town.getAgenda(fixture());
 assert.equal(a.count,1);
 assert.equal(a.items.filter(x=>x.id===jobId).length,1);
 assert.equal(town.ACTORS[0].name,'Matt');
 const source=fs.readFileSync('js/town-hall-briefing.js','utf8');
 assert.match(source,/Δεν ξεκίνησε κοινή AI συζήτηση/);
 assert.doesNotMatch(source,/sendAndWait|fetch\(|createPullRequest/);
});
test('Integrated UI preserves exact server approval endpoint and avoids technical UX in primary flow',()=>{
 const dialog=fs.readFileSync('js/world-dialogue.js','utf8');
 const cloud=fs.readFileSync('js/cloud-ui.js','utf8');
 const app=fs.readFileSync('js/app.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert.match(dialog,/world-chat-decisions/);
 assert.match(dialog,/compact:true,load:\(\)=>cloud\(\)\.loadHumanWork\(\)/);
 assert.match(dialog,/refreshDecisions\(\)/);
 assert.match(dialog,/world-chat-full-report/);
 assert.match(cloud,/publishListeningProposal\(item\.jobId,item\.digest\)/);
 assert.match(cloud,/rejectListeningProposal\(item\.jobId,item\.digest\)/);
 assert.match(cloud,/previewListeningChange:/);
 assert.doesNotMatch(cloud,/room='workshop';active=true;edit=null;memoryOpen=false;\s*render\(\);work\(reload\);/);
 assert.match(app,/directorAssembly\.call\(\)/);
 assert.match(app,/townHallBriefing\.show\(\)/);
 assert.ok(html.indexOf('js/listening-review.js')<html.indexOf('js/human-first-hub.js'));
 assert.ok(html.indexOf('js/human-first-hub.js')<html.indexOf('js/cloud-ui.js'));
 assert.ok(html.indexOf('js/town-hall-briefing.js')<html.indexOf('js/app.js'));
});
