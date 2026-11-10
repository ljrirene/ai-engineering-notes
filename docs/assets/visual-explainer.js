(function(){
"use strict";
const page=document.querySelector(".vl-page");if(!page)return;
const tabs=[...page.querySelectorAll("[data-mode].vl-mode-switch button")];
const flows=[...page.querySelectorAll(".vl-flow")],steps=[...page.querySelectorAll(".vl-progress-step")];
const count=document.getElementById("vl-step-count"),title=document.getElementById("vl-step-title"),brief=document.getElementById("vl-step-brief"),technical=document.getElementById("vl-technical"),technicalText=document.getElementById("vl-technical-text"),counter=document.getElementById("vl-counter"),prev=document.getElementById("vl-prev"),next=document.getElementById("vl-next");
let mode="after",index=0;
const current=()=>steps.filter(s=>s.dataset.mode===mode);
function paint(keepFocus){
 const array=current(),step=array[index];if(!step)return;
 steps.forEach(s=>s.setAttribute("aria-current",s===step?"step":"false"));
 count.textContent="第 "+(index+1)+" 步";title.textContent=step.dataset.title;brief.textContent=step.dataset.brief;
 technicalText.textContent=step.dataset.detail;technical.open=false;
 counter.textContent=(index+1)+" / "+array.length;
 prev.disabled=index===0;next.disabled=index===array.length-1;
 if(keepFocus)step.focus();
}
function selectMode(nextMode){
 mode=nextMode;index=0;
 tabs.forEach(t=>t.setAttribute("aria-selected",String(t.dataset.mode===mode)));
 flows.forEach(f=>{f.hidden=f.dataset.flow!==mode;});
 paint(false);
}
tabs.forEach(t=>t.addEventListener("click",()=>selectMode(t.dataset.mode)));
steps.forEach(s=>s.addEventListener("click",()=>{mode=s.dataset.mode;index=current().indexOf(s);paint(false);}));
prev.addEventListener("click",()=>{if(index>0){index--;paint(false);}});
next.addEventListener("click",()=>{if(index<current().length-1){index++;paint(false);}});
flows.forEach(f=>f.addEventListener("keydown",e=>{
 if(e.target.closest(".vl-progress-step")&&(e.key==="ArrowRight"||e.key==="ArrowLeft")){
 e.preventDefault();index=Math.max(0,Math.min(current().length-1,index+(e.key==="ArrowRight"?1:-1)));paint(true);
 }
}));
selectMode("after");
})();
