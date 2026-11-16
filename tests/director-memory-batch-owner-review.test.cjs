'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createView}=require('../js/director-memory-review.js');
const ID=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const row=(i,body='Owner preference')=>({id:ID[i],project_id:'workshop',kind:'preference',
 status:'proposed',title:'Memory '+i,body,source_type:'conversation',
 source_ref:'owner-summary',observed_at:'2026-11-15T00:00:00Z',
 version:1,sensitivity:'standard'});
function fixture({accepted=true,failAt=-1,mutateAt=-1}={}){
 const nodes=[];
 function node(tag){
  const n={tagName:tag,textContent:'',children:[],disabled:false,events:{},
   replaceChildren(...args){this.children=[...args]},
   append(...args){this.children.push(...args)},
   setAttribute(){},
   addEventListener(event,handler){this.events[event]=handler}};
  nodes.push(n);return n;
 }
 let entries=[row(0),row(1)],writes=[],confirmations=0,reads=0;
 const view=createView({document:{createElement:node},
  enableReview:true,
  load:async project=>{
   assert.equal(project,'workshop');reads++;
   if(mutateAt===reads)entries=[entries[0],{...entries[1],body:'Changed after preview'}];
   return entries;
  },
  requestReview:async({entryId,projectId,decision})=>{
   if(writes.length===failAt)throw Error('storage down');
   assert.equal(projectId,'workshop');assert.equal(decision,'approved');
   writes.push(entryId);
   entries=entries.map(e=>e.id===entryId?{...e,status:'approved'}:e);
  },
  confirmDecision:async()=>false,
  confirmBatch:async({projectId,entries:items})=>{
   confirmations++;
   assert.equal(projectId,'workshop');
   assert.equal(items.length,2);
   return accepted;
  }});
 const host=node('div');
 async function clickBatch(){
  const b=nodes.filter(n=>n.tagName==='button'&&n.textContent.includes('αναμνήσεων μαζί')).at(-1);
  assert.ok(b&&!b.disabled);
  return b.events.click();
 }
 return {view,host,clickBatch,get:()=>({writes,entries,confirmations,reads,nodes})};
}
test('single owner confirmation reviews two selected memories with separate verified writes',async()=>{
 const f=fixture();await f.view.refresh(f.host);await f.clickBatch();
 const r=f.get();assert.equal(r.confirmations,1);
 assert.deepEqual(r.writes,ID);assert.ok(r.entries.every(e=>e.status==='approved'));
});
test('cancelling batch creates no writes',async()=>{
 const f=fixture({accepted:false});await f.view.refresh(f.host);await f.clickBatch();
 assert.deepEqual(f.get().writes,[]);
});
test('stale content halts batch before writing altered memory',async()=>{
 // First refresh=1, first pre-write refresh=2, second pre-write refresh=3.
 const f=fixture({mutateAt:3});await f.view.refresh(f.host);await f.clickBatch();
 assert.deepEqual(f.get().writes,[ID[0]]);
});
test('failed individual write stops and does not claim whole batch completed',async()=>{
 const f=fixture({failAt:1});await f.view.refresh(f.host);await f.clickBatch();
 assert.deepEqual(f.get().writes,[ID[0]]);
});
