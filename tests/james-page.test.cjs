'use strict';
// The owner sees James's work without asking: his products with their stage
// and his daily research journal (Work → Digital Shop), and his week on Sunday.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Sunday meeting: James\'s days of research, best finding and new products',async()=>{
 const {jamesWeek,weekly}=await import('../supabase/functions/paperworld-watch/index.mjs');
 const line=jamesWeek([{note:{niche:'Students'},confidence:3},{note:{niche:'Nurses 2027'},confidence:5}],[{status:'listed'},{status:'spec'}]);
 assert.equal(line,'James: 2 μέρες έρευνας, καλύτερο εύρημα «Nurses 2027» (5/5), 1 νέο προϊόν στη βιτρίνα.');
 assert.equal(jamesWeek([],[]),'');
 assert.match(weekly([],0,line).text,/James: 2 μέρες έρευνας/);
 const src=fs.readFileSync('supabase/functions/paperworld-watch/index.mjs','utf8');
 assert.match(src,/paperworld_shop_research_v1\?select=note,confidence&owner_id=eq\.'\+ctx\.owner_id/);
});
test('Work → Digital Shop: products with their stage and the research journal (owner rows only)',()=>{
 const cloud=fs.readFileSync('js/cloud.js','utf8'),ws=fs.readFileSync('js/workspace.js','utf8');
 assert.match(cloud,/async function listShopResearch\(\)/);assert.match(cloud,/paperworld_shop_research_v1\?select=day,note,confidence&order=day\.desc&limit=7/);
 assert.match(cloud,/async function listShopProducts\(\)/);
 assert.match(ws,/if\(p\.id==='shop'\)body\.append\(\.\.\.shopSections\(\)\)/);
 assert.match(ws,/listed:'Στη βιτρίνα · Coming soon'/);assert.match(ws,/'Ημερολόγιο έρευνας'/);
 assert.match(ws,/const can=typeof ui\?\.listShopResearch==='function';/,'older servers show empty sections, never an endless spinner');
 assert.doesNotMatch(ws.slice(ws.indexOf('function shopSections')),/innerHTML/);
});
