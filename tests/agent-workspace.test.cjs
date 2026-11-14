'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ROLES,makeEvidencePacket,formatDirectorEvidence,newJob,advanceJob}=require('../server/agent-workspace.cjs');
const source=(lines='L1 const ok = true;')=>({repository:'mr-tanq/concerts',ref:'main',readOnly:true,
 category:'ticketing',files:[{path:'js/ticketswap-check.js',sha:'a'.repeat(40),
 url:'https://github.com/mr-tanq/concerts/blob/main/js/ticketswap-check.js',lines}]});
test('three explicit roles form a controlled reporting chain',()=>{
 assert.equal(ROLES['listening-developer'].reportsTo,'listening-director');
 assert.equal(ROLES['listening-director'].reportsTo,'matt');
 assert.ok(ROLES['listening-developer'].cannot.includes('edit_repositories'));
});
test('source packet carries verifiable line content to reviewer',()=>{
 const packet=makeEvidencePacket(source());
 const review=formatDirectorEvidence(packet);
 assert.match(review,/js\/ticketswap-check\.js/);
 assert.match(review,/L1 const ok = true/);
 assert.match(review,/UNTRUSTED SOURCE DATA/);
 assert.equal(packet.files[0].sha,'a'.repeat(40));
});
test('source packet rejects unexpected origins and duplicates',()=>{
 assert.throws(()=>makeEvidencePacket({...source(),repository:'another/repo'}));
 const data=source();data.files=[data.files[0],data.files[0]];
 assert.throws(()=>makeEvidencePacket(data),/duplicate/);
});
test('source is bounded and transparently labeled if truncated',()=>{
 const packet=makeEvidencePacket(source('L1 '+('x'.repeat(1800))));
 const rendered=formatDirectorEvidence(packet,{maxChars:350});
 assert.match(rendered,/TRUNCATED/);
 assert.ok(rendered.length<500);
});
test('job history is immutable and cannot move backward',()=>{
 const job=newJob({id:'job-1',request:'Investigate ticket status'});
 const next=advanceJob(job,{state:'routed',actor:'matt',note:'Listening Mirror selected'});
 assert.equal(job.state,'created');
 assert.equal(next.state,'routed');
 assert.equal(next.events.length,2);
 assert.throws(()=>advanceJob(next,{state:'created',actor:'matt',note:'invalid'}));
 assert.throws(()=>advanceJob(next,{state:'scoped',actor:'unknown',note:'invalid'}));
});
test('real worker chain passes independently reviewable source excerpts to Director',()=>{
 const fs=require('node:fs');
 const code=fs.readFileSync(require('node:path').join(__dirname,'../server/matt-worker-delegation.cjs'),'utf8');
 assert.match(code,/makeEvidencePacket\(evidence\)/);
 assert.match(code,/formatDirectorEvidence\(verifiedPacket/);
 assert.match(code,/Verify each claimed line/);
});
