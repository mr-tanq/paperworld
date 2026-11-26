/* PAPERWORLD service worker — phone notifications, plus a local copy of the
 * village ART only (images under ./assets/), so the app opens fast after the
 * first visit. Pages, scripts, styles and every cloud/API request always go
 * to the network untouched. Art is served from the copy and refreshed in the
 * background (a changed picture shows on the next open). */
const ART='paperworld-art-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 for(const k of await caches.keys())if(k.startsWith('paperworld-art-')&&k!==ART)await caches.delete(k);
 await self.clients.claim();
})()));
function isArt(request){
 if(request.method!=='GET')return false;
 const url=new URL(request.url),scope=new URL(self.registration.scope);
 return url.origin===scope.origin&&url.pathname.startsWith(scope.pathname+'assets/')&&/\.(webp|png|jpe?g)$/i.test(url.pathname);
}
self.addEventListener('fetch',event=>{
 if(!isArt(event.request))return;
 event.respondWith((async()=>{
  const cache=await caches.open(ART);const hit=await cache.match(event.request);
  const fresh=fetch(event.request).then(r=>{if(r.ok&&r.type==='basic')cache.put(event.request,r.clone()).catch(()=>{});return r});
  if(hit){event.waitUntil(fresh.catch(()=>{}));return hit}
  return fresh;
 })());
});
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
