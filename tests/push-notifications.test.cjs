'use strict';
// Phone notifications: standard Web Push, decryptable by the browser, only
// Matt's notification messages, at most once, owner-only subscriptions.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const load=()=>import('../supabase/functions/paperworld-push/webpush.mjs');
const loadIndex=()=>import('../supabase/functions/paperworld-push/index.mjs');
async function hkdf(salt,ikm,info,n){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,n*8))}
test('aes128gcm payload decrypts with the browser keys (RFC 8291)',async()=>{
 const {encryptPayload,b64u}=await load();
 const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const uaPub=new Uint8Array(await crypto.subtle.exportKey('raw',ua.publicKey));
 const authSecret=crypto.getRandomValues(new Uint8Array(16));
 const body=await encryptPayload({p256dh:b64u.encode(uaPub),auth:b64u.encode(authSecret)},'{"title":"Matt"}');
 const salt=body.slice(0,16),idlen=body[20],asPub=body.slice(21,21+idlen),cipher=body.slice(21+idlen);
 assert.equal(new DataView(body.buffer,body.byteOffset+16,4).getUint32(0),4096);
 const asKey=await crypto.subtle.importKey('raw',asPub,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:asKey},ua.privateKey,256));
 const te=new TextEncoder(),cat=(...p)=>{const o=new Uint8Array(p.reduce((n,x)=>n+x.length,0));let i=0;for(const x of p){o.set(x,i);i+=x.length}return o};
 const ikm=await hkdf(authSecret,shared,cat(te.encode('WebPush: info\0'),uaPub,asPub),32);
 const cek=await hkdf(salt,ikm,te.encode('Content-Encoding: aes128gcm\0'),16);
 const nonce=await hkdf(salt,ikm,te.encode('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']);
 const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},key,cipher));
 assert.equal(plain[plain.length-1],2);
 assert.equal(new TextDecoder().decode(plain.slice(0,-1)),'{"title":"Matt"}');
});
test('VAPID token is ES256, aimed at the push origin, with the app URL as subject',async()=>{
 const {vapidHeader,b64u}=await load();
 const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',k.privateKey);
 const pub=b64u.encode(await crypto.subtle.exportKey('raw',k.publicKey));
 const h=await vapidHeader('https://fcm.googleapis.com/fcm/send/abc',{publicKey:pub,privateJwk:jwk,subject:'https://mr-tanq.github.io/paperworld/'});
 const [,t,kk]=h.match(/^vapid t=([^,]+), k=(.+)$/);assert.equal(kk,pub);
 const [a,b,sig]=t.split('.');
 const claims=JSON.parse(new TextDecoder().decode(b64u.decode(b)));
 assert.equal(claims.aud,'https://fcm.googleapis.com');assert.equal(claims.sub,'https://mr-tanq.github.io/paperworld/');
 assert.ok(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k.publicKey,b64u.decode(sig),new TextEncoder().encode(a+'.'+b)));
});
test('only Matt notification messages become phone notifications; endpoints are push services only',async()=>{
 const {notificationFor}=await loadIndex();const {safeEndpoint}=await load();
 const msg=(o)=>({id:'1',content:'@paperworld-matt:v1:'+JSON.stringify(o)});
 const n=notificationFor(msg({kind:'notification',director:'listening-director',text:'Η Luna τελείωσε https://x.y/z την εργασία'}));
 assert.equal(n.title,'Luna μέσω Matt');assert.doesNotMatch(n.body,/https/);assert.equal(n.url,'./?open=matt');
 assert.equal(notificationFor(msg({director:'matt',text:'απλή απάντηση συνομιλίας'})),null);
 assert.equal(notificationFor({id:'2',content:'hello'}),null);
 assert.ok(notificationFor(msg({kind:'notification',text:'x'.repeat(400)})).body.length<=180);
 assert.ok(safeEndpoint('https://web.push.apple.com/abc'));assert.ok(safeEndpoint('https://fcm.googleapis.com/fcm/send/x'));
 assert.ok(!safeEndpoint('https://evil.example/fcm'));assert.ok(!safeEndpoint('http://fcm.googleapis.com/x'));
});
test('sender claims each message once before sending and removes dead devices',async()=>{
 const {createPushSender}=await loadIndex();
 const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const {b64u}=await load();
 const p256dh=b64u.encode(await crypto.subtle.exportKey('raw',ua.publicKey)),auth=b64u.encode(crypto.getRandomValues(new Uint8Array(16)));
 const v=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']);
 const jwk=await crypto.subtle.exportKey('jwk',v.privateKey),pub=b64u.encode(await crypto.subtle.exportKey('raw',v.publicKey));
 const owner='11111111-1111-4111-8111-111111111111',claimed=new Set(),calls=[];
 const subs=[{owner_id:owner,endpoint:'https://fcm.googleapis.com/fcm/send/a',p256dh,auth,created_at:'2026-11-21T06:00:00Z'},
  {owner_id:owner,endpoint:'https://web.push.apple.com/gone',p256dh,auth,created_at:'2026-11-21T06:00:00Z'}];
 const rows=[{id:'m1',owner_id:owner,created_at:'2026-11-21T07:00:00Z',content:'@paperworld-matt:v1:'+JSON.stringify({kind:'notification',text:'Έτοιμο'})},
  {id:'m2',owner_id:owner,created_at:'2026-11-21T07:01:00Z',content:'@paperworld-matt:v1:'+JSON.stringify({text:'chat'})}];
 const fetcher=async(url,o={})=>{calls.push([o.method||'GET',url]);
  const json=b=>({ok:true,status:200,json:async()=>b});
  if(url.includes('paperworld_push_subscriptions_v1')&&(o.method||'GET')==='GET')return json(subs);
  if(url.includes('paperworld_push_subscriptions_v1'))return {ok:true,status:204};
  if(url.includes('paperworld_agent_messages'))return json(rows);
  if(url.includes('paperworld_push_sent_v1')){const id=JSON.parse(o.body).message_id;const fresh=!claimed.has(id);claimed.add(id);return json(fresh?[{message_id:id}]:[])}
  if(url.includes('apple.com'))return {ok:false,status:410};
  return {ok:true,status:201};
 };
 const env={SUPABASE_SERVICE_ROLE_KEY:'x'.repeat(40),PAPERWORLD_VAPID_PUBLIC_KEY:pub};
 const s=createPushSender({environment:k=>env[k],fetcher,clock:()=>Date.parse('2026-11-21T07:05:00Z')});
 assert.deepEqual(await s.runOnce(),{state:'not_configured'},'no key, nothing sent');
 assert.deepEqual(await s.runOnce({vaultKey:JSON.stringify(jwk)}),{state:'done',sent:1,gone:1});
 assert.ok(calls.some(([m,u])=>m==='DELETE'&&u.includes(encodeURIComponent('https://web.push.apple.com/gone'))));
 assert.deepEqual(await s.runOnce({vaultKey:JSON.stringify(jwk)}),{state:'done',sent:0,gone:0},'never twice');
 assert.equal(calls.filter(([,u])=>u.includes('fcm.googleapis')).length,1);
});
test('browser side: off by default, saved to the owner\'s own row, SQL is owner-only',()=>{
 const push=fs.readFileSync('js/push-notify.js','utf8'),sw=fs.readFileSync('sw.js','utf8');
 assert.match(push,/const PUBLIC_KEY='B[A-Za-z0-9_-]{86}'/);assert.doesNotMatch(push,/"d"|privateJwk/);
 assert.match(sw,/showNotification/);assert.doesNotMatch(sw,/addEventListener\('fetch'/);
 const sql=fs.readFileSync('sql/paperworld_push_notifications_v1.sql','utf8');
 assert.match(sql,/for insert to authenticated with check \(\(select auth\.uid\(\)\)=owner_id\)/);
 assert.match(sql,/revoke all on public\.paperworld_push_sent_v1 from public,anon,authenticated/);
 assert.match(sql,/into vapid using 'paperworld_vapid_private_jwk'/);
 assert.match(sql,/if waiting=0 then return '\{"state":"idle"\}'/);
 assert.match(fs.readFileSync('js/workspace.js','utf8'),/settingRow\('Ειδοποιήσεις στο κινητό'/);
 assert.match(fs.readFileSync('index.html','utf8'),/push-notify\.js\?v=1/);
});
