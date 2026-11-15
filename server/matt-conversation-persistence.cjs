/* Server-only persistence of verified Matt replies. No browser writes. */
'use strict';
const {encode}=require('../js/matt-history.js');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const BASE='https://jrevhzvrgenucuozjowm.supabase.co';
function createMattPersistence({fetcher=globalThis.fetch,secret=process.env.PAPERWORLD_SUPABASE_SERVICE_ROLE_KEY}={}){
 return Object.freeze({async save({threadId,ownerId,requestId,director,text}){
  if(!UUID.test(threadId||'')||!UUID.test(ownerId||'')||!UUID.test(requestId||''))return false;
  if(typeof secret!=='string'||!(secret.startsWith('sb_secret_')||secret.startsWith('eyJ')))return false;
  let content;
  try{content=encode(director,text)}catch(_){return false}
  if(content.length>2000)return false;
  try{const response=await fetcher(BASE+'/rest/v1/paperworld_agent_messages',{
   method:'POST',redirect:'error',headers:{
    apikey:secret,
    ...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),
    'Content-Type':'application/json',Prefer:'return=minimal'
   },body:JSON.stringify({id:requestId,thread_id:threadId,owner_id:ownerId,
    role:'agent',content}),signal:AbortSignal.timeout(8000)
  });return response?.ok===true}catch(_){return false}
 }});
}
module.exports=Object.freeze({createMattPersistence});