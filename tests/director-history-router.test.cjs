'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const router=require('../js/director-history-router.js');
const parser=require('../js/director-history-import.js');
const ID='12345678-1234-4234-8234-123456789abc';
function conversation(title,query){
 return {id:ID,title,current_node:'b',create_time:1794800000,mapping:{
  a:{parent:null,message:null},
  b:{parent:'a',message:{author:{role:'user'},content:{parts:[query]}}}
 }};
}
test('suggests the correct Director for explicit unambiguous Greek and English projects',()=>{
 const cases=[
  ['Listening Mirror concerts','Θέλω setlist και festival', 'workshop'],
  ['Pokémon Echoes','Godot Alder Town Route 1', 'pokemon'],
  ['Golden Ray Suno','The Lost Wanderer μουσική ενορχήστρωση', 'studio'],
  ['Φυσιοθεραπεία μηνίσκου','Αυχένας και μέση, φυσιοθεραπεία', 'wellbeing']
 ];
 for(const [title,query,expected] of cases){
  const item=router.suggest([conversation(title,query)],parser)[0];
  assert.equal(item.projectId,expected,title);
  assert.equal(item.confidence,'suggested');
 }
});
test('mixed medical and song topics require explicit project assignment',()=>{
 const c=conversation('The Lost Wanderer Golden Ray Suno',
  'Φυσιοθεραπεία μηνίσκου, αυχένας, οσφυαλγία. Golden Ray Suno');
 const got=router.suggest([c],parser)[0];
 assert.equal(got.projectId,null);
 assert.equal(got.confidence,'needs_review');
});
test('generic chat, assistant speculation and unrelated private content never auto-route',()=>{
 const x=conversation('Καλημέρα','Τι κάνεις σήμερα;');
 x.mapping.a={parent:null,message:{author:{role:'assistant'},
  content:{parts:['The Lost Wanderer Suno Golden Ray']}}};
 const got=router.suggest([x],parser)[0];
 assert.equal(got.projectId,null);
});
test('Greek accents and suffixes remain detectable',()=>{
 const result=router.suggest([conversation('Πρόγραμμα φυσικοθεραπείας',
  'Έχω θέμα με τον μηνίσκο μου και τον αυχένα')],parser)[0];
 assert.equal(result.projectId,'wellbeing');
});
