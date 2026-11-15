'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {projectContext}=require('../server/director-memory-policy.cjs');
function item(id,title,body,status='approved',sensitivity='standard'){
 return {id:'00000000-0000-4000-8000-'+String(id).padStart(12,'0'),projectId:'studio',
 kind:'preference',status,title,body,sourceType:'owner_note',
 sourceRef:'synthetic-test',observedAt:'2026-11-15T00:00:00Z',
 version:1,sensitivity};
}
test('relevant approved director note is preferred even when inserted last',()=>{
 const entries=[item(1,'Arrangement','Spare trumpet texture '.repeat(8)),
 item(2,'Voice rules','Avoid shouting on vulnerable acoustic songs')];
 const result=projectContext(entries,{actor:'studio-director',projectId:'studio',
  maxChars:256,query:'shouting acoustic voice'});
 assert.equal(result.included,1);
 assert.match(result.text,/Voice rules/);
});
test('unapproved information never enters relevant retrieval',()=>{
 const entries=[item(1,'Secret voice','Unapproved vocal proposal','proposed'),
 item(2,'Approved voice','Soft close vocal')];
 const result=projectContext(entries,{actor:'studio-director',projectId:'studio',
  query:'secret voice'});
 assert.doesNotMatch(result.text,/Secret voice/);
 assert.match(result.text,/Approved voice/);
});
test('cross-project records are rejected even if relevant',()=>{
 const entries=[{...item(1,'Acoustic','Private song'),projectId:'wellbeing'}];
 assert.throws(()=>projectContext(entries,{actor:'studio-director',projectId:'studio',query:'song'}),
 /mixed_project_records_denied/);
});
test('director can read private records in own project only',()=>{
 const result=projectContext([item(1,'Unreleased lyrics','Personal draft', 'approved','private')],
  {actor:'studio-director',projectId:'studio',query:'lyrics'});
 assert.match(result.text,/Personal draft/);
});
