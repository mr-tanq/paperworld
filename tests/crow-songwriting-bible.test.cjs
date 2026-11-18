'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {GUIDE,forCrow:guide}=require('../server/crow-songwriting-guide.cjs');
const {BIBLE,forCrow:bible}=require('../server/crow-project-bible.cjs');
const {parseSong,fromMatt,extractStyle}=require('../js/crow-studio-draft.js');
const uuid='11111111-1111-4111-8111-111111111111';
const song=[
 'TITLE: A Quiet Road',
 'SUNO STYLE PROMPT: Intimate dark acoustic folk, fingerpicked nylon guitar, live-feeling brushed drums, sparse muted trumpet, vulnerable male baritone. No crowd noise.',
 'LYRICS:',
 '[Intro — fingerpicked guitar alone, very quiet]',
 '[Verse 1 — intimate voice, just above a whisper]',
 'I watched the morning leave the road',
 'And carried silence like a coat',
 '[Chorus — a restrained, organic lift]',
 'The dark is not the place I stay',
 '[Outro — trumpet echoes once, instruments fade]',
 '[End]'
].join('\n');
test('Crow project bible includes both approved eras and rejected directions',()=>{
 for(const x of ['Xibalba Records','No Destination','Smoky Dreams',
  'The Things I Never Said','Still Searching','I Remember','Golden Ray',
  'Dancing Alone','The Crow','No Destination']){
  assert.ok(BIBLE.toLowerCase().includes(x.toLowerCase()),x);
 }
 assert.match(BIBLE,/not a license to invent lyrics/i);
 assert.match(bible(),/PROJECT BIBLE/);
 assert.match(GUIDE,/square brackets/i);
 assert.match(guide(),/TITLE:/);
 assert.match(guide(),/SUNO STYLE PROMPT:/);
 assert.match(guide(),/LYRICS:/);
});
test('full Suno package puts title style and bracketed lyrics in separate Studio fields',()=>{
 const parsed=parseSong(song);
 assert.ok(parsed);
 assert.equal(parsed.title,'A Quiet Road');
 assert.match(parsed.style,/fingerpicked nylon guitar/);
 assert.match(parsed.lyrics,/\[Verse 1 — intimate voice/);
 assert.match(parsed.lyrics,/I watched the morning leave/);
 assert.doesNotMatch(parsed.style,/\[Verse|I watched/);
 const draft=fromMatt({directorId:'studio-director',delegated:true,requestId:uuid,
  request:'Please create a new emotional acoustic song',directorReport:song});
 assert.equal(draft.title,parsed.title);
 assert.equal(draft.style,parsed.style);
 assert.equal(draft.lyrics,parsed.lyrics);
});
test('malformed and incomplete song package cannot fabricate lyrics',()=>{
 assert.equal(parseSong('TITLE: Only a Title\nSUNO STYLE PROMPT: guitar'),null);
 assert.equal(parseSong('TITLE: A\nSUNO STYLE PROMPT: guitar\nLYRICS: Just words'),null);
 assert.equal(extractStyle('TITLE: A\nSUNO STYLE PROMPT: guitar\nLYRICS:\n[Verse]\nOne'), 'guitar');
});
test('Crow bible is limited to Crow in both AI entry points',()=>{
 const direct=fs.readFileSync('server/director-direct-chat.cjs','utf8');
 const delegated=fs.readFileSync('server/matt-delegation.cjs','utf8');
 assert.match(direct,/agentId==='studio-director'\?forCrowHistory\(\)\+forCrow\(\)/);
 assert.match(delegated,/route==='studio-director'\?forCrowHistory\(\)\+forCrow\(\)/);
 assert.match(delegated,/preserve TITLE, SUNO STYLE PROMPT and LYRICS sections verbatim/);
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/const song=parser\?\.parseSong\(text\)/);
 assert.match(ui,/musicLyrics\.value=song\.lyrics/);
 assert.match(ui,/latestSavedStudioDraft\|\|window\.PaperworldCrowStudioDraft/);
});

test('Crow follows the current sonic reference over its historical acoustic era',()=>{
 const {currentBriefPriority}=require('../server/crow-songwriting-guide.cjs');
 const instructions=GUIDE+'\n'+currentBriefPriority();
 assert.match(instructions,/CURRENT BRIEF HAS HIGHEST ARTISTIC PRIORITY/);
 assert.match(instructions,/historical acoustic\/noir\/folk preferences are only background/i);
 assert.match(instructions,/DO NOT inject fingerpicked nylon guitar/);
 assert.match(instructions,/ambiguous artist, album or track/);
 assert.match(instructions,/Do NOT pretend to know the sound/);
 assert.match(instructions,/\[End\]/);
 const direct=fs.readFileSync('server/director-direct-chat.cjs','utf8');
 const delegated=fs.readFileSync('server/matt-delegation.cjs','utf8');
 assert.match(direct,/agentId==='studio-director'\?currentBriefPriority\(\):''/);
 assert.match(delegated,/route==='studio-director'\?currentBriefPriority\(\):''/);
});
