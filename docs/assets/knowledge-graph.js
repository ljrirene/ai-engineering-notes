/* Knowledge Constellation v2 · D3 force + curved semantic links, transparent data source. */
(async function(){
'use strict';
const byId=id=>document.getElementById(id),svg=byId('kg-svg'),info=byId('kg-info'),host=byId('kg-canvas');
if(!svg||!info||!host)return;
if(!window.d3){info.textContent='图谱绘制库未能加载。请刷新页面或访问文章归档。';return;}
const d3=window.d3,colors={article:'#087e84',concept:'#517db4',skill:'#b58346',deployment:'#a56b96',guide:'#659277'};
const labels={article:'研究文章',concept:'核心概念',skill:'岗位能力',deployment:'部署路径',guide:'学习方法'};
let data;
try{const r=await fetch('./data/knowledge-graph.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();}catch(e){info.textContent='知识图谱数据加载失败：'+e.message;return;}
const sourceNodes=data.nodes.map(n=>({...n})),sourceEdges=data.edges.map(e=>({...e})),byNode=new Map(sourceNodes.map(n=>[n.id,n]));
const articleCluster={'a-replayssm':'serving','a-sticky':'serving','a-decision':'serving','a-space':'agent','a-browsesafe':'agent','a-orchestrator':'agent','a-superagent':'agent','a-retrieval':'retrieval','a-shadow':'retrieval','a-repair':'platform','a-spindle':'platform'};
const hubs={serving:{x:250,y:235,title:'INFERENCE & SERVING'},agent:{x:815,y:220,title:'AGENTS & SECURITY'},retrieval:{x:245,y:555,title:'RETRIEVAL & EVALUATION'},platform:{x:825,y:550,title:'PLATFORM & TRAINING'}};
const counts=new Map();
sourceNodes.forEach(n=>counts.set(n.id,0));
sourceEdges.forEach(e=>{counts.set(e.source,(counts.get(e.source)||0)+1);counts.set(e.target,(counts.get(e.target)||0)+1)});
const weights={serving:0,agent:0,retrieval:0,platform:0};
sourceNodes.forEach(n=>{
 if(n.kind==='article'){n.group=articleCluster[n.id]||'platform';return;}
 if(n.kind==='concept'){for(const k in weights)weights[k]=0;sourceEdges.forEach(e=>{
  const other=e.source===n.id?e.target:e.target===n.id?e.source:null;
  if(other&&articleCluster[other])weights[articleCluster[other]]+=1;
 });n.group=Object.entries(weights).sort((a,b)=>b[1]-a[1])[0][0]||'agent';return;}
 n.group=n.kind==='skill'?'platform':n.kind==='deployment'?'platform':'retrieval';
});
const seed=(s)=>{let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619);}return (x>>>0)/4294967295;};
sourceNodes.forEach((n,i)=>{const c=hubs[n.group],angle=seed(n.id)*Math.PI*2,r=n.kind==='article'?35+seed(n.id+'r')*92:n.kind==='concept'?100+seed(n.id+'r')*85:180+seed(n.id+'r')*75;n.x=c.x+Math.cos(angle)*r;n.y=c.y+Math.sin(angle)*r;n.vx=0;n.vy=0;n.degree=counts.get(n.id);if(n.id==='d-onprem'){n.x=435;n.y=380;n.fx=435;n.fy=380;}if(n.id==='d-hybrid'){n.x=655;n.y=380;n.fx=655;n.fy=380;}});
let mode='constellation',types=new Set(['article','concept','deployment']),selected=null,hover=null,query='',simulation=null,zoomTransform=d3.zoomIdentity;
const W=1080,H=760;
const root=d3.select(svg).attr('viewBox','0 0 '+W+' '+H).attr('preserveAspectRatio','xMidYMid meet').attr('tabindex',0);
const defs=root.append('defs');
const glow=defs.append('filter').attr('id','kg-star-glow').attr('x','-70%').attr('y','-70%').attr('width','240%').attr('height','240%');
glow.append('feGaussianBlur').attr('stdDeviation','12');
const world=root.append('g').attr('class','kg-world');
const background=world.append('g').attr('class','kg-background');
Object.entries(hubs).forEach(([key,c])=>{background.append('ellipse').attr('class','kg-cluster-orbit').attr('cx',c.x).attr('cy',c.y).attr('rx',225).attr('ry',168);background.append('text').attr('class','kg-cluster-label').attr('x',c.x-92).attr('y',c.y-153).text(c.title);});
const edgeLayer=world.append('g').attr('class','kg-links'),nodeLayer=world.append('g').attr('class','kg-nodes');
const zoom=d3.zoom().scaleExtent([.37,2.8]).filter(event=>!event.target.closest('.kg-node')&&(!event.ctrlKey||event.type==='wheel')).on('zoom',event=>{zoomTransform=event.transform;world.attr('transform',zoomTransform);});
root.call(zoom).on('dblclick.zoom',null);
let linkSel=null,nodeSel=null,visibleNodes=[],visibleEdges=[];
function colorForEdge(e){if(e.type==='shares-core-problem')return '#9f80bd';if(e.type==='prerequisite')return '#d19554';if(e.type==='complements')return '#74b5ab';if(e.type==='extends')return '#3c99b4';if(e.type==='supports-skill')return '#b89a67';if(e.type==='deploys-to')return '#ab83a5';return '#85aabf';}
function important(e){return ['shares-core-problem','prerequisite','extends','complements'].includes(e.type);}
function pathFor(e){
 const a=e.source,b=e.target,x1=a.x||0,y1=a.y||0,x2=b.x||0,y2=b.y||0,dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)||1;
 const sep=(seed(a.id+'>'+b.id)-.5)*2,sign=sep>=0?1:-1;
 let bend=Math.min(65,Math.max(16,length*.15))*(Math.abs(sep)>.25?sign:-sign);
 if(e.type==='explains')bend*=.60;
 return 'M'+x1.toFixed(1)+','+y1.toFixed(1)+' Q'+((x1+x2)*.5-dy/length*bend).toFixed(1)+','+((y1+y2)*.5+dx/length*bend).toFixed(1)+' '+x2.toFixed(1)+','+y2.toFixed(1);
}
function safeUrl(path){if(!path||typeof path!=='string')return null;if(/^https?:\/\//i.test(path))return null;const clean=path.replace(/^\/+/, '');if(!/^[a-zA-Z0-9_./-]+$/.test(clean)||clean.includes('..'))return null;return new URL('./'+clean,window.location.href).href;}
function directNeighbors(id){const v=new Set([id]);visibleEdges.forEach(e=>{if(e.source===id)v.add(e.target);if(e.target===id)v.add(e.source);});return v;}
function renderFocus(){
 const focus=selected||hover,near=focus?directNeighbors(focus):null;
 nodeSel?.classed('focused',d=>d.id===focus).classed('neighbor',d=>!!near&&near.has(d.id)&&d.id!==focus).classed('faded',d=>!!focus&&!near.has(d.id));
 linkSel?.classed('highlight',d=>!!focus&&(d.source.id===focus||d.target.id===focus)).classed('faded',d=>!!focus&&d.source.id!==focus&&d.target.id!==focus);
 nodeSel?.select('.kg-label').style('opacity',d=>!focus?(d.kind==='article'?'1':d.degree>=3?'.63':'.19'):near.has(d.id)?'1':'.1');
}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function render(){
 if(simulation)simulation.stop();
 const visible=new Set(sourceNodes.filter(n=>types.has(n.kind)&&(!query||(n.label+' '+(n.description||'')).toLowerCase().includes(query)||n.id===selected)).map(n=>n.id));
 if(query){sourceEdges.forEach(e=>{if(visible.has(e.source)||visible.has(e.target)){const o=byNode.get(visible.has(e.source)?e.target:e.source);if(o&&types.has(o.kind))visible.add(o.id)}});}
 visibleNodes=sourceNodes.filter(n=>visible.has(n.id));
 visibleEdges=sourceEdges.filter(e=>visible.has(e.source)&&visible.has(e.target)&&((mode==='study')||!(e.type==='guided-by'||e.type==='supports-skill')));
 // Hidden node types should never pull the constellation into a giant central star.
 const links=visibleEdges.map(e=>({...e,source:byNode.get(e.source),target:byNode.get(e.target)}));
 linkSel=edgeLayer.selectAll('path.kg-link').data(links,d=>d.source.id+'|'+d.target.id+'|'+d.type)
  .join(enter=>enter.append('path').attr('class','kg-link')).attr('stroke',d=>colorForEdge(d))
  .classed('strong',d=>important(d)).classed('deployment-link',d=>d.type==='deploys-to');
 const drag=d3.drag().clickDistance(5).on('start',(event,d)=>{if(!event.active)simulation.alphaTarget(.12).restart();d.fx=d.x;d.fy=d.y;}).on('drag',(event,d)=>{d.fx=clamp(event.x,40,W-40);d.fy=clamp(event.y,40,H-40);}).on('end',(event,d)=>{if(!event.active)simulation.alphaTarget(0);if(d.kind!=='deployment'){d.fx=null;d.fy=null;}});
 nodeSel=nodeLayer.selectAll('g.kg-node').data(visibleNodes,d=>d.id).join(
 enter=>{const g=enter.append('g').attr('class','kg-node').attr('tabindex',0).attr('role','button').attr('aria-label',d=>d.label);
  g.append('circle').attr('class','kg-halo').attr('fill',d=>colors[d.kind]).attr('r',d=>d.kind==='article'?39:27);
  g.append('circle').attr('class','kg-ring').attr('stroke',d=>colors[d.kind]).attr('r',d=>d.kind==='article'?24:17);
  g.append('circle').attr('class','kg-core').attr('fill',d=>colors[d.kind]).attr('r',d=>d.kind==='article'?14:d.kind==='concept'?8.8:7.6);
  g.append('text').attr('class','kg-glyph').attr('dy',-.3).text(d=>d.kind==='article'?'✦':d.kind==='concept'?'·':'');
  g.append('text').attr('class','kg-label').attr('x',d=>d.kind==='article'?19:13).attr('y',4).text(d=>d.label.length>25?d.label.slice(0,24)+'…':d.label);
  g.append('circle').attr('class','kg-hit').attr('r',25);
  return g;});
 nodeSel.attr('data-kind',d=>d.kind).on('mouseenter',(event,d)=>{hover=d.id;renderFocus()}).on('mouseleave',()=>{hover=null;renderFocus()})
 .on('click',(event,d)=>{event.stopPropagation();selected=selected===d.id?null:d.id;hover=null;showDetails();renderFocus();})
 .on('keydown',(event,d)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selected=d.id;showDetails();renderFocus();}});
 nodeSel.call(drag);
 if(selected&&!visible.has(selected))selected=null;
 const linkForce=d3.forceLink(links).id(d=>d.id).distance(d=>d.type==='explains'?83:important(d)?180:d.type==='deploys-to'?245:230).strength(d=>d.type==='explains'?.21:important(d)?.065:d.type==='deploys-to'?.018:.022);
 simulation=d3.forceSimulation(visibleNodes)
 .force('link',linkForce)
 .force('charge',d3.forceManyBody().strength(d=>d.kind==='article'?-420:-175).distanceMax(260))
 .force('collide',d3.forceCollide().radius(d=>d.kind==='article'?43:d.kind==='concept'?25:23).strength(.95).iterations(2))
 .force('anchorX',d3.forceX(d=>hubs[d.group].x).strength(d=>d.kind==='article'?.10:.052))
 .force('anchorY',d3.forceY(d=>hubs[d.group].y).strength(d=>d.kind==='article'?.11:.062))
 .velocityDecay(.62).alpha(.65).alphaDecay(.038).on('tick',()=>{
  linkSel.attr('d',pathFor);nodeSel.attr('transform',d=>'translate('+d.x+','+d.y+')');
 });
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){simulation.tick(280);simulation.stop();linkSel.attr('d',pathFor);nodeSel.attr('transform',d=>'translate('+d.x+','+d.y+')');}
 count();renderFocus();showDetails();updateMode();
}
function block(parent,tag,t,className){const x=document.createElement(tag);x.textContent=t||'';if(className)x.className=className;parent.appendChild(x);return x;}
const reasons={explains:'解释',complements:'互补',prerequisite:'前置',extends:'扩展','shares-core-problem':'共享底层问题','supports-skill':'对应能力','deploys-to':'部署路径','guided-by':'学习方法'};
function showDetails(){
 info.replaceChildren();
 const n=byNode.get(selected);
 if(!n){block(info,'div','THE CONNECTIONS','kg-kind');const ill=block(info,'div','','kg-info-illustration');ill.setAttribute('aria-hidden','true');block(info,'h2','从一个知识点出发');block(info,'p','点亮任意一颗星，沿着弧线探索它的前置概念、技术实现与能力关联。');block(info,'p','默认星图显示文章、核心概念与部署路径。点击 On-prem / Controlled Hybrid 可点亮关联文章；切换「学习地图」展开求职能力与方法论。');return;}
 block(info,'div',labels[n.kind]||n.kind,'kg-kind');block(info,'h2',n.label);if(n.date)block(info,'div',n.date+' · '+(n.track==='onprem'?'On-prem':n.track==='hybrid'?'Controlled Hybrid':'On-prem / Controlled Hybrid'),'kg-meta');block(info,'p',n.description||'');
 for(const [url,label] of [[n.url,'阅读完整研究 ↗'],[n.visual,'打开交互架构图 ↗']]){const path=safeUrl(url);if(path){const a=block(info,'a',label,'kg-read');a.href=path;}}
 const related=sourceEdges.filter(e=>e.source===n.id||e.target===n.id).map(e=>({...e,other:byNode.get(e.source===n.id?e.target:e.source)})).filter(e=>e.other);
 block(info,'h3','RELATED KNOWLEDGE · '+related.length);
 const list=block(info,'ul','');related.sort((a,b)=>(important(b)?1:0)-(important(a)?1:0));
 related.forEach(e=>{const li=block(list,'li','');block(li,'span',reasons[e.type]||e.type,'kg-edge-kind');const b=block(li,'button',e.other.label);b.type='button';b.onclick=()=>{if(!types.has(e.other.kind)){types.add(e.other.kind);updateFilters();render()}selected=e.other.id;showDetails();renderFocus();focusNode(e.other)};block(li,'div',e.reason||'','kg-edge-reason');});
}
function focusNode(n){if(!n)return;const t=d3.zoomIdentity.translate(W/2-n.x*.92,H/2-n.y*.92).scale(.92);root.transition().duration(600).call(zoom.transform,t);}
function count(){const s=visibleNodes.length+' NODES · '+visibleEdges.length+' LINKS';byId('kg-count').textContent=s;byId('kg-stats').textContent=data.nodes.filter(n=>n.kind==='article').length+' STUDIES · '+data.nodes.length+' NODES';}
const filters=byId('kg-filters');
function updateFilters(){filters.replaceChildren();Object.entries(labels).forEach(([kind,label])=>{const b=block(filters,'button',label+' · '+sourceNodes.filter(n=>n.kind===kind).length,'kg-filter');b.type='button';b.setAttribute('aria-pressed',String(types.has(kind)));b.onclick=()=>{if(types.has(kind)&&types.size>1)types.delete(kind);else types.add(kind);updateFilters();render()};});}
function setMode(next){mode=next;types=next==='study'?new Set(['article','concept','skill','deployment','guide']):new Set(['article','concept','deployment']);updateFilters();selected=null;render();root.transition().duration(600).call(zoom.transform,d3.zoomIdentity.translate(20,4).scale(.88));}
function updateMode(){const c=mode==='constellation';byId('kg-mode-constellation').classList.toggle('is-active',c);byId('kg-mode-study').classList.toggle('is-active',!c);byId('kg-mode-constellation').setAttribute('aria-pressed',String(c));byId('kg-mode-study').setAttribute('aria-pressed',String(!c));byId('kg-current-mode').textContent=c?'CONSTELLATION MODE':'STUDY MAP · ALL RELATIONS';}
byId('kg-mode-constellation').onclick=()=>setMode('constellation');
byId('kg-mode-study').onclick=()=>setMode('study');
byId('kg-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();if(query){const matches=sourceNodes.filter(n=>(n.label+' '+(n.description||'')).toLowerCase().includes(query));matches.forEach(n=>types.add(n.kind));updateFilters();}render();});
byId('kg-clear').onclick=()=>{byId('kg-search').value='';query='';hover=null;setMode(mode)};
byId('kg-zoom-in').onclick=()=>root.transition().duration(270).call(zoom.scaleBy,1.22);
byId('kg-zoom-out').onclick=()=>root.transition().duration(270).call(zoom.scaleBy,.82);
byId('kg-reset').onclick=()=>root.transition().duration(550).call(zoom.transform,d3.zoomIdentity.translate(20,4).scale(.88));
root.on('click',event=>{if(event.target===svg||event.target.closest('.kg-background')){selected=null;renderFocus();showDetails();}});
updateFilters();render();root.call(zoom.transform,d3.zoomIdentity.translate(20,4).scale(.88));
})();



