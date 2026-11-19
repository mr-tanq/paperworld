/* Crow reference recall: deterministic, project-local, no network, no model.
 *
 * When the owner names one of their own Lost Wanderer songs, albums or eras
 * ("something like Smoky Dreams", "in the style of Aftermath"), this module
 * resolves the reference against (a) the owner-curated catalogue below and
 * (b) the owner-APPROVED memory text already loaded for this turn, and emits
 * a compact dossier that separates:
 *   KNOWN     – curated/approved facts, with their source,
 *   CONTEXT   – neighbouring era palettes Crow may draw on, labelled inference,
 *   UNKNOWN   – characteristics no approved source records.
 * It never reads proposed/rejected memories, audio, lyrics or other projects.
 */
'use strict';
// Curated from server/crow-project-bible.cjs (owner-established context).
// Palettes are only included where the owner actually described them.
const ERAS=Object.freeze([
 {id:'album-i',name:'Album I — The Crow and the Lost Wanderer',aliases:['album i','album 1',
  'the crow and the lost wanderer','crow and the lost wanderer','debut album','first album'],
  period:'early concept record',
  palette:'darker, mystical, doom-leaning; cinematic experimental post-rock / dark folk, narrative concept',
  songs:['Dead Bunny','Mystical Forest','The Longest Night','The Crow','Crawl With Me',
   'Voices in the Dark','The Valley of Death','The Wanderer','Lord of the Trees','This Is Xibalba']},
 {id:'album-ii',name:'Album II — The Aftermath',aliases:['the aftermath','aftermath','album ii','album 2',
  'second album'],period:'after album I',
  palette:'urban, groove-first original trip-hop rhythms with stoner/atmospheric rock weight, deep bass, '+
   'rough organic textures, rhythm-driven arrangements, energized and often brighter/happier than album I; '+
   'no single album-wide tempo, vocal type or fixed instrumentation was established',
  songs:['Garden of Lies','Glorious Day','Trying to Forget','You Couldn\'t See','Is It Me','City of Gold',
   'I Wish I Knew','Living Again','Something Calling','The War Inside Me','Break Through My Skin',
   'Ashes of Myself','Change']},
 {id:'album-iii',name:'Album III — Reprise and the Lost Wanderer',aliases:['reprise','album iii','album 3',
  'reprise and the lost wanderer'],period:'after album II',
  palette:'acoustic reworkings of songs from album I',songs:[]},
 {id:'album-iv',name:'Album IV — slow noir-bolero period',aliases:['album iv','album 4','bolero noir',
  'noir bolero','slow noir bolero'],period:'before the September 2026 album V review',
  palette:'56–64 BPM hypnotic, constant fingerpicked nylon bolero guitar, brushed minimal/broken drums, '+
   'deep repeated bass, very sparse muted trumpet, subtle isokratema drone, restrained behind-the-beat baritone',
  songs:['Dancing Alone','It\'s Me','Morning Rise','Where Are You?','A Day to Remember',
   'Shadow on the Sun','Did It Again','The Odyssey','I\'m Still Here, Crow']},
 {id:'album-v',name:'Album V — No Destination',aliases:['no destination','album v','album 5'],
  period:'reviewed September 2026; mostly rejected',
  palette:null, // The owner never described album V's sound in approved context.
  status:'Most of this direction was rejected in September 2026; only Smoky Dreams was kept. '+
   'Do not treat the rest of album V as current canon.',
  songs:['Smoky Dreams'],neighbours:['album-iv','organic-electronica']},
 {id:'organic-electronica',name:'Organic melodic electronica / nocturnal travel experiments',
  aliases:['organic electronica','organic electronic'],period:'around and after album V',
  palette:'cinematic guitar-driven organic melodic electronic music, acoustic guitar, distant trumpet, '+
   'quietly spoken nocturnal travel reflections',
  songs:['And I..','04:47','Where Are You Now?']},
 {id:'acoustic-2026',name:'Indie / acoustic era (November 2026)',aliases:['acoustic era',
  'indie acoustic','acoustic folk'],period:'November 2026 (current)',
  palette:'Damien Rice / Ben Howard-like emotional intimacy (also Bon Iver, Kodaline), soft organic recording, '+
   'human live drums, fragile emotionally strained male vocals, build toward a vulnerable climax, '+
   'no brutal/shouted sections, stage noise or applause',
  songs:['The Things I Never Said','Still Searching','You Again?','There Is Nothing','The Moon','I Remember']}
]);
const UNKNOWN_FIELDS=['exact tempo','instrumentation','vocal delivery','structure','original lyrics','audio'];
function fold(value){
 return String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
  .replace(/ς/g,'σ').replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
// Damerau-free Levenshtein with an early exit; inputs are short titles.
function distance(a,b,limit){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const row=[i];let best=i;
  for(let j=1;j<=b.length;j++){
   row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   if(row[j]<best)best=row[j];
  }
  if(best>limit)return limit+1;
  prev=row;
 }
 return prev[b.length];
}
// Typo tolerance scales with length: "smokey dreams" ≈ "smoky dreams".
function tolerance(phrase){return phrase.length<5?0:phrase.length<10?1:2}
function mentions(foldedMessage,phrase){
 const target=fold(phrase);
 if(!target)return false;
 if((' '+foldedMessage+' ').includes(' '+target+' '))return true;
 const limit=tolerance(target);
 if(!limit)return false;
 const words=foldedMessage.split(' '),size=target.split(' ').length;
 for(let n=Math.max(1,size-1);n<=size+1;n++)
  for(let i=0;i+n<=words.length;i++)
   if(distance(words.slice(i,i+n).join(' '),target,limit)<=limit)return true;
 return false;
}
// A single generic word ("the crow", "change") is too ambiguous to resolve
// on its own unless the owner quotes it or calls it a song.
function songMentioned(folded,raw,title){
 const target=fold(title);
 if(target.split(' ').length>=2&&target.length>=10)return mentions(folded,title);
 const quoted=new RegExp('[«"“\']\\s*'+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[»"”\']','i');
 return quoted.test(raw)||new RegExp('(song|track|τραγούδι|κομμάτι)\\s+'+
  title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(raw);
}
function approvedNotesMentioning(memoryText,phrase){
 if(typeof memoryText!=='string'||!memoryText)return [];
 const target=fold(phrase),notes=[];
 for(const chunk of memoryText.split(/\n\n(?=\[)/)){
  const head=/^\[[a-z_]+ \| ([^|\]]{1,140}) \|/.exec(chunk);
  if(head&&mentions(fold(chunk),target))notes.push(head[1].trim());
 }
 return [...new Set(notes)].slice(0,4);
}
function resolve(message){
 const raw=String(message||'').slice(0,1200),folded=fold(raw);
 const hits=[];
 for(const era of ERAS){
  for(const song of era.songs)
   if(songMentioned(folded,raw,song))hits.push({type:'song',title:song,era});
  if(era.aliases.some(a=>mentions(folded,a)))hits.push({type:'era',title:era.name,era});
 }
 const seen=new Set();
 return hits.filter(h=>{const k=h.type+':'+h.title;if(seen.has(k))return false;seen.add(k);return true})
  .slice(0,3);
}
function buildReferenceDossier(message,{memoryText=''}={}){
 const hits=resolve(message);
 if(!hits.length)return {text:'',references:[]};
 const lines=['','OWNER CATALOGUE REFERENCE DOSSIER (resolved from the current request; curated owner '+
  'context + owner-APPROVED memory only; proposed or unapproved notes are deliberately excluded):'];
 for(const hit of hits){
  const era=hit.era,notes=approvedNotesMentioning(memoryText,hit.type==='song'?hit.title:era.aliases[0]);
  lines.push('• '+(hit.type==='song'?'SONG "'+hit.title+'" — belongs to '+era.name:'ALBUM/ERA '+era.name)+'.');
  lines.push('  KNOWN: period: '+era.period+'.'+(era.status?' '+era.status:'')+
   (era.palette?' Era palette (owner-described): '+era.palette+'.':'')+
   (notes.length?' Approved memory notes mentioning it: '+notes.join('; ')+'.':''));
  if(hit.type==='song'){
   if(!era.palette&&Array.isArray(era.neighbours)){
    const near=ERAS.filter(e=>era.neighbours.includes(e.id)&&e.palette);
    lines.push('  NEIGHBOURING CONTEXT (inference only, label it as such): '+
     near.map(e=>e.name+': '+e.palette).join(' | ')+'.');
   }
   lines.push('  UNKNOWN (no approved source): '+UNKNOWN_FIELDS.join(', ')+' of "'+hit.title+
    '" itself'+(era.palette?' beyond the era palette':'')+'.');
  }
 }
 lines.push('RESPONSE CONTRACT FOR THESE REFERENCES: Treat them as the owner\'s own catalogue — never ask '+
  'which artist/album is meant. Do NOT reply with a questionnaire. First give a concrete, musically '+
  'informed proposal (or the full song if one was requested) grounded in the KNOWN facts; where you use '+
  'NEIGHBOURING CONTEXT or the title\'s imagery, say briefly that it is your interpretation. Then name at '+
  'most ONE specific uncertainty that would most change the result (e.g. "I don\'t have Smoky Dreams\' '+
  'tempo — I assumed ~72 BPM; tell me if it was faster"). Never claim to know or quote the original '+
  'song\'s lyrics, audio, melody or arrangement.');
 return {text:lines.join('\n')+'\n',references:hits.map(h=>({type:h.type,title:h.title,era:h.era.id}))};
}
module.exports=Object.freeze({buildReferenceDossier,resolve,ERAS,fold,distance});
