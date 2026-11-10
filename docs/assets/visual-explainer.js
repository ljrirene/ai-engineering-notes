(function(){
"use strict";
const page=document.querySelector(".vl-page");if(!page)return;
const tabs=[...document.querySelectorAll("[data-tab]")],flows=[...document.querySelectorAll(".vl-flow")];
const all=[...document.querySelectorAll(".vl-step")],detailTop=document.getElementById("vl-detail-top"),detailTitle=document.getElementById("vl-detail-title"),detailText=document.getElementById("vl-detail-text");
let flow="after",active=null;
function select(btn,focus){
 if(!btn)return;
 active=btn;all.forEach(b=>b.setAttribute("aria-pressed",String(b===btn)));
 detailTop.textContent=(flow==="after"?"文章方案":"常见做法")+" · 第 "+btn.dataset.number+" 步";
 detailTitle.textContent=btn.dataset.title;detailText.textContent=btn.dataset.detail;
 if(focus)btn.focus();
}
function switchFlow(next){
 flow=next;
 tabs.forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===next)));
 flows.forEach(el=>el.hidden=el.dataset.flow!==next);
 const choices=all.filter(b=>b.dataset.flow===flow);
 select(choices.find(b=>b.querySelector(".vl-step-mark"))||choices[0],false);
}
tabs.forEach(b=>b.addEventListener("click",()=>switchFlow(b.dataset.tab)));
all.forEach(b=>b.addEventListener("click",()=>select(b,false)));
function move(delta){
 const visible=all.filter(b=>b.dataset.flow===flow);
 if(!visible.length)return;
 let index=visible.indexOf(active);index=(index+delta+visible.length)%visible.length;
 select(visible[index],true);
}
document.getElementById("vl-prev").addEventListener("click",()=>move(-1));
document.getElementById("vl-next").addEventListener("click",()=>move(1));
switchFlow("after");
})();
