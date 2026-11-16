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
 assert.match(source,/PaperworldCrowStudioDraft\?\.extractStyle\(last\)/);
 assert.doesNotMatch(source,/musicStyle\.value=last\.trim\(\)\.slice\(0,1000\)/);
});
