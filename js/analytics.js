import { sb } from './db.js';
import { range, finance, months, items, calc } from './util.js';
const R=[['d30','30 days'],['quarter','Quarter'],['year','Year'],['l12','12 months']];
const P={rev:'#3B5BDB',exp:'#F08C3A',pos:'#1F9D6B',neg:'#D64550',pal:['#3B5BDB','#6C8CF0','#A5B8F7','#F08C3A','#1F9D6B','#9AA1B2']};
let r='l12';
const dkk=v=>new Intl.NumberFormat('da-DK',{maximumFractionDigits:0}).format(Math.round(v))+' kr';
const short=v=>Math.abs(v)>=1000?(v/1000).toLocaleString('da-DK',{maximumFractionDigits:1})+'k':v;
const lab=m=>{const [y,o]=m.split('-');return new Date(+y,+o-1,1).toLocaleDateString('da-DK',{month:'short',year:'2-digit'})};
const grad=(c,a=.45)=>ctx=>{const ar=ctx.chart.chartArea;if(!ar)return c+'22';const g=ctx.chart.ctx.createLinearGradient(0,ar.top,0,ar.bottom);g.addColorStop(0,c+Math.round(a*255).toString(16).padStart(2,'0'));g.addColorStop(1,c+'00');return g};
const barGrad=ctx=>{const ar=ctx.chart.chartArea;if(!ar)return P.rev;const g=ctx.chart.ctx.createLinearGradient(0,ar.top,0,ar.bottom);g.addColorStop(0,'#3B5BDB');g.addColorStop(1,'#8FA6F2');return g};
const cross={id:'cross',afterDatasetsDraw(ch){const a=ch.tooltip?.getActiveElements?.();if(!a||!a.length)return;const x=a[0].element.x,{ctx,chartArea:c}=ch;ctx.save();ctx.strokeStyle='rgba(120,126,140,.4)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,c.top);ctx.lineTo(x,c.bottom);ctx.stroke();ctx.restore()}};
const up=(e,to,fmt)=>{const t0=performance.now(),st=n=>{const p=Math.min(1,(n-t0)/900);e.textContent=fmt(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(st)};requestAnimationFrame(st)};
export async function render(el){
  const [f,t]=range(r),[F,c]=await Promise.all([finance(f,t),sb.from('customers').select('status,mrr_ore,created_at')]);if(c.error)throw c.error;
  const ms=months(f,t),lb=ms.map(lab),Cu=c.data,cnt=s=>Cu.filter(x=>[].concat(s).includes(x.status)).length;
  const rev=ms.map(x=>F.inv.filter(i=>i.issue_date.slice(0,7)===x).reduce((s,i)=>s+i.t.net,0)/100);
  const exp=ms.map(x=>F.exp.filter(i=>i.date.slice(0,7)===x).reduce((s,i)=>s+i.amount_ore,0)/100);
  const prf=rev.map((x,i)=>x-exp[i]),sum=a=>a.reduce((s,x)=>s+x,0),totRev=sum(rev),totPrf=sum(prf);
  const svc={};F.inv.forEach(i=>{const ls=items(i);calc(ls);ls.forEach(l=>svc[l.description]=(svc[l.description]||0)+l._n/100)});
  const sv=Object.entries(svc).sort((a,b)=>b[1]-a[1]),svTot=sum(sv.map(x=>x[1]));
  const isC=x=>['customer','active','inactive'].includes(x.status);let run=Cu.filter(x=>isC(x)&&x.created_at.slice(0,7)<ms[0]).length;
  const grow=ms.map(x=>run+=Cu.filter(y=>isC(y)&&y.created_at.slice(0,7)===x).length),newC=grow.at(-1)-(Cu.filter(x=>isC(x)&&x.created_at.slice(0,7)<ms[0]).length);
  const last=rev.at(-1),prev=rev.at(-2),g=prev>0?Math.round((last-prev)/prev*100):null;
  const won=cnt(['customer','active']),lost=cnt('lost'),conv=won+lost?won/(won+lost)*100:0,act=cnt('active'),ina=cnt('inactive');
  const mrr=Cu.filter(x=>x.status==='active').reduce((s,x)=>s+(x.mrr_ore||0),0)/100,avg=F.inv.length?totRev/F.inv.length:0;
  const K=[
    {l:'Revenue',v:totRev,fmt:dkk,badge:g===null?['n','excl. VAT']:[g>=0?'up':'down',(g>=0?'+':'')+g+'% vs prev. month'],sp:rev,col:P.rev},
    {l:'Profit',v:totPrf,fmt:dkk,cls:totPrf<0?'neg':'pos',badge:totRev?[totPrf>=0?'up':'down',Math.round(totPrf/totRev*100)+'% margin']:['n','no revenue'],sp:prf,col:totPrf<0?P.neg:P.pos},
    {l:'Customers',v:grow.at(-1),fmt:x=>Math.round(x),badge:['n','+'+newC+' in period'],sp:grow,col:P.pos},
    {l:'Monthly recurring revenue',v:mrr,fmt:dkk,badge:['n',act+' active']},
    {l:'Average deal value',v:avg,fmt:dkk,badge:['n',F.inv.length+' invoices']},
    {l:'Lead conversion',v:conv,fmt:x=>Math.round(x)+'%',badge:['n',won+' won, '+lost+' lost']}];
  const stages=[['New leads','lead'],['Contacted','contacted'],['Interested','interested'],['Meeting','meeting'],['Negotiation','negotiation'],['Won',['customer','active']],['Lost','lost']],mx=Math.max(1,...stages.map(s=>cnt(s[1])));
  el.innerHTML=`<div class="an-head"><div><h2>Analytics</h2><p class="muted">${f} to ${t}</p></div><div class="seg">${R.map(([a,b])=>`<button data-r="${a}" class="${r===a?'on':''}">${b}</button>`).join('')}</div></div>
  <div class="kpis">${K.map((k,i)=>`<div class="kpi"><small>${k.l}</small><b class="${k.cls||''}" data-k="${i}">0</b><span class="badge ${k.badge[0]}">${k.badge[1]}</span>${k.sp?`<div class="sp"><canvas data-s="${i}"></canvas></div>`:'<div style="height:18px"></div>'}</div>`).join('')}</div>
  <div class="an-card" style="margin-bottom:14px"><h4>Revenue, expenses and profit</h4><p class="sub">Monthly, excl. VAT. Click a label to show or hide it.</p><div class="chips" id="chips"></div><div style="height:340px"><canvas id="c1"></canvas></div></div>
  <div class="an-row" style="grid-template-columns:2fr 1fr"><div class="an-card"><h4>Monthly sales</h4><p class="sub">Sent and paid invoices</p><div style="height:280px"><canvas id="c4"></canvas></div></div>
  <div class="an-card"><h4>Revenue by service</h4><p class="sub">Share of total</p>${sv.length?`<div style="height:190px"><canvas id="c2"></canvas></div>${sv.slice(0,6).map((s,i)=>`<div class="sv"><i style="background:${P.pal[i%6]}"></i><span>${s[0]}</span><em>${Math.round(s[1]/svTot*100)}%</em></div>`).join('')}`:'<p class="muted">No sent or paid invoices in this period.</p>'}</div></div>
  <div class="an-row" style="grid-template-columns:1fr 1fr"><div class="an-card"><h4>Customer growth</h4><p class="sub">Total customers over time</p><div style="height:260px"><canvas id="c3"></canvas></div></div>
  <div class="an-card"><h4>Sales funnel</h4><p class="sub">Customers and leads by stage. Retention: ${act+ina?Math.round(act/(act+ina)*100)+'%':'–'}</p>${stages.map(([n,s],i)=>`<div class="fn"><span>${n}</span><div class="tr"><i class="${n==='Lost'?'lost':''}" data-w="${cnt(s)/mx*100}"></i></div><b>${cnt(s)}</b></div>`).join('')}</div></div>`;
  const $=s=>el.querySelector(s),cs=getComputedStyle(document.body),V=n=>cs.getPropertyValue(n).trim();
  Chart.defaults.font.family='Inter,system-ui,sans-serif';Chart.defaults.color=V('--mu')||'#747984';
  const tip={backgroundColor:V('--card')||'#fff',titleColor:V('--tx'),bodyColor:V('--mu'),borderColor:V('--bd'),borderWidth:1,padding:12,cornerRadius:10,boxPadding:6,usePointStyle:true,titleFont:{weight:'600',size:13},callbacks:{label:c=>` ${c.dataset.label}: ${dkk(c.parsed.y??c.parsed)}`}};
  const ax={x:{grid:{display:false},border:{display:false},ticks:{maxRotation:0}},y:{border:{display:false},grid:{color:V('--bd'),drawTicks:false},ticks:{callback:short,padding:8}}};
  const base=(x={})=>({responsive:true,maintainAspectRatio:false,animation:{duration:1100,easing:'easeOutQuart'},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:tip},scales:ax,...x});
  const ln=(l,d,c,fill=true,w=2.5)=>({label:l,data:d,borderColor:c,backgroundColor:fill?grad(c):c,fill,tension:.4,borderWidth:w,pointRadius:0,pointHoverRadius:6,pointHoverBorderWidth:3,pointHoverBorderColor:'#fff',pointHoverBackgroundColor:c});
  K.forEach((k,i)=>{up($(`[data-k="${i}"]`),k.v,k.fmt);if(k.sp)new Chart($(`[data-s="${i}"]`),{type:'line',data:{labels:k.sp.map((_,j)=>j),datasets:[{data:k.sp,borderColor:k.col,backgroundColor:grad(k.col,.35),fill:true,tension:.4,borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:1200},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}}}})});
  const main=new Chart($('#c1'),{type:'line',plugins:[cross],data:{labels:lb,datasets:[ln('Revenue',rev,P.rev),ln('Expenses',exp,P.exp),{...ln('Profit',prf,P.pos,false,3),segment:{borderColor:c=>(c.p0.parsed.y+c.p1.parsed.y)/2<0?P.neg:P.pos}}]},options:base()});
  $('#chips').innerHTML=[['Revenue',P.rev],['Expenses',P.exp],['Profit',P.pos]].map(([n,c],i)=>`<button class="chip" data-i="${i}"><i style="background:${c}"></i>${n}</button>`).join('');
  el.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;main.setDatasetVisibility(i,!main.isDatasetVisible(i));b.classList.toggle('off',!main.isDatasetVisible(i));main.update()});
  new Chart($('#c4'),{type:'bar',data:{labels:lb,datasets:[{label:'Sales',data:rev,backgroundColor:barGrad,borderRadius:10,borderSkipped:false,maxBarThickness:42,hoverBackgroundColor:'#2F4AB8'}]},options:base()});
  if(sv.length)new Chart($('#c2'),{type:'doughnut',data:{labels:sv.map(x=>x[0]),datasets:[{data:sv.map(x=>x[1]),backgroundColor:sv.map((_,i)=>P.pal[i%6]),borderWidth:4,borderColor:V('--card')||'#fff',hoverOffset:10,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'74%',animation:{animateRotate:true,duration:1200},plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>` ${c.label}: ${dkk(c.parsed)}`}}}}});
  new Chart($('#c3'),{type:'line',plugins:[cross],data:{labels:lb,datasets:[ln('Customers',grow,P.pos)]},options:base({plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>` ${c.parsed.y} customers`}}},scales:{...ax,y:{...ax.y,beginAtZero:true,ticks:{precision:0}}}})});
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll('.fn i').forEach(i=>i.style.width=i.dataset.w+'%')));
  el.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{r=b.dataset.r;render(el)});
}