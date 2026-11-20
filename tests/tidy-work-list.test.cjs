'use strict';
// Owner can remove items from the work lists (records kept), stopped tasks
// explain why, and "Μίλα με …" opens the chat about that exact item.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const activity=require('../js/village-activity.js');
test('a stopped task explains why in plain words, never with a raw code',()=>{
 const v=activity.view({id:'1',projectId:'listening',status:'needs_you',goal:'Διόρθωση',lastError:'agent_no_changes'});
 assert.match(v.message,/δεν βρήκε κάτι χαλασμένο/);
 assert.doesNotMatch(v.message,/agent_no_changes/);
 const unknown=activity.view({id:'2',projectId:'listening',status:'needs_you',goal:'x',lastError:'weird_code'});
 assert.equal(unknown.message,activity.STATUS.needs_you);
});
test('mission list returns only the stop-reason code for stopped tasks',()=>{
 const api=fs.readFileSync('server/v5-autonomous-mission-api.cjs','utf8');
 assert.match(api,/select:'id,project_id,goal,status,policy,report,last_error,created_at,updated_at'/);
 assert.match(api,/lastError:\['needs_you','failed'\]\.includes\(r\.status\)&&\/\^\[a-z_\]\{1,60\}\$\/\.test/);
});
test('removing items: own rows via RLS, filtered everywhere, with undo; notes keep their own delete',()=>{
 const cloud=fs.readFileSync('js/cloud.js','utf8');
 assert.match(cloud,/\/rest\/v1\/paperworld_dismissed_items_v1\?select=item_key/);
 assert.match(cloud,/Prefer:'resolution=ignore-duplicates,return=minimal'/);
 const ws=fs.readFileSync('js/workspace.js','utf8');
 assert.match(ws,/state\.dismissed\.has\(row\.kind\+':'\+row\.id\)/);
 assert.match(ws,/state\.dismissed\.has\('mission:'\+m\.id\)/);
 assert.match(ws,/if\(!item\.note&&item\.key&&typeof cloud\(\)\?\.dismissItem==='function'\)/);
 assert.match(ws,/Η καταγραφή μένει στο ιστορικό/);assert.match(ws,/'Αναίρεση'/);
 const hub=fs.readFileSync('js/human-first-hub.js','utf8');
 assert.match(hub,/'Δεν χρειάζεται πια'/);assert.match(hub,/dismissItem\('handoff:'\+item\.id\)/);
 assert.match(hub,/!removed\?\.has\?\.\(item\.kind\+':'\+item\.id\)/);
 const sql=fs.readFileSync('sql/paperworld_dismissed_items_v1.sql','utf8');
 assert.match(sql,/using \(\(select auth\.uid\(\)\)=owner_id\)/);
 assert.doesNotMatch(sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n'),
  /delete from public\.paperworld_autonomous|update public\.paperworld_autonomous/i);
});
test('"Μίλα με" opens the chat about that item, with a visible context note',()=>{
 const ws=fs.readFileSync('js/workspace.js','utf8');
 assert.match(ws,/draft:'Για την εργασία «'\+titleText\.slice\(0,90\)\+'»: '/);
 const ui=fs.readFileSync('js/world-dialogue.js','utf8');
 assert.match(ui,/function open\(id,\{draft='',context=null\}=\{\}\)/);
 assert.match(ui,/'Συζητάμε για: «'/);
 assert.match(ui,/contextNote\.hidden=true;contextNote\.replaceChildren\(\);/);
});
