'use strict';
// Crow and Dave get real tools: Crow sends a finished song to Suno, Dave saves
// items to the Wellbeing list and sets weekly reminders — decided in chat,
// executed by the owner's own session, strictly validated.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {extract,prompt}=require('../server/director-actions.cjs');
const client=require('../js/director-actions-client.js');
const SONG='Ορίστε το τραγούδι.\nTITLE: Ash on the Windowsill\nSUNO STYLE PROMPT: dark folk, warm male vocal, slow\nLYRICS:\n[Verse 1]\nThe ash still sleeps on the windowsill\n[Chorus]\nAnd I wait for the light\n[End]\nCREATE_SUNO_SONG';
test('Crow: a complete song + marker becomes one Suno action; ideas alone never do',()=>{
 const r=extract('studio-director',SONG);
 assert.equal(r.actions.length,1);assert.equal(r.actions[0].type,'suno_song');
 assert.equal(r.actions[0].brief.title,'Ash on the Windowsill');assert.match(r.actions[0].brief.lyrics,/\[End\]$/);
 assert.doesNotMatch(r.content,/CREATE_SUNO_SONG/);assert.match(r.content,/TITLE: Ash/,'the song stays in the chat');
 assert.deepEqual(extract('studio-director','Μια ιδέα: σκοτεινό folk…').actions,[]);
 const half=extract('studio-director','TITLE: X\nCREATE_SUNO_SONG');
 assert.deepEqual(half.actions,[]);assert.equal(half.actionError,'song_package_incomplete');
 assert.match(prompt('studio-director'),/CREATE_SUNO_SONG/);
});
test('Dave: task and reminder lines become bounded actions and disappear from the text',()=>{
 const r=extract('wellbeing-director','Καλό πλάνο!\nSAVE_TASK: Πόδια Δευτέρα || 3x10 squats\n- SAVE_TASK: Περπάτημα 30 λεπτά\nREMIND_WEEKLY: MON 18:30 || Ώρα για προπόνηση\nREMIND_WEEKLY: XYZ 99:00 || bad');
 assert.equal(r.content,'Καλό πλάνο!');
 assert.deepEqual(r.actions,[{type:'add_task',title:'Πόδια Δευτέρα',notes:'3x10 squats'},
  {type:'add_task',title:'Περπάτημα 30 λεπτά',notes:''},
  {type:'weekly_reminder',dayOfWeek:1,hour:18,minute:30,goal:'Ώρα για προπόνηση'}]);
 const many=extract('wellbeing-director',Array.from({length:9},(_,i)=>'SAVE_TASK: t'+i).join('\n'));
 assert.equal(many.actions.length,5,'at most five items per reply');
 assert.deepEqual(extract('listening-director','SAVE_TASK: x').actions,[],'other Directors have no such tools');
 assert.equal(prompt('pokemon-director'),'');
});
test('app runs the actions with the owner session and reports in plain Greek',async()=>{
 const calls=[];
 const cloud={createSunoSong:async(b,k)=>{calls.push(['suno',b.title,k]);return {accepted:true}},
  addTask:async(room,t)=>{calls.push(['task',room,t])},
  createRoutine:async p=>{calls.push(['routine',p.projectId,p.dayOfWeek]);return {routineId:'r1'}},
  changeRoutine:async(id,on)=>{calls.push(['enable',id,on])}};
 const lines=await client.run([{type:'suno_song',brief:{title:'Ash',style:'folk',lyrics:'[Verse]\nx\n[End]'}},
  {type:'add_task',title:'Πόδια',notes:''},{type:'weekly_reminder',dayOfWeek:1,hour:18,minute:5,goal:'Προπόνηση'},
  {type:'delete_everything'}],{cloud,requestId:'req-1'});
 assert.deepEqual(calls,[['suno','Ash','req-1'],['task','wellbeing','Πόδια'],['routine','wellbeing',1],['enable','r1',true]]);
 assert.match(lines[0],/στάλθηκε στο Suno/);assert.match(lines[2],/κάθε Δευτέρα στις 18:05/);assert.equal(lines.length,3);
 const capped=await client.run([{type:'suno_song',brief:{title:'A',style:'b',lyrics:'c'}}],
  {cloud:{createSunoSong:async()=>({accepted:false,reason:'suno_monthly_limit_reached'})}});
 assert.match(capped[0],/όριο των 50/);
});
test('chat wiring: two AI turns accepted only for Developer handoffs; actions run after the reply',()=>{
 const cloudSrc=fs.readFileSync('js/cloud.js','utf8');
 assert.match(cloudSrc,/result\.aiTurns===1\|\|\(result\.aiTurns===2&&result\.execution==='task_queued'\)/);
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/PaperworldDirectorActions\.run\(result\.actions,\{cloud:cloud\(\),requestId:result\.requestId\}\)/);
 const server=fs.readFileSync('server/director-direct-chat.cjs','utf8');
 assert.match(server,/directorActions\.extract\(agentId,content\)/);
 assert.match(fs.readFileSync('index.html','utf8'),/director-actions-client\.js\?v=1/);
});
test('server: Crow\'s reply returns the Suno action, never runs it, one AI turn',async()=>{
 const {makeDirectorChat,CONSENT}=require('../server/director-direct-chat.cjs');
 const owner='11111111-1111-4111-8111-111111111111',thread='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
 const prompts=[];
 const api=makeDirectorChat({oauth:{getLinkedToken:()=>'gho_TEST123456789'},
  guard:{authenticate:async()=>({ownerId:owner}),ownsThread:async()=>true},
  memoryLoader:{load:async a=>({actor:a.actor,projectId:'studio',text:'notes',included:1,capabilitiesGranted:[],untrustedContent:true})},
  threadRecall:{load:async()=>({text:'',messageCount:0})},replyPersistence:{save:async()=>true},budgetVerified:()=>true,
  taskIntake:{available:async()=>true,submit:async()=>{throw Error('never')}},mattThreadLookup:async()=>null,
  clientFactory:async()=>({start:async()=>{},stop:async()=>{},
   listModels:async()=>[{id:'m',billing:{tokenPrices:{inputPrice:1,outputPrice:1,batchSize:1000}}}],
   createSession:async()=>({sendAndWait:async({prompt})=>{prompts.push(prompt);return {data:{content:SONG}}},disconnect:async()=>{}})})});
 const r=await api.handle({headers:{origin:'https://mr-tanq.github.io',authorization:'Bearer aaa.bbb.fake12345678'},
  body:JSON.stringify({agentId:'studio-director',threadId:thread,requestId:id,message:'Φτιάξ\' το στο Suno',consent:CONSENT})});
 assert.equal(r.status,200);assert.equal(r.body.aiTurns,1);assert.equal(r.body.execution,'owner_actions');
 assert.equal(r.body.actions[0].type,'suno_song');assert.doesNotMatch(r.body.content,/CREATE_SUNO_SONG/);
 assert.match(prompts[0],/You CAN create the song on Suno/);
});
test('a failing Director chat says at which stage, never provider text',async()=>{
 const {makeDirectorChat,CONSENT}=require('../server/director-direct-chat.cjs');
 const owner='11111111-1111-4111-8111-111111111111';
 const api=makeDirectorChat({oauth:{getLinkedToken:()=>'gho_TEST123456789'},
  guard:{authenticate:async()=>({ownerId:owner}),ownsThread:async()=>true},
  memoryLoader:{load:async a=>({actor:a.actor,projectId:'wellbeing',text:'',included:0,capabilitiesGranted:[],untrustedContent:true})},
  threadRecall:{load:async()=>({text:'',messageCount:0})},replyPersistence:{save:async()=>true},budgetVerified:()=>true,
  clientFactory:async()=>({start:async()=>{throw Error('secret provider detail sk-123')},stop:async()=>{}})});
 const r=await api.handle({headers:{origin:'https://mr-tanq.github.io',authorization:'Bearer aaa.bbb.fake12345678'},
  body:JSON.stringify({agentId:'wellbeing-director',threadId:'22222222-2222-4222-8222-222222222222',
   requestId:'33333333-3333-4333-8333-333333333334',message:'γεια',consent:CONSENT})});
 assert.equal(r.status,503);assert.deepEqual(r.body,{error:'director_chat_unavailable',stage:'client_start'});
});
test('wordless / instrumental songs are complete songs too (only when they end with [End])',()=>{
 const {validLyrics,parseSong}=require('../js/crow-studio-draft.js');
 const wordless='[Intro: solo baglama, dusty room air]\n[Verse vocal: wordless improvisation only, aman style]\n[Chorus: full band, vocal rises]\n[Outro: long breath]\n[End]';
 assert.equal(validLyrics(wordless),true);
 assert.equal(validLyrics('[Intro: baglama]\n[Verse: wordless]'),false,'no [End]: maybe truncated');
 assert.equal(validLyrics('[Intro: baglama]\n[End]'),false,'too short to be a song');
 const song=parseSong('TITLE: Smoke Over the Breakbeat\nSUNO STYLE PROMPT: drum and bass with rebetiko, wordless vocal\nLYRICS:\n'+wordless);
 assert.equal(song.title,'Smoke Over the Breakbeat');
 const {extract}=require('../server/director-actions.cjs');
 assert.equal(extract('studio-director','TITLE: X\nSUNO STYLE PROMPT: y\nLYRICS:\n'+wordless+'\nCREATE_SUNO_SONG').actions.length,1);
});
