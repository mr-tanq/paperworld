/* Manual end-to-end check of Workspace V2 on phone, 1280x800 tablet and desktop.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/e2e/workspace.e2e.cjs
 * Uses tests/e2e/fake-cloud.js (fake data, no network). Not part of npm test. */
const {chromium,devices}=require('playwright');const fs=require('fs');
const path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-cloud.js'),'utf8');
const BASE=process.env.PAPERWORLD_BASE||'http://localhost:8765';
const OUT=process.env.PAPERWORLD_SHOTS||path.join(require('os').tmpdir(),'paperworld-workspace-shots');fs.mkdirSync(OUT,{recursive:true});
const only=process.argv[2];
(async()=>{const b=await chromium.launch();const out={};
 const sizes={phone:{...devices['Pixel 7']},tablet:{viewport:{width:1280,height:800},deviceScaleFactor:1,hasTouch:true},desktop:{viewport:{width:1440,height:900},deviceScaleFactor:1}};
 for(const [n,o] of Object.entries(sizes)){ if(only&&only!==n)continue;
  const c=await b.newContext(o);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await c.addInitScript(fake);await p.route(u=>!String(u).startsWith(BASE),r=>r.abort());
  await p.goto(BASE+'/index.html');await p.waitForTimeout(1500);
  const r=out[n]={};const shot=s=>p.screenshot({path:path.join(OUT,`${n}-${s}.png`)});
  const vp=p.viewportSize();
  const inView=async sel=>{const bb=await p.locator(sel).first().boundingBox();return !!bb&&bb.x>=0&&bb.y>=0&&bb.x+bb.width<=vp.width+1&&bb.y+bb.height<=vp.height+1};
  r.controls={team:await p.locator('.controls .team-launch').isVisible(),work:await p.locator('#world-work-panel').isVisible(),settings:await p.locator('.controls .settings-launch').isVisible()};
  // WORK
  await p.locator('#world-work-panel').click();await p.waitForTimeout(900);
  r.workTitle=await p.locator('#pw-ws-title').innerText();
  r.heroTitle=await p.locator('.pw-hero-title').innerText();
  r.stats=await p.locator('.pw-stat').allInnerTexts();
  r.decisionCards=await p.locator('.pw-decisions .human-hub-item').count();
  r.decisionButtons=await p.locator('.pw-decisions .human-hub-item-actions button').allInnerTexts();
  r.attentionItems=await p.locator('#pw-sec-attention .pw-item').count();
  r.activeItems=await p.locator('#pw-sec-active .pw-item-title').allInnerTexts();
  r.doneLinks=await p.locator('#pw-sec-done a.pw-link').evaluateAll(a=>a.map(x=>x.href));
  r.drawerHidden=await p.locator('#world-drawer').isHidden();
  r.tabsInView=await inView('.pw-ws-tabs');
  await shot('work');
  // Decision flow: confirm dialog appears and can be dismissed (no action).
  let dialog=null;p.once('dialog',d=>{dialog=d.message().slice(0,60);d.dismiss()});
  await p.locator('.pw-decisions .human-hub-yes').first().click();await p.waitForTimeout(600);
  r.decisionConfirm=dialog;
  // Project detail
  await p.locator('.pw-project-tile[data-project="studio"]').click();await p.waitForTimeout(500);
  r.projectTitle=await p.locator('#pw-ws-title').innerText();
  r.backVisible=await p.locator('.pw-ws-back').isVisible();
  await p.locator('.pw-note-form input').fill('Νέα ιδέα για ρεφρέν');await p.locator('.pw-note-form button').click();await p.waitForTimeout(700);
  r.notes=await p.locator('.pw-note-title').allInnerTexts();
  const st=p.locator('.pw-note').filter({hasText:'Νέα ιδέα'}).locator('.pw-note-status');
  await st.click();await p.waitForTimeout(700);
  r.noteStatusAfterTap=await p.locator('.pw-note').filter({hasText:'Νέα ιδέα'}).locator('.pw-note-status').innerText();
  await shot('project');
  await p.locator('.pw-ws-back').click();await p.waitForTimeout(300);
  r.backToOverview=await p.locator('#pw-ws-title').innerText();
  // Ask the team → Matt with draft, not sent
  await p.locator('.pw-ask textarea').fill('Θέλω νέο τραγούδι για το φθινόπωρο');
  await p.locator('.pw-ask button').click();await p.waitForTimeout(700);
  r.askOpensMatt=await p.locator('.pw-messenger .world-chat-identity strong').innerText();
  r.draftPrefilled=await p.locator('.world-chat-input').inputValue();
  r.workspaceHiddenDuringChat=await p.locator('.pw-workspace').isHidden();
  await p.locator('.world-chat-close').click();await p.waitForTimeout(500);
  r.returnsToWork=await p.locator('.pw-workspace').isVisible()&&await p.locator('#pw-ws-title').innerText();
  // TEAM
  await p.locator('#pw-ws-tab-team').click();await p.waitForTimeout(500);
  r.teamCards=await p.locator('.pw-agent-card .pw-agent-name').allInnerTexts();
  r.activity=await p.locator('.pw-agent-card .pw-agent-activity').allInnerTexts();
  r.workers=await p.locator('.pw-worker strong').allInnerTexts();
  r.workerStatus=await p.locator('.pw-worker .pw-agent-activity').allInnerTexts();
  await shot('team');
  await p.locator('.pw-agent-card[data-agent="studio-director"] .pw-btn-primary').click();await p.waitForTimeout(600);
  r.teamChat=await p.locator('.pw-messenger .world-chat-identity strong').innerText();
  await p.keyboard.press('Escape');await p.waitForTimeout(500);
  r.returnsToTeam=await p.locator('.pw-workspace').isVisible()&&await p.locator('#pw-ws-title').innerText();
  // worker → responsible director
  await p.locator('.pw-worker').first().locator('.pw-chip').click();await p.waitForTimeout(500);
  r.workerRoutesTo=await p.locator('.pw-messenger .world-chat-identity strong').innerText();
  await p.locator('.world-chat-close').click();await p.waitForTimeout(500);
  // locate
  r.locate=await p.evaluate(()=>window.PaperworldWorld.focusAgent('studio-director',{panelWidth:600}));
  // SETTINGS
  await p.locator('#pw-ws-tab-settings').click();await p.waitForTimeout(800);
  r.settings=await p.locator('.pw-setting-text strong').allInnerTexts();
  await shot('settings');
  await p.locator('.pw-switch').click();
  r.reduceMotion=await p.evaluate(()=>document.documentElement.classList.contains('pw-reduce-motion'));
  await p.locator('.pw-switch').click();
  // keyboard: arrows across tabs; Esc closes
  await p.locator('#pw-ws-tab-settings').focus();await p.keyboard.press('ArrowLeft');
  r.arrowTab=await p.evaluate(()=>document.activeElement.id);
  await p.keyboard.press('Escape');await p.waitForTimeout(300);
  r.escCloses=await p.locator('.pw-workspace').isHidden();
  // M while workspace open → messenger wins
  await p.locator('.controls .team-launch').click({force:true});await p.waitForTimeout(400);
  await shot('team-open');
  await p.keyboard.press('Escape');
  r.errors=errs.slice(0,5);await c.close()}
 console.log(JSON.stringify(out,null,1));await b.close()})();
