'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizedSpec,REGISTRY,safePath}=require('../server/v5-task-spec.cjs');
const good={title:'Tighten one recommendation filter',summary:'A bounded tested update',
 acceptance:['Support genre edge cases'],requiredTests:['recommendation-filter'],
 allowedPaths:['js/','tests/'],maxFiles:4};
test('one policy-defined contract for Joey and Luna, no model-selected repo',()=>{
 assert.equal(normalizedSpec(good,{projectId:'listening',directorId:'listening-director'}).repository,'mr-tanq/concerts');
 const p=normalizedSpec({...good,allowedPaths:['scripts/','tests/']},
  {projectId:'pokemon',directorId:'pokemon-director'});
 assert.equal(p.repository,'mr-tanq/pokemon-echoes');
 assert.equal(Object.keys(REGISTRY).length,2);
});
test('cross-project delegation and tampered model registry are refused',()=>{
 for(const attempted of [
  {...good,repository:'mr-tanq/pokemon-echoes'},
  {...good,projectId:'pokemon'},
  {...good,allowedPaths:['.github/workflows/']},
  {...good,allowedPaths:['tests/../../.github/']},
  {...good,allowedPaths:['assets/']},
  {...good,allowedPaths:['scripts/']},
  {...good,requiredTests:['run && rm -rf /']},
  {...good,maxFiles:11},
  {...good,acceptance:[]},
  {...good,title:''}
 ])assert.throws(()=>normalizedSpec(attempted,{
   projectId:'listening',directorId:'listening-director'
 }));
 assert.throws(()=>normalizedSpec(good,{projectId:'listening',directorId:'pokemon-director'}));
 assert.throws(()=>normalizedSpec(good,{projectId:'wellbeing',directorId:'wellbeing-director'}));
});
test('no absolute paths, traversal or CI/internal writable paths',()=>{
 for(const p of ['/tests/','tests/../.github/','tests//x','tests/./x',
  '.paperworld/project.json','.github/actions.yml','js/\\bad','assets/x'])
  assert.equal(safePath(p),false,p);
 assert.equal(safePath('js/recommendations.js'),true);
});
