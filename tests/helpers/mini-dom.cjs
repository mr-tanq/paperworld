'use strict';
// A deliberately small DOM for behavioural tests of UI modules in Node.
// Supports what the Workspace uses: tree ops, attributes, classList, dataset,
// events, simple selectors (#id, .class, tag, [attr="v"], descendant chains).
class Node{
 constructor(tag,doc){this.tagName=String(tag).toUpperCase();this.ownerDocument=doc;this.children=[];
  this.parentNode=null;this.attributes={};this.listeners={};this.dataset={};this.style={setProperty(){}};
  this._text='';this.hidden=false;this.value='';this.disabled=false;this.type='';this.scrollTop=0;
  const self=this;this.classList={add:(...c)=>{for(const x of c)self._cls.add(x)},remove:(...c)=>{for(const x of c)self._cls.delete(x)},
   toggle:(c,on)=>{const v=on===undefined?!self._cls.has(c):!!on;v?self._cls.add(c):self._cls.delete(c);return v},
   contains:c=>self._cls.has(c)};this._cls=new Set()}
 get childNodes(){return this.children}
 get className(){return [...this._cls].join(' ')}set className(v){this._cls=new Set(String(v).split(/\s+/).filter(Boolean))}
 get id(){return this.attributes.id||''}set id(v){this.attributes.id=String(v)}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
 set textContent(v){this.children=[];this._text=String(v)}
 get isConnected(){let n=this;while(n.parentNode)n=n.parentNode;return n===this.ownerDocument.documentElement}
 append(...nodes){for(const n of nodes){if(n==null)continue;const node=typeof n==='string'?this.ownerDocument.createTextNode(n):n;
  node.parentNode?.removeChild(node);node.parentNode=this;this.children.push(node)}}
 prepend(...nodes){const keep=this.children;this.children=[];this.append(...nodes);this.children.push(...keep)}
 after(n){const p=this.parentNode;if(!p)return;n.parentNode?.removeChild(n);const i=p.children.indexOf(this);n.parentNode=p;p.children.splice(i+1,0,n)}
 insertBefore(n,ref){n.parentNode?.removeChild(n);n.parentNode=this;const i=ref?this.children.indexOf(ref):-1;
  i<0?this.children.push(n):this.children.splice(i,0,n)}
 removeChild(n){this.children=this.children.filter(c=>c!==n);n.parentNode=null}
 remove(){this.parentNode?.removeChild(this)}
 replaceChildren(...nodes){for(const c of this.children)c.parentNode=null;this.children=[];this._text='';this.append(...nodes)}
 setAttribute(k,v){this.attributes[k]=String(v)}getAttribute(k){return this.attributes[k]??null}
 contains(n){while(n){if(n===this)return true;n=n.parentNode}return false}
 addEventListener(t,f){(this.listeners[t]||=[]).push(f)}
 dispatch(type,extra={}){const ev={type,target:this,preventDefault(){this.defaultPrevented=true},stopPropagation(){},
  stopImmediatePropagation(){},...extra};let n=this;
  while(n){for(const f of n.listeners[type]||[])f(ev);n=n.parentNode}
  if(n===null)for(const f of this.ownerDocument.listeners[type]||[])f(ev);return ev}
 click(){if(!this.disabled)return this.dispatch('click')}
 focus(){this.ownerDocument.activeElement=this}
 reportValidity(){return true}
 scrollIntoView(){}scrollTo(){}
 getBoundingClientRect(){return {x:0,y:0,width:600,height:600}}
 matches(sel){return sel.split(',').some(s=>simple(this,s.trim()))}
 closest(sel){let n=this;while(n&&n.tagName){if(n.matches(sel))return n;n=n.parentNode}return null}
 querySelectorAll(sel){const out=[];const walk=n=>{for(const c of n.children){if(c.tagName&&match(c,sel,this))out.push(c);walk(c)}};walk(this);return out}
 querySelector(sel){return this.querySelectorAll(sel)[0]||null}
}
function simple(n,s){if(!n.tagName)return false;const re=/([#.]?[\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;let m,ok=true,any=false;
 while((m=re.exec(s))){any=true;const t=m[1];
  if(t){if(t[0]==='#')ok=ok&&n.id===t.slice(1);else if(t[0]==='.')ok=ok&&n._cls.has(t.slice(1));else ok=ok&&n.tagName===t.toUpperCase()}
  else ok=ok&&(m[3]===undefined?m[2] in n.attributes||m[2] in n.dataset:(n.attributes[m[2]]??n.dataset[m[2].replace(/^data-/,'').replace(/-(\w)/g,(_,c)=>c.toUpperCase())])===m[3])}
 return any&&ok}
function match(n,sel,root){return sel.split(',').some(group=>{const parts=group.trim().split(/\s+/);
 if(!simple(n,parts.at(-1)))return false;let p=n.parentNode;
 for(let i=parts.length-2;i>=0;i--){while(p&&p!==root.parentNode&&!simple(p,parts[i]))p=p.parentNode;
  if(!p||p===root.parentNode)return false;p=p.parentNode}return true})}
function createDocument(){
 const doc={listeners:{},activeElement:null};
 doc.createElement=t=>new Node(t,doc);
 doc.createTextNode=t=>{const n=new Node('#text',doc);n.tagName='';n._text=String(t);return n};
 doc.documentElement=new Node('html',doc);doc.body=new Node('body',doc);doc.documentElement.append(doc.body);
 doc.addEventListener=(t,f)=>{(doc.listeners[t]||=[]).push(f)};
 doc.dispatchEvent=ev=>{for(const f of doc.listeners[ev.type]||[])f(ev);return true};
 doc.querySelector=s=>doc.documentElement.querySelector(s);doc.querySelectorAll=s=>doc.documentElement.querySelectorAll(s);
 return doc;
}
module.exports={createDocument};
