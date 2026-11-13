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
     const response=await github("/actions/workflows/"+WORKFLOW+"/runs?event=workflow_dispatch&per_page=5");
     if(!response.ok)return respond(502,{error:"GitHub status unavailable"});
     const data=await response.json();
     const run=(data.workflow_runs||[])[0];
     return respond(200,{connected:!!TOKEN,ownerVerified:true,
       dispatchEnabled:!!TOKEN,prepareOnly:true,
       latestRun:run?{id:run.id,status:run.status,conclusion:run.conclusion,createdAt:run.created_at,url:run.html_url}:null,
       note:"Latest repository workflow run, not proof of execution of this particular mission."});
   }
   if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return respond(415,{error:"JSON required"});
   const data=await req.json().catch(()=>null);
   if(!data||Object.keys(data).sort().join(",")!=="confirm_prepare_only,mission_id"||data.confirm_prepare_only!==true||!safeId(data.mission_id))
     return respond(400,{error:"Explicit prepare-only confirmation and mission ID required"});
   // Browser cannot dispatch arbitrary prompts, repositories, refs, or input modes.
   const url=PROJECT+"/rest/v1/paperworld_missions?id=eq."+encodeURIComponent(data.mission_id)+
     "&select=id,owner_id,repository,project_room,title,mode,status&limit=1";
   const lookup=await fetch(url,{headers:{apikey:USER_KEY,Authorization:auth,Accept:"application/json"},signal:AbortSignal.timeout(10000)});
   if(!lookup.ok)return respond(502,{error:"Cannot verify mission ownership"});
   const rows=await lookup.json();
   const mission=rows[0];
   if(!mission||mission.owner_id!==userId||mission.repository!=="mr-tanq/concerts"||
     mission.project_room!=="workshop"||mission.mode!=="analysis_only"||
     mission.status!=="ready_for_review"||!/ticketswap/i.test(mission.title))
     return respond(403,{error:"Only your review-ready TicketSwap investigation is permitted"});
   if(!TOKEN)return respond(503,{error:"Secure GitHub Actions bridge not connected. No workflow started.",
     setupRequired:true,workflowUrl:"https://github.com/"+REPO+"/actions/workflows/"+WORKFLOW});
   const dispatched=await github("/actions/workflows/"+WORKFLOW+"/dispatches",{
     method:"POST",body:JSON.stringify({ref:"main",inputs:{mode:"prepare-only",approve_credits:""}})});
   if(dispatched.status!==204)return respond(502,{error:"GitHub did not accept the prepare-only dispatch",githubStatus:dispatched.status});
   return respond(202,{accepted:true,mode:"prepare-only",inference:false,creditsRequested:false,
     note:"Only the free preparation job was requested. No AI worker, code write or deployment."});
 }catch(_){return respond(502,{error:"Worker bridge temporarily unavailable"})}
});
