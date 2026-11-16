/* Prepare an exact, owner-reviewed song request for a Suno MCP-capable assistant.
 * This module is offline, does not contact Suno and never authorizes spending.
 */
(function(root,factory){
 'use strict';
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 else root.PaperworldCrowSunoPrompt=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function clean(value,max){
  if(typeof value!=='string'||value.length>max)return null;
  const normalized=value.replace(/\r\n?/g,'\n').trim();
  return normalized||null;
 }
 function format({title,style,lyrics=''}={}){
  const name=clean(title,120),direction=clean(style,1000);
  if(!name||!direction||typeof lyrics!=='string'||lyrics.length>8000)
   throw Error('invalid_crow_suno_brief');
  const words=lyrics.trim();
  return [
   'Suno: Create ONE original song using my existing Suno account credits,',
   'but FIRST show the credit cost and ASK ME for explicit approval.',
   'Do not generate, extend, cover or use credits until I explicitly confirm.',
   '',
   'Title: '+name,
   'Musical direction: '+direction,
   words?'Original lyrics (use these words, no unsolicited repeats):\n'+words:
    'Lyrics: instrumental, unless I explicitly ask for vocals.',
   '',
   'Do not imitate any specific living artist or copy an existing song.',
   'After approval, return the actual Suno library link, not a fictional result.'
  ].join('\n');
 }
 return Object.freeze({format});
});
