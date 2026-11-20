'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/i18n.js'),'utf8');
function translator(mode='en'){
 const window={localStorage:{getItem:k=>k==='paperworld-ui-language-v1'?mode:null}};
 vm.runInNewContext(source,{window});
 return window.PaperworldI18n;
}
test('English interface translates Task and Team summaries from the actual village',()=>{
 const i18n=translator();
 for(const [el,en] of [
  ['Ένα θέμα περιμένει εσένα.','One item needs your attention.'],
  ['Χρειάζονται εσένα','Needs your attention'],
  ['Σε εξέλιξη','In progress'],
  ['Ολοκληρώθηκαν','Completed'],
  ['Οργανώνει την ομάδα, βρίσκει ποιος μπορεί να βοηθήσει και σου φέρνει τα αποτελέσματα.',
   'Coordinates the team, finds the right person and brings you the results.'],
  ['Συνομιλία','Chat'],['Καμία ενεργή εργασία αυτή τη στιγμή.','No active tasks right now.'],
  ['Πάντα ελληνικά','Always Greek'],['Αυτόματα — απάντηση στη γλώσσα μου','Automatic — follow my language'],
  ['1 χρειάζεται εσένα','1 needs your attention'],
  ['5 ολοκληρώθηκαν πρόσφατα','5 recently completed'],
  ['Μίλα με τη Luna','Talk to Luna'],
 ])assert.equal(i18n.t(el),en,el);
});
test('Greek remains the default and arbitrary private or creative content is untouched',()=>{
 const el=translator('el'),en=translator('en');
 assert.equal(el.t('Χρειάζονται εσένα'),'Χρειάζονται εσένα');
 for(const text of ['Matt, το TicketSwap check στο Listening Mirror δεν λειτουργεί σωστά.',
  '[Verse 1] Πρωτότυποι στίχοι', 'The Lost Wanderer', 'Το προσωπικό μου τραγούδι']){
  assert.equal(en.t(text),text);
 }
});
test('i18n script preserves the browser language settings and protects messages',()=>{
 assert.match(source,/paperworld-ui-language-v1/);
 assert.match(source,/paperworld-chat-language-v1/);
 assert.match(source,/\.world-dialogue-messages/);
 assert.match(source,/\.pw-item-title/);
 assert.match(source,/\.pw-memory-text/);
});
