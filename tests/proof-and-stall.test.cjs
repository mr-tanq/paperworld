'use strict';
// The village never looks busier than the system is; «Απόδειξη» counts only real records.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {statuses}=require('../js/resident-status.js');const P=require('../js/proof.js');
const NOW=Date.parse('2026-11-21T20:00:00Z'),ago=h=>new Date(NOW-h*3600e3).toISOString();
test('active work with no progress for 2 hours is shown as stuck, not busy',()=>{
 assert.equal(statuses([{projectId:'listening',status:'working',goal:'x',updatedAt:ago(1)}],NOW)['listening-director'].tone,'active');
 const s=statuses([{projectId:'listening',status:'working',goal:'x',updatedAt:ago(3)}],NOW)['listening-director'];
 assert.deepEqual({...s},{tone:'attention',text:'Κόλλησε: δεν προχωράει'});
});
test('proof: alone vs needed you, rate and median time from real records only',()=>{
 const m=(status,src,h,dur,extra={})=>({projectId:'listening',status,source:src,createdAt:ago(h),updatedAt:ago(h-dur/60),goal:'g',...extra});
 const sum=P.summary([m('completed','initiative',5,30,{report:{merged:true,title:'Enrich'}}),m('completed','owner',10,50,{report:{merged:true}}),
  m('needs_you','owner',20,10),m('working','owner',1,5),{...m('completed','owner',5,5,{report:{merged:true}}),simulation:true},
  {...m('completed','owner',24*40,5,{report:{merged:true}})}],NOW);
 assert.equal(sum.alone,2);assert.equal(sum.neededYou,1);assert.equal(sum.running,1);assert.equal(sum.rate,67);
 assert.equal(sum.initiatives,1);assert.equal(sum.medianMinutes,50);assert.equal(sum.recent[0].source,'Πρωτοβουλία');
});
test('wiring: settings shows the proof; the server says who started each task',()=>{
 assert.match(fs.readFileSync('js/workspace.js','utf8'),/el\('summary','','Απόδειξη αυτονομίας'/);
 assert.match(fs.readFileSync('server/v5-autonomous-mission-api.cjs','utf8'),/source:r\.policy\?\.initiative===true\?'initiative'/);
 assert.match(fs.readFileSync('index.html','utf8'),/proof\.js\?v=3-checks/);
});
