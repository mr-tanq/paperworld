'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {deflateRawSync}=require('node:zlib');
let extractTrustedJson,validateAttestation;
test.before(async()=>({extractTrustedJson,validateAttestation}=
 await import('../supabase/functions/paperworld-task-dispatch/artifact.mjs')));
const ID='11111111-1111-4111-8111-111111111111',SHA='a'.repeat(40);
function zip(name,raw,{method=0}={}){
 const payload=Buffer.from(raw,'utf8');
 const compressed=method===8?deflateRawSync(payload):payload;
 const file=Buffer.from(name);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);
 local.writeUInt16LE(method,8);local.writeUInt32LE(compressed.length,18);
 local.writeUInt32LE(payload.length,22);local.writeUInt16LE(file.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);
 central.writeUInt16LE(method,10);central.writeUInt32LE(compressed.length,20);
 central.writeUInt32LE(payload.length,24);central.writeUInt16LE(file.length,28);
 const start=local.length+file.length+compressed.length;
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(central.length+file.length,12);end.writeUInt32LE(start,16);
 return Buffer.concat([local,file,compressed,central,file,end]);
}
const payload={schema:'paperworld-result-v1',projectId:'listening',
 commit_sha:SHA,mission:ID,required_tests:[{id:'festival_revisit',status:'passed'}],
 executed_tests:['festival_revisit']};
test('trusted single-file stored and deflated artifacts pass',async()=>{
 for(const method of [0,8]){
  const got=await extractTrustedJson(zip('paperworld-result.json',
   JSON.stringify(payload),{method}));
  assert.equal(validateAttestation(got,{projectId:'listening',headSha:SHA,
   missionId:ID,requiredTests:['festival_revisit']}).verified,true);
 }
});
test('a green run with a skipped or missing test never passes',async()=>{
 for(const value of [
  {...payload,required_tests:[{id:'festival_revisit',status:'skipped'}]},
  {...payload,executed_tests:[]},
  {...payload,commit_sha:'b'.repeat(40)},
  {...payload,mission:'22222222-2222-4222-8222-222222222222'}
 ]){
  const got=await extractTrustedJson(zip('paperworld-result.json',JSON.stringify(value)));
  assert.throws(()=>validateAttestation(got,{projectId:'listening',headSha:SHA,
   missionId:ID,requiredTests:['festival_revisit']}));
 }
});
test('zip traversal and unrelated files cannot be used as evidence',async()=>{
 await assert.rejects(extractTrustedJson(zip('../paperworld-result.json',JSON.stringify(payload))));
 await assert.rejects(extractTrustedJson(zip('workflow-report.txt',JSON.stringify(payload))));
 await assert.rejects(extractTrustedJson(Buffer.alloc(50)));
});
