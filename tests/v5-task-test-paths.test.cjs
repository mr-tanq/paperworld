'use strict';
// A Developer who adds a test next to the fix (concerts keeps tests in
// scripts/) must never be stopped as "out of scope" (live mission e8b68c56).
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizedSpec,withTestPaths}=require('../server/v5-task-spec.cjs');
const base={title:'t',summary:'s',acceptance:['a'],requiredTests:['festival_discovery'],maxFiles:4};
test('test folders are always allowed, within the 8-path limit',()=>{
 const s=normalizedSpec({...base,allowedPaths:['js/','tests/']},{projectId:'listening',directorId:'listening-director'});
 assert.deepEqual([...s.allowedPaths],['js/','tests/','scripts/']);
 const p=normalizedSpec({...base,requiredTests:['godot_smoke'],allowedPaths:['scenes/']},{projectId:'pokemon',directorId:'pokemon-director'});
 assert.deepEqual([...p.allowedPaths],['scenes/','tests/']);
 const many=['js/a','js/b','js/c','js/d','js/e','js/f','js/g','js/h'];
 const w=withTestPaths(many,['scripts/','tests/']);
 assert.equal(w.length,8);assert.ok(w.includes('scripts/')&&w.includes('tests/'));
});
