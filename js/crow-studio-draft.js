/* Owner-only, client-memory handoff from Matt's verified Crow delegation.
 * No persistence, AI call, network request, invented lyrics or Suno submission.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldCrowStudioDraft=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // A chat reply is not automatically a Suno style prompt. Only import a
 // distinctly labeled direction, never lyrics, notes or unrelated conversation.
 function extractStyle(reply){
  if(typeof reply!=='string'||!reply.trim())return null;
  const lines=reply.replace(/\r\n?/g,'\n').split('\n');
  const heading=/^(?:suno\s*style\s*prompt|style\s*prompt|musical\s*direction|μουσικ(?:ό|η)\s*ύφος|μουσικ(?:ή|ης)\s*κατεύθυνση|ύφος(?:\s*\([^)]{1,100}\))?)\s*[:：]\s*(.*)$/i;
  const section=/^\s*(?:#{1,4}\s*)?(?:\*{0,2})(?:σημειώσεις|notes|lyrics|στίχοι|title|τίτλος|verse|chorus|bridge|outro|prompt|description)(?:\*{0,2})\s*[:：]?/i;
  for(let i=0;i<lines.length;i++){
   const match=lines[i].trim().replace(/^#{1,4}\s*/,'').replace(/\*\*/g,'').match(heading);
   if(!match)continue;
   const selected=[];
   if(match[1]?.trim())selected.push(match[1].trim());
   for(let j=i+1;j<lines.length&&selected.join(' ').length<1000;j++){
    const line=lines[j].trim();
    const label=line.replace(/^#{1,4}\s*/,'').replace(/\*\*/g,'');
    if(section.test(label)||heading.test(label)||/^\s*\[\s*(?:verse|chorus|bridge|outro)/i.test(line))break;
    if(!line){if(selected.length)break;continue}
    selected.push(line);
   }
   const result=selected.join(' ').replace(/\*\*/g,'').trim().slice(0,1000);
   return result||null;
  }
  return null;
 }
 function parseSong(reply){
  if(typeof reply!=='string'||!reply.trim())return null;
  const lines=reply.replace(/\r\n?/g,'\n').split('\n');
  const sections={title:[],style:[],lyrics:[]};
  const headings={
   title:/^title\s*[:：]\s*(.*)$/i,
   style:/^(?:suno\s*style\s*prompt|style\s*prompt)\s*[:：]\s*(.*)$/i,
   lyrics:/^lyrics\s*[:：]\s*(.*)$/i
  };
  let part=null;
  for(const raw of lines){
   const line=raw.trim().replace(/^#{1,4}\s*/,'').replace(/\*\*/g,'');
   let found=false;
   for(const [key,re] of Object.entries(headings)){
    const m=line.match(re);
    if(!m)continue;
    part=key;found=true;
    if(m[1]?.trim())sections[key].push(m[1].trim());
    break;
   }
   if(!found&&part)sections[part].push(raw);
  }
  const title=sections.title.join(' ').trim();
  const style=sections.style.join(' ').replace(/\s+/g,' ').trim();
  const lyrics=sections.lyrics.join('\n').trim();
  if(!title||title.length>120||!style||style.length>1000||
    !lyrics||lyrics.length>8000||!/^\[(?:Intro|Verse|Chorus|Pre-Chorus|Bridge|Outro|Instrumental|Break|End|Final)/im.test(lyrics))
   return null;
  return Object.freeze({title,style,lyrics});
 }
 function fromMatt({directorId,delegated,requestId,request,directorReport}={}){
  if(delegated!==true||directorId!=='studio-director'||
   typeof requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(requestId)||
   typeof request!=='string'||!request.trim()||request.length>1200||
   typeof directorReport!=='string'||!directorReport.trim()||
   directorReport.length>5500)return null;
  const clean=s=>s.replace(/\r\n?/g,'\n').trim();
  const song=parseSong(directorReport);
  const direction=song?.style||clean(directorReport).slice(0,1000);
  if(!direction)return null;
  return Object.freeze({
   source:'matt_to_crow',
   requestId,
   title:song?.title||'New Lost Wanderer Song',
   style:direction,
   lyrics:song?.lyrics||'',
   originalRequest:clean(request).slice(0,1200)
  });
 }
 function fromSavedHistory(rows,decode){
  // Require owner-scoped persisted Matt rows and the server's director envelope.
  // Never infer Crow ownership from natural language or a generic 409 error.
  if(!Array.isArray(rows)||typeof decode!=='function')return null;
  const recent=rows.slice(-24);
  for(let i=recent.length-1;i>=0;i--){
   const row=recent[i];
   if(row?.role!=='agent'||typeof row.content!=='string')continue;
   const parsed=decode(row.content);
   if(!parsed||parsed.director!=='studio-director')continue;
   const prior=recent.slice(0,i).reverse().find(item=>
    item?.role==='human'&&typeof item.content==='string'&&item.content.trim());
   if(!prior)return null;
   const draft=fromMatt({delegated:true,directorId:'studio-director',
    requestId:row.id,request:prior.content.slice(0,1200),
    directorReport:parsed.text});
   if(draft)return Object.freeze({...draft,source:'saved_matt_crow_reply'});
  }
  return null;
 }
 return Object.freeze({fromMatt,fromSavedHistory,extractStyle,parseSong});
});
