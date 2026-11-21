'use strict';
// Town Hall interior: owner and Matt at the heads, Directors around, real
// statuses only, ending the meeting brings everyone out.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../js/town-hall-interior.js');
test('seats: owner at one head, Matt at the other, four Directors around the table',()=>{
 assert.ok(R.SEATS.owner[0]<.2&&R.SEATS.matt[0]>.8,'heads at the two ends');
 assert.equal(R.ORDER.length,6);
 const lines=R.seatLines({'listening-director':{text:'Δουλεύει: Διόρθωση'}});
 assert.equal(lines['listening-director'],'Δουλεύει: Διόρθωση');
 assert.equal(lines['studio-director'],'Όλα ήσυχα από μένα.','no invented activity');
 const src=fs.readFileSync('js/town-hall-interior.js','utf8');
 assert.doesNotMatch(src,/fetch\(|askDirector|delegate|localStorage/);
 assert.match(src,/assets\/interiors\/town-hall\.png/,'owner art replaces the painted room when present');
});
test('meeting flow is wired: walk in, room opens with the team inside, end brings everyone out',()=>{
 const app=fs.readFileSync('js/app.js','utf8');
 assert.match(app,/const started=directorAssembly\.call\(\)&&directorAssembly\.keepMeeting\(\);/);
 assert.match(app,/function walkOwnerToTownHall\(\)/);assert.match(app,/function leaveTownHall\(\)/);
 assert.match(app,/followTrail\.length>\(state\.walker\.inside\?0:4\)/);
 assert.match(app,/if\(!followTrail\.length\)followTrail\.push/);
 assert.match(app,/if\(!a\.inside\)layers\.push/);assert.match(app,/if\(!w\.inside\)layers\.push/);
 assert.match(app,/meetingState:\(\)=>/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('town-hall-interior.js')>0&&html.indexOf('town-hall.css')>0);
});
