(()=>{'use strict';
const canvas=document.querySelector('#map'),ctx=canvas.getContext('2d'),nameEl=document.querySelector('#name'),descEl=document.querySelector('#desc'),assetEl=document.querySelector('#assets');
const W=1671,H=941;
const depth=window.PaperworldDepth;
if(!depth)throw new Error('PAPERWORLD depth module not loaded');
const state={width:0,height:0,dpr:1,scale:1,fit:1,x:0,y:0,pointer:null,chosen:null,walker:{x:835,y:854,direction:'down',moving:false,walkDistance:14},route:[],destination:null,depthDemo:0};
const defs=[
{id:'town',name:'Town Hall',file:'./assets/town-hall.png',x:535,bottom:476,width:356,entrance:[355,547],approach:[535,520],desc:'The future approval and budget hub. All operations remain disabled.'},
{id:'workshop',name:'Listening Mirror Workshop',file:'./assets/listening-mirror-workshop.png',x:1125,bottom:468,width:358,entrance:[1153,358],approach:[1125,515],desc:'The music discovery project workspace. No real tasks are connected.'},
{id:'pokemon',name:'Pokémon Hub',file:'./assets/pokemon-hub.png',x:330,bottom:646,width:370,entrance:[343,561],approach:[385,665],desc:'Future home of Pokémon: Echoes development.'},
{id:'wellbeing',name:'Wellbeing & Training Center',file:'./assets/wellbeing-training-center.png',x:1325,bottom:645,width:366,entrance:[1330,574],approach:[1240,690],desc:'Future training, nutrition, habits and progress workspace.'},
{id:'studio',name:'The Lost Wanderer Studio',file:'./assets/lost-wanderer-studio.png',x:835,bottom:801,width:438,entrance:[872,679],approach:[835,854],desc:'Future music writing and production studio.'}
];
// Preview-only marker offsets are local to the user's browser; no GitHub writes.
const markerKey='paperworld-preview-010-marker-calibration-v1';
try{const saved=JSON.parse(localStorage.getItem(markerKey)||'{}');for(const d of defs){const p=saved[d.id];if(Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=W&&p[1]>=0&&p[1]<=H)d.entrance=[...p]}}catch(_){}
let calibrating=false;
const calibrateButton=document.querySelector('#calibrate-marker');
const resetMarkerButton=document.querySelector('#reset-marker');
const exportMarkerButton=document.querySelector('#export-markers');
const markerExportOutput=document.querySelector('#marker-export-output');
const markerText=document.querySelector('#marker-status');
const defaultEntrances={"town":[355,547],"workshop":[1153,358],"pokemon":[343,561],"wellbeing":[1330,574],"studio":[872,679]};
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
const actors=defs.map(d=>({id:({town:'matt',workshop:'listening-director',pokemon:'pokemon-director',wellbeing:'wellbeing-director',studio:'studio-director'})[d.id],name:d.id==='town'?'Matt':d.name+' Director',x:d.approach[0],y:d.approach[1]}));
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
   a.x-dw/2,a.y-dh,dw,dh);
 ctx.font='bold 13px system-ui';
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=5;
 ctx.fillStyle='#fff4db';ctx.fillText(label,a.x,a.y+14);
 ctx.restore();
 return true;
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
 ctx.drawImage(playerVisual,frame*sw,row*sh,sw,sh,p.x-dw/2,p.y-dh,dw,dh);
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
 ctx.drawImage(wellbeingDirectorVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh,dw,dh);
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
 ctx.drawImage(studioDirectorVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh,dw,dh);
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
 ctx.drawImage(pokemonDirectorVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh,dw,dh);
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
 ctx.drawImage(listeningDirectorVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh,dw,dh);
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
 ctx.drawImage(mattVisual,frame*sw,row*sh,sw,sh,a.x-dw/2,a.y-dh,dw,dh);
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
 pendingReturn:false,meetingSince:0,failed:false};
window.PaperworldWorld=Object.freeze({
 agents:()=>actors.map(a=>({...a})),
 // T addresses a nearby Director; M talks to the always-available Matt.
 setAgentWorkflowStage,
 setAgentWorkflowFailure,
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
function setAgentWorkflowFailure(){
 // A worker failure is not a completed meeting. Never invent a journey.
 agentJourney.failed=true;
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
   if(planMattRoute([state.walker.x,state.walker.y]))agentJourney.mode='returning';
  }
 }else if(projection.travel&&agentJourney.mode==='following'){
  if(planMattRoute([1125,515]))agentJourney.mode='outbound';
 }
 return true;
}

function resize(){const r=canvas.getBoundingClientRect();state.width=r.width;state.height=r.height;state.dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*state.dpr));canvas.height=Math.max(1,Math.round(r.height*state.dpr));ctx.setTransform(state.dpr,0,0,state.dpr,0,0);state.fit=Math.min((r.width-14)/W,(r.height-14)/H);resetCamera()}
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
function draw(now){ctx.clearRect(0,0,state.width,state.height);ctx.fillStyle='#151b22';ctx.fillRect(0,0,state.width,state.height);ctx.save();ctx.translate(state.x,state.y);ctx.scale(state.scale,state.scale);
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
 // Optional developer overlay: visualize only collision-checked walkable edges.
 if(showSurveyedPaths){
  ctx.save();ctx.lineWidth=4;ctx.strokeStyle='rgba(229,48,53,.92)';
  ctx.setLineDash([8,5]);ctx.beginPath();
  for(const [i,j] of navigation.safeConnections){
   const a=navigation.nodes[i],b=navigation.nodes[j];
   ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);
  }
  ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ff6464';
  for(const [x,y] of navigation.nodes){
   ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
  }
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
 if(agentJourney.meeting){
  const d=actors.find(a=>a.id==='listening-director');
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
 // Directors move only during explicitly requested visual meetings.
const dt=Math.min(.05,(now-(tick.last||now))/1000);tick.last=now;
 directorAssembly.tick(dt);
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
   const dist=Math.hypot(dx,dy),speed=125*dt;
   if(dist>0.001){
    const step=Math.min(dist,speed);
    mattActor.direction=mattDirection(dx,dy,mattActor.direction);
    mattActor.x+=dx/dist*step;mattActor.y+=dy/dist*step;
    mattActor.walkDistance+=step;mattActor.moving=step>0.25;
   }
   if(dist<=speed+0.01)agentJourney.route.shift();
  }else if(agentJourney.mode==='outbound'){
   agentJourney.mode='meeting';agentJourney.meeting=true;agentJourney.meetingSince=now;
  }else{
   agentJourney.mode='following';agentJourney.meeting=false;
   followTrail.length=0;followTrail.push({x:state.walker.x,y:state.walker.y});
  }
 }
 if(agentJourney.mode==='meeting'&&agentJourney.pendingReturn&&
    now-agentJourney.meetingSince>1600){
  agentJourney.meeting=false;agentJourney.pendingReturn=false;
  if(planMattRoute([state.walker.x,state.walker.y]))agentJourney.mode='returning';
  else agentJourney.mode='following';
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
canvas.addEventListener('pointerdown',e=>{const p=localPoint(e);state.pointer={...p,originalX:p.x,originalY:p.y,dragged:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{const p=localPoint(e),v=state.pointer;if(!v)return;if(Math.hypot(p.x-v.originalX,p.y-v.originalY)>7)v.dragged=true;if(v.dragged){state.x+=p.x-v.x;state.y+=p.y-v.y}v.x=p.x;v.y=p.y});
canvas.addEventListener('pointerup',e=>{const p=localPoint(e),v=state.pointer;if(v&&!v.dragged)tap(worldPoint(p));state.pointer=null});
canvas.addEventListener('pointercancel',()=>{state.pointer=null});
function zoom(delta){const cx=state.width/2,cy=state.height/2,worldX=(cx-state.x)/state.scale,worldY=(cy-state.y)/state.scale;state.scale=Math.max(state.fit*.7,Math.min(state.fit*3,state.scale*delta));state.x=cx-worldX*state.scale;state.y=cy-worldY*state.scale}
document.querySelector('#plus').onclick=()=>zoom(1.2);document.querySelector('#minus').onclick=()=>zoom(1/1.2);document.querySelector('#home').onclick=resetCamera;
const drawer=document.querySelector('#world-drawer');
function openWorkDesk(){
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
document.querySelector('#call-visual-meeting')?.addEventListener('click',()=>{
 const started=directorAssembly.call();
 nameEl.textContent='Town Hall · visual meeting';
 descEl.textContent=started
  ?'Directors are walking on mapped paths for an illustrative gathering. No AI meeting, model call, task, or approval has been started.'
  :'A visual gathering is already underway or no safe route is available.';
});

new ResizeObserver(resize).observe(canvas);renderStatus();updateMarkerControls();requestAnimationFrame(tick);
})();