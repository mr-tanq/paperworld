/* Optional team drawer; does not claim workers are online. */
(()=>{'use strict';
const view=document.querySelector('#view'),controls=document.querySelector('.controls'),profiles=window.PaperworldProfiles;
if(!view||!controls||!profiles)return;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const launch=el('button','team-launch','♟');launch.type='button';launch.title='Directors & Workers';launch.setAttribute('aria-label','Open team directory');launch.setAttribute('aria-expanded','false');
controls.insertBefore(launch,controls.querySelector('#world-work-panel'));
const panel=el('section','team-panel');panel.hidden=true;panel.setAttribute('aria-label','Team directory');
const title=el('div','team-panel-head');title.append(el('strong','','Η ΟΜΑΔΑ ΣΟΥ'));
const close=el('button','team-panel-close','×');close.type='button';close.setAttribute('aria-label','Close team directory');title.append(close);
const tabs=el('div','team-panel-tabs'),directors=el('button','team-tab','Directors'),workers=el('button','team-tab','Workers');
directors.type=workers.type='button';tabs.append(directors,workers);
const roster=el('div','team-roster');
panel.append(title,tabs,roster,el('p','team-panel-note','Οι Directors δέχονται απευθείας μηνύματα. Για εργασία Worker μίλησε στον αρμόδιο Director ή στον Matt. Δεν εμφανίζονται ψευδείς καταστάσεις διαθεσιμότητας.'));view.append(panel);
let active='director';
function toggle(show){panel.hidden=!show;launch.setAttribute('aria-expanded',String(show));if(show)render()}
function render(){
 roster.replaceChildren();directors.setAttribute('aria-pressed',String(active==='director'));workers.setAttribute('aria-pressed',String(active==='worker'));
 for(const p of profiles.entries(active)){
  const row=el('button','team-person');row.type='button';
  const avatar=el('span','team-person-avatar');profiles.paintAvatar(avatar,p.id);
  const info=el('span','team-person-info');info.append(el('strong','',p.name),el('small','',p.project+' · '+p.role));
  row.append(avatar,info,el('span','team-person-trailing',active==='worker'?'Μέσω Director':'›'));
  // Workers work through their Director; opening a Worker never fabricates
  // an independent AI account, call, assignment or message.
  const responsible=p.id==='listening-developer'?'listening-director':
   p.id==='pokemon-developer'?'pokemon-director':p.id;
  row.title=active==='worker'?'Μίλα στον αρμόδιο Director':'Άνοιξε συνομιλία';
  row.addEventListener('click',()=>{
   toggle(false);window.PaperworldWorldDialogue?.show(responsible);
  });
  roster.append(row);
 }
}
launch.addEventListener('click',()=>toggle(panel.hidden));close.addEventListener('click',()=>toggle(false));
directors.addEventListener('click',()=>{active='director';render()});workers.addEventListener('click',()=>{active='worker';render()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)toggle(false)});
})();
