/* PAPERWORLD bilingual UI — local, no network or translation of private messages. */
(function(root){'use strict';
const UI_KEY='paperworld-ui-language-v1';
const CHAT_KEY='paperworld-chat-language-v1';
const pick=(key,allowed,fallback)=>{try{const v=root.localStorage.getItem(key);return allowed.includes(v)?v:fallback}catch{return fallback}};
let ui=pick(UI_KEY,['el','en'],'el');
let chat=pick(CHAT_KEY,['auto','el','en'],'auto');
// This lookup is deliberately restricted to exact application chrome strings.
// Never translate conversation content, project names, editable controls or memory.
const dict=Object.freeze({
 'Η ομάδα σου':'Your team','Οι εργασίες μου':'My tasks','Ρυθμίσεις':'Settings',
 'Ομάδα':'Team','Εργασίες':'Tasks','Προτιμήσεις':'Preferences',
 'Γλώσσα':'Language','Γλώσσα εφαρμογής':'App language','Γλώσσα συνομιλιών':'Conversation language',
 'Αυτόματα — απάντηση στη γλώσσα μου':'Automatic — follow my language',
 'Πάντα ελληνικά':'Always Greek','Πάντα αγγλικά':'Always English',
 'Λογαριασμός':'Account','Συνδεδεμένες υπηρεσίες':'Connected services',
 'Μνήμη':'Memory','Για προχωρημένους':'Advanced',
 'Ανανέωση':'Refresh','Κλείσιμο':'Close','Πίσω':'Back',
 'Περιοχές':'Sections','Ενημέρωση…':'Updating…',
 'Ποιος βοηθά σε τι':'Who helps with what',
 'Τι γίνεται και τι χρειάζεται εσένα':'What is happening and what needs you',
 'Λογαριασμός, συνδέσεις και μνήμη':'Account, connections and memory',
 'Συνδεδεμένος λογαριασμός':'Signed-in account',
 'Αποσύνδεση':'Sign out','Σύνδεση':'Connect','Άνοιγμα':'Open',
 'Άνοιγμα ›':'Open ›','Δοκίμασε ξανά':'Try again','Λιγότερη κίνηση':'Reduce motion',
 'Απενεργοποιεί τις μεταβάσεις και τις κινήσεις διεπαφής':'Disables UI transitions and animations',
 'Κλασικός πίνακας εργασιών':'Classic work dashboard',
 'Λειτουργία συντήρησης':'Maintenance mode','Κατάσταση συστήματος':'System status',
 'Έλεγχος':'Check','Γρήγορος έλεγχος χωρίς AI και χωρίς κόστος':'Quick check without AI or cost',
 'Οι agents χρησιμοποιούν μόνο ό,τι έχεις εγκρίνει.':'Agents only use knowledge you approved.',
 'Χρησιμοποιούνται μόνο όταν το εγκρίνεις.':'Used only with your approval.',
 'Σύνθεση και παραγωγή μουσικής':'Music writing and production',
 'Προπόνηση, διατροφή και συνήθειες':'Training, nutrition and habits',
 'Συντονισμός και αποφάσεις για όλο το χωριό':'Coordination and decisions for the village',
 'Ανακάλυψη συναυλιών και η εφαρμογή':'Concert discovery and the app',
 'Το παιχνίδι σε Godot 4':'The game in Godot 4',
 'Το χωριό σου':'Your village',
 'Επίλεξε ένα κτίριο ή μίλησε στον Matt.':'Choose a building or talk to Matt.',
 'Town Hall · συντονισμός':'Town Hall · coordination',
 'Άγγιξε το χωριό για να περπατήσεις · M: Matt · T: κοντινός συνεργάτης':'Tap the village to walk · M: Matt · T: nearby colleague',
 'Οι σημαντικές αποφάσεις και οι δημοσιεύσεις παραμένουν υπό τον έλεγχό σου.':'Important decisions and publishing remain under your control.',
 'Καλημέρα':'Good morning','Καλό απόγευμα':'Good afternoon','Καλησπέρα':'Good evening',
 'Περισσότερα':'More','Λιγότερα':'Less','Δική σου σημείωση':'Your note',
 'Άνοιγμα προφίλ':'Open profile','Αναζήτηση':'Search'
});
const reverse=Object.fromEntries(Object.entries(dict).map(([a,b])=>[b,a]));
const remembered=new WeakMap();
const attributes=['aria-label','title','placeholder'];
const excluded='input,textarea,select,option,[contenteditable],.world-dialogue-messages,.world-chat-message,.pw-item-title,.pw-item-full,.pw-note-title,.pw-memory-text,.pw-memory-source,.world-chat-brief,.pw-studio-lyrics,.pw-studio-tools textarea';
function allowed(el){return el instanceof Element&&!el.closest(excluded)}
let busy=false;
function apply(){
 if(busy||!root.document?.body)return;
 busy=true;
 try{
  document.documentElement.lang=ui;
  for(const el of document.querySelectorAll('body *')){
   if(!allowed(el))continue;
   for(const node of el.childNodes){
    if(node.nodeType!==Node.TEXT_NODE)continue;
    const current=node.nodeValue;
    const trimmed=current.trim();
    if(!trimmed)continue;
    let original=remembered.get(node);
    if(original===undefined||current!==original&&current!==replaceText(original,'en')){
     original=current;remembered.set(node,original);
    }
    const next=replaceText(original,ui);
    if(current!==next)node.nodeValue=next;
   }
   for(const key of attributes){
    if(!el.hasAttribute(key))continue;
    const v=el.getAttribute(key);
    const stored='data-pw-original-'+key;
    let original=el.getAttribute(stored);
    if(original===null||v!==original&&v!==replaceText(original,'en')){
     original=v;el.setAttribute(stored,v);
    }
    const next=replaceText(original,ui);
    if(v!==next)el.setAttribute(key,next);
   }
  }
 }finally{busy=false}
}
function replaceText(value,language){
 const trimmed=String(value).trim();
 const greek=Object.hasOwn(dict,trimmed)?trimmed:Object.hasOwn(reverse,trimmed)?reverse[trimmed]:null;
 if(!greek)return value;
 const next=language==='en'?dict[greek]:greek;
 return value.replace(trimmed,next);
}
let queued=false;
function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply()})}
const api=Object.freeze({
 ui:()=>ui,chat:()=>chat,
 setUI(value){if(!['el','en'].includes(value))return false;ui=value;
  try{localStorage.setItem(UI_KEY,value)}catch{}
  queue();document.dispatchEvent(new CustomEvent('paperworld:language-change',{detail:{ui,chat}}));return true},
 setChat(value){if(!['auto','el','en'].includes(value))return false;chat=value;
  try{localStorage.setItem(CHAT_KEY,value)}catch{}
  document.dispatchEvent(new CustomEvent('paperworld:language-change',{detail:{ui,chat}}));return true},
 t(value){return replaceText(value,ui)}
});
root.PaperworldI18n=api;
if(root.document){
 document.addEventListener('DOMContentLoaded',()=>{
  apply();new MutationObserver(queue).observe(document.body,{subtree:true,childList:true,characterData:true,
   attributes:true,attributeFilter:attributes});
 });
}
})(window);
