'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const parser=require('../js/director-history-import.js');
const {validateEntry}=require('../server/director-memory-policy.cjs');
const cloud=require('../js/cloud.js');
const CID='12345678-1234-4234-8234-123456789abc';
const USER='44444444-4444-4444-8444-444444444444';
function conversation(){
 const mapping={
  a:{parent:null,message:{author:{role:'system'},content:{parts:['hidden system prompt']}}},
  b:{parent:'a',message:{author:{role:'user'},content:{parts:['Θέλω μουσική\nμε τρομπέτα και μπάσο.']}}},
  c:{parent:'b',message:{author:{role:'assistant'},content:{parts:['An earlier suggestion.']}}},
  d:{parent:'b',message:{author:{role:'assistant'},content:{parts:['Alternative active answer.']}}}
 };
 return {id:CID,title:'Lost Wanderer private draft',create_time:1794600000,
  current_node:'d',mapping};
}
test('reads only the active conversation branch, not alternate or system messages',()=>{
 const source=[conversation()];
 assert.equal(parser.catalog(source).length,1);
 const items=parser.mainMessages(source[0]);
 assert.deepEqual(items.map(m=>m.role),['user','assistant']);
 const plan=parser.prepare(source,0,'studio');
 assert.equal(plan.records.length,1);
 assert.match(plan.records[0].body,/Θέλω μουσική/);
 assert.match(plan.records[0].body,/Alternative active answer/);
 assert.doesNotMatch(plan.records[0].body,/An earlier suggestion|hidden system prompt/);
 assert.equal(plan.records[0].status,'proposed');
 assert.equal(plan.records[0].sensitivity,'private');
 assert.equal(plan.records[0].project_id,'studio');
 assert.match(plan.records[0].source_ref,/^chatgpt-export:/);
});
test('prepared history is valid under existing policy, including multiline Greek',()=>{
 const source=[conversation()];
 const result=parser.prepare(source,0,'studio');
 for(const row of result.records){
  const normalized=validateEntry({id:'11111111-1111-4111-8111-111111111111',
   projectId:row.project_id,kind:row.kind,status:row.status,
   title:row.title,body:row.body,sourceType:row.source_type,
   sourceRef:row.source_ref,observedAt:row.observed_at,
   version:row.version,sensitivity:row.sensitivity});
  assert.ok(normalized.body);
  assert.doesNotMatch(normalized.body,/[\u0000-\u001f\u007f]/);
 }
});
test('rejects implicit cross-project import or invalid/unstructured export',()=>{
 const source=[conversation()];
 assert.throws(()=>parser.prepare(source,0,'town'),/Invalid selected import scope/);
 assert.throws(()=>parser.prepare(source,9,'studio'));
 assert.throws(()=>parser.catalog({unexpected:'format'}));
 assert.equal(parser.catalog([{...source[0],current_node:'nonexistent'}]).length,0);
});
test('long conversation is split into bounded, paged references without losing source IDs',()=>{
 const c=conversation(),large='Το παλιό ιστορικό. '.repeat(2500);
 c.mapping.b.message.content.parts=[large];
 const source=[c];
 const p=parser.prepare(source,0,'studio',{limit:2});
 assert.equal(p.records.length,2);
 assert.ok(p.total>2);
 assert.equal(p.nextOffset,2);
 assert.ok(p.records.every(r=>r.body.length<=4000));
 const q=parser.prepare(source,0,'studio',{offset:2,limit:2});
 assert.equal(q.records[0].source_ref,'chatgpt-export:'+CID+':2');
});
function clientFixture(exists=false){
 const calls=[],session={access_token:'fixture-owner-jwt',refresh_token:'fixture-refresh',
  expires_at:Date.now()+3600000,user:{id:USER}};
 const storage={getItem:key=>key===cloud.TOKEN_STORAGE?JSON.stringify(session):null,
  setItem(){},removeItem(){}};
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('/auth/v1/user'))
   return {ok:true,status:200,text:async()=>JSON.stringify({id:USER})};
  if(options.method==='GET'&&url.includes('source_ref=eq.'))
   return {ok:true,status:200,text:async()=>JSON.stringify(exists?[{id:USER,project_id:'studio'}]:[])};
  if(options.method==='POST')
   return {ok:true,status:201,text:async()=>''};
  throw Error('Unexpected test request');
 };
 return {client:cloud.createClient({fetcher,storage}),calls};
}
test('owner-authenticated import posts only proposed history with no client-selected owner',async()=>{
 const {client,calls}=clientFixture();
 const records=parser.prepare([conversation()],0,'studio').records;
 const result=await client.proposeDirectorHistory({projectId:'studio',records});
 assert.deepEqual(result,{imported:1,skipped:0});
 const post=calls.find(x=>x.options.method==='POST');
 assert.equal(post.options.headers.Authorization,'Bearer fixture-owner-jwt');
 const data=JSON.parse(post.options.body);
 assert.equal(data.owner_id,undefined);
 assert.equal(data.status,'proposed');
 assert.equal(data.project_id,'studio');
 assert.equal(data.sensitivity,'private');
 assert.equal(data.source_ref,records[0].source_ref);
});
test('previously imported excerpt is skipped and wrong-project records do not upload',async()=>{
 const fixture=clientFixture(true);
 const records=parser.prepare([conversation()],0,'studio').records;
 assert.deepEqual(await fixture.client.proposeDirectorHistory({projectId:'studio',records}),
  {imported:0,skipped:1});
 assert.equal(fixture.calls.filter(x=>x.options.method==='POST').length,0);
 await assert.rejects(fixture.client.proposeDirectorHistory({projectId:'workshop',records}),
  /Malformed private history excerpt/);
 assert.equal(fixture.calls.filter(x=>x.options.method==='POST').length,0);
});
