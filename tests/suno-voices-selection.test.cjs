'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeSunoVoicesList,extractVoices}=require('../server/suno-voices-list.cjs');
const {buildAudioCreateCall}=require('../server/suno-audio-create.cjs');
const {toolContract}=require('../server/suno-mcp-tool-probe.cjs');
const KEY='11111111-1111-4111-8111-111111111111';
const VOICE='22222222-2222-4222-8222-222222222222';
const BRIEF={title:'Test',style:'dark acoustic folk',lyrics:'[Verse]\nOriginal line'};
function contract(extra={}){
 return toolContract({jsonrpc:'2.0',id:1,result:{tools:[{name:'audio-create',
  inputSchema:{type:'object',properties:{
   title:{type:'string'},style:{type:'string'},lyrics:{type:'string'},
   instrumental:{type:'boolean'},idempotency_key:{type:'string'},...extra
  }}}]}},'audio-create');
}
test('Saved voices are reduced to safe name + id pairs only',()=>{
 const parsed=extractVoices({structuredContent:{voices:[
  {id:VOICE,name:'The Wanderer',secret:'sensitive'},
  {voice_id:'33333333-3333-4333-8333-333333333333',display_name:'Bollman'},
  {id:'bad',name:'Fake'}
 ]}});
 assert.deepEqual(parsed,[{id:VOICE,name:'The Wanderer'},
  {id:'33333333-3333-4333-8333-333333333333',name:'Bollman'}]);
 assert.doesNotMatch(JSON.stringify(parsed),/sensitive/);
});
test('Suno saved voices tool uses one non-generation MCP call with no private body echo',async()=>{
 const calls=[],voices=makeSunoVoicesList({fetcher:async(url,opts)=>{
  calls.push({url,opts});
  return {status:200,headers:{get:k=>k==='content-type'?'application/json':null},
   text:async()=>JSON.stringify({jsonrpc:'2.0',id:7,result:{content:[{
    type:'text',text:JSON.stringify({voices:[{id:VOICE,name:'The Wanderer',secret:'PRIVATE'}]})
   }]}})};
 }});
 const r=await voices.list({accessToken:'secret-access-token-1234'});
 assert.equal(r.available,true);
 assert.deepEqual(r.voices,[{id:VOICE,name:'The Wanderer'}]);
 assert.equal(calls.length,1);
 const req=JSON.parse(calls[0].opts.body);
 assert.equal(req.method,'tools/call');
 assert.equal(req.params.name,'voices-list');
 assert.deepEqual(req.params.arguments,{});
 assert.equal(calls[0].opts.headers['Mcp-Name'],'voices-list');
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE|secret-access-token/);
});
test('A malformed voices-list response cannot invent saved voices',async()=>{
 const list=makeSunoVoicesList({fetcher:async()=>({
  status:200,headers:{get:k=>k==='content-type'?'text/html':null},
  text:async()=>'<html>no</html>'
 })});
 const r=await list.list({accessToken:'secret-access-token-1234'});
 assert.equal(r.available,false);
 assert.deepEqual(r.voices,[]);
});
test('Selected voice uses voice_id in schema while random mode omits it',()=>{
 const selected=buildAudioCreateCall({brief:BRIEF,idempotencyKey:KEY,
  contract:contract({voice_id:{type:'string','x-mcp-header':'Voice-Id'}}),voiceId:VOICE});
 assert.equal(selected.ok,true);
 assert.equal(selected.args.voice_id,VOICE);
 assert.equal(selected.paramHeaders['Mcp-Param-Voice-Id'],VOICE);
 const random=buildAudioCreateCall({brief:BRIEF,idempotencyKey:KEY,
  contract:contract({voice_id:{type:'string'}}),voiceId:null});
 assert.equal(random.ok,true);
 assert.equal(Object.hasOwn(random.args,'voice_id'),false);
});
test('A missing schema voice field blocks the call before Suno',()=>{
 const r=buildAudioCreateCall({brief:BRIEF,idempotencyKey:KEY,
  contract:contract(),voiceId:VOICE});
 assert.equal(r.ok,false);
 assert.equal(r.reason,'audio_create_voice_unsupported');
});
test('Crow uses Wanderer as fail-closed default and random only by explicit selection',()=>{
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 const cloud=fs.readFileSync('js/cloud.js','utf8');
 const wrapper=fs.readFileSync('js/cloud-ui.js','utf8');
 const backend=fs.readFileSync('server/suno-oauth-client.cjs','utf8');
 assert.match(ui,/v\.name\.trim\(\)\.toLowerCase\(\)==='the wanderer'/);
 assert.match(ui,/voiceSelect\.value==='random'\?null:voiceSelect\.value\.slice\(6\)/);
 assert.match(ui,/verifiedVoices\.some/);
 assert.match(ui,/Ανανέωση φωνών/);
 assert.match(ui,/createSunoSong\(brief,key,selectedVoiceId\)/);
 assert.match(cloud,/listSunoVoices/);
 assert.match(wrapper,/listSunoVoices:.*client\.listSunoVoices/);
 assert.match(backend,/voices\.voices\.some\(v=>v\.id===selectedVoice\)/);
});

test('Suno voice selector and refresh are actually mounted in Crow Music Studio',()=>{
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 // Voice is its own labelled studio group (selector + refresh + hint).
 assert.match(ui,/const voiceRow=make\('div','pw-studio-voice-row'\);voiceRow\.append\(voiceLabel,voiceRefresh\)/);
 assert.match(ui,/studioGroup\('Φωνή','Αποθηκευμένη φωνή Suno\. Προεπιλογή: The Wanderer\.',voiceRow,voiceHint\)/);
 assert.match(ui,/studioActions\.append\(musicCancel,musicCopy,musicSave,sunoGenerate\)/);
 assert.match(ui,/studioCreate\.append\(studioSource,musicForm,sunoCreateStatus,studioTools\)/);
});
