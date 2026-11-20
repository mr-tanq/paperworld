/* PAPERWORLD village board — on tall (portrait) screens the space under the
 * village shows who lives here and what each resident is doing right now,
 * from real missions only ("Κάνει βόλτα" when nothing is recorded). Tap a
 * resident to talk. Read-only: never starts work, never calls AI.
 */
(()=>{'use strict';
const ORDER=['matt','listening-director','pokemon-director','studio-director','wellbeing-director'];
const IDLE={matt:'Είναι δίπλα σου. Πες του τι χρειάζεσαι.',
 'listening-director':'Κάνει βόλτα στο χωριό.','pokemon-director':'Κάνει βόλτα στο χωριό.',
 'studio-director':'Κάνει βόλτα στο χωριό.','wellbeing-director':'Κάνει βόλτα στο χωριό.'};
const view=document.querySelector('#view');
if(!view)return;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const board=el('section','village-board');board.hidden=true;board.setAttribute('aria-label','Στο χωριό τώρα');
const head=el('div','village-board-head');
head.append(el('h2','','Στο χωριό τώρα'),el('p','','Πάτησε έναν κάτοικο για να του μιλήσεις.'));
const list=el('div','village-board-list');
const talk=el('button','village-board-talk','Μίλα με τον Matt');talk.type='button';
talk.addEventListener('click',()=>window.PaperworldWorldDialogue?.show?.('matt'));
board.append(head,list,talk);view.append(board);
let statuses={};
function row(id){
 const p=window.PaperworldProfiles?.get?.(id);if(!p)return null;
 const s=statuses[id];
 const item=el('button','village-board-row');item.type='button';
 if(s?.tone)item.dataset.tone=s.tone;
 const face=el('span','village-board-face');window.PaperworldProfiles.paintAvatar?.(face,id);
 const text=el('span','village-board-text');
 text.append(el('strong','',p.name+(id==='matt'?'':' · '+p.project)),el('span','',s?.text||IDLE[id]||''));
 item.append(face,text,el('span','village-board-go','›'));
 item.setAttribute('aria-label','Μίλα με '+p.name+'. '+(s?.text||IDLE[id]||''));
 item.addEventListener('click',()=>window.PaperworldWorldDialogue?.show?.(id));
 return item;
}
function render(){list.replaceChildren(...ORDER.map(row).filter(Boolean))}
function layout(){
 const top=window.PaperworldWorld?.boardTop?.();
 const h=view.clientHeight;
 const show=Number.isFinite(top)&&h-top>=170;
 board.hidden=!show;
 if(show){board.style.top=top+'px';document.documentElement.classList.add('pw-has-board')}
 else document.documentElement.classList.remove('pw-has-board');
}
document.addEventListener('paperworld:residents',e=>{statuses=e.detail&&typeof e.detail==='object'?e.detail:{};render()});
addEventListener('resize',()=>requestAnimationFrame(layout));
addEventListener('orientationchange',()=>setTimeout(layout,250));
function start(){render();layout();setTimeout(layout,600);setTimeout(()=>{render();layout()},1800)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.PaperworldVillageBoard=Object.freeze({render,layout});
})();
