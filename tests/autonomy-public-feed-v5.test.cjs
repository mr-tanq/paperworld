'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const feed=require('../js/autonomy-public-feed.js');
const hub=require('../js/human-first-hub.js');
const digest='a'.repeat(64);
function fake({bot='github-actions[bot]',failed=false,malicious=false}={}){
 const issues=[
  {number:43,title:feed.MISSIONS[0].title,comments:1},
  {number:44,title:feed.MISSIONS[1].title,comments:1},
  {number:45,title:'Unrelated private issue',comments:10}
 ];
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/issues?state=open&per_page=100'))return {ok:true,json:async()=>issues};
  const issue=url.match(/\/issues\/(\d+)\/comments\?/);
  if(issue){
   const source=Number(issue[1])===43?'paperworld':'concerts';
   const marker=malicious?'random unrelated comment':
    '<!-- paperworld-autonomy-v5-report:'+digest+' -->\nCommit: `'+
    (source==='paperworld'?'b':'c').repeat(12)+'`\n'+
    (failed?'Offline Node suite: needs attention':'No AI/model calls');
   return {ok:true,json:async()=>[{
    user:{login:bot},body:marker,created_at:'2026-11-16T14:00:00Z'
   }]};
  }
  throw Error('unexpected URL');
 };
 return {fetcher,calls};
}
test('Display only fixed public bot-authored reports with bounded URLs',async()=>{
 const {fetcher,calls}=fake();
 const reports=await feed.load({fetcher});
 assert.equal(reports.length,2);
 assert.equal(reports[0].project,'Paperworld');
 assert.equal(reports[1].project,'Listening Mirror');
 assert.equal(reports[0].status,'checked');
 assert.equal(reports[0].commit,'b'.repeat(12));
 assert.ok(calls.every(x=>x.opts.method==='GET'&&
  x.url.startsWith('https://api.github.com/repos/mr-tanq/paperworld/')));
 assert.ok(calls.every(x=>!x.opts.headers.Authorization));
 const rows=hub.project({autonomyReports:reports}).rows;
 assert.equal(rows.length,2);
 assert.equal(rows[0].kind,'scheduled-check');
 assert.ok(rows.every(x=>x.stage==='checked'));
});
test('Failed tests show an actionable status, never claim source code was updated',async()=>{
 const reports=await feed.load({fetcher:fake({failed:true}).fetcher});
 assert.equal(reports[0].status,'needs_attention');
 const card=hub.project({autonomyReports:reports}).rows[0];
 assert.equal(card.stage,'needs_attention');
 assert.match(card.summary,/αποτυχία/);
});
test('A public issue comment cannot impersonate the scheduled Worker',async()=>{
 assert.deepEqual(await feed.load({fetcher:fake({bot:'untrusted-user'}).fetcher}),[]);
 assert.deepEqual(await feed.load({fetcher:fake({malicious:true}).fetcher}),[]);
});
test('The work hub refuses forged public autonomy metadata',()=>{
 const good={id:'autonomy-paperworld',project:'Paperworld',
  status:'checked',summary:'Verified',commit:'b'.repeat(12),
  issueUrl:'https://github.com/mr-tanq/paperworld/issues/43',
  createdAt:'2026-11-16T14:00:00Z'};
 assert.equal(hub.scheduledReport(good).kind,'scheduled-check');
 for(const invalid of [
  {...good,id:'autonomy-pokemon'},
  {...good,project:'Wellbeing'},
  {...good,issueUrl:'https://github.com/mr-tanq/pokemon-echoes/issues/43'},
  {...good,commit:'notsha'}
 ])assert.equal(hub.scheduledReport(invalid),null);
});
test('Dashboard wiring loads autonomous work only for logged-in user and never runs AI',()=>{
 const ui=fs.readFileSync('js/cloud-ui.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert.match(ui,/publicAutonomyReports/);
 assert.match(ui,/autonomyReports:results\[5\]/);
 assert.match(html,/autonomy-public-feed\.js\?v=unattended-v5/);
 assert.doesNotMatch(ui,/COPILOT_GITHUB_TOKEN|process\.env/);
});
