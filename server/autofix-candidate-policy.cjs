/* PAPERWORLD Auto Fix phase 1: conservative, pure, fail-closed patch gate.
 * No GitHub writes, model calls, code execution, deployments or credentials.
 * Source snapshots must come from a trusted repository reader, not the model.
 */
'use strict';
const REPOSITORY='mr-tanq/concerts';
const SOURCE_FILES=Object.freeze([
 'js/ticketswap-check.js',
 'js/concert-ticketswap.js'
]);
const TEST_FILE=/^tests\/autofix\/ticketswap-[a-z0-9-]{1,40}\.test\.mjs$/;
const SHA=/^[a-f0-9]{40}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const MAX_FILES=3,MAX_CHANGED_LINES=80,MAX_BYTES=20000,MAX_TEST_BYTES=8000;
const FORBIDDEN_ADDITIONS=/\b(?:eval|Function|XMLHttpRequest|WebSocket|fetch|sendBeacon|localStorage|sessionStorage|require|process|child_process|exec|spawn|Deno|Bun|document\.cookie|navigator\.credentials)\b|\bimport\s*\(|\b(?:putFile|getGithubConfig)\s*\(|(?:https?:\/\/|github\.com|api\.github\.com)|(?:\.\.\/|\.\.\\)/i;
function deny(code){const e=new Error(code);e.code=code;throw e}
function validContent(value,max){
 return typeof value==='string'&&Buffer.byteLength(value,'utf8')<=max&&
  !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)&&!value.includes('\r');
}
function importHeader(source){
 // Both approved source files start with static imports, including multiline imports.
 const match=source.match(/^(?:\s*import\s[\s\S]*?;\s*)+/);
 return match?match[0]:null;
}
function lineDifference(original,next){
 const a=original.split('\n'),b=next.split('\n');
 // Strict upper bound to prevent expensive model-supplied input.
 if(a.length>700||b.length>700)deny('candidate_too_large');
 const cols=b.length+1,dp=new Uint16Array((a.length+1)*cols);
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--){
  const index=i*cols+j;
  dp[index]=a[i]===b[j]?1+dp[(i+1)*cols+j+1]:
   Math.max(dp[(i+1)*cols+j],dp[i*cols+j+1]);
 }
 const additions=[],deletions=[];let i=0,j=0;
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){i++;j++;continue}
  if(j<b.length&&(i===a.length||dp[i*cols+j+1]>=dp[(i+1)*cols+j])){
   additions.push(b[j++]);continue;
  }
  deletions.push(a[i++]);
 }
 return {added:additions.length,removed:deletions.length,addedLines:additions};
}
function prepareCandidate({repository,taskId,baseCommitSha,trustedSources,proposedFiles}={}){
 if(repository!==REPOSITORY)deny('repository_not_allowed');
 if(!UUID.test(taskId||'')||!SHA.test(baseCommitSha||''))deny('invalid_task_or_base');
 if(!trustedSources||typeof trustedSources!=='object'||Array.isArray(trustedSources))
  deny('trusted_sources_required');
 if(!Array.isArray(proposedFiles)||proposedFiles.length<2||proposedFiles.length>MAX_FILES)
  deny('file_count_not_allowed');
 const seen=new Set(),entries=[];let changeCount=0,sourceCount=0,testCount=0;
 for(const proposal of proposedFiles){
  if(!proposal||typeof proposal.path!=='string'||seen.has(proposal.path))
   deny('duplicate_or_invalid_path');
  seen.add(proposal.path);
  const source=SOURCE_FILES.includes(proposal.path),test=TEST_FILE.test(proposal.path);
  if(!source&&!test)deny('path_not_allowed');
  if(!validContent(proposal.content,source?MAX_BYTES:MAX_TEST_BYTES))
   deny('candidate_content_invalid');
  if(source){
   sourceCount++;
   const trusted=Object.prototype.hasOwnProperty.call(trustedSources,proposal.path)?
    trustedSources[proposal.path]:null;
   if(!trusted||!SHA.test(trusted.sha||'')||
      !validContent(trusted.content,MAX_BYTES))deny('trusted_source_missing');
   if(proposal.content===trusted.content)deny('no_change');
   if(!importHeader(trusted.content)||
      importHeader(trusted.content)!==importHeader(proposal.content))
    deny('imports_changed');
   const diff=lineDifference(trusted.content,proposal.content);
   changeCount+=diff.added+diff.removed;
   if(changeCount>MAX_CHANGED_LINES)deny('change_budget_exceeded');
   if(diff.addedLines.some(line=>FORBIDDEN_ADDITIONS.test(line)))
    deny('high_risk_change');
   entries.push(Object.freeze({path:proposal.path,kind:'modify',baseSha:trusted.sha,
    content:proposal.content,added:diff.added,removed:diff.removed}));
  }else{
   testCount++;
   if(Object.prototype.hasOwnProperty.call(trustedSources,proposal.path))
    deny('existing_test_must_not_be_overwritten');
   if(!proposal.content.includes("node:test")||
      !proposal.content.includes("node:assert"))
    deny('regression_test_required');
   // A model-generated test is UNTRUSTED executable code. This gate only
   // stages it; do not run outside a no-secrets, no-network sandbox.
   entries.push(Object.freeze({path:proposal.path,kind:'new-test',
    content:proposal.content,added:proposal.content.split('\n').length,removed:0}));
  }
 }
 if(sourceCount<1||testCount!==1)deny('source_and_one_regression_test_required');
 return Object.freeze({repository,taskId,baseCommitSha,
  files:Object.freeze(entries),sourceChangedLines:changeCount,
  execution:'none',merge:'blocked',deployment:'blocked'});
}
module.exports=Object.freeze({prepareCandidate,REPOSITORY,SOURCE_FILES,MAX_FILES,MAX_CHANGED_LINES});
