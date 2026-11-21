'use strict';
// Speak instead of typing: words fill the box live; when you stop, it sends
// after a short pause unless you touch the text to correct it.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function el(){const h={};return {value:'',hidden:false,classList:{toggle(){}},attrs:{},
 setAttribute(k,v){this.attrs[k]=v},addEventListener(t,f){(h[t]||=[]).push(f)},fire(t){(h[t]||[]).forEach(f=>f({}))},
 dispatchEvent(){}}}
function load(rec){
 globalThis.webkitSpeechRecognition=rec;globalThis.Event=class{constructor(t){this.type=t}};
 delete require.cache[require.resolve('../js/voice-input.js')];
 return require('../js/voice-input.js');
}
test('spoken words fill the box and the message sends after the pause',async()=>{
 let instance;
 class Rec{constructor(){instance=this}start(){}stop(){this.onend()}}
 const V=load(Rec);
 const field=el(),button=el(),status=el();let sent=0;const form={...el(),requestSubmit(){sent++}};
 V.attach({field,button,form,status});
 button.fire('click');
 assert.equal(instance.lang,'el-GR');
 instance.onresult({resultIndex:0,results:[Object.assign([{transcript:'βρες μου συναυλίες'}],{isFinal:false})]});
 assert.equal(field.value,'βρες μου συναυλίες');
 instance.onresult({resultIndex:0,results:[Object.assign([{transcript:'βρες μου συναυλίες στην Αθήνα'}],{isFinal:true})]});
 button.fire('click');
 assert.equal(field.value,'βρες μου συναυλίες στην Αθήνα');
 assert.match(status.textContent,/Στέλνω σε λίγο/);
 await new Promise(r=>setTimeout(r,V.SEND_DELAY+100));
 assert.equal(sent,1);
});
test('touching the text cancels the automatic send; no support hides the mic',async()=>{
 let instance;class Rec{constructor(){instance=this}start(){}stop(){this.onend()}}
 const V=load(Rec);
 const field=el(),button=el();let sent=0;const form={...el(),requestSubmit(){sent++}};
 V.attach({field,button,form});button.fire('click');
 instance.onresult({resultIndex:0,results:[Object.assign([{transcript:'γεια'}],{isFinal:true})]});
 button.fire('click');field.fire('pointerdown');
 await new Promise(r=>setTimeout(r,V.SEND_DELAY+100));
 assert.equal(sent,0);
 const none=load(undefined);const b=el();
 assert.equal(none.attach({field:el(),button:b,form:el()}),null);assert.equal(b.hidden,true);
});
test('wired into every chat composer, loaded before the Messenger',()=>{
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/form\.append\(field,mic,send\)/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('voice-input.js')>0&&html.indexOf('voice-input.js')<html.indexOf('world-dialogue.js'));
 assert.doesNotMatch(fs.readFileSync('js/voice-input.js','utf8'),/fetch\(|MediaRecorder|localStorage/,'no audio recording or upload');
});
