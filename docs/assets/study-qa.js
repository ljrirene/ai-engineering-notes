/* Study QA v1: deterministic evidence retrieval + manually curated active recall. No AI API. */
(async()=>{'use strict';
const root=document.getElementById('study-qa-root');if(!root)return;
const get=id=>document.getElementById(id),base=new URL('../',location.href);
const status=get('qa-index-status');let index,bank,graph;
try{const rs=await Promise.all([fetch(root.dataset.corpus),fetch(root.dataset.bank),fetch(root.dataset.graph)]);for(const r of rs)if(!r.ok)throw Error('HTTP '+r.status);[index,bank,graph]=await Promise.all(rs.map(r=>r.json()));status.textContent=index.documents.length+' 篇 · '+index.chunks.length+' 段证据';}catch(e){status.textContent='资料加载失败';get('qa-results').textContent='无法读取研究索引：'+e.message;get('qa-question').textContent='题库加载失败';return;}
const docs=new Map(index.documents.map(d=>[d.id,d])),concepts=new Map(graph.nodes.map(n=>[n.id,n]));
const accent=new Map([['rag',['retrieval','检索','evidence','证据','embedding']],['asr',['sticky','stream','session','流式']],['注入',['prompt injection','guard','trust','信任']],['沙箱',['sandbox','microvm','space']],['强化学习',['rl','rollout','trainer','sampler']],['模型发布',['canary','shadow','deployment']],['熔断',['circuit','breaker','gpu','repair']],['路由',['routing','decision','orchestrator']],['缓存',['cache','state','hbm']],['agent',['tool','policy','planner']]]);
const stop=new Set(['什么','怎么','如何','为什么','可以','是否','我们','还是','这个','那个','哪些','需要','区别','区别','比较','介绍','一下','有关','有什么','一些','的是','就是','时候','以及','between','what','when','does','with','from','there','about','would','should','this','that','which','where','what','why','how','and','the','for']);
function norm(s){return (s||'').normalize('NFKC').toLowerCase().replace(/[_-]/g,' ').trim()}
function tokens(s){const n=norm(s),t=[];const en=n.match(/[a-z][a-z0-9]{1,}/g)||[];for(const w of en)if(!stop.has(w))t.push(w);
const han=n.match(/[\u3400-\u9fff]+/g)||[];for(const c of han){if(c.length<=3){if(c.length>1&&!stop.has(c))t.push(c)}else{for(let k=0;k<c.length-1;k++){let v=c.slice(k,k+2);if(!stop.has(v))t.push(v)}for(let k=0;k<c.length-2;k++){let v=c.slice(k,k+3);if(!stop.has(v))t.push(v)}}}
return [...new Set(t)];}
function boostQuery(q){let full=q;const l=norm(q);for(const [key,arr] of accent)if(l.includes(key))full+=' '+arr.join(' ');return full;}
const ix=index.chunks.map(c=>{const doc=docs.get(c.docId),str=norm(c.text+' '+c.heading+' '+doc.label+' '+doc.title);return {...c,doc,toks:new Set(tokens(str)),textLower:norm(c.text),headLower:norm(c.heading),docLower:norm(doc.label+' '+doc.title+' '+doc.description)};});
const df=new Map();for(const c of ix)for(const t of c.toks)df.set(t,(df.get(t)||0)+1);
function score(q,scope){const t=tokens(boostQuery(q));if(!t.length)return [];const results=[];
for(const c of ix){if(scope!=='all'&&c.docId!==scope)continue;let s=0,matches=[];for(const x of t){const f=df.get(x)||0;const idf=Math.log(1+(ix.length-f+.5)/(f+.5));if(c.toks.has(x)){s+=1.1+idf;matches.push(x);if(c.headLower.includes(x))s+=1.8;if(c.docLower.includes(x))s+=1.8;}}if(s>0){s*=1/(1+Math.log(1+c.text.length/700)*.08);results.push({...c,score:s,matches});}}
results.sort((a,b)=>b.score-a.score);
const out=[],used=new Map();for(const c of results){if((used.get(c.docId)||0)>=2)continue;if(out.length>=5)break;out.push(c);used.set(c.docId,(used.get(c.docId)||0)+1);}return out;
}
function el(tag,t,parent,cls){const e=document.createElement(tag);if(t!=null)e.textContent=t;if(cls)e.className=cls;parent?.appendChild(e);return e}
function safeURL(p){if(typeof p!=='string'||!p.startsWith('/')||p.includes('..'))return null;return new URL(p.slice(1),base).href;}
function link(parent,url,label){let href=safeURL(url);if(!href)return;let a=el('a',label,parent);a.href=href;return a;}
function snippet(c){let text=c.text.replace(/\n+/g,' '),at=-1;for(const t of c.matches){let i=norm(text).indexOf(t);if(i>=0&&(at<0||i<at))at=i;}if(text.length<=425)return text;let start=Math.max(0,(at<0?0:at-70));if(start>text.length-300)start=Math.max(0,text.length-370);return (start?'…':'')+text.slice(start,start+395)+(start+395<text.length?'…':'');}
function showResults(q){const holder=get('qa-results');holder.replaceChildren();const ranked=score(q,get('qa-scope').value);if(!ranked.length){const d=el('div',null,holder,'qa-idle');el('h3','没有找到足够相关的文段',d);el('p','试试专有名词、论文名称或较短的技术问题。本功能是本地检索，不会编造答案。',d);return;}
const intro=el('p',null,holder,'qa-result-summary');intro.append('检索到 ');el('strong',ranked.length+' 条有出处的相关文段',intro);intro.append('。下面是研究原文摘录，不是模型生成的总结。请点开文章确认上下文。');
ranked.forEach((c,i)=>{const article=el('article',null,holder,'qa-evidence');el('span',String(i+1).padStart(2,'0'),article,'qa-rank');const body=el('div',null,article);el('h3',c.doc.title,body);el('div',c.heading+' · '+c.doc.date,body,'qa-evidence-section');el('blockquote',snippet(c),body);const links=el('div',null,body,'qa-source-links');link(links,c.doc.url,'阅读原文 ↗');link(links,c.doc.visual,'打开原理对照图 ↗');});
const hit=new Map();for(const c of ranked)for(const e of graph.edges){const other=e.source===c.docId?e.target:e.target===c.docId?e.source:null;if(other&&concepts.get(other)?.kind==='concept')hit.set(other,(hit.get(other)||0)+1);}
if(hit.size){const box=el('div',null,holder,'qa-related');el('h3','沿图谱继续探索 · Related concepts',box);[...hit].sort((a,b)=>b[1]-a[1]).slice(0,7).forEach(([id])=>{const n=concepts.get(id),b=el('button',n.label,box);b.type='button';b.onclick=()=>{get('qa-query').value=n.label;get('qa-scope').value='all';showResults(n.label);};});}
}
const scope=get('qa-scope'),topic=get('qa-topic');for(const d of index.documents){for(const sel of [scope,topic]){const op=document.createElement('option');op.value=d.id;op.textContent=d.label;sel.appendChild(op)}}
get('qa-ask-form').addEventListener('submit',e=>{e.preventDefault();const q=get('qa-query').value.trim();if(q)showResults(q);});
get('qa-prompts').addEventListener('click',e=>{const b=e.target.closest('button[data-query]');if(!b)return;get('qa-query').value=b.dataset.query;showResults(b.dataset.query);});
function tab(name){const ask=name==='ask';get('qa-ask').hidden=!ask;get('qa-practice').hidden=ask;get('qa-tab-ask').classList.toggle('active',ask);get('qa-tab-practice').classList.toggle('active',!ask);get('qa-tab-ask').setAttribute('aria-selected',String(ask));get('qa-tab-practice').setAttribute('aria-selected',String(!ask));}
get('qa-tab-ask').onclick=()=>tab('ask');get('qa-tab-practice').onclick=()=>tab('practice');
let question=null,round=0,seen=new Set(),mastered=new Set();
function nextQuestion(){const pool=bank.questions.filter(q=>topic.value==='all'||q.doc===topic.value);if(!pool.length)return;
let remaining=pool.filter(q=>!seen.has(q.id));if(!remaining.length){remaining=pool;seen=new Set([...seen].filter(id=>!pool.some(q=>q.id===id)));}
question=remaining[round%remaining.length];round++;seen.add(question.id);
get('qa-q-number').textContent='QUESTION '+question.id.slice(2);get('qa-q-level').textContent=question.level;get('qa-question').textContent=question.q;get('qa-answer').value='';
for(const id of ['qa-hint','qa-self-check','qa-reference']){get(id).hidden=true;get(id).replaceChildren();}
get('qa-progress').textContent=mastered.size+' / '+bank.questions.length+' 已掌握';get('qa-mastered').textContent=mastered.has(question.id)?'已标记掌握 ✓':'这题掌握了 ✓';
}
get('qa-next').onclick=nextQuestion;topic.onchange=()=>{round=0;nextQuestion()};
get('qa-hint-btn').onclick=()=>{if(!question)return;const box=get('qa-hint');box.hidden=false;box.textContent='思考提示：'+question.hint;};
get('qa-check').onclick=()=>{if(!question)return;const box=get('qa-self-check');box.replaceChildren();box.hidden=false;const answer=norm(get('qa-answer').value);if(answer.length<8){el('b','先写下你自己的理解，再试概念自检。',box);return;}
let found=0;for(const group of question.terms)if(group.some(t=>answer.includes(norm(t))))found++;
el('p','概念覆盖提示：'+found+' / '+question.terms.length+' 组线索已提及。仅为关键词提示，不代表内容正确，更不会评判语义或逻辑。',box);
const row=el('div',null,box,'qa-cov');question.terms.forEach(group=>{const yes=group.some(t=>answer.includes(norm(t)));el('span',(yes?'✓ ':'○ ')+group.slice(0,2).join(' / '),row,yes?'found':'');});};
get('qa-reveal').onclick=()=>{if(!question)return;const box=get('qa-reference');box.replaceChildren();box.hidden=false;el('h4','参考答案',box);el('p',question.answer,box);el('h4','常见误区',box);el('p',question.trap,box);const d=docs.get(question.doc);link(box,d.url,'阅读出处 ↗');box.append('　');link(box,d.visual,'原理对照图 ↗');};
get('qa-mastered').onclick=()=>{if(!question)return;mastered.add(question.id);get('qa-progress').textContent=mastered.size+' / '+bank.questions.length+' 已掌握';nextQuestion();};
nextQuestion();
})();


