'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {forDave,SOURCES}=require('../server/dave-coaching-guide.cjs');
const direct=fs.readFileSync('server/director-direct-chat.cjs','utf8');
const delegate=fs.readFileSync('server/matt-delegation.cjs','utf8');
test('Dave gets focused source-aware coaching covering gym, rehabilitation and nutrition',()=>{
 const s=forDave();
 assert.ok(s.length>3200&&s.length<9000);
 for(const item of ['ACSM','WHO','ISSN','ESSKA','NICE','knee','full-body','protein','300–500','1.4–2.0','physiotherapist','three sessions','nonconsecutive'])
  assert.ok(s.toLowerCase().includes(item.toLowerCase()),item);
 assert.ok(SOURCES.length>=6);
 for(const source of SOURCES)assert.match(source.url,/^https:\/\//);
});
test('the guide never turns Dave into a doctor, authorizes tools, or exposes private wellbeing history',()=>{
 const s=forDave();
 assert.match(s,/not a clinical diagnosis/);
 assert.match(s,/Never expose private Wellbeing facts/);
 assert.match(s,/If the physiotherapist gave exercises, preserve them/);
 assert.match(s,/Do NOT automatically prescribe high loads/);
 assert.match(s,/No diagnosis or surgery decisions/);
 assert.doesNotMatch(s,/owner_id|service_role|access.token/);
});
test('only Dave receives the guide in private one-to-one chat',()=>{
 assert.match(direct,/const \{forDave\}=require\('\.\/dave-coaching-guide\.cjs'\)/);
 assert.match(direct,/\(agentId==='wellbeing-director'\?forDave\(\):''\)/);
 assert.match(direct,/if\(!await identity\.ownsThread\(/);
});
test('Dave gets identical guide with explicit consent via Matt without cross-project memory sharing',()=>{
 assert.match(delegate,/\(route==='wellbeing-director'\?forDave\(\):''\)/);
 assert.match(delegate,/wellbeingConsent/);
 assert.match(delegate,/Treat all personal context as sensitive/);
});
