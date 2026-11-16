'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const review=require('../js/director-memory-review.js');
const cloud=require('../js/cloud.js');
const ID='11111111-1111-4111-8111-111111111111';
function row(project='workshop',status='proposed'){
 return {id:ID,project_id:project,kind:'preference',status,
  title:'Owner decision',body:'Never use a generated generic band image.',
  source_type:'conversation',source_ref:'conversation/reviewed-topic',
  observed_at:'2026-11-15T00:00:00+00:00',sensitivity:'standard',version:1}
}
test('One reviewed project at a time, exact five project registry',()=>{
 assert.deepEqual(review.PROJECTS.map(p=>p.id),
  ['town','workshop','studio','pokemon','wellbeing']);
 const results=review.normalize([row()], 'workshop');
 assert.equal(results.length,1);
 assert.equal(results[0].projectId,'workshop');
 assert.deepEqual(review.counts(results),{total:1,pending:1,approved:0});
 assert.throws(()=>review.normalize([row('studio')],'workshop'),/Invalid Director Memory response/);
 assert.throws(()=>review.normalize([row()],'attacker-project'),/Invalid Director Memory response/);
});
test('No malformed, oversized or unverified content is displayed',()=>{
 for(const invalid of [
  {...row(),body:'x'.repeat(4001)},
  {...row(),source_ref:''},
  {...row(),project_id:'studio'},
  {...row(),status:'fake_approved'},
  {...row(),kind:'secret'},
  {...row(),id:'not-a-uuid'}
 ])assert.throws(()=>review.normalize([invalid],'workshop'));
 assert.throws(()=>review.normalize('not rows','workshop'));
});
test('Private source cards are escaped via textContent and never execute HTML',async()=>{
 const elements=[];
 function node(tag){
  const value={tagName:tag,children:[],textContent:'',className:'',
   disabled:false,replaceChildren(...v){this.children=[...v]},
   append(...items){this.children.push(...items)},
   setAttribute(){},addEventListener(){},
   getSelection(){return 'workshop'}};
  elements.push(value);return value;
 }
 const view=review.createView({
  document:{createElement:node},
  load:async()=>[{...row(),body:'<img src=x onerror=alert(1)>',sensitivity:'private'}]
 });
 const host=node('div');await view.refresh(host);
 assert.equal(host.children.length,3);
 assert.ok(elements.some(el=>el.tagName==='p'&&
  el.textContent==='<img src=x onerror=alert(1)>'));
 assert.equal(typeof view.approve,'undefined');
 assert.equal(typeof view.reject,'undefined');
});
test('Cloud reader uses Supabase JWT GET only, project filter and no direct writes',async()=>{
 const requests=[];
 const session={access_token:'fixture-jwt',refresh_token:'fixture-refresh',
  expires_at:Date.now()+3600000,user:{email:'test@example.org'}};
 const storage={getItem:k=>k===cloud.TOKEN_STORAGE?JSON.stringify(session):null,
  setItem(){},removeItem(){}};
 const fetcher=async (url,opts)=>{
  requests.push({url:String(url),...opts});
  return {ok:true,status:200,text:async()=>JSON.stringify([row('studio')])}
 };
 const client=cloud.createClient({fetcher,storage});
 const result=await client.listDirectorMemory('studio');
 assert.equal(result.length,1);
 assert.equal(result[0].project_id,'studio');
 assert.equal(requests.length,1);
 assert.equal(requests[0].method,'GET');
 assert.match(requests[0].url,/project_id=eq.studio/);
 assert.match(requests[0].url,/limit=100/);
 assert.equal(requests[0].headers.Authorization,'Bearer fixture-jwt');
 assert.equal(requests[0].body,undefined);
 await assert.rejects(client.listDirectorMemory('../studio'),/Invalid Director Memory project/);
 assert.equal(requests.length,1);
});
test('Cloud rejects cross-project server responses even with owner JWT',async()=>{
 const session={access_token:'fixture-jwt',refresh_token:'fixture-refresh',
  expires_at:Date.now()+3600000};
 const storage={getItem:k=>k===cloud.TOKEN_STORAGE?JSON.stringify(session):null};
 const client=cloud.createClient({storage,fetcher:async()=>({
  ok:true,status:200,text:async()=>JSON.stringify([row('pokemon')])
 })});
 await assert.rejects(client.listDirectorMemory('studio'),/Invalid private Director Memory response/);
});
test('Review is separate from AI, merge/deploy and status-mutation logic',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/director-memory-review.js'),'utf8');
 assert.doesNotMatch(source,/\.innerHTML\s*=|eval\(|createSession\(|fetch\(/);
 assert.match(source,/owner review desk/);
 assert.match(source,/δεν έχουν ακόμη ενεργοποιηθεί/);
 const cloudSource=fs.readFileSync(path.join(__dirname,'../js/cloud.js'),'utf8');
 const code=cloudSource.slice(cloudSource.indexOf('async function listDirectorMemory('),
  cloudSource.indexOf('async function verifiedMemoryReviewer()'));
 assert.doesNotMatch(code,/method:\s*['"](?:PATCH|POST|DELETE)['"]/);
});
