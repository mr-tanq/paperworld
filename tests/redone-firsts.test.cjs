'use strict';
// A first try that the team redid (automatic retry or the owner's one-tap
// redo) never shows as "needs you" anywhere: Work, Matt's banner, the village.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../js/village-activity.js'),R=require('../js/resident-status.js'),P=require('../js/proof.js');
const now=Date.parse('2026-11-25T12:00:00Z'),at='2026-11-25T10:00:00Z';
const rows=[
 {id:'a',projectId:'pokemon',status:'needs_you',lastError:'agent_files_out_of_scope',goal:'Starter',updatedAt:at,createdAt:at},
 {id:'b',projectId:'pokemon',status:'completed',retryOf:'a',report:{merged:true,headStillCurrent:true,title:'Starter'},goal:'Starter',updatedAt:at,createdAt:at},
 {id:'c',projectId:'listening',status:'needs_you',lastError:'trusted_verification_failed',goal:'Συναυλίες',updatedAt:at,createdAt:at},
 {id:'d',projectId:'listening',status:'working',redoOf:'c',goal:'Συναυλίες',updatedAt:at,createdAt:at}];
test('Work and Matt: redone first tries are not "needs you"',()=>{
 const s=A.summary(rows,{now});
 assert.equal(s.attention,0);assert.deepEqual(s.items.map(i=>i.id).sort(),['b','d']);
});
test('village and proof agree',()=>{
 const v=R.statuses(rows,now);
 assert.notEqual(v['pokemon-director'].tone,'attention');assert.notEqual(v['listening-director'].tone,'attention');
 assert.equal(P.summary(rows,now).neededYou,0);
 assert.match(fs.readFileSync('server/v5-autonomous-mission-api.cjs','utf8'),/redoOf:UUID\.test\(r\.policy\?\.redoOf\|\|''\)\?r\.policy\.redoOf:null/);
});
