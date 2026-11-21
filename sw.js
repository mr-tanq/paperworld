/* PAPERWORLD service worker — phone notifications only (no caching, no
 * network interception). Shows Matt's updates and opens the app on tap. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{}}catch(_){}
 const title=typeof data.title==='string'&&data.title?data.title.slice(0,80):'PAPERWORLD';
 const body=typeof data.body==='string'?data.body.slice(0,240):'Νέα ενημέρωση από τον Matt.';
 event.waitUntil(self.registration.showNotification(title,{body,tag:typeof data.tag==='string'?data.tag:'pw',
  lang:'el',data:{url:'./?open=matt'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL('./?open=matt',self.registration.scope).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  for(const c of list){if(c.url.startsWith(self.registration.scope)){c.focus();c.postMessage({type:'open-matt'});return}}
  return self.clients.openWindow(target);
 }));
});
