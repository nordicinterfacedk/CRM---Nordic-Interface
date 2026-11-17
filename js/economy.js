import { sb, esc, toast, log } from './db.js';
import { m, range, PERIODS, finance, months, modal, today } from './util.js';
const CAT=['Hosting','Domains','Software','Marketing','Advertising','Equipment','Other'].map(c=>[c,c]);
let me,el,p='month',a='',b='';
export async function render(e,u){me=u;el=e;await draw()}
async function draw(){
  const [f,t]=p==='custom'&&(!a||!b)?range('month'):range(p,a,b);
  const [F,c]=await Promise.all([finance(f,t),sb.from('customers').select('mrr_ore').eq('status','active')]);
  const mrr=(c.data||[]).reduce((s,r)=>s+(r.mrr_ore||0),0);
  const card=(l,v,s='',cl='')=>`<div class="stat"><small>${l}</small><b class="${cl}">${v}</b><small>${s}</small></div>`;
  const profit=F.rev-F.expNet;
  el.innerHTML=`<div class="bar"><h2>Economy</h2><select id="p">${PERIODS.map(([k,v])=>`<option value="${k}" ${p===k?'selected':''}>${v}</option>`).join('')}</select>${p==='custom'?`<input type="date" id="a" value="${a}"><input type="date" id="b" value="${b}">`:''}<button class="btn primary" id="new">Register expense</button></div>
  <p class="muted">${f} to ${t}. Sent and paid invoices count as sales (by invoice date). Draft and cancelled do not. This is a management overview, not tax reporting.</p>
  <div class="stats">${card('Sales excl. VAT',m(F.rev)+' DKK','Incl. VAT: '+m(F.total))}${card('VAT collected',m(F.vatOut)+' DKK')}${card('VAT paid (expenses)',m(F.vatIn)+' DKK')}${card('Estimated VAT payable',m(F.vatOut-F.vatIn)+' DKK')}${card('Expenses excl. VAT',m(F.expNet)+' DKK','Incl. VAT: '+m(F.expTotal))}${card('Profit excl. VAT',m(profit)+' DKK','',profit<0?'neg':'pos')}${card('Outstanding payments',m(F.outstanding)+' DKK','All unpaid sent invoices')}${card('Monthly recurring revenue',m(mrr)+' DKK')}</div>
  <div class="box" style="margin-bottom:16px"><div class="ch" style="height:300px"><canvas id="c1"></canvas></div></div><h3>Expenses</h3>
  ${F.exp.length?`<table><tr><th>Date</th><th>Name</th><th>Category</th><th>Excl. VAT</th><th>VAT</th><th>Total</th><th>Supplier</th><th></th></tr>${F.exp.map(x=>`<tr><td>${x.date}</td><td>${esc(x.name)}</td><td>${esc(x.category)}</td><td>${m(x.amount_ore)}</td><td>${m(x.vat_ore)} (${x.vat_percent}%)</td><td>${m(x.total_ore)}</td><td>${esc(x.supplier)}</td><td><button class="btn" data-id="${x.id}">Delete</button></td></tr>`).join('')}</table>`:'<p class="muted">No expenses in this period.</p>'}`;
  const ms=months(f,t),sumBy=(arr,k,v)=>ms.map(x=>arr.filter(r=>r[k].slice(0,7)===x).reduce((s,r)=>s+r[v],0)/100);
  new Chart(el.querySelector('#c1'),{type:'bar',data:{labels:ms,datasets:[{label:'Sales excl. VAT',data:sumBy(F.inv.map(r=>({d:r.issue_date,v:r.t.net})),'d','v'),backgroundColor:'#2B4C9B',borderRadius:6},{label:'Expenses excl. VAT',data:sumBy(F.exp,'date','amount_ore'),backgroundColor:'#E08A3C',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:700}}});
  el.querySelector('#p').onchange=e=>{p=e.target.value;draw()};
  if(p==='custom'){el.querySelector('#a').onchange=e=>{a=e.target.value;draw()};el.querySelector('#b').onchange=e=>{b=e.target.value;draw()}}
  el.querySelector('#new').onclick=()=>modal('Register expense',[['name','Expense name'],['category','Category','select',CAT],['amount','Amount excl. VAT (DKK)','number'],['vat_percent','VAT %','number'],['date','Date','date'],['supplier','Supplier'],['notes','Notes','textarea']],{category:'Hosting',vat_percent:25,date:today()},async v=>{
    const amt=Math.round((+v.amount||0)*100),pc=+v.vat_percent||0,vat=Math.round(amt*pc/100);
    if(!v.name.trim()||amt<=0)return toast('Name and amount are required',1);
    const {error}=await sb.from('expenses').insert({company_id:me.company_id,name:v.name.trim(),category:v.category,amount_ore:amt,vat_percent:pc,vat_ore:vat,total_ore:amt+vat,date:v.date,supplier:v.supplier,notes:v.notes});
    if(error)return toast(error.message,1);await log(me,'Expense registered: '+v.name,'expense');toast('Saved');draw()});
  el.querySelectorAll('[data-id]').forEach(bn=>bn.onclick=async()=>{if(!confirm('Delete expense?'))return;const {error}=await sb.from('expenses').delete().eq('id',bn.dataset.id);error?toast(error.message,1):draw()});
}