'use strict';
// Town Hall interior: owner and Matt at the heads, Directors around, real
// statuses only, ending the meeting brings everyone out.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../js/town-hall-interior.js');
test('seats: owner at one head, Matt at the other, four Directors around the table',()=>{
 assert.ok(R.SEATS.owner[0]<.25&&R.SEATS.matt[0]>.75,'heads at the two ends');
 assert.equal(R.ORDER.length,6);
 const lines=R.seatLines({'listening-director':{text:'Δουλεύει: Διόρθωση'}});
 assert.equal(lines['listening-director'],'Δουλεύει: Διόρθωση');
 assert.equal(lines['studio-director'],'Όλα ήσυχα από μένα.','no invented activity');
 const src=fs.readFileSync('js/town-hall-interior.js','utf8');
 assert.doesNotMatch(src,/fetch\(|askDirector|delegate|localStorage/);
 assert.match(src,/assets\/interiors\/town-hall-day\.webp/);assert.match(src,/assets\/interiors\/town-hall-night\.webp/);
 const fs2=require('node:fs');assert.ok(fs2.existsSync('assets/interiors/town-hall-day.webp')&&fs2.existsSync('assets/interiors/town-hall-night.webp'));
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

test('the owner art fills the room without stretching and never crops a seat',()=>{
 for(const [w,h] of [[1280,720],[1280,800],[800,1100],[390,300]]){
  const r=R.coverRect(w,h);
  assert.ok(Math.abs(r.w/r.h-R.ART.w/R.ART.h)<1e-9,'aspect kept');
  for(const [fx] of Object.values(R.SEATS)){const x=r.x+fx*r.w;assert.ok(x>=0&&x<=w,w+'x'+h+' seat visible at '+fx)}
 }
 // Seats sit on the chairs of the art: heads at the ends, two behind, two in front.
 assert.ok(R.SEATS['listening-director'][1]<R.SEATS['studio-director'][1]);
});
test('meeting scene: the owner\'s painted team, day and night, everyone tappable at their head',()=>{
 const R=require('../js/town-hall-interior.js'),fs=require('node:fs');
 for(const k of ['day','night'])assert.ok(fs.existsSync(R.SCENE[k].replace('./','')),k);
 assert.deepEqual(Object.keys(R.PEOPLE).sort(),[...R.ORDER].sort());
 assert.ok(R.PEOPLE.owner[0]<.25&&R.PEOPLE.matt[0]>.7,'you on the left, Matt on the right');
 assert.ok(R.PEOPLE['studio-director'][1]>R.PEOPLE['listening-director'][1],'Crow and Dave sit in front');
 assert.match(fs.readFileSync('town-hall.css','utf8'),/\.th-scene \.th-face\{background:transparent/);
});
