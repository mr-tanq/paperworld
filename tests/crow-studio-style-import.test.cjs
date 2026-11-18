'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {extractStyle}=require('../js/crow-studio-draft.js');
test('extract actual Suno style section and stop before notes',()=>{
 const reply='**Ύφος (Suno style prompt, προσχέδιο):**\nDark organic acoustic folk, warm bass, brushed drums.\n**Σημειώσεις:**\nUntil the morning finds us.';
 assert.equal(extractStyle(reply),'Dark organic acoustic folk, warm bass, brushed drums.');
});
test('recognize English heading but not freeform prose or lyrics',()=>{
 assert.equal(extractStyle('Suno Style Prompt: Sparse muted trumpet, soft drums\nLyrics: line one'),'Sparse muted trumpet, soft drums');
 assert.equal(extractStyle('Until the morning finds us.\n**Σημειώσεις:**\nDo not shout.'),null);
 assert.equal(extractStyle('[Verse]\nI wander alone'),null);
 assert.equal(extractStyle(''),null);
});
test('the Crow Messenger never copies a whole reply to the style field',()=>{
 const source=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(source,/const song=parser\?\.parseSong\(text\)/);
 assert.match(source,/latestSavedCrowReply/);
 assert.doesNotMatch(source,/musicStyle\.value=last\.trim\(\)\.slice\(0,1000\)/);
});

test('Suno package strips notes, commentary and extra text after [End]',()=>{
 const {parseSong}=require('../js/crow-studio-draft.js');
 const response=[
  'I wrote something for you:',
  '**TITLE:** A Gentle Wake',
  '**SUNO STYLE PROMPT:** Quiet intimate acoustic folk; natural drums.',
  '**LYRICS:**',
  '[Intro — fingerpicked nylon guitar]',
  '[Verse 1 — close baritone]',
  'I walked until the evening knew',
  '[Chorus — soft restrained lift]',
  'Something good was coming through',
  '[End]',
  'I hope this works for your album!',
  '**NOTES:** Consider trying a different tempo.'
 ].join('\n');
 const song=parseSong(response);
 assert.equal(song.title,'A Gentle Wake');
 assert.equal(song.style,'Quiet intimate acoustic folk; natural drums.');
 assert.equal(song.lyrics,[
  '[Intro — fingerpicked nylon guitar]',
  '[Verse 1 — close baritone]',
  'I walked until the evening knew',
  '[Chorus — soft restrained lift]',
  'Something good was coming through',
  '[End]'
 ].join('\n'));
});
test('Never import commentary as lyrics or invent song fields',()=>{
 const {parseSong,fromMatt}=require('../js/crow-studio-draft.js');
 assert.equal(parseSong('TITLE: One\nSUNO STYLE PROMPT: guitar\nLYRICS:\nThis is my suggestion\n[Verse]\nHello'),null);
 assert.equal(parseSong('TITLE: One\nSUNO STYLE PROMPT: guitar\nLYRICS:\n[Verse]\n[Outro]'),null);
 assert.equal(parseSong('TITLE: One\nSUNO STYLE PROMPT: guitar\nLYRICS:\n[Verse]\nLine\nNOTES:\nPlease revise').lyrics,'[Verse]\nLine');
 assert.equal(fromMatt({delegated:true,directorId:'studio-director',
  requestId:'11111111-1111-4111-8111-111111111111',
  request:'make me a song',directorReport:'Some thoughts, not a Suno prompt.'}),null);
});
test('Crow import reads persisted replies and refuses unstructured latest messages',()=>{
 const source=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(source,/latestSavedCrowReply/);
 assert.match(source,/history\.filter\(m=>m\.role==='agent'/);
 assert.match(source,/const song=parser\?\.parseSong\(text\)/);
 assert.match(source,/Τα υπάρχοντα πεδία δεν άλλαξαν/);
 assert.doesNotMatch(source,/musicStyle\.value=style;\s*if\(song\)/);
});
