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
 "Καλό βράδυ":"Good night",
 "Ένα θέμα περιμένει εσένα.":"One item needs your attention.",
 "Κάτι είναι σε εξέλιξη· τίποτα δεν περιμένει εσένα.":"Work is in progress; nothing needs your attention.",
 "Τίποτα σε εξέλιξη αυτή τη στιγμή.":"Nothing in progress right now.",
 "Δεν έχω ενημέρωση αυτή τη στιγμή.":"No updates available right now.",
 "Ενημερώνομαι για την ομάδα…":"Checking team updates…",
 "Χρειάζονται εσένα":"Needs your attention",
 "Σε εξέλιξη":"In progress",
 "Ολοκληρώθηκαν":"Completed",
 "Τίποτα δεν περιμένει την απόφασή σου.":"Nothing needs your decision.",
 "Καμία ενεργή εργασία αυτή τη στιγμή.":"No active tasks right now.",
 "Για αργότερα":"For later",
 "Δεν έχουν ξεκινήσει ακόμη.":"Not started yet.",
 "Έτοιμα για ματιά":"Ready to review",
 "Ελέγχθηκαν ή ετοιμάστηκαν· τίποτα δεν έχει εφαρμοστεί.":"Reviewed or prepared; no changes have been applied.",
 "Ολοκληρώθηκαν πρόσφατα":"Recently completed",
 "Σύνδεσμος εμφανίζεται μόνο όταν υπάρχει επαληθευμένο αποτέλεσμα.":"A link appears only for a verified result.",
 "Δεν υπάρχουν ολοκληρωμένες εργασίες ακόμη.":"No completed tasks yet.",
 "Ήσυχα":"No pending work",
 "Ζήτα κάτι από την ομάδα":"Ask the team",
 "Τι θέλεις να γίνει; Ο Matt θα βρει ποιος μπορεί να βοηθήσει.":"What would you like done? Matt will find who can help.",
 "Συνέχεια με τον Matt":"Continue with Matt",
 "Δες στο χωριό":"Find in village",
 "Τι γνωρίζει":"What they know",
 "Μίλα με τη Luna":"Talk to Luna",
 "Μίλα με τον Matt":"Talk to Matt",
 "Μίλα με τον Joey":"Talk to Joey",
 "Μίλα με τον Crow":"Talk to Crow",
 "Μίλα με τον Dave":"Talk to Dave",
 "Σταμάτησε · χρειάζεται συζήτηση":"Stopped · needs discussion",
 "Δες την προετοιμασμένη αλλαγή":"View prepared change",
 "Δες την αναφορά":"View report",
 "Λεπτομέρειες":"Details",
 "Οι σημειώσεις σου":"Your notes",
 "Πρόσθεσε μια σημείωση…":"Add a note…",
 "Προσθήκη":"Add",
 "Έγινε":"Done",
 "Καμία σημείωση. Οι σημειώσεις είναι δικές σου· δεν αναθέτουν εργασία σε agent.":"No notes yet. Your notes do not assign tasks to an agent.",
 "Η σημείωση δεν αποθηκεύτηκε.":"Note could not be saved.",
 "Η αλλαγή δεν αποθηκεύτηκε.":"Change could not be saved.",
 "Η διαγραφή απέτυχε.":"Could not delete.",
 "Διαγραφή σημείωσης":"Delete note",
 "Καμία ενεργή εργασία σε αυτό το project.":"No active tasks in this project.",
 "Δεν ήταν δυνατή η ενημέρωση. Δοκίμασε ξανά.":"Could not refresh. Try again.",
 "Οργανώνει την ομάδα, βρίσκει ποιος μπορεί να βοηθήσει και σου φέρνει τα αποτελέσματα.":"Coordinates the team, finds the right person and brings you the results.",
 "Η εφαρμογή Listening Mirror: συναυλίες, εμπειρία χρήστη και ανάπτυξη.":"The Listening Mirror app: concerts, user experience and development.",
 "Το παιχνίδι Pokémon: Echoes σε Godot 4: χάρτες, μάχες και διάλογοι.":"The Pokémon: Echoes game in Godot 4: maps, battles and dialogue.",
 "Η μουσική του The Lost Wanderer: τραγούδια, στίχοι και Music Studio.":"The Lost Wanderer's music: songs, lyrics and Music Studio.",
 "Προπόνηση, διατροφή και καθημερινές συνήθειες. Ιδιωτικό project.":"Training, nutrition and daily habits. Private project.",
 "Διαβάζει τον κώδικα του Listening Mirror όταν το εγκρίνεις.":"Reviews Listening Mirror code when you approve.",
 "Διαβάζει τα αρχεία του Pokémon: Echoes όταν το εγκρίνεις.":"Reviews Pokémon: Echoes files when you approve.",
 "Η δραστηριότητα δεν είναι διαθέσιμη χωρίς σύνδεση.":"Activity is unavailable until you sign in.",
 "Καμία καταγεγραμμένη εργασία αυτή τη στιγμή":"No recorded work right now",
 "Chief of Staff · Όλα τα projects":"Chief of Staff · All projects",
 "Συνομιλία":"Chat",
 "Πάτησε «Συνομιλία» για να μιλήσεις απευθείας με κάποιον.":"Select Chat to talk directly to a resident.",
 "Συγκέντρωση στο Town Hall":"Gather at Town Hall",
 "Συγκέντρωσε την ομάδα στο Town Hall":"Gather the team at Town Hall",
 "Βοηθοί ανάπτυξης":"Development assistants",
 "Ελέγχουν κώδικα μόνο μέσω του υπεύθυνου του project και μόνο με την έγκρισή σου.":"They review code only through the project Director and with your approval.",
 "Ένας έλεγχος περιμένει την έγκρισή σου.":"One review needs your approval.",
 "Τελευταίος έλεγχος: δεν έχει τελειώσει.":"Last review: still running.",
 "Τελευταίος έλεγχος: ολοκληρώθηκε χωρίς αλλαγές.":"Last review: completed without changes.",
 "Τελευταίος έλεγχος: σταμάτησε.":"Last review: stopped.",
 "Συνδέσου στο PAPERWORLD Cloud":"Sign in to PAPERWORLD Cloud",
 "Οι εργασίες, οι αποφάσεις και οι συνδέσεις σου είναι ιδιωτικές στον λογαριασμό σου.":"Your tasks, decisions and connections are private to your account.",
 "Κωδικός":"Password",
 "Δημιουργία λογαριασμού":"Create account",
 "Ο λογαριασμός δημιουργήθηκε.":"Account created.",
 "Έλεγξε το email σου για επιβεβαίωση και μετά συνδέσου.":"Check your email to confirm, then sign in.",
 "Η δημιουργία λογαριασμού δεν ολοκληρώθηκε.":"Account creation failed.",
 "Η σύνδεση απέτυχε. Έλεγξε email και κωδικό.":"Sign-in failed. Check your email and password.",
 "PAPERWORLD Cloud · ιδιωτικά δεδομένα":"PAPERWORLD Cloud · private data",
 "Έλεγχος, έγκριση και εισαγωγή μνήμης":"Review, approve and import memory",
 "Όλες οι προτάσεις, ανά project":"All suggestions, by project",
 "Συντομεύσεις: M · Matt, T · κοντινός agent, Esc · κλείσιμο.":"Shortcuts: M · Matt, T · nearby resident, Esc · close.",
 "Τα παλαιότερα εργαλεία, για συντήρηση":"Legacy tools for maintenance",
 "Τεχνικός έλεγχος Listening Mirror":"Listening Mirror technical review",
 "Λεπτομέρειες προτεινόμενων αλλαγών κώδικα":"Details of proposed code changes",
 "Εργαλεία χάρτη, διαδρομών και διαγνωστικά":"Map, path and diagnostic tools",
 "Ο server δεν απάντησε. Δοκίμασε ξανά σε λίγο.":"The server did not respond. Try again shortly.",
 "Δεν είναι διαθέσιμο.":"Not available.",
 "Έλεγχος…":"Checking…",
 "Πάντα ελληνικά":"Always Greek",
 "Πάντα αγγλικά":"Always English",
 "Αυτόματα — απάντηση στη γλώσσα μου":"Automatic — follow my language",
 "🇬🇷 Ελληνικά":"🇬🇷 Greek",
 "🇬🇧 English":"🇬🇧 English",
 "Σύνδεση GitHub δεν ξεκίνησε.":"Could not start GitHub connection.",
 "Οι AI συνομιλίες είναι έτοιμες.":"AI conversations are ready.",
 "Η σύνδεση είναι προσωρινή και χάνεται αν γίνει επανεκκίνηση του server.":"The connection is temporary and may be lost when the server restarts.",
 "Η σύνδεση GitHub δεν έχει ρυθμιστεί στον server.":"GitHub connection is not configured on the server.",
 "Ο server δεν απάντησε. Η κατάσταση δεν είναι γνωστή.":"The server did not respond. Status is unknown.",
 "Για AI συνομιλίες και προετοιμασία αλλαγών κώδικα.":"For AI conversations and prepared code changes.",
 "Προσωρινή εξουσιοδότηση. Κάθε τραγούδι ελέγχεται ξανά πριν δημιουργηθεί.":"Temporary authorization. Each song is checked again before creation.",
 "Για δημιουργία τραγουδιών από το Music Studio του Crow.":"For making songs in Crow's Music Studio.",
 "Μη διαθέσιμο τώρα":"Unavailable right now",
 'Περισσότερα':'More','Λιγότερα':'Less','Δική σου σημείωση':'Your note',
 'Άνοιγμα προφίλ':'Open profile','Αναζήτηση':'Search'
});
const reverse=Object.fromEntries(Object.entries(dict).map(([a,b])=>[b,a]));
const remembered=new WeakMap();
const attributes=['aria-label','title','placeholder'];
const excluded='input,textarea,[contenteditable],.world-dialogue-messages,.world-chat-message,.pw-item-title,.pw-item-full,.pw-note-title,.pw-memory-text,.pw-memory-source,.world-chat-brief,.pw-studio-lyrics,.pw-studio-tools textarea';
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
    const original=remembered.get(node);
    if(original===undefined||current!==original&&current!==replaceText(original,'en')){
     remembered.set(node,current);
    }
    const next=replaceText(remembered.get(node),ui);
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
