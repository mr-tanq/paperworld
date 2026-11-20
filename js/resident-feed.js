/* PAPERWORLD resident feed — refreshes the residents' activity bubbles from the
 * owner's real missions about once a minute, only while signed in and while the
 * page is visible. Read-only: it never starts work, never calls AI, and a failed
 * read just keeps (or clears) the bubbles — it never invents activity.
 */
(()=>{'use strict';
const PERIOD=60000;
let timer=null,busy=false;
async function refresh(){
 const cloud=window.PaperworldCloudUI,world=window.PaperworldWorld,status=window.PaperworldResidentStatus;
 if(busy||!cloud||!world||!status||document.hidden)return;
 if(cloud.signedIn?.()!==true||typeof cloud.listAutonomousMissions!=='function'){
  world.setResidentStatus?.({});return;
 }
 busy=true;
 try{world.setResidentStatus?.(status.statuses(await cloud.listAutonomousMissions()))}
 catch(_){/* Keep the last verified view; never guess. */}
 finally{busy=false}
}
function start(){
 if(timer)return;
 setTimeout(refresh,4000);
 timer=setInterval(refresh,PERIOD);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.PaperworldResidentFeed=Object.freeze({refresh});
})();
