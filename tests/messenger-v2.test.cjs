'use strict';
// Messenger v2: safe formatting, conversation-first architecture, separated
// workspaces and preserved safety guarantees.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const F=require('../js/messenger-format.js');
const ui=fs.readFileSync('js/world-dialogue.js','utf8');
const css=fs.readFileSync('messenger.css','utf8');
const html=fs.readFileSync('index.html','utf8');

test('Markdown subset parses structure and never produces unsafe links',()=>{
 const blocks=F.parseBlocks('# Title\nPara line\n\n- one\n- two\n\n1. a\n2) b\n\n> quote\n\n```js\ncode()\n```');
 assert.deepEqual(blocks.map(b=>b.type),['h','p','ul','ol','quote','code']);
 assert.deepEqual(blocks[2].items,['one','two']);
 assert.equal(blocks[5].text,'code()');
 const inline=F.parseInline('**bold** and *it* `x` [ok](https://a.example/p) https://b.example/q. [bad](javascript:alert(1))');
 assert.deepEqual(inline.filter(t=>t.t!=='text').map(t=>t.t),['b','i','code','link','link']);
 assert.equal(inline.find(t=>t.t==='link').href,'https://a.example/p');
 assert.ok(!inline.some(t=>t.href&&!t.href.startsWith('https://')));
 assert.equal(F.safeHref('javascript:alert(1)'),null);
 assert.equal(F.safeHref('http://plain.example'),null);
 assert.equal(F.safeHref('https://u:p@x.example'),null);
 assert.match(F.parseBlocks('a\\nb')[0].text,/a\nb/,'escaped newlines are normalised');
});
test('Long replies get a readable summary that never cuts mid-word',()=>{
 const long=Array.from({length:24},(_,i)=>'Paragraph '+i+' explains one specific finding in careful detail.').join('\n\n');
 assert.equal(F.isLong(long),true);
 const s=F.summary(long);
 assert.ok(s.length<=440,s.length);
 assert.match(s,/^Paragraph 0/);
 assert.doesNotMatch(s,/\*\*|##/);
 assert.equal(F.looksLikeSong('TITLE: A\nSUNO STYLE PROMPT: b\nLYRICS:\n[End]'),true);
 assert.equal(F.looksLikeSong('A normal answer about titles'),false);
});
test('Renderer builds DOM nodes only — no innerHTML anywhere in the Messenger',()=>{
 const fmt=fs.readFileSync('js/messenger-format.js','utf8');
 for(const source of [fmt,ui])assert.doesNotMatch(source,/\.innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/);
 assert.match(fmt,/el\.rel='noopener noreferrer nofollow'/);
});
test('Conversation first: header, timeline and composer; secondary actions in a menu',()=>{
 assert.match(ui,/top\.append\(avatar,identity,headTools,close\)/);
 assert.match(ui,/headTools\.append\(musicToggle,menuBtn,menu\)/);
 assert.match(ui,/menuBtn\.setAttribute\('aria-haspopup','menu'\)/);
 assert.match(ui,/e\.key==='ArrowDown'\|\|e\.key==='ArrowUp'/);
 assert.match(ui,/composer\.append\(contextRow,form\)/);
 assert.match(ui,/panel\.append\(chat,musicPanel,memorySheet\)/);
 // Studio and diagnostics are no longer inside the composer.
 assert.doesNotMatch(ui,/composer\.append\([^)]*musicPanel/);
 assert.doesNotMatch(ui,/composer\.append\([^)]*sunoTransportCheck/);
});
test('Music Studio is a grouped workspace keeping every Suno safeguard',()=>{
 for(const group of ["studioGroup('Τραγούδι'","studioGroup('Ήχος'","studioGroup('Στίχοι'","studioGroup('Φωνή'"])
  assert.ok(ui.includes(group),group);
 assert.match(ui,/\['\[Intro\]','\[Verse\]','\[Pre-Chorus\]','\[Chorus\]','\[Bridge\]','\[Outro\]','\[End\]'\]/);
 assert.match(ui,/counter\(musicStyle,1000\)/);
 assert.match(ui,/counter\(musicLyrics,8000\)/);
 // Explicit confirmation, verified voice, one-shot key and honest outcome remain.
 assert.match(ui,/window\.confirm\('Να στείλω το τραγούδι στο Suno με φωνή «'/);
 assert.match(ui,/Διάλεξε «Τυχαία» ή δοκίμασε ξανά\. Δεν στάλθηκε αίτημα/);
 assert.match(ui,/if\(lastSunoSubmission===fingerprint&&!window\.confirm\(/);
 assert.match(ui,/Η ολοκλήρωση του τραγουδιού δεν έχει ακόμη επαληθευτεί/);
 assert.match(ui,/\[\['random','Τυχαία'\],\['wanderer','The Wanderer'\]\]/);
 assert.doesNotMatch(ui,/createSunoSong\([^)]*\)[^;]*;\s*\/\/\s*auto/i);
 // Opening a song in the Studio never submits it.
 const open=ui.split('function openSongInStudio(text){')[1].split('\n }')[0];
 assert.doesNotMatch(open,/createSunoSong|sunoGenerate\.click|confirm\(/);
});
test('Memory view labels approved vs proposed and reviews one row with confirmation',()=>{
 assert.match(ui,/listDirectorMemory\(projectId\)/);
 assert.match(ui,/r\.status==='approved'/);
 assert.match(ui,/r\.status==='proposed'/);
 assert.match(ui,/Δεν χρησιμοποιούνται μέχρι να τις εγκρίνεις/);
 assert.match(ui,/reviewDirectorMemory\(\{projectId,entryId:row\.id,decision\}\)/);
 assert.match(ui,/if\(!window\.confirm\(decision==='approved'/);
 assert.match(ui,/r\.project_id===projectId/);
 assert.match(css,/\.pw-memory-card\[data-status="proposed"\] \.pw-memory-meta::before\{content:'Πρόταση · '/);
 const facade=fs.readFileSync('js/cloud-ui.js','utf8');
 assert.match(facade,/listDirectorMemory:\(projectId\)=>client\.listDirectorMemory\(projectId\)/);
 assert.match(facade,/reviewDirectorMemory:\(args\)=>client\.reviewDirectorMemory\(args\)/);
});
test('Failures are friendly, retryable and never duplicate a saved message',()=>{
 assert.match(ui,/function friendlyError\(error\)/);
 assert.match(ui,/failure\.agentId!=='matt'&&failure\.noteSaved/);
 assert.match(ui,/submitDirector\(failure\.agentId,failure\.text,\{saveNote:false\}\)/);
 assert.match(ui,/cloud\(\)\.askDirector\(id,text,\{saveNote:false\}\)/);
 assert.match(ui,/make\('summary','','Λεπτομέρειες'\)/);
});
test('Keyboard, focus, viewport and accessibility behaviours are wired',()=>{
 assert.match(ui,/window\.visualViewport/);
 assert.match(ui,/--pw-vvh/);
 assert.match(ui,/function autoGrow\(\)/);
 assert.match(ui,/if\(!menu\.hidden\)\{setMenu\(false\);menuBtn\.focus\(\);return\}/);
 assert.match(ui,/if\(!memorySheet\.hidden\)\{closeMemory\(\);return\}/);
 assert.match(ui,/panel\.lang='el'/);
 assert.match(ui,/typing\.setAttribute\('aria-label','Γράφει…'\)/);
 assert.match(ui,/document\.documentElement\.classList\.toggle\('pw-chat-open'/);
});
test('Design system: tokens, responsive layouts, reduced motion and safe-area',()=>{
 for(const token of ['--pw-bg:','--pw-accent:','--pw-r-bubble:','--pw-ease:','--pw-font:'])
  assert.ok(css.includes(token),token);
 assert.match(css,/@media \(min-width:900px\)\{\s*#view \.pw-messenger\.pw-studio-open/);
 assert.match(css,/@media \(max-width:760px\)\{\s*#view \.pw-messenger\{position:fixed/);
 assert.match(css,/height:var\(--pw-vvh,100dvh\)/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/#view \.pw-messenger \[hidden\]\{display:none!important\}/);
 assert.match(css,/font:400 16px|font-size:16px\} \/\* no iOS zoom \*\//);
 for(const agent of ['studio-director','listening-director','pokemon-director','wellbeing-director'])
  assert.ok(css.includes('[data-agent="'+agent+'"]'),agent);
 assert.match(html,/messenger\.css\?v=release-1/);
 assert.ok(html.indexOf('messenger-format.js')<html.indexOf('world-dialogue.js'));
 const legacy=fs.readFileSync('style.css','utf8');
 assert.doesNotMatch(legacy,/\.world-chat-mode-picker|\.world-dialogue-private|width:min\(310px,72vw\)/);
});
