'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createView}=require('../js/director-history-bulk-ui.js');
const ID='12345678-1234-4234-8234-123456789abc';
function setup(){
 const nodes=[],calls=[];
 function createElement(tag){
  const n={tagName:tag,textContent:'',children:[],className:'',disabled:false,
   checked:false,value:'',events:{},
   setAttribute(){},append(...args){this.children.push(...args)},
   replaceChildren(...args){this.children=[...args]},
   addEventListener(type,cb){this.events[type]=cb}};
  nodes.push(n);return n;
 }
 const source=[{id:ID,title:'Project brief'}];
 const router={suggest:()=>[{id:ID,index:0,title:'Project brief',
  count:2,confidence:'suggested',projectId:'studio',
  reason:'Strong single-project match'}]};
 const parser={prepare:(_,index,projectId)=>({
  total:1,nextOffset:null,records:[{source_ref:'chatgpt-export:'+ID+':0',
   project_id:projectId,title:'Project brief',status:'proposed',body:'Private text'}]}),
  mainMessages:()=>[{role:'user',text:'Unreleased track idea'}]};
 let confirmed=0;
 const view=createView({document:{createElement},router,parser,
  confirm:async({conversations,parts})=>{
   confirmed++;assert.equal(parts,1);assert.equal(conversations[0].projectId,'studio');
   return true},
  upload:async({projectId,records})=>{calls.push({projectId,records});
   return {imported:1,skipped:0}}
 });
 const host=createElement('div');
 view.setSource(source);view.draw(host);
 function get(tag,predicate=()=>true){return nodes.filter(n=>n.tagName===tag&&predicate(n)).at(-1)}
 return {view,host,nodes,calls,get,confirmationCount:()=>confirmed};
}
test('bulk import never selects a conversation automatically',async()=>{
 const f=setup();
 const submit=f.get('button',n=>n.textContent.includes('Προεπισκόπηση και εισαγωγή'));
 assert.equal(submit.disabled,true);
 assert.equal(f.confirmationCount(),0);
 assert.equal(f.calls.length,0);
});
test('one explicitly chosen high-confidence conversation requires confirmation',async()=>{
 const f=setup();
 const choose=f.get('button',n=>n.textContent.includes('Επίλεξε τις ξεκάθαρες'));
 await choose.events.click();
 const submit=f.get('button',n=>n.textContent.includes('Προεπισκόπηση και εισαγωγή'));
 assert.equal(submit.disabled,false);
 await submit.events.click();
 assert.equal(f.confirmationCount(),1);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].projectId,'studio');
 assert.equal(f.calls[0].records[0].status,'proposed');
});
test('bulk history import requires a correct source and trusted callbacks',()=>{
 assert.throws(()=>createView({document:{createElement:()=>({})}}),
  /Bulk import dependencies required/);
 const f=setup();f.view.setSource(null);
 const submit=f.get('button',n=>n.textContent.includes('Προεπισκόπηση και εισαγωγή'));
 assert.equal(submit.disabled,true);
});
