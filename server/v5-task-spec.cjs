/* Paperworld V5 reusable coding-task contract.
 * AI output is untrusted; only registry policies can grant project permissions.
 */
'use strict';
const REGISTRY=Object.freeze({
 listening:Object.freeze({director:'listening-director',repo:'mr-tanq/concerts',
  paths:Object.freeze(['js/','css/','tests/','workers/','server/'])}),
 pokemon:Object.freeze({director:'pokemon-director',repo:'mr-tanq/pokemon-echoes',
  paths:Object.freeze(['scripts/','scenes/','tests/'])})
});
const forbidden=['.github/','.paperworld/','node_modules/','addons/','assets/'];
function safePath(p){return typeof p==='string'&&p.length<160&&p.length>1&&
 !p.startsWith('/')&&!p.includes('\\')&&!p.split('/').includes('..')&&
 !p.split('/').includes('.')&&!p.includes('//')&&
 /^[A-Za-z0-9_./-]+$/.test(p)&&!forbidden.some(f=>p.startsWith(f))}
function normalizedSpec(input,{projectId,directorId}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_spec');
 const reg=Object.hasOwn(REGISTRY,projectId)?REGISTRY[projectId]:null;
 if(!reg||reg.director!==directorId)throw Error('project_director_mismatch');
 const fields=Object.keys(input).sort().join(',');
 if(fields!=='acceptance,allowedPaths,maxFiles,requiredTests,summary,title')
  throw Error('unexpected_spec_field');
 const short=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=n;
 if(!short(input.title,120)||!short(input.summary,800))throw Error('invalid_task_text');
 if(!Number.isInteger(input.maxFiles)||input.maxFiles<1||input.maxFiles>10)
  throw Error('unsafe_file_count');
 const stringList=(items,min,max,len)=>Array.isArray(items)&&items.length>=min&&
  items.length<=max&&items.every(x=>short(x,len))&&
  new Set(items).size===items.length;
 if(!stringList(input.acceptance,1,5,240)||!stringList(input.requiredTests,1,10,80)||
  !stringList(input.allowedPaths,1,8,160))throw Error('invalid_requirements');
 if(!input.requiredTests.every(s=>/^[a-zA-Z][a-zA-Z0-9_.-]{1,79}$/.test(s)))
  throw Error('unsafe_test_id');
 if(!input.allowedPaths.every(p=>safePath(p)&&
   reg.paths.some(root=>p.startsWith(root))))throw Error('path_outside_project_policy');
 return Object.freeze({projectId,directorId,repository:reg.repo,
  title:input.title.trim(),summary:input.summary.trim(),
  acceptance:Object.freeze(input.acceptance.map(x=>x.trim())),
  requiredTests:Object.freeze([...input.requiredTests]),
  allowedPaths:Object.freeze([...input.allowedPaths]),maxFiles:input.maxFiles,
  noAutoMerge:true,noAutoDeploy:true});
}
module.exports=Object.freeze({REGISTRY,normalizedSpec,safePath});
