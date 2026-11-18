/* Parse the ONE trusted attestation file from a GitHub Actions artifact ZIP.
 * Independent of the GitHub API. Rejects malformed/multi-file/zip-bomb data.
 */
const decoder=new TextDecoder('utf-8',{fatal:true});
const getU16=(dv,o)=>dv.getUint16(o,true);
const getU32=(dv,o)=>dv.getUint32(o,true);
async function extractTrustedJson(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.byteLength<22||bytes.byteLength>1048576)throw Error('artifact_size_denied');
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(getU32(dv,i)===0x06054b50){eocd=i;break}
 }
 if(eocd<0)throw Error('zip_directory_missing');
 const count=getU16(dv,eocd+10),directoryStart=getU32(dv,eocd+16);
 if(count!==1||directoryStart>=bytes.length)throw Error('artifact_file_count_denied');
 const off=directoryStart;
 if(off+46>bytes.length||getU32(dv,off)!==0x02014b50)
  throw Error('zip_directory_invalid');
 const flags=getU16(dv,off+8),method=getU16(dv,off+10),
  compressed=getU32(dv,off+20),uncompressed=getU32(dv,off+24),
  filenameLength=getU16(dv,off+28),extraLength=getU16(dv,off+30),
  localOffset=getU32(dv,off+42);
 const end=off+46+filenameLength+extraLength+getU16(dv,off+32);
 if(end>bytes.length)throw Error('zip_directory_bounds');
 const name=decoder.decode(bytes.subarray(off+46,off+46+filenameLength));
 if(name!=='paperworld-result.json'||(flags&1)!==0||!([0,8].includes(method))||
  compressed>512000||uncompressed>512000)
  throw Error('artifact_member_denied');
 if(localOffset+30>bytes.length||getU32(dv,localOffset)!==0x04034b50)
  throw Error('zip_local_header_invalid');
 const begin=localOffset+30+getU16(dv,localOffset+26)+getU16(dv,localOffset+28);
 if(begin+compressed>bytes.length)throw Error('zip_member_bounds');
 let output;
 const chunk=bytes.slice(begin,begin+compressed);
 if(method===0)output=chunk;
 else{
  const stream=new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  output=new Uint8Array(await new Response(stream).arrayBuffer());
 }
 if(output.length!==uncompressed||output.length>512000)
  throw Error('zip_member_size_mismatch');
 const result=JSON.parse(decoder.decode(output));
 if(!result||typeof result!=='object'||Array.isArray(result)||
  result.schema!=='paperworld-result-v1')throw Error('untrusted_result_schema');
 return result;
}
function validateAttestation(report,{projectId,headSha,missionId,requiredTests}){
 if(report.projectId!==projectId||report.commit_sha!==headSha||
  report.mission!==missionId||!Array.isArray(report.required_tests)||
  !Array.isArray(report.executed_tests)||!Array.isArray(requiredTests))
  throw Error('attestation_identity_mismatch');
 const expected=new Set(requiredTests);
 if(expected.size!==requiredTests.length||expected.size<1||expected.size>10||
    report.required_tests.length!==expected.size)
  throw Error('attestation_missing_test');
 const seen=new Set();
 for(const v of report.required_tests){
  if(!v||typeof v.id!=='string'||v.status!=='passed'||
    !expected.has(v.id)||seen.has(v.id)||!report.executed_tests.includes(v.id))
   throw Error('required_test_not_proven');
  seen.add(v.id);
 }
 return Object.freeze({verified:true,headSha,requiredTests:[...seen]});
}
export {extractTrustedJson,validateAttestation};
