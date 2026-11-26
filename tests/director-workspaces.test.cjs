'use strict';
// Director workspaces: real work sends a Director home and inside; tapping the
// house shows them at the desk (or an honest empty desk), from the owner's art.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const nav=require('../js/navigation.js'),life=require('../js/village-life.js');
const room=require('../js/workspace-interior.js');
test('every Director has day and night room art and two chairs inside the picture',()=>{
 for(const [id,r] of Object.entries(room.ROOMS)){
  for(const t of ['day','night'])assert.ok(fs.existsSync('assets/interiors/'+r.key+'-'+t+'.webp'),id+' '+t);
  for(const [x,y] of [r.desk,r.guest])assert.ok(x>.1&&x<.9&&y>.1&&y<.9);
  assert.ok(fs.existsSync('assets/portraits/'+room.PORTRAIT[id]+'.webp'));
 }
});
test('room line only describes real work',()=>{
 assert.equal(room.roomLine({tone:'active',text:'Δουλεύει: X'},'Luna'),'Δουλεύει: X');
 assert.match(room.roomLine(null,'Ο Dave'),/^Ο Dave δεν έχει δουλειά τώρα/);
});
test('work(): the resident walks to the door and goes inside; rest() brings them out',()=>{
 const people=[{id:'listening-director',x:1110,y:558,direction:'down'}],v=life.create(nav,people,()=>.5);
 const spot=nav.snapToPath([1125,515],60);assert.ok(spot);
 const door={x:spot.point[0],y:spot.point[1]};
 assert.equal(v.work('listening-director',door),true);
 for(let i=0;i<1200&&!people[0].inside;i++)v.tick(.05);
 assert.equal(people[0].inside,true);assert.equal(v.isWorking('listening-director'),true);
 assert.equal(v.rest('listening-director'),true);assert.equal(people[0].inside,false);
});
test('app wires workspaces: house tap opens the room, work only from resident status',()=>{
 const app=fs.readFileSync('js/app.js','utf8');
 assert.match(app,/if\(id!=='matt'&&openWorkspace\(id\)\)return;/);
 assert.match(app,/residentStatus\[a\.id\]\?\.tone==='active'&&conversation\.with!==a\.id/);
 assert.match(app,/syncWork\(\);/);
 assert.match(fs.readFileSync('index.html','utf8'),/workspace-interior\.js\?v=/);
});
test('working Director: the owner\'s painted scene (day/night) with the bubble above their head',()=>{
 for(const [id,r] of Object.entries(room.ROOMS)){
  for(const t of ['day','night'])assert.ok(fs.existsSync(room.sceneUrl(id,t).replace('./','').replace(/\?.*$/,'')),id+' '+t);
  assert.ok(r.sceneDesk[0]<r.sceneGuest[0],'Director at the desk, you to the right');
 }
 const src=fs.readFileSync('js/workspace-interior.js','utf8');
 assert.match(src,/if\(inside\)\{const scene=load\(sceneUrl\(current,time\)\)/);
});
