/* Paperworld Task Engine v1 trusted project registry.
 * This file—not model output—defines repository, test and path authority.
 */
const REGISTRY=Object.freeze({
 listening:Object.freeze({
  repository:'mr-tanq/concerts',director:'listening-director',
  workflow:'paperworld-verify.yml',
  workflowBlob:'5ef7f441cd5d4efc71ab715d7616360d8f78d1b9',
  allowedPaths:Object.freeze(['js/','css/','scripts/','tests/','workers/','server/']),
  testIds:Object.freeze(['festival_revisit','festival_discovery','identity_profile','setlist_resolver']),
  maxFiles:10
 }),
 pokemon:Object.freeze({
  repository:'mr-tanq/pokemon-echoes',director:'pokemon-director',
  workflow:'paperworld-verify.yml',
  workflowBlob:'5ef7f441cd5d4efc71ab715d7616360d8f78d1b9',
  allowedPaths:Object.freeze(['scripts/','scenes/','tests/']),
  testIds:Object.freeze(['godot_smoke','battle_damage']),maxFiles:10
 })
});
function taskProject(id){if(!Object.hasOwn(REGISTRY,id))throw Error('project_not_enabled');return REGISTRY[id]}
function verifyBoundedSpec(spec,projectId){
 const p=taskProject(projectId);
 if(!spec||typeof spec!=='object'||Array.isArray(spec)||
  spec.projectId!==projectId||spec.directorId!==p.director||
  spec.repository!==p.repository||spec.noAutoMerge!==true||
  spec.noAutoDeploy!==true||!Number.isSafeInteger(spec.maxFiles)||
  spec.maxFiles<1||spec.maxFiles>p.maxFiles||
  !Array.isArray(spec.allowedPaths)||spec.allowedPaths.length<1||
  !Array.isArray(spec.requiredTests)||spec.requiredTests.length<1||
  spec.requiredTests.length>p.testIds.length||
  !spec.requiredTests.every(t=>p.testIds.includes(t))||
  !spec.allowedPaths.every(x=>p.allowedPaths.some(a=>x===a||x.startsWith(a))&&
   typeof x==='string'&&!x.includes('..')&&!x.includes('\\')))
   throw Error('untrusted_task_spec');
 return p;
}
export {REGISTRY,taskProject,verifyBoundedSpec};
