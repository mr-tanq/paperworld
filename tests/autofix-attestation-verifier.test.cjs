'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const {createAttestationVerifier,canonical}=require('../server/autofix-attestation-verifier.cjs');
const keys=generateKeyPairSync('ed25519');
const other=generateKeyPairSync('ed25519');
const pem=keys.publicKey.export({type:'spki',format:'pem'});
const taskId='11111111-1111-4111-8111-111111111111';
const baseCommitSha='a'.repeat(40),candidateDigest='b'.repeat(64);
const now=Date.parse('2026-11-15T00:00:00Z');
function claims(){
 return {version:1,issuer:'paperworld-dedicated-verifier',
  audience:'paperworld-autofix-draft-publisher',
  repository:'mr-tanq/concerts',taskId,baseCommitSha,candidateDigest,
  imageDigest:'c'.repeat(64),nonce:'22222222-2222-4222-8222-222222222222',
  issuedAt:now-10000,expiresAt:now+60000,
  isolation:{network:'disabled',secrets:'none',credentialFree:true,stagingVerified:true},
  checks:[
   {id:'syntax:js/ticketswap-check.js',ok:true,exitCode:0,cleanupVerified:true},
   {id:'regression',ok:true,exitCode:0,cleanupVerified:true}
  ]};
}
function envelope(claim=claims(),privateKey=keys.privateKey){
 return {keyId:'approved-test-key',claim,
  signature:sign(null,Buffer.from(canonical(claim)),privateKey).toString('base64url')};
}
function fixture({consume=true}={}){
 const consumed=new Set(),seen=[];
 const verifier=createAttestationVerifier({publicKeyPem:pem,keyId:'approved-test-key',
  clock:()=>now,
  consumeNonce:async args=>{
   seen.push(args);
   if(!consume||consumed.has(args.nonce))return false;
   consumed.add(args.nonce);return true;
  }});
 const input=(signedAttestation=envelope())=>({
  taskId,repository:'mr-tanq/concerts',baseCommitSha,candidateDigest,
  verification:{signedAttestation}
 });
 return {verifier,seen,input};
}
test('Verifies Ed25519 signature, exact task, SHA, sandbox checks and consumes nonce once',async()=>{
 const f=fixture();
 assert.equal(await f.verifier.verifyAttestation(f.input()),true);
 assert.equal(f.seen.length,1);
 assert.equal(f.seen[0].candidateDigest,candidateDigest);
 assert.equal(await f.verifier.verifyAttestation(f.input()),false);
 assert.equal(f.seen.length,2);
});
test('Rejects forged signature and tampered signed facts without nonce consumption',async()=>{
 for(const broken of [
  envelope(claims(),other.privateKey),
  (()=>{const e=envelope();e.claim.candidateDigest='f'.repeat(64);return e})(),
  (()=>{const e=envelope();e.claim.checks[1].ok=false;return e})(),
  (()=>{const e=envelope();e.claim.isolation.network='host';return e})(),
  {...envelope(),keyId:'unknown-key'},
  {...envelope(),signature:'not-a-signature'}
 ]){
  const f=fixture();
  assert.equal(await f.verifier.verifyAttestation(f.input(broken)),false);
  assert.equal(f.seen.length,0);
 }
});
test('Rejects expired, overly future, failed-check, missing-cleanup and incorrect audience claims',async()=>{
 const variations=[
  c=>{c.expiresAt=now-1},
  c=>{c.issuedAt=now+60000;c.expiresAt=now+65000},
  c=>{c.issuedAt=now-500000},
  c=>{c.audience='some-other-publisher'},
  c=>{c.isolation.secrets='mounted'},
  c=>{c.isolation.credentialFree=false},
  c=>{c.checks[0].exitCode=1},
  c=>{c.checks[0].cleanupVerified=false},
  c=>{c.checks=c.checks.slice(0,1)},
  c=>{c.checks[0].id='syntax:js/other.js'},
  c=>{c.checks.push({...c.checks[0]})}
 ];
 for(const modify of variations){
  const c=claims();modify(c);
  const f=fixture();
  assert.equal(await f.verifier.verifyAttestation(f.input(envelope(c))),false);
  assert.equal(f.seen.length,0);
 }
});
test('Signed claims bound to task, repository, content and owner request context',async()=>{
 for(const change of [
  {taskId:'33333333-3333-4333-8333-333333333333'},
  {candidateDigest:'d'.repeat(64)},
  {baseCommitSha:'d'.repeat(40)},
  {repository:'attacker/concerts'}
 ]){
  const f=fixture();
  assert.equal(await f.verifier.verifyAttestation({...f.input(),...change}),false);
  assert.equal(f.seen.length,0);
 }
});
test('Cannot start without trusted public key and durable atomic nonce adapter',()=>{
 assert.throws(()=>createAttestationVerifier({}),/trusted_verifier_config_required/);
 assert.throws(()=>createAttestationVerifier({publicKeyPem:pem,keyId:'approved-test-key'}),
  /trusted_verifier_config_required/);
 assert.throws(()=>createAttestationVerifier({publicKeyPem:'not a key',
  keyId:'approved-test-key',consumeNonce:async()=>true}),/invalid_verification_key/);
});
test('A nonce store denial fails closed rather than authorizing publishing',async()=>{
 const f=fixture({consume:false});
 assert.equal(await f.verifier.verifyAttestation(f.input()),false);
});
