(()=>{'use strict';
const canvas=document.querySelector('#map'),ctx=canvas.getContext('2d'),nameEl=document.querySelector('#name'),descEl=document.querySelector('#desc'),assetEl=document.querySelector('#assets');
const W=1671,H=941;
const depth=window.PaperworldDepth;
if(!depth)throw new Error('PAPERWORLD depth module not loaded');
const pathEditor=window.PaperworldPathEditor;
if(!pathEditor)throw new Error('PAPERWORLD path editor module not loaded');
const state={width:0,height:0,dpr:1,scale:1,fit:1,x:0,y:0,pointer:null,chosen:null,walker:{x:822,y:861,direction:'down',moving:false,walkDistance:14},route:[],destination:null,depthDemo:0};
const defs=[
{id:'town',name:'Town Hall',file:'./assets/town-hall.png',x:594,bottom:381,width:356,entrance:[419,523],approach:[535,520],desc:'The future approval and budget hub. All operations remain disabled.'},
{id:'workshop',name:'Listening Mirror Workshop',file:'./assets/listening-mirror-workshop.png',x:1107,bottom:399,width:358,entrance:[1165,342],approach:[1125,515],desc:'The music discovery project workspace. No real tasks are connected.'},
{id:'pokemon',name:'Pokémon Hub',file:'./assets/pokemon-hub.png',x:338,bottom:586,width:370,entrance:[351,501],approach:[385,665],desc:'Future home of Pokémon: Echoes development.'},
{id:'wellbeing',name:'Wellbeing & Training Center',file:'./assets/wellbeing-training-center.png',x:1361,bottom:577,width:366,entrance:[1366,506],approach:[1240,690],desc:'Future training, nutrition, habits and progress workspace.'},
{id:'studio',name:'The Lost Wanderer Studio',file:'./assets/lost-wanderer-studio.png',x:835,bottom:757,width:438,entrance:[872,635],approach:[835,854],desc:'Future music writing and production studio.'}
];
// Preview-only marker offsets are local to the user's browser; no GitHub writes.
const markerKey='paperworld-preview-010-marker-calibration-v1';
try{const saved=JSON.parse(localStorage.getItem(markerKey)||'{}');for(const d of defs){const p=saved[d.id];if(Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=W&&p[1]>=0&&p[1]<=H)d.entrance=[...p]}}catch(_){}
// Building layout drafts are local to this browser until the owner exports them.
const buildingLayoutKey='paperworld-building-layout-draft-v2';
const originalBuildings=Object.fromEntries(defs.map(d=>[d.id,{x:d.x,bottom:d.bottom,entrance:[...d.entrance]}]));
let placingBuildings=false,placementSelected=null;
try{
 const saved=JSON.parse(localStorage.getItem(buildingLayoutKey)||'{}');
 for(const d of defs){
  const p=saved[d.id];
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.bottom)||
     p.x<0||p.x>W||p.bottom<0||p.bottom>H)continue;
  d.x=p.x;d.bottom=p.bottom;
  if(Array.isArray(p.entrance)&&p.entrance.length===2&&
     p.entrance.every(Number.isFinite))d.entrance=[...p.entrance];
 }
}catch(_){}
function saveBuildingLayout(){
 try{
  localStorage.setItem(buildingLayoutKey,JSON.stringify(Object.fromEntries(
   defs.map(d=>[d.id,{x:Math.round(d.x),bottom:Math.round(d.bottom),
    entrance:d.entrance.map(Math.round)}])
  )));
 }catch(_){placementStatus.textContent='Η αποθήκευση δεν είναι διαθέσιμη. Αντέγραψε τις θέσεις πριν κλείσεις τη σελίδα.'}
}
function movePlacement(d,dx,dy){
 if(!d)return;
 const oldX=d.x,oldY=d.bottom;
 d.x=Math.round(Math.max(d.width/2,Math.min(W-d.width/2,d.x+dx)));
 d.bottom=Math.round(Math.max(200,Math.min(H-20,d.bottom+dy)));
 const mx=d.x-oldX,my=d.bottom-oldY;
 d.entrance=[Math.round(Math.max(0,Math.min(W,d.entrance[0]+mx))),
  Math.round(Math.max(0,Math.min(H,d.entrance[1]+my)))];
 updatePlacementStatus();
}
const pathToggle=document.querySelector('#path-editor-toggle');
const pathPanel=document.querySelector('#path-editor-panel');
const pathStatus=document.querySelector('#path-editor-status');
const pathExport=document.querySelector('#path-editor-export');
const pathModeSelect=document.querySelector('#path-editor-mode');
const pathVisibility=document.querySelector('#path-editor-show-hidden');
const pathDraft=pathEditor.create({
 nodes:window.PaperworldNavigation.nodes,
 connections:window.PaperworldNavigation.connections,
 hiddenConnections:window.PaperworldNavigation.hiddenConnections,
 width:W,height:H,
 storage:window.localStorage,
 storageKey:'paperworld-operational-paths-studio-only-v2'
});
let editingPaths=false;
function pathDisconnectedComponents(){
 const snapshot=pathDraft.snapshot();
 const adjacent=Array.from({length:snapshot.nodes.length},()=>[]);
 for(const [a,b] of snapshot.connections){adjacent[a].push(b);adjacent[b].push(a)}
 const visited=new Set(),groups=[];
 for(let i=0;i<adjacent.length;i++){
  if(visited.has(i))continue;
  const stack=[i],group=[];visited.add(i);
  while(stack.length){
   const node=stack.pop();group.push(node);
   for(const next of adjacent[node])if(!visited.has(next)){visited.add(next);stack.push(next)}
  }
  groups.push(group);
 }
 return groups;
}
function updatePathStatus(note=''){
 const groups=pathDisconnectedComponents();
 const gap=groups.length>1?' · ⚠ '+groups.length+' ασύνδετα τμήματα':' · ✓ Ενιαίο δίκτυο';
 pathStatus.textContent=(note||pathDraft.summary()+' · '+pathDraft.modeLabel())+gap;
}
function setPathEditing(on){
 editingPaths=on;pathPanel.hidden=!on;pathToggle.setAttribute('aria-pressed',String(on));
 pathToggle.textContent=on?'Τέλος paths':'Paths';
 state.pointer=null;
 if(on){if(placingBuildings)setPlacementMode(false);state.route=[];state.destination=null;state.chosen=null;updatePathStatus()}
}
pathToggle.addEventListener('click',()=>setPathEditing(!editingPaths));
document.querySelector('#path-editor-finish').addEventListener('click',()=>setPathEditing(false));
pathModeSelect.addEventListener('change',()=>{pathDraft.setMode(pathModeSelect.value);updatePathStatus()});
pathVisibility.addEventListener('change',()=>{pathDraft.setShowHidden(pathVisibility.checked);updatePathStatus()});
document.querySelector('#path-editor-undo').addEventListener('click',()=>{pathDraft.undo();updatePathStatus()});
document.querySelector('#path-editor-reset').addEventListener('click',()=>{pathDraft.reset();updatePathStatus('Το σχέδιο επανήλθε στο αρχικό δίκτυο.')});
document.querySelector('#path-editor-copy').addEventListener('click',async()=>{
 const json=pathDraft.exportJSON();pathExport.hidden=false;pathExport.value=json;
 pathExport.focus();pathExport.select();
 try{await navigator.clipboard.writeText(json);updatePathStatus('Αντιγράφηκε το δίκτυο. Στείλε μου το JSON εδώ.')}
 catch(_){updatePathStatus('Αντέγραψε το JSON από το πλαίσιο και στείλ’ το εδώ.')}
});
const placementToggle=document.querySelector('#building-placement-toggle');
const placementPanel=document.querySelector('#building-placement-panel');
const placementStatus=document.querySelector('#building-placement-status');
const placementExport=document.querySelector('#building-placement-export');
function updatePlacementStatus(){
 placementStatus.textContent=placementSelected?
  placementSelected.name+' · X '+Math.round(placementSelected.x)+' · Y '+Math.round(placementSelected.bottom)+
  ' · Σύρε το κτίριο ή χρησιμοποίησε τα βελάκια':
  'Άγγιξε ένα κτίριο και σύρε το στη σωστή θέση. Σύρε στο κενό για μετακίνηση του χάρτη.';
}
function setPlacementMode(on){
 placingBuildings=on;placementPanel.hidden=!on;
 if(on&&editingPaths)setPathEditing(false);
 placementToggle.setAttribute('aria-pressed',String(on));
 placementToggle.textContent=on?'Τέλος τοποθέτησης':'Τοποθέτηση κτιρίων';
 state.pointer=null;calibrating=false;
 if(on){state.chosen=null;state.route=[];state.destination=null;updatePlacementStatus()}
}
placementToggle.addEventListener('click',()=>setPlacementMode(!placingBuildings));
document.querySelector('#building-placement-finish').addEventListener('click',()=>setPlacementMode(false));
for(const [id,dx,dy] of [['left',-4,0],['right',4,0],['up',0,-4],['down',0,4]]){
 document.querySelector('#building-nudge-'+id).addEventListener('click',()=>{
  if(!placementSelected)return;
  movePlacement(placementSelected,dx,dy);saveBuildingLayout();
 });
}
document.querySelector('#building-placement-reset').addEventListener('click',()=>{
 if(!placementSelected)return;
 const original=originalBuildings[placementSelected.id];
 placementSelected.x=original.x;placementSelected.bottom=original.bottom;
 placementSelected.entrance=[...original.entrance];
 saveBuildingLayout();updatePlacementStatus();
});
document.querySelector('#building-placement-reset-all').addEventListener('click',()=>{
 // In edit mode Reset all is an explicit command; undo remains possible by moving again.
 for(const d of defs){
  const p=originalBuildings[d.id];d.x=p.x;d.bottom=p.bottom;d.entrance=[...p.entrance];
 }
 saveBuildingLayout();updatePlacementStatus();
});
document.querySelector('#building-placement-copy').addEventListener('click',async()=>{
 const json=JSON.stringify({
  format:'paperworld-building-layout-v1',scene:{width:W,height:H},
  buildings:Object.fromEntries(defs.map(d=>[d.id,{
   name:d.name,x:Math.round(d.x),bottom:Math.round(d.bottom),
   width:d.width,entrance:d.entrance.map(Math.round),approach:[...d.approach]
  }]))
 },null,2);
 placementExport.hidden=false;placementExport.value=json;
 placementExport.focus();placementExport.select();
 try{await navigator.clipboard.writeText(json);
  placementStatus.textContent='Οι θέσεις αντιγράφηκαν. Στείλε μου το JSON εδώ για το τελικό PR.';
 }catch(_){placementStatus.textContent='Αντέγραψε το JSON από το πλαίσιο και στείλ’ το εδώ.'}
});
let calibrating=false;
const calibrateButton=document.querySelector('#calibrate-marker');
const resetMarkerButton=document.querySelector('#reset-marker');
const exportMarkerButton=document.querySelector('#export-markers');
const markerExportOutput=document.querySelector('#marker-export-output');
const markerText=document.querySelector('#marker-status');
const defaultEntrances={"town":[419,523],"workshop":[1165,342],"pokemon":[351,501],"wellbeing":[1366,506],"studio":[872,635]};
function setCalibrating(value){calibrating=value;calibrateButton.textContent=value?'Cancel marker placement':'Place marker on door';markerText.textContent=value?'Tap the actual doorway in the village. The marker will move exactly there.':'Choose a building, then place its marker on the doorway.'}
function updateMarkerControls(){const selected=!!state.chosen;calibrateButton.disabled=!selected;resetMarkerButton.disabled=!selected;markerText.textContent=selected?'Marker: '+state.chosen.entrance.map(v=>Math.round(v)).join(', ')+' (world coordinates)':'Select a building to adjust its marker.'}
function saveMarker(d){try{const saved=JSON.parse(localStorage.getItem(markerKey)||'{}');saved[d.id]=d.entrance;localStorage.setItem(markerKey,JSON.stringify(saved))}catch(_){markerText.textContent='Marker moved. Browser local storage was unavailable.'}}
calibrateButton.addEventListener('click',()=>{if(!state.chosen)return;setCalibrating(!calibrating)});
resetMarkerButton.addEventListener('click',()=>{const d=state.chosen;if(!d)return;d.entrance=[...defaultEntrances[d.id]];try{const saved=JSON.parse(localStorage.getItem(markerKey)||'{}');delete saved[d.id];localStorage.setItem(markerKey,JSON.stringify(saved))}catch(_){}setCalibrating(false);updateMarkerControls()});
function exportCalibration(){
 // Include building IDs plus visible door positions; approaches stay unchanged.
 // JSON may be copied into a PR later only after the user reviews it.
 const payload={format:'paperworld-entrance-calibration-v1',scene:{width:W,height:H},entrances:Object.fromEntries(defs.map(d=>[d.id,{name:d.name,door:[...d.entrance],approach:[...d.approach]}]))};
 const json=JSON.stringify(payload,null,2);
 markerExportOutput.hidden=false;
 markerExportOutput.value=json;
 markerExportOutput.focus();markerExportOutput.select();
 markerText.textContent='Coordinates ready below. Copy them and paste into this chat.';
 if(navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(json).then(()=>{markerText.textContent='Coordinates copied! Paste them into this chat.'}).catch(()=>{markerText.textContent='Select and copy the JSON below, then paste it into this chat.'});
 }
}
exportMarkerButton.addEventListener('click',exportCalibration);
// Isolated visual tests of painter depth. Neither test actor changes the real path graph.
const demoButton=document.querySelector('#depth-demo');
let showSurveyedPaths=false;
const demoPositions=[null,{x:835,y:705,label:'Behind the Studio'},{x:831,y:434,label:'Behind the plaza tree'}];
demoButton.addEventListener('click',()=>{state.depthDemo=(state.depthDemo+1)%demoPositions.length;demoButton.textContent='Depth test: '+(demoPositions[state.depthDemo]?.label||'Off')});
// Placeholders: Directors stand at approved path approach coordinates, not inside buildings.
// Display labels only. Keep stable actor IDs and AI-agent routing unchanged.
const directorDisplayNames=Object.freeze({
 'listening-director':'Luna',
 'pokemon-director':'Joey',
 'wellbeing-director':'Dave',
 'studio-director':'Crow'
});
function actorDisplayName(actor){
 return actor.id==='matt'?'Matt':(directorDisplayNames[actor.id]||'Director');
}
// Align feet to the owner's connected paved waypoints; do not move the buildings.
const homeOnPaths=Object.freeze({
 'matt':[612,551],
 'listening-director':[1110,558],
 'pokemon-director':[385,665],
 'wellbeing-director':[1238,640],
 'studio-director':[822,861]
});
const actors=defs.map(d=>{
 const id=({town:'matt',workshop:'listening-director',pokemon:'pokemon-director',wellbeing:'wellbeing-director',studio:'studio-director'})[d.id];
 const [x,y]=homeOnPaths[id];
 return {id,name:d.id==='town'?'Matt':d.name+' Director',x,y};
});
// Matt follows the player along previously walked positions rather than
// teleporting through houses. This is visual companionship, not AI execution.
// Matt's visual animation is independent of AI execution and task delegation.
// Chief Human Officer: contemporary clothes distinguish the human visitor from AI residents.
// Shared high-detail atlas: groups of four rows (Human, Matt, Listening Director).
// Source row order is front, left, right, back; four stepping poses per row.
// Preserves character size and original sprites as a safe fallback.
const charactersHD=new Image();
charactersHD.decoding='async';
charactersHD.src='./assets/characters-hq-v2.png';
function drawHDCharacter(a,group,label){
 if(!charactersHD.complete||!charactersHD.naturalWidth)return false;
 if(charactersHD.naturalWidth!==256||charactersHD.naturalHeight!==1056)return false;
 const facing={down:0,left:1,right:2,up:3}[a.direction]??0;
 const frame=a.moving?Math.floor((a.walkDistance||0)/14)%4:1;
 const sw=64,sh=88,dw=60,dh=88;
 ctx.save();
 ctx.fillStyle='rgba(31,24,18,.28)';
 ctx.beginPath();ctx.ellipse(a.x,a.y-2,14,5,0,0,Math.PI*2);ctx.fill();
 ctx.imageSmoothingEnabled=true;
 ctx.imageSmoothingQuality='high';
 ctx.drawImage(charactersHD,frame*sw,(group*4+facing)*sh,sw,sh,
   a.x-dw/2,a.y-dh+idleBob(a),dw,dh);
 ctx.font='bold 13px system-ui';
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=5;
 ctx.fillStyle='#fff4db';ctx.fillText(label,a.x,a.y+14);
 ctx.restore();
 return true;
}
let spriteNow=0;
function idleBob(a){
 if(a.moving)return 0;
 const seed=(a.id||'player').split('').reduce((n,c)=>n+c.charCodeAt(0),0);
 return Math.sin(spriteNow/650+seed)*1.25;
}
const playerVisual=new Image();
playerVisual.decoding='async';
playerVisual.src='./assets/player-walk-v2.png';
function drawPlayerSprite(p){
 if(drawHDCharacter(p,0,'You'))return true;
 if(!playerVisual.complete||!playerVisual.naturalWidth)return false;
 const rows={down:0,right:1,up:2,left:3};
 const row=rows[p.direction]??0;
 // Use the proven Matt v3 4-pose gait, driven by physical movement distance.
 const frame=p.moving?Math.floor(p.walkDistance/14)%4:1;
 const sw=playerVisual.naturalWidth/4,sh=playerVisual.naturalHeight/4;
 const dw=60,dh=88;
 ctx.save();
 ctx.fillStyle='rgba(31,24,18,.28)';
 ctx.beginPath();ctx.ellipse(p.x,p.y-2,14,5,0,0,Math.PI*2);ctx.fill();
 ctx.drawImage(playerVisual,frame*sw,row*sh,sw,sh,p.x-dw/2,p.y-dh+idleBob(p),dw,dh);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 13px system-ui';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=5;ctx.fillStyle='#fff4db';
 ctx.fillText('You',p.x,p.y+14);
 ctx.restore();
 return true;
}
// Listening Mirror Director visual only; preserves her existing agent id and permissions.
// Game Architect is the existing Pokémon: Echoes director; visual-only sprite.
// Wellbeing & Training Director: visual-only, existing AI identity preserved.
const wellbeingDirectorVisual=new Image();
wellbeingDirectorVisual.decoding='async';
wellbeingDirectorVisual.src='./assets/wellbeing-director-walk-hq-v2.png';
function drawWellbeingDirectorSprite(a){
 if(!wellbeingDirectorVisual.complete||wellbeingDirectorVisual.naturalWidth!==256||wellbeingDirectorVisual.naturalHeight!==352)return false;
 const row={down:0,right:1,up:2,left:3}[a.direction]??0;
 const frame=a.moving?Math.floor((a.walkDistance||0)/14)%4:1;
 const sw=64,sh=88,dw=60,dh=88;
 ctx.save();
 ctx.fillStyle='rgba(31,24,18,.28)';
 ctx.beginPath();ctx.ellipse(a.x,a.y-2,14,5,0,0,Math.PI*2);ctx.fill();
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(wellbeingDirectorVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh+idleBob(a),dw,dh);
 ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=5;
 ctx.fillStyle='#fff4db';ctx.fillText(actorDisplayName(a),a.x,a.y+14);
 ctx.restore();
 return true;
}
// Existing The Lost Wanderer Studio Director, visual identity only.
const studioDirectorVisual=new Image();
studioDirectorVisual.decoding='async';
studioDirectorVisual.src='./assets/studio-director-hooded-v2.png';
function drawStudioDirectorSprite(a){
 if(!studioDirectorVisual.complete || studioDirectorVisual.naturalWidth!==384 || studioDirectorVisual.naturalHeight!==528)return false;
 const row={down:0,right:1,up:2,left:3}[a.direction]??0;
 const frame=a.moving?Math.floor((a.walkDistance||0)/14)%4:1;
 const sw=96,sh=132,dw=60,dh=88;
 ctx.save();
 ctx.fillStyle='rgba(31,24,18,.28)';
 ctx.beginPath();ctx.ellipse(a.x,a.y-2,14,5,0,0,Math.PI*2);ctx.fill();
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(studioDirectorVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh+idleBob(a),dw,dh);
 ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=5;
 ctx.fillStyle='#fff4db';ctx.fillText(actorDisplayName(a),a.x,a.y+14);
 ctx.restore();
 return true;
}
const pokemonDirectorVisual=new Image();
pokemonDirectorVisual.decoding='async';
pokemonDirectorVisual.src='./assets/pokemon-director-walk-hq-v2.png';
function drawPokemonDirectorSprite(a){
 if(!pokemonDirectorVisual.complete||pokemonDirectorVisual.naturalWidth!==256||pokemonDirectorVisual.naturalHeight!==352)return false;
 const row={down:0,right:1,up:2,left:3}[a.direction]??0;
 const frame=a.moving?Math.floor((a.walkDistance||0)/14)%4:1;
 const sw=64,sh=88,dw=60,dh=88;
 ctx.save();
 ctx.fillStyle='rgba(31,24,18,.28)';
 ctx.beginPath();ctx.ellipse(a.x,a.y-2,14,5,0,0,Math.PI*2);ctx.fill();
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(pokemonDirectorVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh+idleBob(a),dw,dh);
 ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=5;
 ctx.fillStyle='#fff4db';ctx.fillText(actorDisplayName(a),a.x,a.y+14);
 ctx.restore();
 return true;
}
const listeningDirectorVisual=new Image();
listeningDirectorVisual.decoding='async';
listeningDirectorVisual.src='./assets/listening-director-walk-v1.png';
function drawListeningDirectorSprite(a){
 if(drawHDCharacter(a,2,actorDisplayName(a)))return true;
 if(!listeningDirectorVisual.complete || !listeningDirectorVisual.naturalWidth)return false;
 const row={down:0,right:1,up:2,left:3}[a.direction]??0;
 const frame=a.moving?Math.floor((a.walkDistance||0)/14)%4:1;
 const sw=listeningDirectorVisual.naturalWidth/4;
 const sh=listeningDirectorVisual.naturalHeight/4;
 const dw=60,dh=88;
 ctx.save();
 ctx.fillStyle='rgba(31,24,18,.28)';
 ctx.beginPath();ctx.ellipse(a.x,a.y-2,14,5,0,0,Math.PI*2);ctx.fill();
 ctx.drawImage(listeningDirectorVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh+idleBob(a),dw,dh);
 ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=5;
 ctx.fillStyle='#fff4db';ctx.fillText(actorDisplayName(a),a.x,a.y+14);
 ctx.restore();
 return true;
}
const mattVisual=new Image();
mattVisual.decoding='async';
// v2 has normalized per-frame feet positions and isolated transparent silhouettes.
mattVisual.src='./assets/matt-walk-v3.png';
function mattDirection(dx,dy,previous='down'){
 if(Math.abs(dx)<0.001 && Math.abs(dy)<0.001)return previous;
 return Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
}
function drawMattSprite(a,now){
 if(drawHDCharacter(a,1,'Matt'))return true;
 if(!mattVisual.complete || !mattVisual.naturalWidth)return false;
 const directions={down:0,right:1,up:2,left:3};
 const row=directions[a.direction]??0;
 // Advance the gait by ACTUAL ground distance, not wall-clock time.
 // No leg cycling while standing, turning or waiting on a route segment.
 // Contact → passing → opposite contact → passing, linked to ground travel.
 const frame=a.moving?Math.floor((a.walkDistance||0)/14)%4:1;
 const sw=mattVisual.naturalWidth/4,sh=mattVisual.naturalHeight/4;
 const dw=60,dh=88;
 ctx.save();
 ctx.fillStyle='rgba(31,24,18,.28)';
 ctx.beginPath();ctx.ellipse(a.x,a.y-2,14,5,0,0,Math.PI*2);ctx.fill();
 ctx.drawImage(mattVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh+idleBob(a),dw,dh);
 ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=5;
 ctx.fillStyle='#fff4db';ctx.fillText('Matt',a.x,a.y+14);
 ctx.restore();
 return true;
}
const pokemonDirectorActor=actors.find(a=>a.id==='pokemon-director');
if(pokemonDirectorActor){
 pokemonDirectorActor.direction='down';
 pokemonDirectorActor.moving=false;
 pokemonDirectorActor.walkDistance=14;
 pokemonDirectorActor.lastVisualX=pokemonDirectorActor.x;
 pokemonDirectorActor.lastVisualY=pokemonDirectorActor.y;
}
const studioDirectorActor=actors.find(a=>a.id==='studio-director');
if(studioDirectorActor){
 studioDirectorActor.direction='down';studioDirectorActor.moving=false;
 studioDirectorActor.walkDistance=14;
 studioDirectorActor.lastVisualX=studioDirectorActor.x;
 studioDirectorActor.lastVisualY=studioDirectorActor.y;
}
const wellbeingDirectorActor=actors.find(a=>a.id==='wellbeing-director');
if(wellbeingDirectorActor){
 wellbeingDirectorActor.direction='down';wellbeingDirectorActor.moving=false;
 wellbeingDirectorActor.walkDistance=14;
 wellbeingDirectorActor.lastVisualX=wellbeingDirectorActor.x;
 wellbeingDirectorActor.lastVisualY=wellbeingDirectorActor.y;
}
const listeningDirectorActor=actors.find(a=>a.id==='listening-director');
if(listeningDirectorActor){
 listeningDirectorActor.direction='down';listeningDirectorActor.moving=false;
 listeningDirectorActor.walkDistance=14;
 listeningDirectorActor.lastVisualX=listeningDirectorActor.x;
 listeningDirectorActor.lastVisualY=listeningDirectorActor.y;
}
const mattActor=actors.find(a=>a.id==='matt');
mattActor.direction='down';mattActor.moving=false;mattActor.walkDistance=16;
mattActor.x=state.walker.x-36;mattActor.y=state.walker.y;
const followTrail=[{x:state.walker.x,y:state.walker.y}];
const agentJourney={mode:'following',route:[],phase:'idle',meeting:false,
 pendingReturn:false,meetingSince:0,failed:false,meetingDirectorId:null,priorDirectorDirection:null,
 reportSince:0,reportReady:false,priorPlayerDirection:null};
const mattReturnWaiters=[];
function resolveMattReturn(){while(mattReturnWaiters.length)mattReturnWaiters.shift()()}
// Workspace framing affects only the camera, never actor positions or scene scale.
let workspaceFrame=null;
window.PaperworldWorld=Object.freeze({
 agents:()=>actors.map(a=>({...a})),
 frameForWorkspace:({open=false,panelWidth=0}={})=>{
  if(open){
   if(!Number.isFinite(panelWidth)||panelWidth<0)return false;
   if(!workspaceFrame)workspaceFrame={x:state.x,y:state.y,scale:state.scale,
    width:state.width,height:state.height};
   const visible=Math.max(280,state.width-Math.min(panelWidth,state.width-280));
   // Keep the user's zoom; pan the landscape into the unobscured left region.
   // Using the original image's center also keeps a predictable framing.
   state.x=visible/2-(W/2)*state.scale;
   state.y=state.height/2-(H/2)*state.scale;
   return true;
  }
  if(workspaceFrame){
   const saved=workspaceFrame;workspaceFrame=null;
   if(saved.width===state.width&&saved.height===state.height){
    state.x=saved.x;state.y=saved.y;state.scale=saved.scale;
   }else resetCamera();
  }
  return true;
 },
 // T addresses a nearby Director; M talks to the always-available Matt.
 setAgentWorkflowStage,
 setAgentWorkflowFailure,
 startMattDirectorJourney,
 completeMattDirectorJourney,
 waitMattDirectorReturn,
 // Pan the camera to a real actor (Team "Δες στο χωριό"). Purely visual:
 // it never moves the agent, starts work or implies availability.
 focusAgent:(id,{panelWidth=0}={})=>{
  const a=actors.find(x=>x.id===id);
  if(!a||!Number.isFinite(a.x)||!Number.isFinite(a.y))return false;
  const visible=Math.max(state.width-Math.max(0,panelWidth),state.width*.4);
  state.x=visible/2-a.x*state.scale;state.y=state.height/2-a.y*state.scale;
  return true;
 },
 nearestAgent:(radius=100)=>actors.filter(a=>a.id!=='matt')
   .map(a=>({...a,distance:Math.hypot(a.x-state.walker.x,a.y-state.walker.y)}))
   .filter(a=>a.distance<=radius).sort((a,b)=>a.distance-b.distance)[0]||null
});
const scene={name:'Papercraft environment',file:'./assets/environment-010.png'};
function load(item){item.image=new Image();item.ready=false;item.image.onload=()=>{item.ready=true;if(item!==scene){const c=document.createElement('canvas');c.width=128;c.height=Math.max(1,Math.round(128*item.image.naturalHeight/item.image.naturalWidth));const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(item.image,0,0,c.width,c.height);item.hitMask={data:g.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height}}renderStatus()};item.image.onerror=()=>{item.ready=false;renderStatus()};item.image.src=item.file}
[scene,...defs].forEach(load);
function renderStatus(){assetEl.innerHTML=[scene,...defs].map(d=>'<div class="'+(d.ready?'good':'bad')+'">'+(d.ready?'✓ ':'○ ')+d.name+'</div>').join('')}
const navigation=window.PaperworldNavigation;
if(!navigation)throw new Error('PAPERWORLD navigation module not loaded');
const directorMovement=window.PaperworldDirectorMovement;
if(!directorMovement)throw new Error('PAPERWORLD director movement module not loaded');
const directorAssembly=directorMovement.create(navigation,actors);
// Village art must still render if an optional ambient module fails to load.
const villageLife=window.PaperworldVillageLife?.create(navigation,actors)||
 Object.freeze({tick(){},recallAll(){},ready:()=>true,resume:()=>true,
  greetings:()=>[],homeOf:()=>null});

function planMattRoute(target){
 const start=navigation.snapToPath([mattActor.x,mattActor.y],110);
 const end=navigation.snapToPath(target,55);
 if(!start||!end)return false;
 const points=navigation.routeBetween(start,end);
 if(!points.length)return false;
 // Preserve physical movement. No teleporting to the target actor/building.
 agentJourney.route=points.map(([x,y])=>({x,y})).filter(p=>Math.hypot(p.x-mattActor.x,p.y-mattActor.y)>1);
 return true;
}
function planMattEncounter(director){
 const home=villageLife.homeOf(director.id);
 const encounter=directorMovement.stagedEncounter(navigation,home?{...director,...home}:director);
 if(!encounter)return false;
 villageLife.recallAll();
 if(!planMattRoute(encounter.point)){villageLife.resume();return false;}
 agentJourney.meetingDirectorId=director.id;
 agentJourney.priorDirectorDirection=null;
 return true;
}
function startFaceToFace(){
 const director=actors.find(a=>a.id===agentJourney.meetingDirectorId);
 if(!director)return;
 agentJourney.priorDirectorDirection=director.direction||'down';
 mattActor.direction=directorMovement.facingToward(mattActor,director,mattActor.direction);
 director.direction=directorMovement.facingToward(director,mattActor,director.direction);
 mattActor.moving=false;director.moving=false;
}
function chooseReportSpot(){
 // The human and Matt must face one another with a gap on approved paving.
 const player=state.walker,desired=58,offsets=[[0,-1],[-1,0],[1,0],[0,1],[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]];
 const start=navigation.snapToPath([mattActor.x,mattActor.y],110);
 if(!start)return null;
 const candidates=[];
 for(const [dx,dy] of offsets){
  const snap=navigation.snapToPath([player.x+dx*desired,player.y+dy*desired],50);
  if(!snap)continue;
  const distance=Math.hypot(snap.point[0]-player.x,snap.point[1]-player.y);
  if(distance<42||distance>90||!navigation.clearSegment(snap.point,[player.x,player.y]))continue;
  const route=navigation.routeBetween(start,snap);
  if(!route.length)continue;
  candidates.push({point:snap.point,score:Math.abs(distance-desired)+
   .005*Math.hypot(snap.point[0]-mattActor.x,snap.point[1]-mattActor.y)});
 }
 candidates.sort((a,b)=>a.score-b.score);
 return candidates[0]?.point||null;
}
function planMattReportRoute(){
 const point=chooseReportSpot();
 return point?planMattRoute(point):planMattRoute([state.walker.x,state.walker.y]);
}
function startReportPose(now){
 const player=state.walker;
 if(Math.hypot(mattActor.x-player.x,mattActor.y-player.y)>95){
  agentJourney.mode='following';resolveMattReturn();villageLife.resume();return;
 }
 agentJourney.mode='reporting';agentJourney.reportSince=now;agentJourney.reportReady=false;
 agentJourney.priorPlayerDirection=player.direction;
 mattActor.direction=directorMovement.facingToward(mattActor,player,mattActor.direction);
 player.direction=directorMovement.facingToward(player,mattActor,player.direction);
 mattActor.moving=false;player.moving=false;
}
function endReportPose(){
 if(agentJourney.priorPlayerDirection!==null)state.walker.direction=agentJourney.priorPlayerDirection;
 agentJourney.priorPlayerDirection=null;agentJourney.mode='following';
 villageLife.resume();
 followTrail.length=0;followTrail.push({x:state.walker.x,y:state.walker.y});
}
function endFaceToFace(){
 const director=actors.find(a=>a.id===agentJourney.meetingDirectorId);
 if(director&&agentJourney.priorDirectorDirection!==null)
  director.direction=agentJourney.priorDirectorDirection;
 agentJourney.priorDirectorDirection=null;
 agentJourney.meetingDirectorId=null;
}
// Re-enact only a verified AI handoff: select the ACTUAL project Director.
 // The inference has already finished. This is visual playback, not a live
 // claim that a model is physically walking between agents.
function startMattDirectorJourney(directorId){
 const target=actors.find(a=>a.id===directorId&&
  ['listening-director','pokemon-director','studio-director'].includes(a.id));
 if(!target||agentJourney.mode!=='following')return false;
 if(!planMattEncounter(target))return false;
 agentJourney.phase='routed';agentJourney.failed=false;
 agentJourney.pendingReturn=false;agentJourney.meeting=false;
 agentJourney.mode='outbound';
 return true;
}
function completeMattDirectorJourney(){
 if(agentJourney.mode==='following')return true;
 agentJourney.pendingReturn=true;
 return true;
}
function waitMattDirectorReturn(){
 if(agentJourney.mode==='following')return Promise.resolve();
 return new Promise(resolve=>mattReturnWaiters.push(resolve));
}
function setAgentWorkflowFailure(){
 // A worker failure is not a completed meeting. Never invent a journey.
 agentJourney.failed=true;
 if(agentJourney.mode==='meeting')endFaceToFace();
 if(agentJourney.mode==='outbound'||agentJourney.mode==='meeting')
  setAgentWorkflowStage('failed');
 else agentJourney.phase='failed';
}
function setAgentWorkflowStage(stateName){
 if(stateName==='routed'||stateName==='created')agentJourney.failed=false;
 const events=stateName==='created'?[{state:'created',actor:'matt'}]:
  [{state:'routed',actor:'matt'},{state:stateName,actor:'matt'}];
 const projection=window.PaperworldVisualWorkflow?.project(events);
 if(!projection)return false;
 agentJourney.phase=projection.phase;
 if(projection.returning){
  // Finish the physical walk and brief encounter even if the AI response
  // finishes before the sprite reaches the workshop. Visual playback only.
  agentJourney.pendingReturn=true;
  if(agentJourney.mode==='following'){
   agentJourney.pendingReturn=false;
   agentJourney.meeting=false;
   if(planMattReportRoute())agentJourney.mode='returning';
  }
 }else if(projection.travel&&agentJourney.mode==='following'){
  const target=actors.find(a=>a.id==='listening-director');
  if(target&&planMattEncounter(target))agentJourney.mode='outbound';
 }
 return true;
}

function resize(){const r=canvas.getBoundingClientRect();state.width=r.width;state.height=r.height;state.dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*state.dpr));canvas.height=Math.max(1,Math.round(r.height*state.dpr));ctx.setTransform(state.dpr,0,0,state.dpr,0,0);state.fit=Math.min((r.width-14)/W,(r.height-14)/H);resetCamera();
 if(workspaceFrame){
  const panel=document.querySelector('.pw-workspace:not([hidden])');
  const width=panel?.getBoundingClientRect?.().width||0;
  const visible=Math.max(280,state.width-Math.min(width+12,state.width-280));
  state.x=visible/2-(W/2)*state.scale;
  state.y=state.height/2-(H/2)*state.scale;
 }
}
function resetCamera(){state.scale=state.fit;state.x=(state.width-W*state.scale)/2;state.y=(state.height-H*state.scale)/2}
function localPoint(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function worldPoint(p){return{x:(p.x-state.x)/state.scale,y:(p.y-state.y)/state.scale}}
function spriteBox(d){const ratio=d.image.naturalHeight/d.image.naturalWidth||.75;const height=d.width*ratio;return{x:d.x-d.width/2,y:d.bottom-height,width:d.width,height}}
function hitBuilding(p){return [...defs].reverse().find(d=>{if(!d.ready||!d.hitMask)return false;const b=spriteBox(d);if(p.x<b.x||p.x>b.x+b.width||p.y<b.y||p.y>b.y+b.height)return false;const m=d.hitMask,px=Math.min(m.w-1,Math.floor((p.x-b.x)/b.width*m.w)),py=Math.min(m.h-1,Math.floor((p.y-b.y)/b.height*m.h));return m.data[(py*m.w+px)*4+3]>65})}
function inspect(d){
 if(calibrating)setCalibrating(false);
 state.chosen=d;state.route=[];state.destination=null;
 nameEl.textContent=d.name;descEl.textContent=d.desc;updateMarkerControls();
 // The world is the primary UI: tapping a house talks to its Director.
 // Open the work desk only on explicit user action; do not show task tabs.
 const agentIds={town:'matt',workshop:'listening-director',pokemon:'pokemon-director',
                 wellbeing:'wellbeing-director',studio:'studio-director'};
 window.PaperworldWorldDialogue?.show(agentIds[d.id]||'matt');
}
function tap(p){
 if(calibrating&&state.chosen){
  state.chosen.entrance=[Math.round(Math.max(0,Math.min(W,p.x))),Math.round(Math.max(0,Math.min(H,p.y)))];
  saveMarker(state.chosen);setCalibrating(false);updateMarkerControls();return;
 }
 const d=hitBuilding(p);if(d){inspect(d);state.destination=null;return}
 // Taps on/near the map resolve to the nearest point ON a surveyed paved segment.
 // Allow a comfortable finger-sized margin around mapped paving, but never jump to a far-away path.
 const touchTolerance=Math.min(115,Math.max(75,56/state.scale));
 const destination=navigation.snapToPath([p.x,p.y],touchTolerance);
 if(!destination){nameEl.textContent='Village paths';descEl.textContent='No connected walkway nearby. Tap closer to the village roads.';return}
 const start=navigation.snapToPath([state.walker.x,state.walker.y],20);
 if(!start){state.route=[];descEl.textContent='The walker is off the mapped road. Reload to reset position.';return}
 const path=navigation.routeBetween(start,destination);
 if(!path.length){descEl.textContent='No connected paved route to this destination.';return}
 state.route=path.slice(1).map(([x,y])=>({x,y}));
 state.destination=state.route.length?{x:destination.point[0],y:destination.point[1]}:null;
 state.chosen=null;
 updateMarkerControls();
 nameEl.textContent='Village paths';
 descEl.textContent=destination.distance>24?'Walking to the nearest paved path.':'Walking along the paved paths.';
}
function draw(now){spriteNow=now;ctx.clearRect(0,0,state.width,state.height);ctx.fillStyle='#151b22';ctx.fillRect(0,0,state.width,state.height);ctx.save();ctx.translate(state.x,state.y);ctx.scale(state.scale,state.scale);
if(scene.ready)ctx.drawImage(scene.image,0,0,W,H);else{ctx.fillStyle='#a6b398';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='40px system-ui';ctx.fillText('Upload assets/environment-010.png to preview the village',105,440)}
const w=state.walker;
 const drawFigure=(p,testing=false)=>{
  ctx.save();
  ctx.fillStyle='#3a2e29aa';ctx.beginPath();ctx.ellipse(p.x,p.y,14,6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=testing?'#f9cfa0':'#f8e0b6';ctx.beginPath();ctx.arc(p.x,p.y-23,10,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=testing?'#a17db7':'#647e76';ctx.fillRect(p.x-10,p.y-14,20,20);
  ctx.fillStyle='#fff8e4';ctx.font='15px system-ui';ctx.textAlign='center';ctx.fillText(testing?'Depth test':'You',p.x,p.y+21);
  ctx.restore();
 };
 // Back-to-front ordering based on the actor's FEET and each object's ground
 // anchor; the transparent building PNG covers an actor behind it, not in front.
 const layers=defs.filter(d=>d.ready).map(d=>({
   id:d.id,depth:d.bottom,paint:()=>{const b=spriteBox(d);ctx.drawImage(d.image,b.x,b.y,b.width,b.height)}
 }));
 for(const a of actors)layers.push({id:'agent-'+a.id,depth:depth.actorWalkwayDepth(a,navigation,defs),paint:()=>{
 if(a.id==='matt' && drawMattSprite(a,now))return;
 if(a.id==='listening-director' && drawListeningDirectorSprite(a))return;
 if(a.id==='pokemon-director' && drawPokemonDirectorSprite(a))return;
 if(a.id==='wellbeing-director' && drawWellbeingDirectorSprite(a))return;
 if(a.id==='studio-director' && drawStudioDirectorSprite(a))return;
 ctx.save();ctx.fillStyle='#42362999';ctx.beginPath();ctx.ellipse(a.x,a.y,13,5,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=a.id==='matt'?'#c9a56e':'#8ca7af';ctx.beginPath();ctx.arc(a.x,a.y-24,10,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#3c4d58';ctx.fillRect(a.x-10,a.y-14,20,20);
 ctx.fillStyle='#fff9e8';ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.fillText(actorDisplayName(a),a.x,a.y+23);
 ctx.restore();
}});
layers.push({id:'player',depth:depth.actorWalkwayDepth(w,navigation,defs),paint:()=>{if(!drawPlayerSprite(w))drawFigure(w)}});
 const d=demoPositions[state.depthDemo];
 if(d)layers.push({id:'depth-demo',depth:d.y,paint:()=>drawFigure(d,true)});
 layers.push(...depth.foregroundLayers(ctx,scene.ready,scene.image,W,H));
 depth.sortLayers(layers).forEach(item=>item.paint());
 // Authoring overlay stays visible even over building art; it is never used for live routes.
 if(editingPaths){
  pathDraft.draw(ctx);
  // Show detached groups in orange; no edges are invented or enabled for walkers.
  const groups=pathDisconnectedComponents().sort((a,b)=>b.length-a.length);
  const pathNodes=pathDraft.snapshot().nodes;
  ctx.save();ctx.fillStyle='#ff965e';ctx.strokeStyle='#481c10';ctx.lineWidth=2;
  for(const group of groups.slice(1)){
   for(const i of group){
    const [x,y]=pathNodes[i];
    ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fill();ctx.stroke();
   }
  }
  ctx.restore();
 }
 // Optional developer overlay: visualize only collision-checked walkable edges.
 if(showSurveyedPaths){
  ctx.save();ctx.lineWidth=4;ctx.strokeStyle='rgba(229,48,53,.92)';
  ctx.setLineDash([8,5]);ctx.beginPath();
  for(const [i,j] of navigation.safeConnections){
   // Rear alleys are genuine walkable paths, but never paint them on rooftops.
   if(navigation.isHiddenEdge(i,j))continue;
   const a=navigation.nodes[i],b=navigation.nodes[j];
   ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);
  }
  ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ff6464';
  const hiddenNodes=new Set(navigation.hiddenConnections.flat());
  navigation.nodes.forEach(([x,y],i)=>{
   if(hiddenNodes.has(i)&&i>=37)return;
   ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
  });
  ctx.restore();
 }
 // A greeting gesture is visual-only, not a fabricated AI conversation.
 for(const pair of villageLife.greetings()){
  if(pair.id>=pair.with)continue;
  const first=actors.find(a=>a.id===pair.id),other=actors.find(a=>a.id===pair.with);
  if(!first||!other)continue;
  const x=(first.x+other.x)/2,y=Math.min(first.y,other.y)-98;
  ctx.save();ctx.font='25px system-ui';ctx.textAlign='center';
  ctx.shadowColor='#453829';ctx.shadowBlur=6;
  ctx.fillText('👋',x,y+Math.sin(now/280)*2);
  ctx.restore();
 }
 if(agentJourney.failed){
  ctx.save();
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold 18px system-ui';
  ctx.shadowColor='#18171b';ctx.shadowBlur=7;
  ctx.fillStyle='#ffb9a8';
  ctx.fillText('⚠ Εργασία απέτυχε',mattActor.x,mattActor.y-108);
  ctx.restore();
 }
 if(agentJourney.meeting||agentJourney.mode==='reporting'){
  const d=agentJourney.meeting?actors.find(a=>a.id===agentJourney.meetingDirectorId):state.walker;
  ctx.save();ctx.font='bold 22px system-ui';ctx.fillStyle='#fff4db';
  ctx.shadowColor='#15211e';ctx.shadowBlur=7;
  ctx.fillText('…',mattActor.x,mattActor.y-96);
  if(d)ctx.fillText('…',d.x,d.y-60);
  ctx.restore();
 }
 if(state.chosen){
  // Marker is tied to the FRONT DOOR on the actual artwork, not the sprite base,
  // the artwork centre, or the nearest pathfinding waypoint.
  const d=state.chosen,x=d.entrance[0],y=d.entrance[1];
  ctx.save();ctx.shadowColor='#ffdda0';ctx.shadowBlur=10;
  ctx.fillStyle='#fff5d5';ctx.strokeStyle='#765c38';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x,y-16);ctx.lineTo(x+9,y-5);ctx.lineTo(x,y+6);ctx.lineTo(x-9,y-5);ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.restore();
}
 if(state.destination){const p=state.destination;ctx.strokeStyle='#fef3d9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-7,p.y);ctx.lineTo(p.x+7,p.y);ctx.moveTo(p.x,p.y-7);ctx.lineTo(p.x,p.y+7);ctx.stroke()}
 ctx.restore()}
function tick(now){
 const dt=Math.min(.05,(now-(tick.last||now))/1000);tick.last=now;
 directorAssembly.tick(dt);
 villageLife.tick(dt,{allowRoaming:directorAssembly.status()==='idle'});
 const player=state.walker;
 player.moving=false;
 if(state.route.length){
  const next=state.route[0],dx=next.x-player.x,dy=next.y-player.y,
        dist=Math.hypot(dx,dy),speed=105*dt;
  if(dist>0.001){
   const step=Math.min(dist,speed);
   player.direction=mattDirection(dx,dy,player.direction);
   player.x+=dx/dist*step;player.y+=dy/dist*step;
   player.walkDistance+=step;player.moving=step>0.25;
  }
  if(dist<=speed+0.001){player.x=next.x;player.y=next.y;state.route.shift();
   if(!state.route.length)state.destination=null}
 }
 const last=followTrail[followTrail.length-1];
 if(Math.hypot(state.walker.x-last.x,state.walker.y-last.y)>11)
  followTrail.push({x:state.walker.x,y:state.walker.y});
 mattActor.moving=false;
 if(agentJourney.mode==='outbound'||agentJourney.mode==='returning'){
  const next=agentJourney.route[0];
  if(next){
   const dx=next.x-mattActor.x,dy=next.y-mattActor.y;
   const dist=Math.hypot(dx,dy),speed=105*dt;
   if(dist>0.001){
    const step=Math.min(dist,speed);
    mattActor.direction=mattDirection(dx,dy,mattActor.direction);
    mattActor.x+=dx/dist*step;mattActor.y+=dy/dist*step;
    mattActor.walkDistance+=step;mattActor.moving=step>0.25;
   }
   if(dist<=speed+0.01)agentJourney.route.shift();
  }else if(agentJourney.mode==='outbound'){
   if(villageLife.ready()){
    agentJourney.mode='meeting';agentJourney.meeting=true;agentJourney.meetingSince=now;startFaceToFace();
   }
  }else{
   agentJourney.meeting=false;
   startReportPose(now);
  }
 }
 if(agentJourney.mode==='meeting'&&agentJourney.pendingReturn&&
    now-agentJourney.meetingSince>1600){
  agentJourney.meeting=false;agentJourney.pendingReturn=false;
  endFaceToFace();
  if(planMattReportRoute())agentJourney.mode='returning';
  else{agentJourney.mode='following';resolveMattReturn()}
 }
 if(agentJourney.mode==='reporting'){
  const distance=Math.hypot(mattActor.x-state.walker.x,mattActor.y-state.walker.y);
  if(distance>95||state.route.length){if(!agentJourney.reportReady)resolveMattReturn();endReportPose();}
  else if(!agentJourney.reportReady&&now-agentJourney.reportSince>900){
   agentJourney.reportReady=true;resolveMattReturn();
  }else if(now-agentJourney.reportSince>6000)endReportPose();
 }
 if(agentJourney.mode==='following'&&followTrail.length>4){
  const next=followTrail[0],dx=next.x-mattActor.x,dy=next.y-mattActor.y,
        dist=Math.hypot(dx,dy),speed=125*dt;
  if(dist>0.01){
   mattActor.direction=mattDirection(dx,dy,mattActor.direction);
   const move=Math.min(dist,speed);
   mattActor.x+=dx/dist*move;mattActor.y+=dy/dist*move;
   mattActor.walkDistance+=move;
   mattActor.moving=move>0.25;
  }
  if(dist<=speed+0.01){mattActor.x=next.x;mattActor.y=next.y;followTrail.shift()}
 }
 draw(now);requestAnimationFrame(tick)
}
canvas.addEventListener('pointerdown',e=>{
 const p=localPoint(e),d=placingBuildings?hitBuilding(worldPoint(p)):null;
 if(editingPaths){
  const pt=worldPoint(p);
  pathDraft.pointerDown([pt.x,pt.y],18/state.scale);
  state.pointer={...p,originalX:p.x,originalY:p.y,dragged:false,path:true};
  canvas.setPointerCapture(e.pointerId);updatePathStatus();return;
 }
 if(placingBuildings&&d){placementSelected=d;updatePlacementStatus()}
 state.pointer={...p,originalX:p.x,originalY:p.y,dragged:false,
  building:placingBuildings?d:null};
 canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 const p=localPoint(e),v=state.pointer;if(!v)return;
 if(editingPaths&&v.path){
  const pt=worldPoint(p);
  if(Math.hypot(p.x-v.originalX,p.y-v.originalY)>5)v.dragged=true;
  pathDraft.pointerMove([pt.x,pt.y]);v.x=p.x;v.y=p.y;
  updatePathStatus();return;
 }
 if(Math.hypot(p.x-v.originalX,p.y-v.originalY)>7)v.dragged=true;
 if(v.dragged){
  if(placingBuildings&&v.building)movePlacement(v.building,(p.x-v.x)/state.scale,(p.y-v.y)/state.scale);
  else{state.x+=p.x-v.x;state.y+=p.y-v.y}
 }
 v.x=p.x;v.y=p.y;
});
canvas.addEventListener('pointerup',e=>{
 const p=localPoint(e),v=state.pointer;
 if(editingPaths&&v?.path){
  const pt=worldPoint(p);pathDraft.pointerUp([pt.x,pt.y],18/state.scale);
  state.pointer=null;updatePathStatus();return;
 }
 if(placingBuildings){
  if(v?.building&&v.dragged)saveBuildingLayout();
  // Selection in layout mode never opens a Director conversation.
 }else if(v&&!v.dragged)tap(worldPoint(p));
 state.pointer=null;
});
canvas.addEventListener('pointercancel',()=>{
 if(editingPaths&&state.pointer?.path)pathDraft.cancelPointer();
 if(placingBuildings&&state.pointer?.building&&state.pointer.dragged)saveBuildingLayout();
 state.pointer=null;
});
function zoom(delta){const cx=state.width/2,cy=state.height/2,worldX=(cx-state.x)/state.scale,worldY=(cy-state.y)/state.scale;state.scale=Math.max(state.fit*.7,Math.min(state.fit*3,state.scale*delta));state.x=cx-worldX*state.scale;state.y=cy-worldY*state.scale}
document.querySelector('#plus').onclick=()=>zoom(1.2);document.querySelector('#minus').onclick=()=>zoom(1/1.2);document.querySelector('#home').onclick=resetCamera;
const drawer=document.querySelector('#world-drawer');
function openWorkDesk(){
 // Workspace V2 is the primary Work surface; the classic desk remains the
 // fallback (and is reachable from Settings → Για προχωρημένους).
 if(window.PaperworldWorkspace?.open){window.PaperworldWorkspace.open('work');return}
 drawer.hidden=false;
 // Cloud sign-in / task data is preserved off the main game canvas.
 window.PaperworldCloudUI?.openChief();
}
document.querySelector('#open-projects').addEventListener('click',openWorkDesk);
document.querySelector('#world-work-panel')?.addEventListener('click',openWorkDesk);
document.querySelector('#close-world-drawer')?.addEventListener('click',()=>{drawer.hidden=true});
document.querySelector('#open-chief')?.addEventListener('click',()=>{
 drawer.hidden=true;window.PaperworldWorldDialogue?.show('matt');
});
document.querySelector('#world-talk-matt')?.addEventListener('click',()=>window.PaperworldWorldDialogue?.show('matt'));
document.querySelector('#walkway-overlay')?.addEventListener('click',e=>{
 showSurveyedPaths=!showSurveyedPaths;
 e.currentTarget.textContent='Paths: '+(showSurveyedPaths?'On':'Off');
 e.currentTarget.setAttribute('aria-pressed',String(showSurveyedPaths));
});
// One briefing surface combines real owner jobs, visual gathering and
// direct one-on-one Director chat without pretending there is a multi-agent AI
// meeting or silently spending model credits.
let townHallBriefing=null;
document.querySelector('#call-visual-meeting')?.addEventListener('click',()=>{
 const started=directorAssembly.call();
 nameEl.textContent='Town Hall · ενημέρωση ομάδας';
 descEl.textContent=started?
  'Η ομάδα συγκεντρώνεται οπτικά. Η κατάσταση εργασιών διαβάζεται από τον λογαριασμό σου, χωρίς αυτόματες AI κλήσεις.':
  'Άνοιγμα Town Hall · η οπτική συγκέντρωση δεν ξεκίνησε ξανά.';
 const module=window.PaperworldTownHall;
 if(module?.create){
  if(!townHallBriefing)townHallBriefing=module.create(document.querySelector('#view'),{
   load:()=>window.PaperworldCloudUI.loadHumanWork(),
   chat:id=>window.PaperworldWorldDialogue?.show(id),
   askAI:(id,prompt)=>window.PaperworldCloudUI.askDirector(id,prompt,{saveNote:false}),
   openWork:()=>{if(window.PaperworldWorkspace?.open){window.PaperworldWorkspace.open('work');return}
    drawer.hidden=false;window.PaperworldCloudUI.openHumanWork()}
  });
  void townHallBriefing.show();
 }
});

new ResizeObserver(resize).observe(canvas);renderStatus();updateMarkerControls();requestAnimationFrame(tick);
})();