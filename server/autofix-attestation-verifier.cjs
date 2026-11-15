/* Auto Fix Phase 1E: signed sandbox attestation verifier, OFF until
 * an independent issuer, trusted key distribution and atomic nonce registry
 * are installed. No private signing key, model calls or GitHub writes.
 */
'use strict';
const {createPublicKey,verify:verifySignature}=require('node:crypto');
const REPO='mr-tanq/concerts';
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const B64=/^[A-Za-z0-9_-]{86}$/; // Ed25519 64 byte base64url signature.
const MAX_AGE_MS=5*60*1000;
function denied(code){const e=new Error(code);e.code=code;throw e}
function canonical(claim){
 // Fixed schema and key order, no attacker-controlled JSON canonicalization.
 const c=claim;
 return JSON.stringify({
  version:c.version,issuer:c.issuer,audience:c.audience,
  repository:c.repository,taskId:c.taskId,baseCommitSha:c.baseCommitSha,
  candidateDigest:c.candidateDigest,imageDigest:c.imageDigest,
  nonce:c.nonce,issuedAt:c.issuedAt,expiresAt:c.expiresAt,
  isolation:{network:c.isolation.network,secrets:c.isolation.secrets,
   credentialFree:c.isolation.credentialFree,stagingVerified:c.isolation.stagingVerified},
  checks:c.checks.map(v=>({id:v.id,ok:v.ok,exitCode:v.exitCode,
   cleanupVerified:v.cleanupVerified}))
 });
}
function validateClaim(c,expected,now){
 if(!c||typeof c!=='object'||Array.isArray(c)||c.version!==1||
   c.issuer!=='paperworld-dedicated-verifier'||
   c.audience!=='paperworld-autofix-draft-publisher'||
   c.repository!==REPO||c.repository!==expected.repository||
   !UUID.test(c.taskId||'')||c.taskId!==expected.taskId||
   !SHA.test(c.baseCommitSha||'')||c.baseCommitSha!==expected.baseCommitSha||
   !DIGEST.test(c.candidateDigest||'')||c.candidateDigest!==expected.candidateDigest||
   !DIGEST.test(c.imageDigest||'')||
   !UUID.test(c.nonce||'')||
   !Number.isSafeInteger(c.issuedAt)||!Number.isSafeInteger(c.expiresAt)||
   c.issuedAt>now+30000||c.issuedAt<now-MAX_AGE_MS||
   c.expiresAt<=now||c.expiresAt>c.issuedAt+MAX_AGE_MS)
  denied('attestation_scope_invalid');
 if(!c.isolation||c.isolation.network!=='disabled'||
   c.isolation.secrets!=='none'||c.isolation.credentialFree!==true||
   c.isolation.stagingVerified!==true)
  denied('attestation_isolation_unverified');
 if(!Array.isArray(c.checks)||c.checks.length<2||c.checks.length>4||
   !c.checks.some(x=>x.id==='regression'))
  denied('attestation_checks_missing');
 const seen=new Set();
 for(const check of c.checks){
  if(!check||typeof check.id!=='string'||
   !/^(?:regression|syntax:js\/(?:ticketswap-check|concert-ticketswap)\.js)$/.test(check.id)||
   seen.has(check.id)||check.ok!==true||check.exitCode!==0||
   check.cleanupVerified!==true)
   denied('attestation_check_failed');
  seen.add(check.id);
 }
 if(![...seen].some(id=>id.startsWith('syntax:')))denied('attestation_syntax_missing');
 return true;
}
function createAttestationVerifier({publicKeyPem,keyId,consumeNonce,clock=Date.now}={}){
 if(typeof publicKeyPem!=='string'||publicKeyPem.length>2000||
    typeof keyId!=='string'||!/^[a-z0-9-]{3,40}$/.test(keyId)||
    typeof consumeNonce!=='function'||typeof clock!=='function')
  denied('trusted_verifier_config_required');
 let key;
 try{key=createPublicKey(publicKeyPem)}catch(_){denied('invalid_verification_key')}
 if(key.asymmetricKeyType!=='ed25519')denied('unsupported_signature_algorithm');
 async function verifyAttestation({taskId,repository,baseCommitSha,
   candidateDigest,verification}={}){
  const e=verification?.signedAttestation;
  if(!e||typeof e!=='object'||e.keyId!==keyId||
   typeof e.signature!=='string'||!B64.test(e.signature)||
   !e.claim||typeof e.claim!=='object'||Array.isArray(e.claim))
   return false;
  const expected={taskId,repository,baseCommitSha,candidateDigest};
  try{
   validateClaim(e.claim,expected,clock());
   const sig=Buffer.from(e.signature,'base64url');
   if(sig.length!==64||!verifySignature(null,Buffer.from(canonical(e.claim)),
      key,sig))return false;
   // Atomic one-time consume must be handled by an independent persistent
   // datastore. An in-memory Set does not protect multiple Render instances.
   const consumed=await consumeNonce({nonce:e.claim.nonce,taskId,
    candidateDigest,expiresAt:e.claim.expiresAt,keyId});
   return consumed===true;
  }catch(_){return false}
 }
 return Object.freeze({verifyAttestation});
}
module.exports=Object.freeze({createAttestationVerifier,canonical,validateClaim});
