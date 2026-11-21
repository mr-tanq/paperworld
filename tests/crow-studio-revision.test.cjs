'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sunoSongLink,revisionRequest}=require('../js/crow-studio-draft.js');
const {currentBriefPriority}=require('../server/crow-songwriting-guide.cjs');
const source='https://suno.com/song/11111111-1111-4111-a111-111111111111';
const version='https://suno.com/s/Abcd1234_X';

test('only Suno song links can become a Studio reference',()=>{
 assert.equal(sunoSongLink('  '+source+'/?utm_source=share#t=4  '),source);
 assert.equal(sunoSongLink(version.replace('suno.com','www.suno.com')+'?tracking=private'),version);
 for(const url of [
  'http://suno.com/s/Abcd1234_X','https://suno.com.evil.test/s/Abcd1234_X',
  'https://suno.com@evil.test/s/Abcd1234_X','https://user@suno.com/s/Abcd1234_X',
  'https://suno.com:4321/s/Abcd1234_X','https://suno.com/playlist/abcd1234',
  'https://suno.com/s/Abcd1234_X/extra','https://suno.com/s/%2fAbcd1234_X',
  'javascript:alert(1)',null
 ])assert.equal(sunoSongLink(url),null,url);
});

test('the Matt and Crow drafts identify the original and optional version and ask for a plan',()=>{
 const notes='Κράτα τη φωνή και πρότεινε νέο outro.';
 const direct=revisionRequest({source,version,notes});
 const matt=revisionRequest({source,version,notes,viaMatt:true});
 assert.match(direct,/^Ετοίμασε ένα πλάνο επεξεργασίας/);
 assert.match(matt,/^Ζήτησε από τον Crow να ετοιμάσει/);
 for(const draft of [direct,matt]){
  assert.ok(draft.includes('Πρωτότυπο '+source+'\nΕναλλακτική εκδοχή '+version));
  assert.ok(draft.includes(notes));
  assert.ok(draft.endsWith('Κράτησε το πρωτότυπο και δώσε μόνο πλάνο.'));
  assert.ok(draft.length<=1200,'fits the existing Matt request limit');
 }
 assert.doesNotMatch(revisionRequest({source,notes}),/Εναλλακτική εκδοχή/);
 assert.equal(revisionRequest({source,version:source+'?tracking=1',notes}),null);
 assert.equal(revisionRequest({source,version:'https://example.com',notes}),null);
 assert.equal(revisionRequest({source,version:123,notes}),null);
 assert.equal(revisionRequest({source,notes:' '.repeat(10)}),null);
 assert.equal(revisionRequest({source,notes:'x'.repeat(651)}),null);
 assert.match(currentBriefPriority(),/does not give you audio access/);
 assert.match(currentBriefPriority(),/Do not turn an edit request into a new song submission/);
});
