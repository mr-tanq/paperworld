'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const profiles=require('../js/agent-profiles.js');
test('visual roster retains original agent IDs and approved display names',()=>{
 const expected={matt:'Matt','listening-director':'Luna','pokemon-director':'Joey','studio-director':'Crow','wellbeing-director':'Dave','shop-director':'James','markets-director':'Mike'};
 for(const [id,name] of Object.entries(expected))assert.equal(profiles.get(id)?.name,name);
 assert.equal(profiles.entries('director').length,7);
 assert.equal(profiles.entries('worker').length,2);
 assert.equal(profiles.get('unknown'),null);
});
test('worker entries have no fabricated image or active direct messaging',()=>{
 for(const p of profiles.entries('worker'))assert.equal(p.sheet,undefined);
 const team=read('js/team-panel.js');
 assert.match(team,/p\.id==='listening-developer'\?'listening-director'/);
 assert.match(team,/p\.id==='pokemon-developer'\?'pokemon-director'/);
 assert.doesNotMatch(team,/show\(p\.id\)/);
 assert.doesNotMatch(team,/["']Online["']|status-dot|green-dot/i);
});
test('chat and team reuse the single portrait registry, loaded before UI scripts',()=>{
 const html=read('index.html');
 const a=html.indexOf('/js/agent-profiles.js'),b=html.indexOf('/js/team-panel.js'),c=html.indexOf('/js/world-dialogue.js');
 assert.ok(a>0&&a<b&&b<c);
 const chat=read('js/world-dialogue.js');
 assert.match(chat,/PaperworldProfiles\.paintAvatar\(avatar,openId\)/);
 assert.match(chat,/profile\?\.name/);
 const team=read('js/team-panel.js');
 assert.match(team,/profiles\.paintAvatar\(avatar,p\.id\)/);
 // Workers route to their responsible Director through the Workspace handoff
 // (which opens the Messenger and returns to Team afterwards).
 assert.match(team,/ctx\.chat\(responsible\)/);
 assert.match(read('js/workspace.js'),/chat\(\)\.open\(agentId,\{draft,context\}\)/);
});
