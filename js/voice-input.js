/* PAPERWORLD voice input — speak instead of typing. Uses the browser's own
 * speech recognition (Chrome/Android, Safari): no extra service, no cost.
 * Tap 🎤, speak; the words appear in the message box as you talk. When you
 * stop, the message is sent after a short pause — tap the box during that
 * pause to correct it first. Never records or stores audio itself.
 */
(function(root,factory){'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldVoice=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
const SEND_DELAY=2200;
function Recognition(){return root.SpeechRecognition||root.webkitSpeechRecognition||null}
function supported(){return !!Recognition()}
// Greek by default; English when the owner chose English conversations.
function language(){
 try{if(root.PaperworldI18n?.chat?.()==='en')return 'en-US'}catch(_){}
 return 'el-GR';
}
const join=(a,b)=>[a,b].map(x=>String(x||'').trim()).filter(Boolean).join(' ');
function attach({field,button,form,status=null,autoSend=true}={}){
 if(!field||!button||!form)throw Error('voice_input_requires_field_button_form');
 const R=Recognition();
 if(!R){button.hidden=true;return null}
 let rec=null,base='',finalText='',listening=false,timer=null;
 const say=t=>{if(status){status.textContent=t;status.hidden=!t}};
 const set=on=>{listening=on;button.classList.toggle('pw-listening',on);button.setAttribute('aria-pressed',String(on));
  button.setAttribute('aria-label',on?'Σταμάτα την ηχογράφηση':'Μίλα αντί να γράφεις')};
 function cancelSend(){if(timer){clearTimeout(timer);timer=null;say('')}}
 function scheduleSend(){
  cancelSend();
  if(!autoSend||!field.value.trim())return say('');
  say('Στέλνω σε λίγο… πάτα το κείμενο για διόρθωση');
  timer=setTimeout(()=>{timer=null;say('');if(field.value.trim())form.requestSubmit?.()},SEND_DELAY);
 }
 function start(){
  cancelSend();
  rec=new R();rec.lang=language();rec.interimResults=true;rec.continuous=true;rec.maxAlternatives=1;
  base=field.value;finalText='';
  rec.onresult=e=>{
   let interim='';
   for(let i=e.resultIndex;i<e.results.length;i++){
    const r=e.results[i],t=r[0]?.transcript||'';
    if(r.isFinal)finalText=join(finalText,t);else interim=join(interim,t);
   }
   field.value=join(base,join(finalText,interim));
   field.dispatchEvent(new Event('input',{bubbles:true}));
  };
  rec.onerror=e=>{
   const why=e?.error==='not-allowed'||e?.error==='service-not-allowed'?
    'Επίτρεψε τη χρήση του μικροφώνου στον browser για να μιλάς.':
    e?.error==='no-speech'?'Δεν άκουσα κάτι. Πάτα ξανά το 🎤.':'';
   if(why)say(why);
  };
  rec.onend=()=>{set(false);rec=null;field.value=join(base,finalText);
   field.dispatchEvent(new Event('input',{bubbles:true}));if(finalText)scheduleSend()};
  try{rec.start();set(true);say('Σε ακούω…')}catch(_){set(false);say('')}
 }
 function stop(){try{rec?.stop()}catch(_){}}
 button.type='button';set(false);
 button.addEventListener('click',()=>{if(listening)stop();else start()});
 // Touching the text during the pause means "let me fix it first".
 for(const ev of ['pointerdown','keydown'])field.addEventListener(ev,cancelSend);
 form.addEventListener('submit',cancelSend);
 return Object.freeze({start,stop,cancelSend,listening:()=>listening});
}
return Object.freeze({attach,supported,language,SEND_DELAY});
});
