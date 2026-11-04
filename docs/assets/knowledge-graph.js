(async()=>{
"use strict";
const E=id=>document.getElementById(id),svg=E("kg-svg"),info=E("kg-info"),search=E("kg-search"),filters=E("kg-filters"),count=E("kg-count"),ns="http://www.w3.org/2000/svg";
let d;try{const r=await fetch("./data/knowledge-graph.json");if(!r.ok)throw Error("Data "+r.status);d=await r.json()}catch(e){info.textContent="图谱加载失败："+e.message;return}
const colors={article:"#08727c",concept:"#648bbb",skill:"#b78348",deployment:"#b8759c",guide:"#78975c"};
const types={article:"文章",concept:"概念",skill:"求职技能",deployment:"部署",guide:"学习 Guide"};
const kinds=Object.keys(types),active=new Set(kinds),byId=new Map(),elems=new Map();
const N=d.nodes.map((n,i)=>({...n,x:500+Math.cos(i*2.39996)*(n.kind==="article"?155:n.kind==="concept"?235:n.kind==="skill"?320:390),y:325+Math.sin(i*2.39996)*(n.kind==="article"?155:n.kind==="concept"?235:n.kind==="skill"?320:390),vx:0,vy:0}));N.forEach(n=>byId.set(n.id,n));
const edges=d.edges.map(x=>({...x,a:byId.get(x.source),b:byId.get(x.target)})).filter(x=>x.a&&x.b);
let selected="",q="",z=1,panX=0,panY=0;
svg.setAttribute("viewBox","0 0 1000 650");
const s=(tag,attrs,parent)=>{const a=document.createElementNS(ns,tag);Object.entries(attrs||{}).forEach(([k,v])=>a.setAttribute(k,v));parent?.appendChild(a);return a};
const world=s("g",{},svg),lines=s("g",{},world),dots=s("g",{},world);
const edgeEls=edges.map(x=>({x,el:s("line",{class:"kg-edge"},lines)}));
N.forEach(n=>{
const g=s("g",{class:"kg-dot",tabindex:0,role:"button","aria-label":n.label},dots),r=n.kind==="article"?11:8.5;
s("circle",{r,fill:colors[n.kind]},g);
const t=s("text",{x:r+4,y:3.5},g);t.textContent=n.label.length>29?n.label.slice(0,28)+"…":n.label;
g.addEventListener("click",()=>select(n.id));
g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(n.id)}});
elems.set(n.id,g);
});
function visible(n){return active.has(n.kind)&&(!q||(n.label+" "+(n.description||"")).toLowerCase().includes(q)||n.id===selected)}
function draw(){
world.setAttribute("transform",`translate(${panX} ${panY}) scale(${z})`);
for(const {x,el} of edgeEls){
const ok=visible(x.a)&&visible(x.b);
el.style.display=ok?"":"none";el.setAttribute("x1",x.a.x);el.setAttribute("y1",x.a.y);el.setAttribute("x2",x.b.x);el.setAttribute("y2",x.b.y);
const related=selected&&(x.source===selected||x.target===selected);
el.classList.toggle("highlight",!!related);el.classList.toggle("dim",!!selected&&!related);
}
for(const n of N){
const g=elems.get(n.id);g.style.display=visible(n)?"":"none";g.setAttribute("transform",`translate(${n.x} ${n.y})`);
const linked=edges.some(e=>(e.source===selected&&e.target===n.id)||(e.target===selected&&e.source===n.id));
g.classList.toggle("selected",n.id===selected);g.classList.toggle("dim",!!selected&&n.id!==selected&&!linked);
}
count.textContent=N.filter(visible).length+" 节点 · "+edges.filter(e=>visible(e.a)&&visible(e.b)).length+" 条语义连接";
}
function block(tag,t,parent=info){const v=document.createElement(tag);v.textContent=t;parent.appendChild(v);return v}
function href(path,label){
const a=document.createElement("a");a.href=new URL(path.replace(/^\//,""),location.href).href;a.textContent=label;a.style.marginRight="14px";info.appendChild(a)
}
function details(){
info.replaceChildren();
if(!selected){block("div","KNOWLEDGE MAP").className="kg-kind";block("h2","点击任一节点");block("p","查看它连接的历史文章、系统概念、前置知识、求职技能和部署路径。拖动空白处平移，滚轮或按钮缩放。");return}
const n=byId.get(selected);if(!n)return;
block("div",types[n.kind]).className="kg-kind";block("h2",n.label);block("p",n.description||"");
if(n.date)block("p",n.date+" · "+(n.track==="onprem"?"On-prem":"Controlled Hybrid"));
if(n.url)href(n.url,"阅读文章/Guide →");if(n.visual)href(n.visual,"交互架构图 →");
block("h3","关系 · "+edges.filter(e=>e.source===selected||e.target===selected).length);
const ul=document.createElement("ul");info.appendChild(ul);
edges.filter(e=>e.source===selected||e.target===selected).forEach(e=>{
const other=byId.get(e.source===selected?e.target:e.source),li=document.createElement("li");ul.appendChild(li);
block("span",e.type,li);const b=document.createElement("button");b.type="button";b.textContent=other.label;b.title=e.reason;b.onclick=()=>select(other.id);li.appendChild(b);
});
}
function select(id){selected=selected===id?"":id;details();draw()}
for(const kind of kinds){
const b=document.createElement("button");b.className="kg-filter";b.type="button";b.textContent=types[kind]+" · "+N.filter(n=>n.kind===kind).length;b.setAttribute("aria-pressed","true");
b.onclick=()=>{if(active.has(kind)){if(active.size<=1)return;active.delete(kind)}else active.add(kind);b.setAttribute("aria-pressed",String(active.has(kind)));if(selected&&!visible(byId.get(selected)))selected="";details();draw()};filters.appendChild(b)}
search.oninput=()=>{q=search.value.trim().toLowerCase();draw()};
function zoom(f){z=Math.min(2.7,Math.max(.45,z*f));draw()}
E("kg-zoom-in").onclick=()=>zoom(1.2);E("kg-zoom-out").onclick=()=>zoom(1/1.2);
E("kg-reset").onclick=()=>{z=.86;panX=70;panY=44;draw()};
E("kg-clear").onclick=()=>{q="";search.value="";selected="";active.clear();kinds.forEach(k=>active.add(k));filters.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed","true"));details();draw()};
svg.addEventListener("wheel",e=>{e.preventDefault();zoom(e.deltaY<0?1.1:1/1.1)},{passive:false});
let drag=null;
svg.addEventListener("pointerdown",e=>{if(e.target.closest(".kg-dot"))return;drag={x:e.clientX,y:e.clientY,px:panX,py:panY};svg.setPointerCapture(e.pointerId)});
svg.addEventListener("pointermove",e=>{if(!drag)return;const rect=svg.getBoundingClientRect();panX=drag.px+(e.clientX-drag.x)*1000/rect.width;panY=drag.py+(e.clientY-drag.y)*650/rect.height;draw()});
svg.addEventListener("pointerup",()=>drag=null);svg.addEventListener("pointercancel",()=>drag=null);
let alpha=.62,t=0;
function tick(){
if(alpha<.009||t++>190)return;
for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){
const a=N[i],b=N[j],dx=a.x-b.x,dy=a.y-b.y,dist2=dx*dx+dy*dy+80,f=Math.min(1.5,1250/dist2)*alpha;
const fx=(dx||1)/Math.sqrt(dist2)*f,fy=(dy||1)/Math.sqrt(dist2)*f;
a.vx+=fx;b.vx-=fx;a.vy+=fy;b.vy-=fy;
}
for(const e of edges){const a=e.a,b=e.b,dx=b.x-a.x,dy=b.y-a.y,r=Math.sqrt(dx*dx+dy*dy)||1,ideal=e.type==="explains"?125:e.type==="guided-by"?240:185,k=(r-ideal)*.0045*alpha;
const fx=dx/r*k,fy=dy/r*k;a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy}
for(const n of N){n.vx+=(500-n.x)*.0012*alpha;n.vy+=(325-n.y)*.0012*alpha;n.vx*=.82;n.vy*=.82;n.x=Math.max(20,Math.min(950,n.x+n.vx));n.y=Math.max(20,Math.min(620,n.y+n.vy))}
alpha*=.97;draw();requestAnimationFrame(tick);
}
details();E("kg-reset").click();requestAnimationFrame(tick);
})();

