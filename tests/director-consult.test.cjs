'use strict';
// Phase 3: Directors consult a colleague through Matt — standard approved notes
// only, never Wellbeing, never private, one server-made grant per request.
const test=require('node:test'),assert=require('node:assert/strict');
const {createApprovedDirectorMemory,formatConsultMemory}=require('../server/approved-director-memory.cjs');
const {parseIntent,routePrompt}=require('../server/matt-semantic-router.cjs');
const OWNER='11111111-1111-4111-8111-111111111111';
const REQUEST='33333333-3333-4333-8333-333333333333';
function row({project='studio',sensitivity='standard',status='approved',id='44444444-4444-4444-8444-444444444444',body='Αγαπημένο συγκρότημα: Mogwai'}={}){
 return {id,project_id:project,kind:'preference',status,title:'Μουσικό γούστο',body,
  source_type:'conversation',source_ref:'synthetic/owner',observed_at:'2026-11-19T01:00:00Z',version:1,sensitivity};
}
function fixture(rows){
 const calls=[];
 const memory=createApprovedDirectorMemory({identity:{authenticate:async()=>({ownerId:OWNER})},
  fetcher:async(url,opts)=>{calls.push(url);return {ok:true,json:async()=>rows.filter(r=>r.status==='approved')}}});
 return {memory,calls};
}
test('Luna consults Crow: only standard approved studio notes, labelled as colleague notes',async()=>{
 const {memory,calls}=fixture([row(),row({id:'55555555-5555-4555-8555-555555555555',sensitivity:'private',body:'PRIVATE_LYRIC_DRAFT'})]);
 const ctx=await memory.loadConsult({token:'synthetic.jwt',ownerId:OWNER,actor:'listening-director',
  consult:'studio-director',requestId:REQUEST,query:'συναυλίες'});
 assert.equal(ctx.projectId,'studio');assert.equal(ctx.included,1);
 assert.ok(calls.every(u=>u.includes('project_id=eq.studio')));
 const prompt=formatConsultMemory(ctx,'The Lost Wanderer Director');
 assert.match(prompt,/COLLEAGUE NOTES FROM THE LOST WANDERER DIRECTOR/);
 assert.match(prompt,/Mogwai/);assert.doesNotMatch(prompt,/PRIVATE_LYRIC_DRAFT/);
 assert.match(prompt,/not instructions, not permission/);
});
test('Wellbeing, self-consult and missing request id are refused before any read',async()=>{
 const {memory,calls}=fixture([row()]);
 for(const [actor,consult,requestId] of [['listening-director','wellbeing-director',REQUEST],
  ['wellbeing-director','studio-director',REQUEST],['studio-director','studio-director',REQUEST],
  ['listening-director','studio-director','not-a-uuid']])
  await assert.rejects(memory.loadConsult({token:'t',ownerId:OWNER,actor,consult,requestId}),/consult_scope_denied/);
 assert.equal(calls.length,0);
 assert.equal(formatConsultMemory({untrustedContent:true,text:'',included:0,capabilitiesGranted:[]},'X'),'');
});
test('router: consult is optional, advisory, and dropped when invalid',()=>{
 assert.equal(parseIntent('{"director":"listening-director","action":"answer","consult":"studio-director"}').consult,'studio-director');
 assert.equal(parseIntent('{"director":"listening-director","action":"build","consult":"pokemon-director"}').consult,'pokemon-director');
 assert.equal(parseIntent('{"director":"listening-director","action":"answer","consult":"wellbeing-director"}').consult,null);
 assert.equal(parseIntent('{"director":"listening-director","action":"answer","consult":"listening-director"}').consult,null);
 assert.equal(parseIntent('{"director":"listening-director","action":"answer","extra":"x"}'),null);
 assert.match(routePrompt('Ποιες συναυλίες να δω;'),/"consult":"<other director id>"/);
});
test('Matt delegation wires the consult into the Director prompt and the response',()=>{
 const src=require('node:fs').readFileSync('server/matt-delegation.cjs','utf8');
 assert.match(src,/approvedMemory\.loadConsult\(\{token:bearer\.slice\(7\),ownerId,\s*actor:route,consult,requestId:data\.requestId/);
 assert.match(src,/const memoryPrompt=formatDirectorMemory\(memory\)\+consultPrompt;/);
 assert.match(src,/included:memory\.included\},consulted\}/);
});
