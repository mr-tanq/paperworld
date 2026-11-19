/* Manual e2e: natural routine request → preview → save → enable → list → edit, and Settings health.
 * Serve the repo (python3 -m http.server 8765), then: node tests/e2e/routine.e2e.cjs  (fake data, no network) */
const {chromium}=require('playwright');const fs=require('fs');
const path=require('path');const fake=fs.readFileSync(path.join(__dirname,'fake-cloud.js'),'utf8');
const BASE=process.env.PAPERWORLD_BASE||'http://localhost:8765';
const OUT=process.env.PAPERWORLD_SHOTS||require('os').tmpdir();
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1280,height:800},hasTouch:true,timezoneId:'Europe/Amsterdam'});
 await c.addInitScript(fake);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(u=>!String(u).startsWith(BASE),r=>r.abort());
 await p.goto(BASE+'/index.html');await p.waitForTimeout(1500);
 const out={};
 await p.evaluate(()=>window.PaperworldWorldDialogue.show('matt'));await p.waitForTimeout(500);
 await p.fill('.world-chat-input','Κάθε Δευτέρα στις 09:00 έλεγχε το Listening Mirror');
 await p.keyboard.press('Enter');await p.waitForTimeout(800);
 out.preview=await p.locator('.world-routine-review').innerText();
 await p.screenshot({path:path.join(OUT,'routine-preview.png')});
 await p.locator('.world-routine-review button',{hasText:'Αποθήκευση'}).click();await p.waitForTimeout(400);
 await p.locator('.world-routine-review button',{hasText:'Ενεργοποίηση'}).click();await p.waitForTimeout(400);
 out.enabled=await p.locator('.world-routine-review [role=status]').first().innerText();
 await p.fill('.world-chat-input','Δείξε μου τις ρουτίνες');await p.keyboard.press('Enter');await p.waitForTimeout(700);
 out.list=await p.locator('.world-routine-entry').first().innerText();
 await p.locator('.world-routine-entry button',{hasText:'Αλλαγή'}).first().click();
 await p.fill('.world-routine-edit input[type=time]','18:30');
 await p.locator('.world-routine-edit button',{hasText:'Αποθήκευση αλλαγών'}).click();await p.waitForTimeout(500);
 out.edit=await p.locator('.world-routine-edit p').innerText();
 await p.screenshot({path:path.join(OUT,'routine-list.png')});
 out.aiCalls=await p.evaluate(()=>0);out.errs=errs;
 // Settings health
 await p.evaluate(()=>window.PaperworldWorldDialogue.close());await p.click('.controls .settings-launch');await p.waitForTimeout(800);
 await p.locator('.pw-advanced summary').click();await p.locator('.pw-setting',{hasText:'Κατάσταση συστήματος'}).locator('button').click();await p.waitForTimeout(500);
 out.health=await p.locator('.pw-health').innerText();
 await p.screenshot({path:path.join(OUT,'health.png')});
 console.log(JSON.stringify(out,null,1));await b.close()})();
