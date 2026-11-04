(function () {
  'use strict';
  var cfg = window.INTERACTIVE_ARCHITECTURE;
  if (!cfg) return;
  var ns = 'http://www.w3.org/2000/svg';
  var ui = {
    svg: document.getElementById('architecture'),
    tabs: document.getElementById('view-switch'),
    list: document.getElementById('component-list'),
    title: document.getElementById('component-title'),
    desc: document.getElementById('component-role'),
    inputs: document.getElementById('component-inputs'),
    outputs: document.getElementById('component-outputs'),
    risks: document.getElementById('component-risks'),
    evidence: document.getElementById('component-evidence'),
    note: document.getElementById('view-summary'),
    selection: document.getElementById('selection-label')
  };
  var state = { view: cfg.defaultView, selected: null };

  function element(tag, attrs, label) {
    var e = document.createElementNS(ns, tag);
    Object.keys(attrs || {}).forEach(function (key) { e.setAttribute(key, attrs[key]); });
    if (label !== undefined) e.textContent = label;
    return e;
  }
  function clear(parent) { while (parent.firstChild) parent.removeChild(parent.firstChild); }
  function view() { return cfg.views.find(function (v) { return v.id === state.view; }); }
  function linkPath(source, target, kind) {
    var sw = source.w || 170, sh = source.h || 82;
    var tw = target.w || 170, th = target.h || 82;
    if (kind === 'back') {
      var sx = source.x + sw/2, ex = target.x + tw/2, by = 568;
      return 'M ' + sx + ' ' + (source.y+sh) + ' C ' + sx + ' ' + by + ', ' + ex + ' ' + by + ', ' + ex + ' ' + (target.y+th);
    }
    if (target.x > source.x + 20) {
      var x1=source.x+sw, y1=source.y+sh/2, x2=target.x, y2=target.y+th/2, bend=Math.max(35,(x2-x1)/2);
      return 'M '+x1+' '+y1+' C '+(x1+bend)+' '+y1+', '+(x2-bend)+' '+y2+', '+x2+' '+y2;
    }
    if (target.y >= source.y) {
      var x3=source.x+sw/2,y3=source.y+sh,x4=target.x+tw/2,y4=target.y;
      return 'M '+x3+' '+y3+' C '+x3+' '+(y3+55)+', '+x4+' '+(y4-55)+', '+x4+' '+y4;
    }
    var x5=source.x+sw/2,y5=source.y,x6=target.x+tw/2,y6=target.y+th;
    return 'M '+x5+' '+y5+' C '+x5+' '+(y5-65)+', '+x6+' '+(y6+65)+', '+x6+' '+y6;
  }
  function focusNode(id) {
    state.selected = id;
    render();
  }
  function makeNode(node, connected) {
    var selected = state.selected === node.id;
    var highlighted = connected.has(node.id);
    var g = element('g', {
      'class': 'graph-node'+(selected?' selected':'')+(highlighted?' connected':'')+(state.selected && !highlighted?' quiet':''),
      'role': 'button', 'tabindex': '0', 'aria-label': '查看 '+node.title+' 的架构说明', 'aria-pressed': selected?'true':'false'
    });
    var rectangle = element('rect', {
      x:node.x, y:node.y, width:node.w||170, height:node.h||82, rx:'13',
      fill: node.kind==='risk'?'#fff0eb':node.kind==='control'?'#e7f7f3':node.kind==='external'?'#f2eefd':'#ffffff',
      stroke:selected?'#067582':node.kind==='risk'?'#d29b84':node.kind==='control'?'#8dc8b5':'#c6d6e2',
      'stroke-width':selected?'3':'1.5'
    });
    g.appendChild(rectangle);
    g.appendChild(element('text',{x:node.x+14,y:node.y+31,'class':'node-title'},node.title));
    g.appendChild(element('text',{x:node.x+14,y:node.y+54,'class':'node-sub'},node.sub));
    g.addEventListener('click',function(){focusNode(node.id);});
    g.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();focusNode(node.id);}});
    return g;
  }
  function render() {
    var selectedView=view();
    if (!selectedView) return;
    if (!selectedView.nodes.some(function(n){return n.id===state.selected;})) state.selected=selectedView.nodes[0].id;
    clear(ui.tabs);
    cfg.views.forEach(function(v){
      var btn=document.createElement('button');
      btn.type='button'; btn.className='mode-button'+(v.id===state.view?' current':'');
      btn.setAttribute('aria-pressed',v.id===state.view?'true':'false');
      btn.textContent=v.title;
      btn.addEventListener('click',function(){state.view=v.id;state.selected=null;render();});
      ui.tabs.appendChild(btn);
    });
    ui.note.textContent=selectedView.summary;
    clear(ui.svg);
    ui.svg.setAttribute('viewBox','0 0 1280 620');
    var defs=element('defs');
    var marker=element('marker',{id:'arrow',markerWidth:'8',markerHeight:'8',refX:'6',refY:'3',orient:'auto'});
    marker.appendChild(element('path',{d:'M 0 0 L 6 3 L 0 6 Z',fill:'#6c95a7'}));
    defs.appendChild(marker);
    var markerActive=element('marker',{id:'arrowActive',markerWidth:'8',markerHeight:'8',refX:'6',refY:'3',orient:'auto'});
    markerActive.appendChild(element('path',{d:'M 0 0 L 6 3 L 0 6 Z',fill:'#067582'}));
    defs.appendChild(markerActive);
    ui.svg.appendChild(defs);
    (selectedView.zones||[]).forEach(function(z){
      ui.svg.appendChild(element('rect',{x:z.x,y:z.y,width:z.w,height:z.h,rx:18,fill:z.kind==='external'?'#faf3ff':'#edf5f8',stroke:z.kind==='external'?'#cbb4df':'#d6e5ed','stroke-dasharray':'6 5'}));
      ui.svg.appendChild(element('text',{x:z.x+16,y:z.y+25,'class':'zone-label'},z.title));
    });
    var connected=new Set([state.selected]);
    selectedView.edges.forEach(function(e){if(e.from===state.selected||e.to===state.selected){connected.add(e.from);connected.add(e.to);}});
    var byId={};selectedView.nodes.forEach(function(n){byId[n.id]=n;});
    selectedView.edges.forEach(function(e){
      var from=byId[e.from], to=byId[e.to];if(!from||!to)return;
      var active=e.from===state.selected||e.to===state.selected;
      var path=element('path',{
        d:linkPath(from,to,e.route),
        'class':'graph-edge'+(active?' active':state.selected?' quiet':''),
        'marker-end':active?'url(#arrowActive)':'url(#arrow)',
      });
      ui.svg.appendChild(path);
    });
    selectedView.nodes.forEach(function(n){ui.svg.appendChild(makeNode(n,connected));});
    clear(ui.list);
    selectedView.nodes.forEach(function(node){
      var btn=document.createElement('button');
      btn.className='component-button'+(state.selected===node.id?' current':'');
      btn.type='button';btn.textContent=node.title;btn.setAttribute('aria-pressed',state.selected===node.id?'true':'false');
      btn.addEventListener('click',function(){focusNode(node.id);});
      ui.list.appendChild(btn);
    });
    var match=byId[state.selected]; if(!match)return;
    ui.selection.textContent='当前选中 · '+selectedView.title;
    ui.title.textContent=match.title;
    ui.desc.textContent=match.role;
    ui.inputs.textContent=match.inputs;
    ui.outputs.textContent=match.outputs;
    ui.risks.textContent=match.risks;
    ui.evidence.textContent=match.evidence;
  }
  render();
})();
