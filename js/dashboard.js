import { sb, esc, kr } from './db.js';
import { range, finance, items, calc, iso, today } from './util.js';
const dkk=v=>new Intl.NumberFormat('da-DK',{maximumFractionDigits:0}).format(Math.round(v))+' kr';
const pct=(c,p)=>p>0?Math.round((c-p)/p*100):null;
const badge=(c,p,txt='vs last month')=>{const d=pct(c,p);return d===null?`<span class="badge n">${txt}: no data</span>`:`<span class="badge ${d>=0?'up':'down'}">${d>=0?'+':''}${d}% ${txt}</span>`};
const up=(e,to,fmt)=>{const t0=performance.now(),st=n=>{const p=Math.min(1,(n-t0)/900);e.textContent=fmt(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(st)};requestAnimationFrame(st)};
const LBL={draft:'Draft',sent:'Sent',paid:'Paid',cancelled:'Cancelled',overdue:'Overdue'};
const ST={lead:'New leads',contacted:'Contacted',interested:'Interested',meeting:'Meeting',negotiation:'Negotiation'};
export async function render(el,me){
  const [f,t]=range('month'),[pf,pt]=range('last'),T=today(),h=new Date().getHours();
  const [F,P,cu,tk,ev,sent,last]=await Promise.all([finance(f,t),finance(pf,pt),
    sb.from('customers').select('id,company_name,status,created_at,deal_value_ore').order('created_at',{ascending:false}),
    sb.from('tasks').select('id,title,due_date,priority,customers(company_name)').eq('status','open').order('due_date',{nullsFirst:false}).limit(6),
    sb.from('calendar_events').select('*').gte('event_date',T).order('event_date').order('event_time').limit(6),
    sb.from('invoices').select('*,invoice_items(*)').eq('status','sent'),
    sb.from('invoices').select('*,customers(company_name),invoice_items(*)').order('created_at',{ascending:false}).limit(6)]);
  for(const x of [cu,tk,ev,sent,last])if(x.error)throw x.error;
  const isC=x=>['customer','active','inactive'].includes(x.status),C=cu.data;
  const newC=C.filter(x=>isC(x)&&x.created_at.slice(0,10)>=f&&x.created_at.slice(0,10)<=t).length,newP=C.filter(x=>isC(x)&&x.created_at.slice(0,10)>=pf&&x.created_at.slice(0,10)<=pt).length;
  const paid=F.inv.filter(i=>i.status==='paid').reduce((s,i)=>s+i.t.net,0);
  const overdue=sent.data.filter(i=>i.due_date<T),ovAmt=overdue.reduce((s,i)=>s+calc(items(i)).total,0);
  const open=C.filter(x=>Object.keys(ST).includes(x.status)),pipe=open.reduce((s,x)=>s+(x.deal_value_ore||0),0);
  const day=Math.max(...[...F.inv,...P.inv].map(i=>+i.issue_date.slice(8)),0)&&0,nowD=new Date().getDate(),dim=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const cum=(inv)=>{const a=Array(dim).fill(0);inv.forEach(i=>a[+i.issue_date.slice(8)-1]+=i.t.net/100);let s=0;return a.map(x=>s+=x)};
  const cur=cum(F.inv).map((x,i)=>i<nowD?x:null),prv=cum(P.inv).slice(0,dim);
  const name=(me.full_name||'').split(' ')[0],greet=h<5?'Good night':h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  const row=(a,b,c)=>`<div class="lr"><span>${a}</span><small>${b}</small>${c?`<em>${c}</em>`:''}</div>`;
  const k=(l,i,sub,b)=>`<div class="kpi big"><small>${l}</small><b data-k="${i}">0</b><span class="sub2">${sub}</span>${b}</div>`;
  el.innerHTML=`<div class="an-head"><div><h2>Welcome, ${esc(name)}</h2><p class="muted">${greet}. Here is Nordic Interface right now.</p></div>
  <div class="qa"><a class="btn" href="#customers">New customer</a><a class="btn" href="#invoices">New invoice</a><a class="btn" href="#tasks">New task</a><a class="btn primary" href="#sales">Open pipeline</a></div></div>
  <div class="kpis k3">${k('Total sales this month',0,`Incl. VAT. ${F.inv.length} invoice${F.inv.length===1?'':'s'} sent or paid`,badge(F.total,P.total))}
  ${k('New customers this month',1,'Customers won in the period',badge(newC,newP))}
  ${k('Revenue this month',2,`Excl. VAT. Of which paid: ${dkk(paid/100)}`,badge(F.rev,P.rev))}</div>
  <div class="an-row" style="grid-template-columns:2fr 1fr">
   <div class="an-card"><h4>Revenue this month vs last month</h4><p class="sub">Cumulative, excl. VAT</p><div style="height:280px"><canvas id="c1"></canvas></div></div>
   <div class="an-card"><h4>Needs attention</h4><p class="sub">Money and pipeline</p>
    ${row('Outstanding payments',overdue.length?`${overdue.length} overdue`:'None overdue',`<b>${dkk(F.outstanding/100)}</b>`)}
    ${row('Overdue invoices','Past due date',`<b class="${overdue.length?'neg':''}">${dkk(ovAmt/100)}</b>`)}
    ${row('Open leads','In the pipeline',`<b>${open.length}</b>`)}
    ${row('Pipeline value','Potential deals',`<b>${kr(pipe)}</b>`)}
    ${row('VAT payable (month)','Collected minus paid',`<b>${dkk((F.vatOut-F.vatIn)/100)}</b>`)}</div></div>
  <div class="an-row" style="grid-template-columns:repeat(3,1fr)">
   <div class="an-card"><h4>Upcoming tasks</h4><p class="sub">Open, by deadline</p>${tk.data.length?tk.data.map(x=>row(esc(x.title),esc(x.customers?.company_name||'No customer'),`<span class="${x.due_date&&x.due_date<T?'neg':''}">${x.due_date||'No date'}</span>`)).join(''):'<p class="muted">No open tasks.</p>'}<a href="#tasks" class="more">All tasks</a></div>
   <div class="an-card"><h4>Upcoming events</h4><p class="sub">Next in your calendar</p>${ev.data.length?ev.data.map(x=>row(esc(x.title),x.event_time?x.event_time.slice(0,5):'All day',x.event_date)).join(''):'<p class="muted">Nothing scheduled.</p>'}<a href="#calendar" class="more">Open calendar</a></div>
   <div class="an-card"><h4>Latest invoices</h4><p class="sub">Most recently created</p>${last.data.length?last.data.map(x=>{const s=x.status==='sent'&&x.due_date<T?'overdue':x.status;return row(x.number,esc(x.customers.company_name),`<span class="tag s-${s}">${LBL[s]}</span>`)}).join(''):'<p class="muted">No invoices yet.</p>'}<a href="#invoices" class="more">All invoices</a></div></div>
  <div class="an-row" style="grid-template-columns:1fr 1fr">
   <div class="an-card"><h4>Latest customers</h4><p class="sub">Newest first</p>${C.slice(0,6).length?C.slice(0,6).map(x=>row(esc(x.company_name),x.created_at.slice(0,10),`<span class="tag s-${x.status}">${x.status}</span>`)).join(''):'<p class="muted">No customers yet.</p>'}<a href="#customers" class="more">All customers</a></div>
   <div class="an-card"><h4>Sales pipeline</h4><p class="sub">Leads by stage</p>${Object.entries(ST).map(([s,n])=>{const c=C.filter(x=>x.status===s).length;return `<div class="fn"><span>${n}</span><div class="tr"><i data-w="${open.length?c/open.length*100:0}"></i></div><b>${c}</b></div>`}).join('')}<a href="#sales" class="more">Open pipeline</a></div></div>`;
  const vals=[[F.total/100,dkk],[newC,x=>Math.round(x)],[F.rev/100,dkk]];
  vals.forEach(([v,fm],i)=>up(el.querySelector(`[data-k="${i}"]`),v,fm));
  const cs=getComputedStyle(document.body),V=n=>cs.getPropertyValue(n).trim();
  Chart.defaults.font.family='Inter,system-ui,sans-serif';Chart.defaults.color=V('--mu')||'#747984';
  const grad=ctx=>{const a=ctx.chart.chartArea;if(!a)return'#3B5BDB22';const g=ctx.chart.ctx.createLinearGradient(0,a.top,0,a.bottom);g.addColorStop(0,'#3B5BDB66');g.addColorStop(1,'#3B5BDB00');return g};
  const labels=Array.from({length:dim},(_,i)=>i+1);
  new Chart(el.querySelector('#c1'),{type:'line',data:{labels,datasets:[{label:'This month',data:cur,borderColor:'#3B5BDB',backgroundColor:grad,fill:true,tension:.35,borderWidth:2.5,pointRadius:0,pointHoverRadius:6,spanGaps:false},{label:'Last month',data:prv,borderColor:'#9AA1B2',borderDash:[6,5],tension:.35,borderWidth:2,pointRadius:0,pointHoverRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:1100,easing:'easeOutQuart'},interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:18}},tooltip:{backgroundColor:V('--card')||'#fff',titleColor:V('--tx'),bodyColor:V('--mu'),borderColor:V('--bd'),borderWidth:1,padding:12,cornerRadius:10,usePointStyle:true,callbacks:{title:c=>'Day '+c[0].label,label:c=>` ${c.dataset.label}: ${dkk(c.parsed.y)}`}}},
    scales:{x:{grid:{display:false},border:{display:false}},y:{beginAtZero:true,border:{display:false},grid:{color:V('--bd')},ticks:{callback:v=>v>=1000?v/1000+'k':v}}}}});
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll('.fn i').forEach(i=>i.style.width=i.dataset.w+'%')));
}