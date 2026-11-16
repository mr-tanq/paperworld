'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('js/app.js','utf8');
const html=fs.readFileSync('index.html','utf8');

test('layout editor is opt-in with visible touch-friendly controls',()=>{
 for(const id of ['building-placement-toggle','building-placement-panel','building-placement-status',
   'building-nudge-left','building-nudge-right','building-nudge-up','building-nudge-down',
   'building-placement-reset','building-placement-reset-all','building-placement-copy',
   'building-placement-finish','building-placement-export'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/building-placement-panel[^>]*hidden/);
 assert.match(app,/placingBuildings=false/);
 assert.match(app,/if\(placingBuildings\)/);
 assert.match(app,/building:placingBuildings\?d:null/);
});
test('placement drafts remain local and include all five building coordinates',()=>{
 assert.match(app,/paperworld-building-layout-draft-v2/);
 assert.match(app,/localStorage\.setItem\(buildingLayoutKey/);
 assert.match(app,/Object\.fromEntries\(defs\.map/);
 assert.match(app,/format:'paperworld-building-layout-v1'/);
 assert.match(app,/entrance:d\.entrance\.map\(Math\.round\)/);
 assert.match(app,/approach:\[\.\.\.d\.approach\]/);
 assert.match(app,/if\(placingBuildings&&v\.building\)movePlacement/);
 assert.match(app,/if\(v\?\.building&&v\.dragged\)saveBuildingLayout/);
 assert.match(app,/else if\(v&&!v\.dragged\)tap\(worldPoint\(p\)\)/);
});
