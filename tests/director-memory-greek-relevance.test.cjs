'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {projectContext}=require('../server/director-memory-policy.cjs');
function entry(n,title,body){
 return {id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),
 projectId:'studio',kind:'preference',status:'approved',title,body,
 sourceType:'conversation',sourceRef:'synthetic-case',
 observedAt:'2026-11-16T09:00:00Z',version:1,sensitivity:'private'};
}
test('Greek questions retrieve accent-variant memories before irrelevant earlier entries',()=>{
 const rows=[entry(1,'Live audio','Drum and guitar details '.repeat(7)),
  entry(2,'Φυσιοθεραπείας οδηγίες','Αναλυτικές ασκήσεις γονάτου')];
 const relevant=rows.map(r=>({...r,projectId:'wellbeing'}));
 const result=projectContext(relevant,{actor:'wellbeing-director',projectId:'wellbeing',
  maxChars:256,query:'Τι έχουμε πει για ΦΥΣΙΟΘΕΡΑΠΕΙΑΣ μου;'});
 assert.match(result.text,/Φυσιοθεραπείας οδηγίες/);
 assert.doesNotMatch(result.text,/Live audio/);
});
test('Greek final sigma and common inflections are normalized during ranking',()=>{
 const rows=[entry(1,'Other musical note','Studio note '.repeat(10)),
 entry(2,'Ακουστικός δίσκος','Λεπτομέρειες μουσικής παραγωγής')];
 const result=projectContext(rows,{actor:'studio-director',projectId:'studio',
  maxChars:256,query:'ΑΚΟΥΣΤΙΚΟΣ ΔΙΣΚΟΣ'});
 assert.match(result.text,/Ακουστικός δίσκος/);
});
test('Greek unrelated questions do not grant any cross-project or unapproved memory',()=>{
 const rows=[{...entry(1,'Ιατρικό ιστορικό','Ιδιωτική θεραπεία'),
   projectId:'wellbeing'}];
 assert.throws(()=>projectContext(rows,{actor:'studio-director',
  projectId:'studio',query:'ιατρικο ιστορικο'}),/mixed_project_records_denied/);
 const draft=[{...entry(2,'Στίχοι Crow','Ανέκδοτη ιδέα'),status:'proposed'}];
 const result=projectContext(draft,{actor:'studio-director',projectId:'studio',
  query:'στιχοι Crow'});
 assert.equal(result.included,0);
});
