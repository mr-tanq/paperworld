/* PAPERWORLD Messenger text formatting.
 * Safe Markdown subset for AI replies: paragraphs, headings, lists, quotes,
 * fenced code, **bold**, *italic*, `code` and https links. Produces DOM nodes
 * only (never innerHTML) so model output can never inject markup or script.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldMessengerFormat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const MAX=20000;
 function normalize(text){
  // Some Copilot replies contain literal escaped newlines.
  return String(text||'').slice(0,MAX).replace(/\r\n?/g,'\n').replace(/\\n/g,'\n');
 }
 // Block structure: [{type:'p'|'h'|'ul'|'ol'|'quote'|'code', ...}]
 function parseBlocks(input){
  const lines=normalize(input).split('\n'),blocks=[];
  let i=0;
  while(i<lines.length){
   const line=lines[i];
   if(!line.trim()){i++;continue}
   const fence=/^\s*```\s*([\w+-]{0,20})\s*$/.exec(line);
   if(fence){
    const body=[];i++;
    while(i<lines.length&&!/^\s*```\s*$/.test(lines[i]))body.push(lines[i++]);
    i++;blocks.push({type:'code',lang:fence[1]||'',text:body.join('\n')});continue;
   }
   const heading=/^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
   if(heading){blocks.push({type:'h',level:heading[1].length,text:heading[2]});i++;continue}
   if(/^\s*([-*•])\s+/.test(line)){
    const items=[];
    while(i<lines.length&&/^\s*([-*•])\s+/.test(lines[i]))
     items.push(lines[i++].replace(/^\s*[-*•]\s+/,''));
    blocks.push({type:'ul',items});continue;
   }
   if(/^\s*\d{1,3}[.)]\s+/.test(line)){
    const items=[];
    while(i<lines.length&&/^\s*\d{1,3}[.)]\s+/.test(lines[i]))
     items.push(lines[i++].replace(/^\s*\d{1,3}[.)]\s+/,''));
    blocks.push({type:'ol',items});continue;
   }
   if(/^\s*>\s?/.test(line)){
    const body=[];
    while(i<lines.length&&/^\s*>\s?/.test(lines[i]))body.push(lines[i++].replace(/^\s*>\s?/,''));
    blocks.push({type:'quote',text:body.join('\n')});continue;
   }
   const para=[];
   while(i<lines.length&&lines[i].trim()&&!/^\s*```/.test(lines[i])&&
    !/^\s{0,3}#{1,4}\s/.test(lines[i])&&!/^\s*([-*•])\s+/.test(lines[i])&&
    !/^\s*\d{1,3}[.)]\s+/.test(lines[i])&&!/^\s*>\s?/.test(lines[i]))para.push(lines[i++]);
   blocks.push({type:'p',text:para.join('\n')});
  }
  return blocks;
 }
 // Inline tokens: [{t:'text'|'b'|'i'|'code'|'link', v, href}]
 const INLINE=/(`[^`\n]{1,400}`)|(\*\*[^*\n][^*\n]{0,400}?\*\*)|(__[^_\n]{1,400}?__)|(\*[^*\s][^*\n]{0,300}?\*)|(\[[^\]\n]{1,200}\]\(https:\/\/[^\s)]{1,500}\))|(https:\/\/[^\s<>"')\]]{3,500})/g;
 function safeHref(href){
  try{const u=new URL(href);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}
  catch(_){return null}
 }
 function parseInline(text){
  const out=[];let last=0,m;
  const s=String(text||'');INLINE.lastIndex=0;
  while((m=INLINE.exec(s))){
   if(m.index>last)out.push({t:'text',v:s.slice(last,m.index)});
   const raw=m[0];
   if(m[1])out.push({t:'code',v:raw.slice(1,-1)});
   else if(m[2])out.push({t:'b',v:raw.slice(2,-2)});
   else if(m[3])out.push({t:'b',v:raw.slice(2,-2)});
   else if(m[4])out.push({t:'i',v:raw.slice(1,-1)});
   else if(m[5]){
    const label=raw.slice(1,raw.indexOf(']')),href=safeHref(raw.slice(raw.indexOf('(')+1,-1));
    out.push(href?{t:'link',v:label,href}:{t:'text',v:label});
   }else{
    const trail=/[.,;:!?]+$/.exec(raw);const clean=trail?raw.slice(0,-trail[0].length):raw;
    const href=safeHref(clean);
    out.push(href?{t:'link',v:clean,href}:{t:'text',v:clean});
    if(trail)out.push({t:'text',v:trail[0]});
   }
   last=m.index+raw.length;
  }
  if(last<s.length)out.push({t:'text',v:s.slice(last)});
  return out;
 }
 function inlineInto(doc,host,text){
  for(const token of parseInline(text)){
   if(token.t==='text'){host.append(doc.createTextNode(token.v));continue}
   const tag=token.t==='b'?'strong':token.t==='i'?'em':token.t==='code'?'code':'a';
   const el=doc.createElement(tag);el.textContent=token.v;
   if(tag==='a'){el.href=token.href;el.target='_blank';el.rel='noopener noreferrer nofollow'}
   host.append(el);
  }
 }
 function render(doc,text){
  const frag=doc.createDocumentFragment();
  for(const block of parseBlocks(text)){
   let el;
   if(block.type==='code'){
    el=doc.createElement('pre');const code=doc.createElement('code');
    code.textContent=block.text;if(block.lang)code.dataset.lang=block.lang;el.append(code);
    el.tabIndex=0;
   }else if(block.type==='h'){
    el=doc.createElement('p');el.className='pw-md-heading';el.setAttribute('role','heading');
    el.setAttribute('aria-level',String(Math.min(6,block.level+2)));inlineInto(doc,el,block.text);
   }else if(block.type==='ul'||block.type==='ol'){
    el=doc.createElement(block.type);
    for(const item of block.items){const li=doc.createElement('li');inlineInto(doc,li,item);el.append(li)}
   }else if(block.type==='quote'){
    el=doc.createElement('blockquote');inlineInto(doc,el,block.text);
   }else{el=doc.createElement('p');inlineInto(doc,el,block.text)}
   frag.append(el);
  }
  return frag;
 }
 // Plain text without Markdown punctuation, for previews and summaries.
 function plain(text){
  return normalize(text).replace(/```[\s\S]*?```/g,' ').replace(/[*_`#>]+/g,'')
   .replace(/\[([^\]]+)\]\(https:\/\/[^)]+\)/g,'$1').replace(/\s+/g,' ').trim();
 }
 const LONG_CHARS=900;
 function isLong(text){return normalize(text).length>LONG_CHARS}
 // A readable lead for long reports: the first complete paragraph(s), never
 // cut mid-sentence. The full original text remains available on demand.
 function summary(text,max=420){
  const blocks=parseBlocks(text),parts=[];let used=0;
  for(const b of blocks){
   if(b.type!=='p'&&b.type!=='h')break;
   const t=plain(b.text);if(!t)continue;
   if(used&&used+t.length>max)break;
   if(t.length>max){
    const cut=t.slice(0,max),end=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('; '));
    parts.push((end>max*.5?cut.slice(0,end+1):cut.replace(/\s+\S*$/,''))+' …');used=max;break;
   }
   parts.push(t);used+=t.length;
   if(b.type==='p'&&used>max*.6)break;
  }
  return parts.join('\n')||plain(text).slice(0,max);
 }
 // Detect Crow's song package so the UI can offer "Open in Music Studio".
 function looksLikeSong(text){
  const t=normalize(text);
  return /(^|\n)\s*\**\s*TITLE\s*\**\s*:/i.test(t)&&/SUNO STYLE PROMPT/i.test(t)&&/(^|\n)\s*\**\s*LYRICS/i.test(t);
 }
 return Object.freeze({parseBlocks,parseInline,render,plain,summary,isLong,looksLikeSong,
  safeHref,LONG_CHARS});
});
