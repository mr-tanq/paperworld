/* PAPERWORLD phone notifications (browser side). Off until the owner turns
 * them on in Settings; then this device subscribes with standard Web Push and
 * the subscription is saved to the owner's own row (RLS). Turning off removes
 * it. Only Matt's updates are sent; nothing else is shared.
 */
(function(root,factory){'use strict';const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldPush=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
// Public half of the VAPID key pair (the private half lives only in Supabase).
const PUBLIC_KEY='BLcC5py3RbGWyTtPIzE2lVRJrKuBKzsW8umfVhay_k0a1OADCwwbSvuLeXVrxl57JoI23DF9X365ySBpDg5z5gk';
const toBytes=b64=>{const s=b64.replace(/-/g,'+').replace(/_/g,'/');
 const bin=root.atob(s+'='.repeat((4-s.length%4)%4));return Uint8Array.from(bin,c=>c.charCodeAt(0))};
const nav=()=>root.navigator||{};
function support(){
 const n=nav();
 if(!('serviceWorker' in n)||!root.PushManager||!root.Notification)
  return {ok:false,reason:/iPhone|iPad/.test(n.userAgent||'')?'ios_home_screen':'unsupported'};
 return {ok:true};
}
async function registration(){return nav().serviceWorker.register('./sw.js',{scope:'./'})}
async function current(){
 if(!support().ok)return null;
 try{const reg=await nav().serviceWorker.getRegistration('./');return reg?await reg.pushManager.getSubscription():null}catch(_){return null}
}
async function enabled(){return !!(await current())&&root.Notification?.permission==='granted'}
async function enable(cloud){
 const s=support();if(!s.ok)return {ok:false,reason:s.reason};
 const permission=await root.Notification.requestPermission();
 if(permission!=='granted')return {ok:false,reason:'denied'};
 const reg=await registration();await nav().serviceWorker.ready;
 const sub=(await reg.pushManager.getSubscription())||
  await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(PUBLIC_KEY)});
 const json=sub.toJSON();
 try{await cloud.savePushSubscription({endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth})}
 catch(_){await sub.unsubscribe().catch(()=>{});return {ok:false,reason:'save_failed'}}
 return {ok:true};
}
async function disable(cloud){
 const sub=await current();if(!sub)return {ok:true};
 const endpoint=sub.endpoint;await sub.unsubscribe().catch(()=>{});
 try{await cloud.deletePushSubscription(endpoint)}catch(_){}
 return {ok:true};
}
const REASONS={ios_home_screen:'Στο iPhone: πρώτα «Κοινοποίηση → Προσθήκη στην οθόνη Αφετηρίας», άνοιξε το PAPERWORLD από εκεί και ξαναδοκίμασε.',
 unsupported:'Αυτός ο browser δεν υποστηρίζει ειδοποιήσεις.',
 denied:'Οι ειδοποιήσεις είναι μπλοκαρισμένες για αυτή τη σελίδα. Επίτρεψέ τες από τις ρυθμίσεις του browser.',
 save_failed:'Δεν μπόρεσα να αποθηκεύσω τη συσκευή. Δοκίμασε ξανά σε λίγο.'};
// Tapping a notification opens the app on Matt's conversation.
if(root.navigator?.serviceWorker?.addEventListener)root.navigator.serviceWorker.addEventListener('message',e=>{
 if(e.data?.type==='open-matt')root.PaperworldWorldDialogue?.show?.('matt')});
// Opened from a notification (?open=matt): go straight to Matt's chat.
try{if(root.location&&new URLSearchParams(root.location.search).get('open')==='matt')
 root.addEventListener('load',()=>setTimeout(()=>root.PaperworldWorldDialogue?.show?.('matt'),900))}catch(_){}
return Object.freeze({support,enabled,enable,disable,REASONS,PUBLIC_KEY});
});
