'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const hub=require('../js/human-first-hub.js');
const id='11111111-1111-4111-8111-111111111111';
const requestId='22222222-2222-4222-8222-222222222222';
const job={id,requestId,project:'pokemon',directorId:'pokemon-director',
 workerId:'pokemon-developer',status:'awaiting_consent',
 summary:'Check Pokémon Echoes Route 1',createdAt:'2026-11-16T15:00:00Z'};
const fixture=()=>({jobs:[],tasks:[],proposals:[],teamJobs:[job],workerRuns:[]});
class FakeElement{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.hidden=false;
  this.className='';this.textContent='';this.attrs={};this.disabled=false}
 append(...items){this.children.push(...items)}
 replaceChildren(...items){this.children=[...items]}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,cb){this.listeners[k]=cb}
 querySelectorAll(selector){return this.findAll(x=>x.className?.split(' ').includes(selector.slice(1)))}
 findAll(fn){return [this,...this.children.flatMap(x=>x.findAll?.(fn)||[])].filter(fn)}
 scrollIntoView(){}
}
async function withDOM(callback){
 const d=global.document,w=global.window;
 global.document={createElement:tag=>new FakeElement(tag)};
 global.window={confirm:()=>true};
 try{return await callback()}finally{global.document=d;global.window=w}
}
test('owner can resume a persisted pending Worker proposal from compact Matt inbox',async()=>{
 await withDOM(async()=>{
  const host=new FakeElement('section');let calls=0,confirmations=0;
  global.window.confirm=()=>{confirmations++;return true};
  const view=hub.create(host,{compact:true,load:async()=>fixture(),
   runWorker:async x=>{calls++;assert.equal(x.requestId,requestId)}});
  view.setData(fixture());
  assert.equal(host.hidden,false);
  const action=host.findAll(x=>x.textContent==='Ναι, έλεγξέ το')[0];
  assert.ok(action);
  await action.listeners.click();
  assert.equal(calls,1);
  assert.equal(confirmations,1);
 });
});
test('owner refusal never starts Copilot Worker request',async()=>{
 await withDOM(async()=>{
  let calls=0;
  global.window.confirm=()=>false;
  const host=new FakeElement('section');
  const view=hub.create(host,{load:async()=>fixture(),runWorker:async()=>{calls++}});
  view.setData(fixture());
  const action=host.findAll(x=>x.textContent==='Ναι, έλεγξέ το')[0];
  await action.listeners.click();
  assert.equal(calls,0);
 });
});
test('stale, replaced, used and unverifiable handoffs fail before any consent or AI',async()=>{
 for(const variant of [
  {...fixture(),teamJobs:[]},
  {...fixture(),teamJobs:[{...job,status:'reported'}]},
  {...fixture(),teamJobs:[{...job,workerId:'listening-developer'}]},
  {...fixture(),workerRuns:[{requestId}]},
  {...fixture(),workerHistoryUnavailable:true},
  {...fixture(),teamUnavailable:true}
 ]){
  await withDOM(async()=>{
   const host=new FakeElement('section');let calls=0,asks=0;
   global.window.confirm=()=>{asks++;return true};
   const view=hub.create(host,{load:async()=>variant,runWorker:async()=>{calls++}});
   view.setData(fixture());
   const action=host.findAll(x=>x.textContent==='Ναι, έλεγξέ το')[0];
   await action.listeners.click();
   assert.equal(calls,0);
   assert.equal(asks,0);
  });
 }
});
test('persisted execution replaces stale pending handoff, never shows a second approval',()=>{
 const r=hub.project({...fixture(),workerRuns:[{
  id:'33333333-3333-4333-8333-333333333333',requestId,
  project:'pokemon',directorId:'pokemon-director',workerId:'pokemon-developer',
  status:'reported',summary:job.summary,createdAt:'2026-11-16T15:10:00Z'
 }]});
 assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].kind,'worker-run');
 assert.equal(r.rows[0].stage,'diagnosed');
});
test('new handoff action reuses existing owner-consented workers without autonomous extra calls',()=>{
 const cloud=fs.readFileSync('js/cloud.js','utf8');
 const cloudUi=fs.readFileSync('js/cloud-ui.js','utf8');
 const dialog=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(cloud,/requestId:requestId\|\|crypto\.randomUUID\(\)/);
 assert.match(cloudUi,/runApprovedHandoff/);
 assert.match(dialog,/runWorker:async item=>/);
 assert.match(dialog,/requestId:result\.requestId/);
 assert.doesNotMatch(cloudUi,/setInterval\(|createPullRequest|autoDeploy/);
});
