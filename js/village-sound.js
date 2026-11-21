/* PAPERWORLD village sounds — optional, OFF by default, synthesized with the
 * Web Audio API (no audio files, no network). A soft stream, birds by day,
 * crickets by night, and a gentle chime when a resident replies. The audio
 * context starts only after the owner switches sound on (a user gesture).
 */
(function(root,factory){'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldSound=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
const KEY='paperworld-pref-sound';
const store={get(){try{return root.localStorage?.getItem(KEY)==='1'}catch(_){return false}},
 set(v){try{root.localStorage?.setItem(KEY,v?'1':'0')}catch(_){}}};
let ctx=null,master=null,stream=null,timer=null,enabledNow=store.get();
const night=(d=new Date())=>{const h=d.getHours();return h>=19||h<6};
function ensure(){
 if(ctx)return ctx;
 const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return null;
 ctx=new AC();master=ctx.createGain();master.gain.value=.9;master.connect(ctx.destination);
 return ctx;
}
function startStream(){
 if(!ctx||stream)return;
 // Brown noise through a low-pass filter: a quiet brook.
 const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),data=buf.getChannelData(0);
 let last=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+.02*w)/1.02;data[i]=last*3.2}
 const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
 const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;
 const g=ctx.createGain();g.gain.value=.05;
 src.connect(lp);lp.connect(g);g.connect(master);src.start();stream={src,g};
}
function chirp(t,f0,f1,dur,vol){
 const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';
 o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);
}
function ambientTick(){
 if(!ctx||!enabledNow)return;
 const t=ctx.currentTime+.05;
 if(night()){for(let i=0;i<3;i++)chirp(t+i*.09,4300,4200,.05,.018)}           // crickets
 else{const n=2+Math.floor(Math.random()*3),base=2400+Math.random()*900;        // birdsong
  for(let i=0;i<n;i++)chirp(t+i*.13,base*(1+Math.random()*.2),base*1.45,.09,.03)}
 timer=setTimeout(ambientTick,(night()?2500:6000)+Math.random()*(night()?3000:8000));
}
function chime(){
 if(!enabledNow||!ensure())return false;
 const t=ctx.currentTime+.02;
 for(const [f,d] of [[880,0],[1318.5,.11]]){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;
  g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(.08,t+d+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d+.9);
  o.connect(g);g.connect(master);o.start(t+d);o.stop(t+d+1);
 }
 return true;
}
function setEnabled(on){
 enabledNow=on===true;store.set(enabledNow);
 if(enabledNow){if(!ensure())return false;ctx.resume?.();startStream();clearTimeout(timer);timer=setTimeout(ambientTick,1200);
  stream&&stream.g.gain.setTargetAtTime(.05,ctx.currentTime,.4)}
 else{clearTimeout(timer);if(ctx&&stream)stream.g.gain.setTargetAtTime(0,ctx.currentTime,.3);ctx?.suspend?.()}
 return true;
}
// Resume after the first tap if the owner had sound on last time (browsers
// require a gesture before audio may start).
if(root.document){
 const kick=()=>{if(enabledNow)setEnabled(true);root.document.removeEventListener('pointerdown',kick)};
 root.document.addEventListener('pointerdown',kick);
 root.document.addEventListener('visibilitychange',()=>{if(!ctx)return;
  if(root.document.hidden)ctx.suspend?.();else if(enabledNow)ctx.resume?.()});
}
return Object.freeze({setEnabled,enabled:()=>enabledNow,chime,night,KEY});
});
