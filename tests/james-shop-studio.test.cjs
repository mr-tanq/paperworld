'use strict';
// James's production line: approved idea → validated spec → PDF kept PRIVATE →
// watermarked preview + catalogue entry via PR → merged only when the
// storefront's own tests passed → delivery only for Stripe-confirmed payments.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const L=()=>import('../supabase/functions/shop-studio/layout.mjs');
const OWNER='11111111-1111-4111-8111-111111111111';
const SPEC={template:'habit_tracker',accent:'sage',slug:'calm-habit-tracker',title:'Calm Habit Tracker',
 summary:'A gentle monthly habit tracker.',price_eur:4,params:{habits:['Drink water','Walk','Read'],months:2}};
test('templates: only valid, ASCII, honestly priced specs; preview shows page 1 with PREVIEW',async()=>{
 const {validateSpec,pagesFor,previewSvg}=await L();
 assert.equal(validateSpec(SPEC).price_eur,4);
 for(const bad of [{...SPEC,template:'ebook'},{...SPEC,accent:'neon'},{...SPEC,price_eur:49},{...SPEC,title:'Ημερολόγιο'},
  {...SPEC,slug:'Bad Slug'},{...SPEC,params:{habits:['a','b']}},{...SPEC,summary:''}])assert.throws(()=>validateSpec(bad));
 assert.equal(pagesFor(SPEC).pages.length,2);
 assert.equal(pagesFor({...SPEC,template:'weekly_planner',params:{weeks:3}}).pages.length,3);
 assert.equal(pagesFor({...SPEC,template:'budget_planner',params:{expenses:['Rent','Food','Bills','Fun'],months:1}}).pages.length,1);
 const svg=previewSvg({...SPEC,title:'Tom & Jerry <3'});
 assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);assert.match(svg,/>PREVIEW<\/text>/);
 assert.match(svg,/Tom &amp; Jerry &lt;3/);assert.doesNotMatch(svg,/<script|href=/);
});
test('the sold PDF is drawn from the same pages (any pdf-lib)',async()=>{
 const {renderPdf}=await L();const calls={pages:0,text:0};
 const PDFLib={rgb:(r,g,b)=>({r,g,b}),StandardFonts:{Helvetica:'H',HelveticaBold:'HB'},PDFDocument:{create:async()=>({
  setTitle(){},setAuthor(){},setCreator(){},embedFont:async()=>({widthOfTextAtSize:(t,s)=>t.length*s*0.5}),
  addPage:()=>{calls.pages++;return {drawRectangle(){},drawLine(){},drawText(){calls.text++}}},save:async()=>new Uint8Array([37,80,68,70])})}};
 const bytes=await renderPdf(SPEC,PDFLib);assert.equal(calls.pages,2);assert.ok(calls.text>10);assert.equal(bytes[0],37);
});
function studioFake({check=null,merged=false}={}){
 const calls=[];const rows=[{id:'p1',owner_id:OWNER,slug:SPEC.slug,spec:SPEC,status:check?'listing':'spec',pr_number:check?7:null,updated_at:new Date().toISOString()}];
 const json=(b,status=200)=>({ok:status<300,status,json:async()=>b});
 const fetcher=async(url,o={})=>{const m=o.method||'GET';calls.push([m,url,o.body]);
  if(url.includes('/rest/v1/paperworld_shop_products_v1')&&m==='GET')return json(rows);
  if(url.includes('/rest/v1/'))return json(m==='GET'?[{id:'t1'}]:null,m==='GET'?200:201);
  if(url.includes('/storage/v1/object/shop-files/'))return json({Key:'x'});
  if(url.endsWith('/git/ref/heads/main'))return json({object:{sha:'a'.repeat(40)}});
  if(url.endsWith('/git/refs'))return json({},201);
  if(url.includes('/contents/products.json?ref='))return json({sha:'s1',content:Buffer.from(JSON.stringify({shop:'Digital Business Studio',currency:'EUR',products:[]})).toString('base64')});
  if(url.includes('/contents/')&&m==='GET')return json(null,404);
  if(url.includes('/contents/'))return json({});
  if(url.includes('/pulls?state=open'))return json([]);
  if(url.endsWith('/pulls')&&m==='POST')return json({number:7});
  if(url.endsWith('/pulls/7'))return json({number:7,state:'open',merged,head:{sha:'b'.repeat(40)}});
  if(url.includes('/check-runs'))return json({check_runs:check?[{name:'test',...check}]:[]});
  if(url.endsWith('/pulls/7/merge'))return json({merged:true});
  return json({});};
 return {fetcher,calls};
}
const env=k=>({SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40),GITHUB_COPILOT_USER_TOKEN:'t'.repeat(30),PAPERWORLD_DISPATCH_TRIGGER_SECRET:'s'.repeat(40)})[k];
const fakePdf={rgb:()=>0,StandardFonts:{},PDFDocument:{create:async()=>({setTitle(){},setAuthor(){},setCreator(){},embedFont:async()=>({widthOfTextAtSize:()=>1}),
 addPage:()=>({drawRectangle(){},drawLine(){},drawText(){}}),save:async()=>new Uint8Array([1])})}};
test('studio: file stored privately; preview + catalogue go to the storefront through a PR',async()=>{
 const {createStudio}=await import('../supabase/functions/shop-studio/studio.mjs');const f=studioFake();
 const r=await createStudio({environment:env,fetcher:f.fetcher,PDFLib:fakePdf}).runOnce();
 assert.deepEqual(r.results[0],{slug:SPEC.slug,state:'listing',pr:7});
 assert.ok(f.calls.some(([m,u])=>m==='POST'&&u.endsWith('/storage/v1/object/shop-files/calm-habit-tracker.pdf')),'private bucket');
 const putCat=f.calls.find(([m,u])=>m==='PUT'&&u.endsWith('/contents/products.json'));
 const cat=JSON.parse(Buffer.from(JSON.parse(putCat[2]).content,'base64').toString());
 assert.deepEqual(cat.products[0],{slug:SPEC.slug,title:SPEC.title,summary:SPEC.summary,price_eur:4,status:'soon',
  preview:'./assets/previews/calm-habit-tracker.svg',file_key:'calm-habit-tracker.pdf'});
 assert.ok(f.calls.some(([m,u])=>m==='PUT'&&u.endsWith('/contents/assets/previews/calm-habit-tracker.svg')));
 assert.ok(!f.calls.some(([m,u])=>m==='PUT'&&/\.pdf$/.test(u)&&u.includes('api.github.com')),'the PDF never goes to the public repo');
 const patch=JSON.parse(f.calls.find(([m,u])=>m==='PATCH')[2]);assert.equal(patch.status,'listing');assert.equal(patch.pr_number,7);
});
test('studio: merges only when the storefront tests passed on that commit; tells the owner',async()=>{
 const {createStudio}=await import('../supabase/functions/shop-studio/studio.mjs');
 const ok=studioFake({check:{status:'completed',conclusion:'success'}});
 assert.equal((await createStudio({environment:env,fetcher:ok.fetcher,PDFLib:fakePdf}).runOnce()).results[0].state,'listed');
 const merge=ok.calls.find(([m,u])=>m==='PUT'&&u.endsWith('/pulls/7/merge'));assert.equal(JSON.parse(merge[2]).sha,'b'.repeat(40));
 assert.match(ok.calls.find(([m,u])=>m==='POST'&&u.includes('agent_messages'))[2],/Ο James έβαλε νέο προϊόν στη βιτρίνα/);
 const bad=studioFake({check:{status:'completed',conclusion:'failure'}});
 assert.equal((await createStudio({environment:env,fetcher:bad.fetcher,PDFLib:fakePdf}).runOnce()).results[0].state,'failed');
 assert.ok(!bad.calls.some(([,u])=>u.endsWith('/merge')));
 const wait=studioFake({check:{status:'in_progress'}});
 assert.equal((await createStudio({environment:env,fetcher:wait.fetcher,PDFLib:fakePdf}).runOnce()).results[0].state,'waiting');
});
test('delivery: only Stripe-confirmed payments get a 1-hour personal link to the private file',async()=>{
 const {createDelivery}=await import('../supabase/functions/shop-delivery/delivery.mjs');
 const req=q=>new Request('https://x/functions/v1/shop-delivery'+q);
 const none=createDelivery({environment:k=>({SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40)})[k]});
 assert.equal((await none.handle(req('?session_id=cs_live_abcdefghijkl'))).status,503);
 assert.equal((await none.handle(req('?session_id=evil'))).status,400);
 const mk=paid=>createDelivery({environment:k=>({SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40),STRIPE_SECRET_KEY:'rk_live_abcdefghijkl'})[k],fetcher:async(url,o={})=>{
  const json=b=>({ok:true,status:200,json:async()=>b});
  if(url.startsWith('https://api.stripe.com/'))return json({payment_status:paid?'paid':'unpaid',status:paid?'complete':'open',
   line_items:{data:[{price:{product:{metadata:{paperworld_slug:'calm-habit-tracker'}}}}]}});
  if(url.includes('paperworld_shop_products_v1'))return json([{slug:'calm-habit-tracker',file_key:'calm-habit-tracker.pdf',spec:{title:'Calm Habit Tracker'}}]);
  if(url.includes('/object/sign/shop-files/calm-habit-tracker.pdf')){assert.equal(JSON.parse(o.body).expiresIn,3600);return json({signedURL:'/object/sign/shop-files/calm-habit-tracker.pdf?token=abc'})}
  return json({})}});
 assert.equal((await mk(false).handle(req('?session_id=cs_live_abcdefghijkl'))).status,402);
 const ok=await mk(true).handle(req('?session_id=cs_live_abcdefghijkl'));assert.equal(ok.status,200);
 const b=await ok.json();assert.match(b.url,/^https:\/\/jrevhzvrgenucuozjowm\.supabase\.co\/storage\/v1\/object\/sign\/shop-files\/calm-habit-tracker\.pdf\?token=abc&download=/);
 assert.equal(ok.headers.get('Access-Control-Allow-Origin'),'https://mr-tanq.github.io');
});
test('builder: owner-approved James ideas only; the spec must pass the template rules',async()=>{
 const {makeJamesShopBuilder}=require('../server/james-shop-builder.cjs');
 const PID='22222222-2222-4222-8222-222222222222';
 const mk=({idea={id:PID,title:'Calm habits',why:'w',task:'t',status:'accepted',director_id:'shop-director'},reply=JSON.stringify(SPEC),existing=[]}={})=>{
  const posts=[];const fetcher=async(url,o={})=>{const m=o.method||'GET';const json=b=>({ok:true,status:200,json:async()=>b});
   if(url.includes('paperworld_proposals_v1'))return json(idea?[idea]:[]);
   if(url.includes('proposal_id=eq.'))return json([]);
   if(url.includes('slug=like.'))return json(existing);
   if(m==='POST'){posts.push(JSON.parse(o.body));return json([{id:'r1'}])}
   return json([])};
  const clientFactory=async()=>({start:async()=>{},stop:async()=>{},listModels:async()=>[{id:'m',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1}}}],
   createSession:async()=>({sendAndWait:async()=>({data:{content:reply}}),disconnect:async()=>{}})});
  const api=makeJamesShopBuilder({fetcher,clientFactory,tokenFor:()=>'gho_x',secret:'x'.repeat(40),guard:{authenticate:async()=>({ownerId:OWNER})}});
  const call=body=>api.handle({headers:{origin:'https://mr-tanq.github.io',authorization:'Bearer '+'t'.repeat(20)},body:JSON.stringify(body)});
  return {call,posts};};
 const ok=mk({existing:[{slug:'calm-habit-tracker'}]});const r=await ok.call({proposalId:PID});
 assert.equal(r.status,201);assert.equal(r.body.slug,'calm-habit-tracker-2','slug kept unique');
 assert.equal(ok.posts[0].status,'spec');assert.equal(ok.posts[0].owner_id,OWNER);assert.equal(ok.posts[0].spec.template,'habit_tracker');
 assert.equal((await mk({idea:{id:PID,status:'accepted',director_id:'studio-director'}}).call({proposalId:PID})).body.error,'idea_not_approved');
 assert.equal((await mk({idea:{id:PID,status:'proposed',director_id:'shop-director'}}).call({proposalId:PID})).body.error,'idea_not_approved');
 assert.equal((await mk({reply:'{"template":"ebook"}'}).call({proposalId:PID})).body.error,'spec_invalid');
 assert.equal((await mk().call({proposalId:PID,x:1})).body.error,'invalid_request');
});
test('wiring: "Ναι" on a James idea builds it; SQL keeps files private and wakes the studio',()=>{
 const ws=fs.readFileSync('js/workspace.js','utf8');assert.match(ws,/p\.directorId==='shop-director'&&typeof cloud\(\)\.shopBuild==='function'/);
 assert.match(fs.readFileSync('js/cloud.js','utf8'),/MATT_ORIGIN\+'\/shop\/build'/);
 assert.match(fs.readFileSync('server/render-matt.cjs','utf8'),/if\(req\.url==='\/shop\/build'\)/);
 const sql=fs.readFileSync('sql/paperworld_shop_v1.sql','utf8');
 assert.match(sql,/insert into storage\.buckets\(id,name,public\) values\('shop-files','shop-files',false\)/);
 assert.match(sql,/for select to authenticated using \(owner_id = auth\.uid\(\)\)/);
 assert.match(sql,/cron\.schedule\('paperworld-shop-studio','\*\/15 \* \* \* \*'/);
 assert.match(sql,/status in \('spec','listing'\)\)\n then return '\{"state":"idle"\}'/);
});
