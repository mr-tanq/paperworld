#!/usr/bin/env node
// PAPERWORLD Worker controller: explicit allowlist, no remote writes, no API keys.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';

const root=resolve(process.cwd());
const job=process.argv[2];
const tasks={
 'ticketswap-diagnostics':{
  repo:'mr-tanq/concerts',
  allowed:[
   'js/concert-ticketswap.js',
   'js/ticketswap-check.js',
   'scripts/lib/ticketswap-going.mjs',
   'scripts/lib/ticketswap-matching.mjs',
   'scripts/ticketswap-confirmation.test.mjs',
   'scripts/ticketswap-matching.test.mjs',
   'scripts/ticketswap-diagnostics.test.mjs'
  ],
  prompt:[
   'You are the PAPERWORLD Developer Worker in a temporary, isolated checkout.',
   'Mission: investigate and fix the TicketSwap check failure or missing-match fallback.',
   'Inspect the repository source and existing tests before changing anything.',
   'Distinguish provider search errors, event not found, ambiguous event, incomplete search, and listing retrieval errors.',
   'Do not invent availability, skip strict event matching, expose secrets or call the TicketSwap provider.',
   'Write a small, evidence-based code change and deterministic offline regression tests if the issue can be reproduced.',
   'If the root cause cannot be demonstrated, leave the code unchanged and explain the uncertainty and tests needed.',
   'Only modify the files explicitly allowed below. Do not create other files, dependencies or workflow changes.',
   'You have no authorization to commit, push, open or merge a PR, deploy, spend money, or contact external services.',
   'Summarize diagnosis, files changed, tests to run and remaining uncertainty in your final response.'
  ]
 }
};
const fail=message=>{throw Error(message)};
if(!Object.hasOwn(tasks,job))fail('Unknown mission');
const task=tasks[job],checkout=join(root,'target'),output=join(root,'worker-output');
await mkdir(output,{recursive:true});
if(process.argv[3]==='prepare'){
 const prompt=task.prompt.join('\n')+'\n\nAllowed paths:\n'+task.allowed.map(x=>'- '+x).join('\n');
 await writeFile(join(output,'prompt.txt'),prompt+'\n');
 await writeFile(join(output,'scope.json'),JSON.stringify({job,repository:task.repo,allowed:task.allowed,mode:'review-only',remoteWrites:false},null,2));
 console.log('Prepared review-only AI task: '+job);
}else if(process.argv[3]==='diagnose'){
 const code=Number(process.env.COPILOT_EXIT_CODE);
 if(!Number.isSafeInteger(code)||code<0||code>255)fail('Invalid Copilot exit code');
 const stderr=await readFile('/tmp/paperworld-copilot-stderr.log','utf8').catch(()=>'');
 const reason=code===0?'cli-exited-successfully':
  /max-ai-credits|at least 30 AI credits/i.test(stderr)?'invalid-credit-limit':
  /not authorized|permission denied|unauthorized|authentication failed|401|403/i.test(stderr)?'authentication-or-permission':
  /model.*(unavailable|unsupported|not allowed)|unsupported.*model/i.test(stderr)?'model-not-available':
  /network|timed out|connection refused|429|rate limit/i.test(stderr)?'network-or-rate-limit':
  'copilot-cli-error';
 await writeFile(join(output,'execution.json'),JSON.stringify({
  stage:'copilot-cli',success:code===0,reason,exitCode:code,
  note:'This records whether Copilot CLI exited successfully, not whether TicketSwap is fixed. No provider logs or secrets are included.'
 },null,2));
 console.log('Copilot execution status recorded: '+reason);
}else if(process.argv[3]==='collect'){
 const raw=execFileSync('git',['status','--porcelain','-z','--untracked-files=all'],{cwd:checkout,encoding:'utf8'});
 const records=raw.split('\0').filter(Boolean);
 const changed=[];
 for(let i=0;i<records.length;i++){
  const record=records[i],state=record.slice(0,2),name=record.slice(3);
  if(state.includes('R')||state.includes('C'))fail('Rename/copy outside simple change policy');
  if(!task.allowed.includes(name))fail('Worker changed forbidden path: '+name);
  changed.push(name);
 }
 for(const file of changed){
  if(!execFileSync('git',['ls-files','--',file],{cwd:checkout,encoding:'utf8'}).trim())
   execFileSync('git',['add','-N','--',file],{cwd:checkout});
 }
 const patch=execFileSync('git',['diff','--binary','--',...task.allowed],{cwd:checkout,encoding:'utf8',maxBuffer:6*1024*1024});
 await writeFile(join(output,'worker.patch'),patch);
 await writeFile(join(output,'audit.json'),JSON.stringify({
  mission:job,repository:task.repo,scopePassed:true,changedPaths:[...new Set(changed)].sort(),
  hasPatch:!!patch,prCreated:false,pushPerformed:false
 },null,2));
 console.log('Sandbox patch captured; no remote writes. Changed files: '+changed.length);
}else fail('Usage: node worker.mjs <mission> prepare|collect|diagnose');
