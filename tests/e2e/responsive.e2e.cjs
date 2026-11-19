/* Manual responsive check (portrait/landscape tablet, phones, desktop).
 * Serve the repo (python3 -m http.server 8765), then: node tests/e2e/responsive.e2e.cjs after
 * Uses tests/e2e/fake-cloud.js (fake data, no network). Prints camera state per viewport. */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-cloud.js'),'utf8');
const label=process.argv[2]||'run';const BASE=process.env.PAPERWORLD_BASE||'http://localhost:8765';
const OUT=process.env.PAPERWORLD_SHOTS||path.join(require('os').tmpdir(),'paperworld-responsive-shots');fs.mkdirSync(OUT,{recursive:true});
const V={'tablet-portrait':[800,1280,1.5,true],'tablet-landscape':[1280,800,1.5,true],'phone-portrait':[412,915,2,true],
 'phone-small':[360,740,2,true],'phone-landscape':[915,412,2,true],'desktop':[1440,900,1,false]};
(async()=>{const b=await chromium.launch();const out={};
 for(const [n,[w,h,dpr,touch]] of Object.entries(V)){
  const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,hasTouch:touch,isMobile:touch&&w<900});
  await c.addInitScript(fake);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route(u=>!String(u).startsWith(BASE),r=>r.abort());
  await p.goto(BASE+'/index.html');await p.waitForTimeout(1600);
  await p.screenshot({path:`${OUT}/${label}-${n}.png`});
  out[n]={errs,cam:await p.evaluate(()=>window.PaperworldWorld.camera?.())};
  if(label==='after'){
   await p.click('#world-work-panel');await p.waitForTimeout(900);
   await p.screenshot({path:`${OUT}/${label}-${n}-work.png`});
   out[n].camWork=await p.evaluate(()=>window.PaperworldWorld.camera());
   await p.keyboard.press('Escape');await p.waitForTimeout(300);
   await p.evaluate(()=>window.PaperworldWorldDialogue.show('studio-director'));await p.waitForTimeout(700);
   await p.screenshot({path:`${OUT}/${label}-${n}-chat.png`});
   await p.evaluate(()=>window.PaperworldWorldDialogue.close());await p.waitForTimeout(300);
   out[n].camAfterClose=await p.evaluate(()=>window.PaperworldWorld.camera());
  }
  await c.close();}
 // rotation behaviour: zoom in twice, pan, then rotate
 const c=await b.newContext({viewport:{width:1280,height:800},hasTouch:true});await c.addInitScript(fake);
 const p=await c.newPage();await p.route(u=>!String(u).startsWith(BASE),r=>r.abort());
 await p.goto(BASE+'/index.html');await p.waitForTimeout(1500);
 await p.click('#plus');await p.click('#plus');
 await p.screenshot({path:`${OUT}/${label}-rotate-1-zoomed-landscape.png`});
 await p.setViewportSize({width:800,height:1280});await p.waitForTimeout(600);
 await p.screenshot({path:`${OUT}/${label}-rotate-2-after-portrait.png`});
 await c.close();console.log(JSON.stringify(out));await b.close()})();
