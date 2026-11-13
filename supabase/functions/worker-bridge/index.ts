import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";
// PAPERWORLD server-side bridge. No GitHub token is ever sent to the browser.
// The ONLY permitted dispatch is the free, no-AI-credit prepare-only workflow.
const ORIGIN="https://mr-tanq.github.io";
const PROJECT="https://jrevhzvrgenucuozjowm.supabase.co";
const REPO="mr-tanq/paperworld";
const WORKFLOW="worker-review.yml";
const GH_API="https://api.github.com/repos/"+REPO;
const USER_KEY=Deno.env.get("SUPABASE_ANON_KEY")||"";
const TOKEN=Deno.env.get("PAPERWORLD_GITHUB_ACTIONS_TOKEN")||"";
const HEADERS={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin","Cache-Control":"no-store"};
const respond=(status:number,payload:Record<string,unknown>)=>new Response(JSON.stringify(payload),{status,headers:HEADERS});
const safeId=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
async function github(path:string,init:RequestInit={}){
 const h:Record<string,string>={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
 if(TOKEN)h.Authorization="Bearer "+TOKEN;
 if(init.body)h["Content-Type"]="application/json";
 return await fetch(GH_API+path,{...init,headers:h,signal:AbortSignal.timeout(12000)});
}

// Only expose runs tagged with the supplied mission UUID. Older manual runs do not qualify.
const matchingRun=(runs:any[],id:string)=>runs.find(r=>
  typeof r.display_title==="string" && r.display_title.endsWith(" | "+id));
async function ownedMission(id:string,userId:string,auth:string){
 const url=PROJECT+"/rest/v1/paperworld_missions?id=eq."+encodeURIComponent(id)+
  "&select=id,owner_id,repository,project_room,title,mode,status&limit=1";
 const lookup=await fetch(url,{headers:{apikey:USER_KEY,Authorization:auth,Accept:"application/json"},signal:AbortSignal.timeout(10000)});
 if(!lookup.ok)throw Error("Mission lookup unavailable");
 const rows=await lookup.json();
 const m=rows[0];
 if(!m||m.owner_id!==userId||m.repository!=="mr-tanq/concerts"||
  m.project_room!=="workshop"||m.mode!=="analysis_only"||!/ticketswap/i.test(m.title))
   return null;
 return m;
}
async function missionRuns(id:string){
 const r=await github("/actions/workflows/"+WORKFLOW+"/runs?event=workflow_dispatch&per_page=40");
 if(!r.ok)throw Error("GitHub runs unavailable");
 const data=await r.json();
 return matchingRun(data.workflow_runs||[],id);
}
async function readReport(runId:number){
 const artifactResponse=await github("/actions/runs/"+runId+"/artifacts?per_page=15");
 if(!artifactResponse.ok)throw Error("Artifact listing unavailable");
 const artifacts=(await artifactResponse.json()).artifacts||[];
 const selected=artifacts.find((a:any)=>!a.expired && (a.name==="paperworld-worker-review"||a.name==="paperworld-worker-scope"));
 if(!selected)return null;
 if(selected.size_in_bytes>1500000)throw Error("Artifact exceeds review size limit");
 const bytesResponse=await github("/actions/artifacts/"+selected.id+"/zip");
 if(!bytesResponse.ok)throw Error("Artifact unavailable");
 const zip=new Uint8Array(await bytesResponse.arrayBuffer());
 if(zip.byteLength>1500000)throw Error("Artifact download exceeds review size limit");
 const files=unzipSync(zip);
 const wanted=["scope.json","analysis.md","audit.json","tests.log","worker.patch","prompt.txt"];
 const content:Record<string,string>={};
 for(const key of wanted){
  const file=files[key];if(file){
   if(file.length>120000)throw Error("Artifact entry exceeds safe review limit");
   content[key]=strFromU8(file).slice(0,18000);
  }
 }
 return {name:selected.name,files:content,downloadUrl:"https://github.com/"+REPO+"/actions/runs/"+runId};
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
 if(req.headers.get("origin")!==ORIGIN)return respond(403,{error:"Origin denied"});
 if(!["GET","POST"].includes(req.method))return respond(405,{error:"Method not allowed"});
 const auth=req.headers.get("authorization")||"";
 if(!/^Bearer\s+\S+$/i.test(auth)||!USER_KEY)return respond(401,{error:"Valid PAPERWORLD session required"});
 // Supabase Auth verifies the JWT online. Do not trust user-edited metadata or client IDs.
 let userId:string;
 try{
   const verify=await fetch(PROJECT+"/auth/v1/user",{headers:{Authorization:auth,apikey:USER_KEY},signal:AbortSignal.timeout(10000)});
   if(!verify.ok)return respond(401,{error:"Session expired"});
   const user=await verify.json();if(!safeId(user.id))return respond(401,{error:"Invalid session"});
   userId=user.id;
 }catch(_){return respond(502,{error:"Could not verify session"})}
 try{
   if(req.method==="GET"){
     const params=new URL(req.url).searchParams,missionId=params.get("mission_id");
     if(!safeId(missionId))return respond(400,{error:"Mission ID required"});
     const mission=await ownedMission(missionId,userId,auth);
     if(!mission)return respond(403,{error:"Mission not accessible"});
     if(!TOKEN)return respond(200,{connected:false,prepareOnly:true,run:null,note:"Bridge token missing."});
     const run=await missionRuns(missionId);
     const tracked=run?{id:run.id,status:run.status,conclusion:run.conclusion,
       createdAt:run.created_at,url:run.html_url,mode:"prepare-only"}:null;
     const result:Record<string,unknown>={connected:true,prepareOnly:true,missionId,run:tracked,
       note:run?"This GitHub Actions run is tagged with this mission.":"No tagged run for this mission yet."};
     if(run?.status==="completed"&&params.get("report")==="1")
       result.report=await readReport(run.id);
     return respond(200,result);
   }
   if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return respond(415,{error:"JSON required"});
   const data=await req.json().catch(()=>null);
   if(!data||Object.keys(data).sort().join(",")!=="confirm_prepare_only,mission_id"||data.confirm_prepare_only!==true||!safeId(data.mission_id))
     return respond(400,{error:"Explicit prepare-only confirmation and mission ID required"});
   // Browser cannot dispatch arbitrary prompts, repositories, refs, or input modes.
   const mission=await ownedMission(data.mission_id,userId,auth);
   if(!mission||mission.status!=="ready_for_review")
     return respond(403,{error:"Only your review-ready TicketSwap investigation is permitted"});
   if(!TOKEN)return respond(503,{error:"Secure GitHub Actions bridge not connected. No workflow started.",
     setupRequired:true,workflowUrl:"https://github.com/"+REPO+"/actions/workflows/"+WORKFLOW});
   const previous=await missionRuns(data.mission_id);
   if(previous && Date.now()-Date.parse(previous.created_at)<10*60*1000)
     return respond(409,{error:"This mission was requested recently. Check its existing run before retrying."});
   const dispatched=await github("/actions/workflows/"+WORKFLOW+"/dispatches",{
     method:"POST",body:JSON.stringify({ref:"main",inputs:{
       mission_id:data.mission_id,mode:"prepare-only",approve_credits:""
     }})});
   if(dispatched.status!==204)return respond(502,{error:"GitHub did not accept the prepare-only dispatch",githubStatus:dispatched.status});
   return respond(202,{accepted:true,mode:"prepare-only",inference:false,creditsRequested:false,
     note:"Only the free preparation job was requested. No AI worker, code write or deployment."});
 }catch(_){return respond(502,{error:"Worker bridge temporarily unavailable"})}
});
