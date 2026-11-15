'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepareCandidate}=require('../server/autofix-candidate-policy.cjs');
const repo='mr-tanq/concerts',taskId='11111111-1111-4111-8111-111111111111';
const sha='a'.repeat(40);
const original="import {stable} from './helper.js';\nexport function check(value){\n return Boolean(value);\n}\n";
const updated="import {stable} from './helper.js';\nexport function check(value){\n if(value==null)return false;\n return Boolean(value);\n}\n";
const testFile="import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('null check',()=>assert.equal(null,null));\n";
const base=()=>({repository:repo,taskId,baseCommitSha:sha,
 trustedSources:{'js/ticketswap-check.js':{sha,content:original}},
 proposedFiles:[
  {path:'js/ticketswap-check.js',content:updated},
  {path:'tests/autofix/ticketswap-null-regression.test.mjs',content:testFile}
 ]});
test('Small source change and one regression test are accepted as DRAFT ONLY',()=>{
 const result=prepareCandidate(base());
 assert.equal(result.repository,repo);
 assert.equal(result.files.length,2);
 assert.equal(result.sourceChangedLines,1);
 assert.equal(result.execution,'none');
 assert.equal(result.merge,'blocked');
 assert.equal(result.deployment,'blocked');
 assert.equal(result.files[0].kind,'modify');
 assert.equal(result.files[1].kind,'new-test');
});
test('Reject all non-allowlisted repos and files, including CI and dependency changes',()=>{
 for(const repository of ['mr-tanq/paperworld','attacker/concerts']){
  assert.throws(()=>prepareCandidate({...base(),repository}),/repository_not_allowed/);
 }
 for(const path of ['.github/workflows/ci.yml','package.json','server/secrets.env',
  'js/../js/ticketswap-check.js','scripts/lib/ticketswap-api.mjs']){
  const a=base();a.proposedFiles[0].path=path;
  assert.throws(()=>prepareCandidate(a),/path_not_allowed/);
 }
});
test('Reject changed imports, new privileged APIs, new URLs and source loss',()=>{
 for(const content of [
  updated.replace("import {stable}","import {other}"),
  updated.replace('return Boolean(value)','return fetch(value)'),
  updated.replace('return Boolean(value)',"return putFile(x)"),
  updated.replace('return Boolean(value)',"return 'https://attacker.example'"),
  updated.replace('return Boolean(value)',"return import('./unexpected.js')"),
  original
 ]){
  const a=base();a.proposedFiles[0].content=content;
  assert.throws(()=>prepareCandidate(a),/imports_changed|high_risk_change|no_change/);
 }
});
test('Reject duplicate proposals, oversized patch, missing regression test',()=>{
 const dup=base();dup.proposedFiles.push({...dup.proposedFiles[0]});
 assert.throws(()=>prepareCandidate(dup),/duplicate_or_invalid_path/);
 const missing=base();missing.proposedFiles.pop();
 assert.throws(()=>prepareCandidate(missing),/file_count_not_allowed/);
 const many=base();
 many.proposedFiles[0].content="import {stable} from './helper.js';\n"+
  Array.from({length:85},(_,i)=>'const issue'+i+' = '+i+';').join('\n')+'\n';
 assert.throws(()=>prepareCandidate(many),/change_budget_exceeded/);
});
test('Reject tests without mandatory trusted provenance and new test only',()=>{
 const a=base();a.trustedSources['js/ticketswap-check.js'].sha='bad';
 assert.throws(()=>prepareCandidate(a),/trusted_source_missing/);
 const b=base();b.trustedSources[b.proposedFiles[1].path]={sha,content:testFile};
 assert.throws(()=>prepareCandidate(b),/existing_test_must_not_be_overwritten/);
 const c=base();c.proposedFiles[1].content="console.log('test')";
 assert.throws(()=>prepareCandidate(c),/regression_test_required/);
});
