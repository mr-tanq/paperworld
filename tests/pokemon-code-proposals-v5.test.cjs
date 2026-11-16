'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {validateProposal,digestPlan,parseProposal,TAG}=require('../server/v5-pokemon-code-proposal.cjs');
const {makePokemonDraftPublisher}=require('../server/v5-pokemon-draft-publisher.cjs');
const {makePokemonProposalApi}=require('../server/v5-pokemon-proposal-api.cjs');
const jobId='33333333-3333-4333-8333-333333333333';
const ownerId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
const original='extends CharacterBody2D\nfunc old():\n\tpass\n';
const replacement='extends CharacterBody2D\nfunc safe():\n\tpass\n';
const sha='a'.repeat(40);
const evidence={repository:'mr-tanq/pokemon-echoes',ref:'main',
 readOnly:true,files:[{path:'player.gd',sha,lines:'L1 extends CharacterBody2D\nL2 func old():\nL3 pass'}]};
const proposal={jobId,repository:'mr-tanq/pokemon-echoes',baseRef:'main',
 summary:'Simplify player movement',edits:[{path:'player.gd',expectedSha:sha,replacement}]};
const plan=validateProposal({jobId,proposal,evidence});
test('Only a tightly bounded source-backed GDScript replacement is accepted',()=>{
 assert.equal(plan.canWrite,false);assert.equal(plan.canDeploy,false);
 assert.equal(plan.approvalRequired,true);
 assert.match(digestPlan(plan),/^[a-f0-9]{64}$/);
 assert.equal(parseProposal('Review done.\n'+TAG+JSON.stringify(proposal),{jobId,evidence}).jobId,jobId);
 for(const altered of [
  {...proposal,repository:'mr-tanq/concerts'},
  {...proposal,edits:[{...proposal.edits[0],path:'../.env'}]},
  {...proposal,edits:[{...proposal.edits[0],expectedSha:'b'.repeat(40)}]},
  {...proposal,edits:[{...proposal.edits[0],replacement:'this is not Godot'}]},
  {...proposal,edits:[{...proposal.edits[0],replacement:'extends Node\n'+ 'a'.repeat(4100)}]}
 ])assert.throws(()=>validateProposal({jobId,proposal:altered,evidence}));
 assert.equal(parseProposal('hello '+TAG+'{invalid}',{jobId,evidence}),null);
});
test('Draft publisher rechecks exact source SHA and consumes approval once',async()=>{
 const calls=[];let approvals=0;
 const approvalsStore={consumeOnce:async()=>{approvals++;return approvals===1}};
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/git/ref/heads/main'))return {ok:true,json:async()=>({object:{sha:'b'.repeat(40)}})};
  if(url.includes('/contents/player.gd?ref=main'))return {ok:true,json:async()=>({type:'file',path:'player.gd',sha})};
  if(url.endsWith('/git/refs'))return {ok:true,json:async()=>({ref:'refs/heads/paperworld/pokemon-33333333-3333',object:{sha:'b'.repeat(40)}})};
  if(url.endsWith('/contents/player.gd'))return {ok:true,json:async()=>({content:{sha:'c'.repeat(40)}})};
  if(url.endsWith('/pulls'))return {ok:true,json:async()=>({number:12,html_url:'https://github.com/mr-tanq/pokemon-echoes/pull/12'})};
  throw Error('Unexpected URL');
 };
 const writer=makePokemonDraftPublisher({fetcher,approvals:approvalsStore});
 const args={ownerId,githubToken:'gho_synthetic_nonproduction_token12345',plan,evidence,
  approval:{id:'44444444-4444-4444-8444-444444444444',secret:'f'.repeat(64)}};
 const outcome=await writer.publish(args);
 assert.equal(outcome.created,true);assert.equal(outcome.draft,true);
 assert.equal(outcome.merged,false);
 assert.equal(calls.length,5);
 assert.ok(calls.every(x=>x.url.startsWith('https://api.github.com/repos/mr-tanq/pokemon-echoes/')));
 assert.equal(JSON.parse(calls.at(-1).opts.body).draft,true);
 assert.equal(JSON.parse(calls[3].opts.body).branch,'paperworld/pokemon-'+jobId.slice(0,12));
 assert.doesNotMatch(JSON.stringify(outcome),/synthetic_nonproduction_token/);
 await assert.rejects(()=>writer.publish(args),/pokemon_draft_approval_required/);
 assert.equal(calls.length,5);
});
test('Stale source revision rejects GitHub writes beyond the read and main ref lookup',async()=>{
 let calls=0;
 const writer=makePokemonDraftPublisher({
  approvals:{consumeOnce:async()=>true},
  fetcher:async(url)=>{
   calls++;
   if(url.endsWith('/git/ref/heads/main'))return {ok:true,json:async()=>({object:{sha:'b'.repeat(40)}})};
   return {ok:true,json:async()=>({type:'file',path:'player.gd',sha:'c'.repeat(40)})};
  }
 });
 await assert.rejects(()=>writer.publish({ownerId,githubToken:'gho_longSynthetic12345678',
  plan,evidence,approval:{}}),/stale_pokemon_source_revision/);
 assert.equal(calls,2);
});
test('Authenticated proposal API requires owner thread and explicit Draft PR consent',async()=>{
 const store={list:async()=>[{jobId}],load:async()=>({jobId,status:'pending_review',
  digest:digestPlan(plan),plan,evidence}),transition:async()=>true,
  issue:async()=>({id:'x',secret:'y'}),consumeOnce:async()=>true};
 const api=makePokemonProposalApi({
  store,guard:{authenticate:async()=>({ownerId}),ownsThread:async()=>true},
  oauth:{getLinkedPrivateWriteToken:()=>null}
 });
 const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer '+('a'.repeat(24))};
 const body=JSON.stringify({threadId,jobId,digest:digestPlan(plan)});
 assert.equal((await api.handle({headers,body,action:'publish'})).status,403);
 assert.equal((await api.handle({headers,body:JSON.stringify({...JSON.parse(body),
  confirm:'CREATE_POKEMON_DRAFT_PR'}),action:'publish'})).status,409);
 assert.equal((await api.handle({headers,body:JSON.stringify({threadId}),action:'list'})).status,200);
 assert.equal((await api.handle({headers:{...headers,origin:'https://evil.invalid'},body,action:'list'})).status,403);
});
test('Server route and UI can review both projects without exposing writer grant',()=>{
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 const client=fs.readFileSync('js/cloud.js','utf8');
 const ui=fs.readFileSync('js/cloud-ui.js','utf8');
 const hub=fs.readFileSync('js/human-first-hub.js','utf8');
 const oauth=fs.readFileSync('server/github-oauth.cjs','utf8');
 assert.match(server,/\/pokemon\/proposals\/publish/);
 assert.match(server,/pokemonProposalStore/);
 assert.match(client,/CREATE_POKEMON_DRAFT_PR/);
 assert.match(hub,/performPokemon/);
 assert.match(ui,/listPokemonProposals/);
 assert.match(oauth,/getLinkedPrivateWriteToken/);
 assert.doesNotMatch(fs.readFileSync('server/v5-pokemon-draft-publisher.cjs','utf8'),/merge_pull_request|\/merges|\/deployments/);
});
