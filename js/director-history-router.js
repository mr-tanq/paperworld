/* Conservative, browser-local historical conversation suggestions.
 * No model calls, network, credentials, or automatic import decisions.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PaperworldHistoryRouter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const PROJECTS=Object.freeze({
  workshop:'Luna',pokemon:'Joey',studio:'Crow',wellbeing:'Dave'
 });
 const SIGNALS=Object.freeze({
  workshop:[
   [/\blistening mirror\b/iu,9],[/\bconcerts?\b/iu,2],
   [/\bsetlist\b/iu,4],[/\blast\.fm\b/iu,5],
   [/\bticketswap\b/iu,5],[/\bdeciding\b/iu,3],
   [/\bpodiuminfo\b/iu,5],[/\bfestivalinfo\b/iu,5],
   [/\bσυναυλι(?:α|ες|ών|ων)\b/iu,4],
   [/\bφεστιβαλ\b/iu,3],
   [/\bεισιτηρι(?:ο|α|ων)\b/iu,3]],
  pokemon:[
   [/\bpok[eé]mon\s*echoes\b/iu,10],
   [/\bpok[eé]mon\b/iu,3],
   [/\bgodot\b/iu,4],[/\balder town\b/iu,7],
   [/\broute 1\b/iu,3],
   [/\bdialogue manager\b/iu,5],
   [/\bποκεμον\b/iu,3]],
  studio:[
   [/\bthe lost wanderer\b/iu,10],
   [/\bgolden ray\b/iu,8],
   [/\bxibalba records\b/iu,8],
   [/\bsuno\b/iu,5],
   [/\bbolero\b/iu,5],
   [/\bηχογραφ(?:ηση|ησεις)\b/iu,3],
   [/\bενορχηστρ(?:ωση|ωσεις)\b/iu,4],
   [/\bστιχ(?:οι|ους|ων|ο)\b/iu,3],
   [/\bτραγουδ(?:ι|ια|ιων)\b/iu,2]],
  wellbeing:[
   [/\bμηνισκ(?:ος|ου|ο|οι)\b/iu,8],
   [/\bmeniscus\b/iu,8],
   [/\bφυσιοθεραπ(?:εια|ειας|ειες)\b/iu,8],
   [/\bphysiotherap(?:y|ist)\b/iu,8],
   [/\bοσφυαλγ(?:ια|ιας)\b/iu,7],
   [/\bαυχεν(?:ας|α|ικο)\b/iu,5],
   [/\brehabilitation\b/iu,3],
   [/\bπροπονησ(?:η|εις)\b/iu,2],
   [/\bυπεραναλυσ(?:η|εις)\b/iu,5],
   [/\bδιατροφη\b/iu,2],
   [/\bwellbeing\b/iu,5]]
 });
 const fold=x=>String(x||'').normalize('NFD').replace(/\p{M}/gu,'')
  .toLocaleLowerCase().replace(/ς/g,'σ');
 function route(item,messages=[]){
  const title=fold(item?.title);
  // Only user-authored text is sampled; historical assistant speculation is
  // not evidence of a conversation's intended Director.
  const sample=fold((Array.isArray(messages)?messages:[])
   .filter(m=>m?.role==='user'&&typeof m.text==='string')
   .slice(0,12).map(m=>m.text.slice(0,350)).join(' ')).slice(0,3500);
  const result=Object.entries(SIGNALS).map(([projectId,rules])=>{
   let score=0,matched=0;
   for(const [pattern,weight] of rules){
    if(pattern.test(title)){score+=weight*2;matched++}
    else if(pattern.test(sample)){score+=weight;matched++}
   }
   return {projectId,score,matched};
  }).sort((a,b)=>b.score-a.score);
  const [best,other]=result;
  // Favor precision over coverage: no generic single-keyword guesses.
  const confident=best.score>=9&&(best.matched>=2||best.score>=14)&&
   best.score>=other.score+7;
  return Object.freeze({projectId:confident?best.projectId:null,
   confidence:confident?'suggested':'needs_review',
   reason:confident?'Βρέθηκαν ξεκάθαρες αναφορές στο συγκεκριμένο project.':
    best.score&&other.score>=best.score-6?'Πιθανή ανάμειξη projects.':
    'Δεν υπάρχουν αρκετά ξεκάθαρα στοιχεία.',
   candidates:result.filter(x=>x.score>0).map(x=>({projectId:x.projectId,score:x.score}))});
 }
 function suggest(source,parser,{limit=30000}={}){
  if(!parser||typeof parser.catalog!=='function'||
   typeof parser.mainMessages!=='function')throw Error('History router parser required');
  const catalog=parser.catalog(source);
  if(!Number.isInteger(limit)||limit<1||limit>30000)throw Error('Invalid catalog bound');
  return catalog.slice(0,limit).map(item=>{
   const match=route(item,parser.mainMessages(source[item.index]));
   return Object.freeze({...item,...match});
  });
 }
 return Object.freeze({PROJECTS,route,suggest});
});