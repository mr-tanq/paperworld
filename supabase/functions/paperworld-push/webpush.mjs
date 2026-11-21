/* Standard Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) with WebCrypto only.
 * Works in Deno (Edge Function) and Node 22 (tests). No dependencies, no IO
 * except the one POST to the browser's own push service.
 */
const enc=new TextEncoder();
const b64u={
 encode(bytes){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')},
 decode(text){const s=String(text).replace(/-/g,'+').replace(/_/g,'/');
  const bin=atob(s+'='.repeat((4-s.length%4)%4));return Uint8Array.from(bin,c=>c.charCodeAt(0))}
};
const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
 let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out};
async function hkdf(salt,ikm,info,bytes){
 const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,bytes*8));
}
// Only https endpoints of the browsers' own push services are ever contacted.
const PUSH_HOSTS=[/\.push\.apple\.com$/,/^fcm\.googleapis\.com$/,/^updates\.push\.services\.mozilla\.com$/,
 /\.notify\.windows\.com$/,/^push\.services\.mozilla\.com$/,/^android\.googleapis\.com$/];
function safeEndpoint(url){
 try{const u=new URL(url);return u.protocol==='https:'&&PUSH_HOSTS.some(r=>r.test(u.hostname))&&!u.username&&!u.password}
 catch(_){return false}
}
// RFC 8291: encrypt one record for the subscriber's p256dh/auth keys.
async function encryptPayload({p256dh,auth},plaintext,{salt=crypto.getRandomValues(new Uint8Array(16)),serverKeys=null}={}){
 const uaPublic=b64u.decode(p256dh),authSecret=b64u.decode(auth);
 if(uaPublic.length!==65||uaPublic[0]!==4||authSecret.length!==16)throw Error('bad_subscription_keys');
 const as=serverKeys||await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const asPublic=new Uint8Array(await crypto.subtle.exportKey('raw',as.publicKey));
 const uaKey=await crypto.subtle.importKey('raw',uaPublic,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},as.privateKey,256));
 const ikm=await hkdf(authSecret,shared,concat(enc.encode('WebPush: info\0'),uaPublic,asPublic),32);
 const cek=await hkdf(salt,ikm,enc.encode('Content-Encoding: aes128gcm\0'),16);
 const nonce=await hkdf(salt,ikm,enc.encode('Content-Encoding: nonce\0'),12);
 const data=typeof plaintext==='string'?enc.encode(plaintext):plaintext;
 if(data.length>3000)throw Error('payload_too_large');
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,concat(data,Uint8Array.of(2))));
 const rs=new Uint8Array(4);new DataView(rs.buffer).setUint32(0,4096);
 return concat(salt,rs,Uint8Array.of(asPublic.length),asPublic,cipher);
}
// RFC 8292: short-lived ES256 token for the push service's origin. The
// subject is the app's public URL (never a personal e-mail address).
async function vapidHeader(endpoint,{publicKey,privateJwk,subject,now=Date.now()}){
 const aud=new URL(endpoint).origin;
 const header=b64u.encode(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const claims=b64u.encode(enc.encode(JSON.stringify({aud,exp:Math.floor(now/1000)+12*3600,sub:subject})));
 const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(header+'.'+claims));
 return 'vapid t='+header+'.'+claims+'.'+b64u.encode(sig)+', k='+publicKey;
}
async function sendPush(subscription,payload,{vapid,fetcher=fetch,ttl=86400}){
 if(!safeEndpoint(subscription?.endpoint))return {state:'skipped',reason:'endpoint_not_allowed'};
 const body=await encryptPayload(subscription,JSON.stringify(payload));
 const res=await fetcher(subscription.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
  headers:{'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:String(ttl),Urgency:'normal',
   Authorization:await vapidHeader(subscription.endpoint,vapid)},body});
 if(res.status===404||res.status===410)return {state:'gone'};
 return res.ok?{state:'sent'}:{state:'failed',status:res.status};
}
export {b64u,encryptPayload,vapidHeader,sendPush,safeEndpoint};
