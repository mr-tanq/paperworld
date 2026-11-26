'use strict';
// Living village v3: continuous strolls, talking poses, consult letters and
// small ambient life — all visual, all bounded, never tied to execution.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const nav=require('../js/navigation.js'),life=require('../js/village-life.js');
const ambience=require('../js/village-ambience.js');
const home=[['listening-director',1110,558],['pokemon-director',385,665],
 ['wellbeing-director',1238,640],['studio-director',822,861]];
const rng=(seed=7)=>()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
test('residents stroll most of the time instead of step-and-stop, and never drift away',()=>{
 const people=home.map(([id,x,y])=>({id,x,y,direction:'down'})),v=life.create(nav,people,rng());
 let moving=0,total=0,maxAway=0;
 for(let i=0;i<12000;i++){v.tick(.05);people.forEach((a,j)=>{total++;if(a.moving)moving++;
  maxAway=Math.max(maxAway,Math.hypot(a.x-home[j][1],a.y-home[j][2]))})}
 assert.ok(moving/total>0.55,'walking share '+(moving/total).toFixed(2));
 assert.ok(maxAway<700,'stays in the neighbourhood: '+Math.round(maxAway));
});
test('a resident in conversation stops and faces the owner; release lets them stroll again',()=>{
 const people=home.map(([id,x,y])=>({id,x,y,direction:'down'})),v=life.create(nav,people,rng(3));
 for(let i=0;i<200;i++)v.tick(.05);
 const luna=people[0],owner={x:luna.x-60,y:luna.y};
 assert.equal(v.hold('listening-director',()=>owner),true);
 const at=[luna.x,luna.y];
 for(let i=0;i<400;i++)v.tick(.05);
 assert.deepEqual([luna.x,luna.y],at,'stays put while talking');
 assert.equal(luna.direction,'left','faces the owner');
 assert.equal(v.release('listening-director'),true);
 let moved=false;for(let i=0;i<800&&!moved;i++){v.tick(.05);moved=luna.x!==at[0]||luna.y!==at[1]}
 assert.ok(moved,'strolls again after the chat');
});
test('ambience: smoke from every chimney, bounded particles, nothing with reduced motion',()=>{
 const img={naturalWidth:1000,naturalHeight:750};
 const defs=['town','workshop','pokemon','wellbeing','studio'].map((id,i)=>({id,ready:true,image:img,x:300+i*250,bottom:500,width:300}));
 const a=ambience.create({defs,W:1671,H:941,random:rng(5)});
 assert.equal(a.chimneyPoints().length,6);
 for(let t=0;t<60000;t+=50)a.step(t);
 const c=a.counts();
 assert.ok(c.smoke>0&&c.smoke<=ambience.MAX_SMOKE,'smoke '+c.smoke);
 assert.equal(c.butterflies,5);
 const calm=ambience.create({defs,W:1671,H:941,random:rng(5),reducedMotion:true});
 for(let t=0;t<20000;t+=50)calm.step(t);
 assert.equal(calm.counts().smoke,0,'reduced motion: no particles');
 assert.equal(a.evening(new Date('2026-11-20T19:00:00')),true);assert.equal(a.evening(new Date('2026-11-20T12:00:00')),false);
 const src=fs.readFileSync('js/village-ambience.js','utf8');
 assert.doesNotMatch(src,/fetch\(|localStorage|delegate|askMatt/);
});
test('renderer wires talking poses, speech, consult letters and ambience',()=>{
 const app=fs.readFileSync('js/app.js','utf8');
 assert.match(app,/setConversation:\(next\)=>/);assert.match(app,/showConsult:\(fromId,toId\)=>/);
 assert.match(app,/agentJourney\.mode='approach-chat'/);assert.match(app,/agentJourney\.mode='chatting'/);
 assert.match(app,/villageLife\.hold\?\.\(id,\(\)=>state\.walker\)/);
 assert.match(app,/ambience\?\.draw\(ctx,now,previewLight\)/);
 assert.match(app,/'wellbeing-director','shop-director','markets-director'\]\.includes\(a\.id\)\);\n \/\/ A chat pose gives way to a real handoff/);
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/world\(\)\?\.setConversation\?\.\(\{with:id,speaking:null\}\)/);
 assert.match(ui,/world\(\)\?\.setConversation\?\.\(null\)/);
 assert.match(ui,/event\.stage==='consulted'/);assert.match(ui,/showConsult\?\.\(event\.consultedId,event\.directorId\)/);
 assert.match(ui,/'listening-director':'τη Luna'/);assert.doesNotMatch(ui,/επέστρεψε από τον '\+who/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('village-ambience.js')<html.indexOf('js/app.js'));
});
test('server streams a consult stage only between two different team Directors',()=>{
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 assert.match(server,/\['routed','director_reported','consulted'\]\.includes\(event\.stage\)/);
 assert.match(server,/event\.consultedId===event\.directorId/);
 assert.doesNotMatch(server.slice(server.indexOf("const team=")),/wellbeing-director/);
});
