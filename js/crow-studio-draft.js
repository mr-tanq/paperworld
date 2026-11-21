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
 // Parse only explicit, complete Crow song packages. Do not treat chat prose as
 // a music prompt, and never send trailing notes or metadata as sung lyrics.
 const labels={
  title:/^(?:title|song\s*title|τίτλος(?:\s+τραγουδιού)?)\s*[:：]\s*(.*)$/i,
  style:/^(?:suno\s*style\s*prompt|style\s*prompt|style|suno\s*style|μουσικ(?:ό|ή)\s*ύφος|μουσικ(?:ή|ής)\s*κατεύθυνση|ύφος(?:\s*\([^)]{1,100}\))?)\s*[:：]\s*(.*)$/i,
  lyrics:/^(?:lyrics|song\s*lyrics|στίχοι)\s*[:：]\s*(.*)$/i
 };
 const other=/^(?:notes?|σημειώσεις|explanation|επεξήγηση|σχόλια|comments?|production\s*notes?|production\s*details?|description|περιγραφή|suggestions?|εναλλακτικές|next\s*steps?|οδηγίες|credits?|summary|περίληψη|analysis|ανάλυση|prompt|τίτλος|title|song\s*title|style|suno\s*style\s*prompt|lyrics|στίχοι)\s*(?:[:：]|$)/i;
 const marker=/^\[(?:intro|verse(?:\s+\d+)?|pre[\s-]?chorus|chorus|post[\s-]?chorus|bridge|outro|instrumental|break|interlude|solo|end|final|hook|refrain)(?:\s|[-—:]|\])/i;
 function plain(line){
  return line.trim().replace(/^#{1,6}\s*/,'').replace(/^>\s*/,'')
   .replace(/^\*\*(.*?)\*\*(:?)/,'$1$2').replace(/__(.*?)__(:?)/,'$1$2')
   .replace(/^\*([^*]+)\*(:?)/,'$1$2').trim();
 }
 function sectionLabel(line){
  const text=plain(line);
  for(const [name,re] of Object.entries(labels)){
   const m=text.match(re);if(m)return {name,inline:m[1]||''};
  }
  return other.test(text)?{name:'stop'}:null;
 }
 function linesOf(reply){
  return reply.replace(/\r\n?/g,'\n').replace(/\\n/g,'\n').split('\n');
 }
 function cleanStyle(lines){
  const text=lines.map(x=>plain(x)).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  return text&&text.length<=1000?text:null;
 }
 function extractStyle(reply){
  if(typeof reply!=='string'||!reply.trim())return null;
  const lines=linesOf(reply);let inside=false,parts=[];
  for(const raw of lines){
   const line=plain(raw),label=sectionLabel(raw);
   if(label){
    if(inside)break;
    if(label.name==='style'){
     inside=true;if(label.inline.trim())parts.push(label.inline.trim());
    }
    continue;
   }
   if(!inside)continue;
   if(/^`{3,}/.test(line)){if(parts.length)break;continue}
   if(!line){if(parts.length)break;continue}
   if(marker.test(line)||/^\[/.test(line))break;
   parts.push(line);
  }
  return cleanStyle(parts);
 }
 // Detect clipped / malformed bracketed production cues before passing
 // anything to Suno. The finished Crow package must terminate at [End].
 function validLyrics(lyrics,{requireEnd=false}={}){
  if(typeof lyrics!=='string'||!lyrics.trim()||lyrics.length>8000)return false;
  const lines=lyrics.replace(/\r\n?/g,'\n').split('\n').map(v=>v.trim()).filter(Boolean);
  if(!lines.length)return false;
  let vocal=false,sections=0;
  for(const line of lines){
   if(line.startsWith('[')||line.endsWith(']')){
    // A production direction occupies one whole, closed bracketed line.
    if(!/^\[[^\[\]\r\n]{1,500}\]$/.test(line))return false;
    if(marker.test(line)&&!/^\[(?:end|final)\s*\]$/i.test(line))sections++;
   }else{
    // Stray bracket characters in a lyric line indicate truncated text.
    if(line.includes('[')||line.includes(']'))return false;
    vocal=true;
   }
  }
  if(sections===0)return false;
  // Instrumental / wordless songs (e.g. "aman" vocal improvisation) have only
  // bracketed directions. Accept them only when clearly complete: at least two
  // sections and a final [End], so truncated text is never sent.
  if(!vocal&&(sections<2||lines.at(-1)!=='[End]'))return false;
  if(requireEnd&&lines.at(-1)!=='[End]')return false;
  return true;
 }
 function parseSong(reply){
  if(typeof reply!=='string'||!reply.trim())return null;
  const sections={title:[],style:[],lyrics:[]};
  const seen=new Set();let part=null,stopped=false;
  for(const raw of linesOf(reply)){
   const line=plain(raw),label=sectionLabel(raw);
   if(label){
    if(label.name==='stop'){if(part==='lyrics')stopped=true;part=null;continue}
    // Repeated section labels are ambiguous; reject rather than guess.
    if(seen.has(label.name))return null;
    seen.add(label.name);part=label.name;
    if(label.inline.trim())sections[part].push(label.inline.trim());
    continue;
   }
   if(stopped||!part)continue;
   if(!line&&(part==='title'||part==='style')&&sections[part].some(v=>v.trim())){
    part=null;continue;
   }
   if(/^`{3,}/.test(line))continue;
   if(part==='lyrics'&&/^(?:---+|___+|thanks(?:\s|[!.])|ελπίζω(?:\s|[!.])|let\s+me\s+know\b)/i.test(line)){
    stopped=true;part=null;continue;
   }
   sections[part].push(raw);
  }
  if(!seen.has('title')||!seen.has('style')||!seen.has('lyrics'))return null;
  const title=sections.title.map(plain).filter(Boolean).join(' ').trim();
  const style=cleanStyle(sections.style);
  const lyricLines=sections.lyrics.map(x=>x.trim());
  while(lyricLines.length&&!lyricLines[0])lyricLines.shift();
  while(lyricLines.length&&!lyricLines.at(-1))lyricLines.pop();
  // Introductory chat text is not a lyric. A real package begins with a
  // structured performance/section tag and contains at least one vocal line.
  if(!lyricLines.length||!marker.test(lyricLines[0]))return null;
  const endIndex=lyricLines.findIndex(l=>/^\[(?:end|final)\s*\]$/i.test(l));
  if(endIndex>=0)lyricLines.splice(endIndex+1);
  if(lyricLines.some(l=>sectionLabel(l)||/^`{3,}/.test(l)))return null;
  const lyrics=lyricLines.join('\n').trim();
  if(!title||title.length>120||!style||
     !validLyrics(lyrics,{requireEnd:true}))return null;
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
  // No fallback that copies Matt's entire conversational report into the
  // Suno style field. Only a complete Crow song can be imported automatically.
  if(!song)return null;
  return Object.freeze({
   source:'matt_to_crow',
   requestId,
   title:song.title,
   style:song.style,
   lyrics:song.lyrics,
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
   // The most recent Crow response decides whether Studio can open.
   // Never silently resurrect an earlier song if Crow most recently asked
   // for clarification or gave an incomplete draft.
   return draft?Object.freeze({...draft,source:'saved_matt_crow_reply'}):null;
  }
  return null;
 }
 function sunoSongLink(value){
  if(typeof value!=='string'||value.length>500)return null;
  // Accept only Suno share and song-page URLs. Drop any tracking parameters.
  const match=value.trim().match(/^https:\/\/(?:www\.)?suno\.com\/(?:song\/([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})|s\/([a-zA-Z0-9_-]{6,64}))\/?(?:[?#][^\s]*)?$/);
  if(!match)return null;
  return 'https://suno.com'+(match[1]?'/song/'+match[1].toLowerCase():'/s/'+match[2]);
 }
 function revisionRequest({source,version,notes,viaMatt}={}){
  const original=sunoSongLink(source),alternate=sunoSongLink(version);
  if(!original||(version!=null&&(typeof version!=='string'||
     (version.trim()&&(!alternate||alternate===original))))||
     typeof notes!=='string'||!notes.trim()||notes.length>650)return null;
  return (viaMatt?'Ζήτησε από τον Crow να ετοιμάσει':'Ετοίμασε')+
   ' ένα πλάνο επεξεργασίας για το υπάρχον τραγούδι μου στο Suno.\n'+
   'Πρωτότυπο '+original+'\n'+(alternate?'Εναλλακτική εκδοχή '+alternate+'\n':'')+
   'Αλλαγές που θέλω\n'+notes.trim()+'\n'+
   'Χρησιμοποίησε τους συνδέσμους ως αναφορές. Κράτησε το πρωτότυπο και δώσε μόνο πλάνο.';
 }
 return Object.freeze({fromMatt,fromSavedHistory,extractStyle,parseSong,validLyrics,sunoSongLink,revisionRequest});
});
