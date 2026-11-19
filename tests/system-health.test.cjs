'use strict';
// Low-cost owner health report: read-only, owner-scoped, no secrets, degrades safely.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeSystemHealth,heartbeatState}=require('../server/system-health.cjs');
const owner='11111111-1111-4111-8111-111111111111';
const headers={origin:'https://mr-tanq.github.io',authorization:'Bearer '+'a'.repeat(24)};
const NOW=Date.parse('2026-11-19T13:35:00Z');
function harness({controller={last_tick_at:'2026-11-19T13:30:00Z',last_error:null,dispatch_enabled:true,
 sessions_per_day:1,sessions_per_month:10,credit_snapshot_at:null},stalled=[],uncertain=[],
 routines=null,fail=[],secret='sb_secret_synthetic'}={}){
 const calls=[];
 const api=makeSystemHealth({secret,now:()=>NOW,env:{PAPERWORLD_COPILOT_BUDGET_VERIFIED:'yes',RENDER_GIT_COMMIT:'abcdef1234567'},
  identity:{authenticate:async()=>({ownerId:owner})},
  fetcher:async(url,opts)=>{
   calls.push({url,opts});
   const table=url.split('/rest/v1/')[1].split('?')[0];
   if(fail.includes(table))throw Error('down');
   const body={paperworld_autonomous_controller_v5:[controller],paperworld_autonomous_missions_v5:stalled,
    paperworld_autonomous_effects_v5:uncertain,paperworld_suno_create_claims:[]}[table];
   if(table==='paperworld_routines_v1')return routines?{ok:true,status:200,json:async()=>routines}:{ok:false,status:404};
   return {ok:true,status:200,json:async()=>body};
  }});
 return {api,calls,run:()=>api.handle({headers})};
}
test('healthy system: ok overall, release and heartbeat freshness, zero AI calls',async()=>{
 const h=harness({routines:[{id:'r',enabled:true},{id:'s',enabled:false}]});
 const r=await h.run();
 assert.equal(r.status,200);
 assert.equal(r.body.overall,'ok');assert.equal(r.body.aiCalls,0);
 assert.equal(r.body.heartbeat.state,'ok');assert.equal(r.body.heartbeat.minutes,5);
 assert.equal(r.body.server.release,'abcdef1');
 assert.deepEqual(r.body.routines,{state:'ok',installed:true,total:2,enabled:1});
 assert.equal(r.body.heartbeat.creditSnapshot,'missing');
 assert.ok(h.calls.every(c=>c.opts.method==='GET'),'read-only');
});
test('owner data is filtered by owner; no secrets or global counts are returned',async()=>{
 const h=harness();const r=await h.run();
 for(const c of h.calls.filter(c=>/missions_v5|effects_v5|routines_v1/.test(c.url)))
  assert.ok(c.url.includes('owner_id=eq.'+owner),c.url);
 const text=JSON.stringify(r.body);
 assert.doesNotMatch(text,/sb_secret|Bearer|ready_steps|waiting_missions|tick_count/);
});
test('stopped heartbeat, controller error, stalled or uncertain work are flagged',async()=>{
 assert.equal((await harness({controller:{last_tick_at:'2026-11-19T10:00:00Z'}}).run()).body.overall,'problem');
 assert.equal((await harness({controller:{last_tick_at:'2026-11-19T13:30:00Z',last_error:'boom'}}).run()).body.overall,'problem');
 const s=(await harness({stalled:[{id:'x'}],uncertain:[{effect_key:'k'}]}).run()).body;
 assert.equal(s.overall,'attention');assert.deepEqual([s.work.stalled,s.work.uncertain],[1,1]);
 assert.equal(heartbeatState('2026-11-19T13:00:00Z',NOW).state,'late');
 assert.equal(heartbeatState(null,NOW).state,'unknown');
});
test('missing migration reads as "not installed"; a failing probe degrades alone',async()=>{
 const r=(await harness({fail:['paperworld_autonomous_effects_v5']}).run()).body;
 assert.equal(r.routines.state,'not_installed');
 assert.equal(r.work.state,'unknown');assert.equal(r.heartbeat.state,'ok');
 assert.equal((await harness({secret:''}).run()).body.config.database,false);
});
test('origin and owner authentication are enforced before any read',async()=>{
 const h=harness();
 assert.equal((await h.api.handle({headers:{...headers,origin:'https://evil.example'}})).status,403);
 assert.equal((await h.api.handle({headers:{origin:headers.origin}})).status,401);
 assert.equal(h.calls.length,0);
});
test('server route, browser client and Settings wording are wired',()=>{
 const server=fs.readFileSync('server/render-matt.cjs','utf8');
 assert.match(server,/if\(req\.url==='\/health\/system'\)/);
 assert.match(fs.readFileSync('js/cloud.js','utf8'),/data\.aiCalls!==0/);
 const ws=fs.readFileSync('js/workspace.js','utf8');
 assert.match(ws,/Κατάσταση συστήματος/);
 assert.match(ws,/Τα εβδομαδιαία προγράμματα δεν έχουν εγκατασταθεί ακόμη στη βάση/);
});

test('over real HTTP: health and routine routes are POST-only, origin-bound, CORS-scoped',async()=>{
 const http=require('node:http');
 const {createRenderMattServer}=require('../server/render-matt.cjs');
 const seen=[];
 const app=createRenderMattServer({
  systemHealthFactory:()=>({handle:async({headers})=>{seen.push('health');return {status:200,body:{overall:'ok',aiCalls:0,origin:headers.origin}}}}),
  routineOwnerApiFactory:()=>({handle:async({action})=>{seen.push(action);return {status:200,body:{action}}}})});
 const address=await app.listen({port:0,host:'127.0.0.1'});
 const call=(path,method,origin)=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:address.port,path,method,
   headers:{...(origin?{origin}:{}),'content-type':'application/json'}},res=>{
   let raw='';res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:raw?JSON.parse(raw):null}));
  });req.on('error',reject);req.end(method==='POST'?'{}':undefined);
 });
 try{
  const app='https://mr-tanq.github.io';
  assert.equal((await call('/health/system','GET',app)).status,405);
  assert.equal((await call('/health/system','POST','https://evil.example')).status,403);
  const ok=await call('/health/system','POST',app);
  assert.equal(ok.status,200);assert.equal(ok.body.overall,'ok');
  assert.equal(ok.headers['access-control-allow-origin'],app);assert.equal(ok.headers['cache-control'],'no-store');
  assert.equal((await call('/health/system','OPTIONS',app)).status,204);
  const update=await call('/routines/update','POST',app);
  assert.equal(update.status,200);assert.equal(update.body.action,'update');
  assert.deepEqual(seen,['health','update']);
 }finally{await app.close?.()}
});
