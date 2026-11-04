/* Dependency-free SVG architecture explorer. No remote API and no sensitive data. */
(function(){
'use strict';
const cfg=window.ARCH_MAP;if(!cfg)return;
const ns='http://www.w3.org/2000/svg', svg=document.getElementById('architecture-svg'), panel=document.getElementById('architecture-detail'), tabs=document.getElementById('architecture-tabs'), sub=document.getElementById('architecture-subtitle');
if(!svg||!panel||!tabs)return;
let view=0,selected=null;
function el(t,attrs,parent){const n=document.createElementNS(ns,t);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,v));if(parent)parent.appendChild(n);return n}
function text(n,v){n.textContent=String(v||'');return n}
function renderTabs(){tabs.replaceChildren();cfg.views.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.textContent=v.label;b.className=i===view?'active':'';b.setAttribute('aria-pressed',String(i===view));b.onclick=()=>{view=i;selected=null;render()};tabs.appendChild(b)})}
function detail(n,focus){panel.replaceChildren();let h=document.createElement('h2');text(h,n?n.title:'选择一个架构节点');panel.appendChild(h);
let intro=document.createElement('p');text(intro,n?n.description:'点击图中的任意节点（或按 Tab + Enter），查看组件职责、数据流以及失败模式；相关连接会自动高亮。');panel.appendChild(intro);
if(!n)return;
[['职责 / 原理',n.duty],['输入与输出',n.io],['边界与失败模式',n.risk],['学习重点',n.lesson]].forEach(([label,val])=>{if(!val)return;const a=document.createElement('h3');text(a,label);panel.appendChild(a);const p=document.createElement('p');text(p,val);panel.appendChild(p)});
if(focus){let p=document.createElement('p');p.style.marginTop='14px';p.style.color='#08727c';text(p,'图中已高亮该节点的直接上游和下游依赖。');panel.appendChild(p)}
}
function render(){
const v=cfg.views[view];renderTabs();sub.textContent=v.explain||'';
svg.replaceChildren();svg.setAttribute('viewBox','0 0 920 590');svg.setAttribute('role','img');svg.setAttribute('aria-label',cfg.title+' — '+v.label+'，节点可点击');
let defs=el('defs',{},svg),marker=el('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'},defs);el('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#7d99aa'},marker);
el('rect',{x:0,y:0,width:920,height:590,rx:14,fill:'#ffffff'},svg);
text(el('text',{x:28,y:35,class:'arch-title'},svg),v.caption||v.label);
const byId=new Map(v.nodes.map(n=>[n.id,n]));
const grpEdges=el('g',{},svg),grpNodes=el('g',{},svg);
v.edges.forEach((e,i)=>{const a=byId.get(e[0]),b=byId.get(e[1]);if(!a||!b)return;
let ax=a.x+80,ay=a.y+34,bx=b.x+80,by=b.y+34,dx=bx-ax,dy=by-ay;
let sx=ax,sy=ay,tx=bx,ty=by;
if(Math.abs(dx)>Math.abs(dy)*1.15){sx+=dx>=0?77:-77;tx+=dx>=0?-86:86;}else{sy+=dy>=0?30:-30;ty+=dy>=0?-39:39}
const g=el('g',{},grpEdges),line=el('path',{d:'M '+sx+' '+sy+' L '+tx+' '+ty, 'marker-end':'url(#arrow)',class:'arch-edge'},g);line.dataset.a=a.id;line.dataset.b=b.id;
});
v.nodes.forEach(n=>{const g=el('g',{class:'arch-node',tabindex:0,role:'button','aria-label':n.title,x:n.x,y:n.y,'data-zone':n.zone||'default'},grpNodes);g.dataset.id=n.id;
el('rect',{x:n.x,y:n.y,width:160,height:68,rx:12},g);
const t=el('text',{x:n.x+80,y:n.y+28,'text-anchor':'middle'},g);
const words=n.title.split('|');words.forEach((w,i)=>text(el('tspan',{x:n.x+80,dy:i===0?0:20},t),w));
const activate=()=>{selected=n.id;highlight();detail(n,true)};g.addEventListener('click',activate);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}})});
highlight();detail(selected?byId.get(selected):null,!!selected)
}
function highlight(){let v=cfg.views[view],neighbor=new Set([selected]);if(selected){v.edges.forEach(e=>{if(e[0]===selected)neighbor.add(e[1]);if(e[1]===selected)neighbor.add(e[0])})}
svg.querySelectorAll('.arch-node').forEach(g=>{g.classList.toggle('selected',!!selected&&g.dataset.id===selected);g.classList.toggle('faded',!!selected&&!neighbor.has(g.dataset.id))});
svg.querySelectorAll('.arch-edge').forEach(g=>{let active=!!selected&&(g.dataset.a===selected||g.dataset.b===selected);g.classList.toggle('selected',active);g.classList.toggle('faded',!!selected&&!active)})}
render();
})();

