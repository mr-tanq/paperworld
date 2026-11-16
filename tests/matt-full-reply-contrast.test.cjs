'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {encode,decode,recover}=require('../js/matt-history.js');
const sample='A dark intimate song. '+('Fingerpicked nylon strings, muted trumpet, warm bass. '.repeat(65));
test('Matt verified reply is stored beyond 1700 characters without mid-word cut',()=>{
 assert.ok(sample.length>1700&&sample.length<5500);
 const packed=encode('studio-director',sample);
 assert.equal(decode(packed).text,sample);
 assert.equal(recover([{role:'agent',content:packed}]).display[0].text,sample);
});
test('Oversize Matt text remains bounded to verified 5500 limit',()=>{
 const packed=encode('studio-director','x'.repeat(8000));
 assert.equal(decode(packed).text.length,5500);
});
test('Server persistence can store the full bounded reply, without unsafe tokens',()=>{
 const source=fs.readFileSync('server/matt-conversation-persistence.cjs','utf8');
 assert.match(source,/content\.length>6000/);
 assert.doesNotMatch(source,/content\.length>2000/);
});
test('Compact Matt decision panel overrides pale global header background',()=>{
 const css=fs.readFileSync('style.css','utf8');
 assert.match(css,/\.world-chat-decisions \.human-hub-header\{background:transparent/);
});
