"use strict";
const $ = (id) => document.getElementById(id);
const datasets = {"attack-enterprise":"ATT&CK Enterprise","attack-mobile":"ATT&CK Mobile","attack-ics":"ATT&CK ICS","atlas":"MITRE ATLAS"};
const state = { dataset:"attack-enterprise", objects:[], query:"", kind:"", tactic:"", page:0, mode:"list", chaos:!window.matchMedia("(prefers-reduced-motion: reduce)").matches };
let requestId=0, catTimer=null;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const short = (text,n=230) => String(text||"").slice(0,n);
const card = (item) => `<button class="item" type="button" data-id="${escapeHtml(item.id)}"><span class="id">${escapeHtml(item.id)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(short(item.description))}</p><span class="tag">${escapeHtml(item.type)}</span></button>`;
function setChaos(enabled) {
  state.chaos=enabled;document.body.classList.toggle("quiet",!enabled);
  $("chaos").textContent=enabled?"✨ Chaos: ON":"😴 Chaos: OFF";$("chaos").setAttribute("aria-pressed",String(enabled));
  if(catTimer)clearInterval(catTimer);
  if(enabled)catTimer=setInterval(spawnCat,4800);
}
function spawnCat(){
  if(!state.chaos||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const el=document.createElement("span");el.className="floatcat";el.textContent=["🐈","🐈‍⬛","😼","🐱","🐾","😹"][Math.floor(Math.random()*6)];
  el.style.left=Math.random()*90+"%";el.style.setProperty("--drift",(Math.random()*60-30)+"vw");el.style.setProperty("--speed",(8+Math.random()*9)+"s");
  $("cats").append(el);el.addEventListener("animationend",()=>el.remove(),{once:true});
}
function populate(select, values, label) {
  select.replaceChildren(new Option(label,""));
  for(const value of values.sort((a,b)=>a.localeCompare(b)))select.add(new Option(value,value));
}
async function loadDataset(name) {
  state.dataset=name;state.page=0;state.kind="";state.tactic="";state.objects=[];
  for(const tab of document.querySelectorAll("[data-dataset]"))tab.setAttribute("aria-selected",String(tab.dataset.dataset===name));
  $("section-title").textContent=datasets[name];$("results").replaceChildren();$("status").textContent="Loading local "+name+" snapshot…";
  const current=++requestId;
  try{
    const response=await fetch("./data/"+name+".json",{cache:"no-cache"});
    if(!response.ok)throw new Error("Local snapshot unavailable (HTTP "+response.status+"). Run scripts/sync.py or the GitHub Actions refresh workflow.");
    const payload=await response.json();
    if(current!==requestId)return;
    if(!Array.isArray(payload.objects)||payload.objects.length<10)throw new Error("Dataset invalid or incomplete.");
    state.objects=payload.objects;
    populate($("kind"),[...new Set(state.objects.map(o=>o.type).filter(Boolean))],"All object types");
    populate($("tactic"),[...new Set(state.objects.flatMap(o=>o.tactics||[]))],"All tactics");
    $("status").textContent="Local snapshot loaded • "+state.objects.length.toLocaleString()+" objects";
    $("updated").textContent="Dataset: "+(payload.version||"latest");
    render();
  }catch(error){if(current!==requestId)return;$("results").innerHTML='<div role="alert"><h3>😿 The knowledge base escaped</h3><p>'+escapeHtml(error.message)+'</p><p>Check the <a href="https://github.com/jordanhardee/mitre-catverse/actions">data refresh workflow</a>.</p></div>';$("status").textContent="Snapshot unavailable";$("count").textContent="0 objects";}
}
function filtered(){
  const q=state.query.toLocaleLowerCase();
  return state.objects.filter(o=>(!state.kind||o.type===state.kind)&&(!state.tactic||(o.tactics||[]).includes(state.tactic))&&(!q||[o.id,o.name,o.description,...(o.tactics||[])].some(x=>String(x||"").toLocaleLowerCase().includes(q))));
}
function render(){
  const items=filtered();$("count").textContent=items.length.toLocaleString()+" results";
  const root=$("results"),pager=$("pagination");pager.replaceChildren();
  if(!items.length){root.className="results";root.innerHTML="<p>No matches. The cats are innocent. Probably.</p>";return;}
  if(state.mode==="matrix"){
    const tactics=state.objects.filter(o=>o.type==="x-mitre-tactic"||o.type==="tactic");
    if(!tactics.length){state.mode="list";return render();}
    root.className="matrix";root.replaceChildren();
    for(const tactic of tactics){
      const col=document.createElement("section");col.className="matrix-col";
      const h=document.createElement("h3");h.textContent=tactic.name;col.append(h);
      const key=state.dataset==="atlas"?tactic.id:(tactic.name||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/,"");
      const matching=items.filter(o=>(o.tactics||[]).includes(key)&&o.type!=="tactic"&&o.type!=="x-mitre-tactic");
      for(const obj of matching.slice(0,80))col.insertAdjacentHTML("beforeend",card(obj));
      if(matching.length>80){const p=document.createElement("p");p.textContent="+"+(matching.length-80)+" more (use list view)";col.append(p);}
      root.append(col);
    }
    return;
  }
  root.className="results";
  const pages=Math.ceil(items.length/60);state.page=Math.min(state.page,Math.max(0,pages-1));
  root.innerHTML=items.slice(state.page*60,(state.page+1)*60).map(card).join("");
  if(pages>1){const prev=document.createElement("button"),next=document.createElement("button"),label=document.createElement("span");prev.textContent="← Prev";next.textContent="Next →";label.textContent=(state.page+1)+" / "+pages;prev.disabled=state.page===0;next.disabled=state.page>=pages-1;prev.onclick=()=>{state.page--;render()};next.onclick=()=>{state.page++;render()};pager.append(prev,label,next);}
}
function showDetail(id){
  const o=state.objects.find(item=>item.id===id);if(!o)return;
  const d=$("detail-content");d.replaceChildren();
  const h=document.createElement("h2");h.textContent=o.name;d.append(h);
  const idp=document.createElement("strong");idp.textContent=o.id+" • "+o.type;d.append(idp);
  const p=document.createElement("p");p.textContent=o.description||"No description supplied.";d.append(p);
  if(o.platforms?.length){const p=document.createElement("p");p.textContent="Platforms: "+o.platforms.join(", ");d.append(p);}
  if(o.tactics?.length){const p=document.createElement("p");p.textContent="Tactics: "+o.tactics.join(", ");d.append(p);}
  if(o.parent){const p=document.createElement("p");p.textContent="Parent: "+o.parent;d.append(p);}
  if(o.relations?.length){const h=document.createElement("h3");h.textContent="Relationships ("+o.relations.length+")";d.append(h);for(const r of o.relations.slice(0,100)){const a=document.createElement("button");a.className="relation";a.textContent=r.type+": "+r.name+" ("+r.id+")";a.onclick=()=>showDetail(r.id);d.append(a);}}
  if(o.url&&/^https:\/\/(attack|atlas)\.mitre\.org\//.test(o.url)){const p=document.createElement("p"),a=document.createElement("a");a.href=o.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="View official MITRE reference ↗";p.append(a);d.append(p);}
  if(!$("detail").open)$("detail").showModal();
}
document.querySelectorAll("[data-dataset]").forEach(b=>b.addEventListener("click",()=>loadDataset(b.dataset.dataset)));
$("search").addEventListener("input",e=>{state.query=e.target.value.trim();state.page=0;render()});
$("kind").addEventListener("change",e=>{state.kind=e.target.value;state.page=0;render()});
$("tactic").addEventListener("change",e=>{state.tactic=e.target.value;state.page=0;render()});
$("results").addEventListener("click",e=>{const card=e.target.closest("[data-id]");if(card)showDetail(card.dataset.id)});
$("matrix-toggle").onclick=()=>{state.mode="matrix";$("matrix-toggle").classList.add("active");$("list-toggle").classList.remove("active");render()};
$("list-toggle").onclick=()=>{state.mode="list";$("list-toggle").classList.add("active");$("matrix-toggle").classList.remove("active");render()};
$("list-toggle").classList.add("active");
$("chaos").onclick=()=>setChaos(!state.chaos);
$("meow").onclick=()=>spawnCat();
$("close-detail").onclick=()=>$("detail").close();
setChaos(state.chaos);loadDataset(state.dataset);
