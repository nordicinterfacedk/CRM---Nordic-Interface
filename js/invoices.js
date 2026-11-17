import { sb, esc, toast, log } from './db.js';
let CO={name:'Nordic Interface',addr:'Din adresse, København',cvr:'CVR: udfyld',email:'din@email.dk',bank:'Reg.nr./konto: udfyld'};
let PFX='NI';
const m=v=>((v||0)/100).toLocaleString('da-DK',{minimumFractionDigits:2,maximumFractionDigits:2});
const calc=ls=>{let net=0,vat=0;for(const l of ls){const n=Math.round(l.qty*l.unit_price_ore*(1-l.discount_percent/100));l._n=n;net+=n;vat+=l.vat_percent>0?Math.round(n*l.vat_percent/100):0}return{net,vat,total:net+vat}};
const today=()=>new Date().toISOString().slice(0,10);
const eff=i=>i.status==='sent'&&i.due_date<today()?'overdue':i.status;
const LBL={draft:'Draft',sent:'Sent',paid:'Paid',overdue:'Overdue',cancelled:'Cancelled'};
const num=x=>({...x,qty:+x.qty,discount_percent:+x.discount_percent,vat_percent:+x.vat_percent});
let me,el,q='',fs='';
export async function render(e,u){me=u;el=e;await draw()}
async function draw(){
  const {data:cs}=await sb.from('company_settings').select('*').maybeSingle();
  if(cs){CO={name:cs.name||CO.name,addr:cs.address||'',cvr:'CVR: '+(cs.cvr||''),email:cs.email||'',bank:cs.bank||''};PFX=cs.invoice_prefix||'NI'}
  const {data,error}=await sb.from('invoices').select('*,customers(company_name,contact_person,email,address,postal_code,city,cvr),invoice_items(*)').order('created_at',{ascending:false});
  if(error)throw error;
  let rows=data.map(i=>({...i,st:eff(i),items:i.invoice_items.map(num).sort((a,b)=>a.position-b.position)}));
  rows.forEach(r=>r.tot=calc(r.items));
  if(fs)rows=rows.filter(r=>r.st===fs);
  if(q)rows=rows.filter(r=>(r.number+' '+r.customers.company_name).toLowerCase().includes(q.toLowerCase()));
  el.innerHTML=`<div class="bar"><h2>Invoices</h2><input id="q" placeholder="Search" value="${esc(q)}"><select id="fs"><option value="">All statuses</option>${Object.entries(LBL).map(([k,v])=>`<option value="${k}" ${fs===k?'selected':''}>${v}</option>`).join('')}</select><button class="btn primary" id="new">New invoice</button></div>
  ${rows.length?`<table><tr><th>Number</th><th>Customer</th><th>Date</th><th>Due</th><th>Total incl. VAT</th><th>Status</th><th></th></tr>${rows.map(r=>`<tr><td>${r.number}</td><td>${esc(r.customers.company_name)}</td><td>${r.issue_date}</td><td>${r.due_date}</td><td>${m(r.tot.total)} DKK<br><small>excl. VAT ${m(r.tot.net)}</small></td><td><span class="tag s-${r.st}">${LBL[r.st]}</span></td><td class="acts"><button class="btn" data-a="pdf" data-id="${r.id}">PDF</button>
  ${r.st==='draft'?`<button class="btn" data-a="sent" data-id="${r.id}">Mark sent</button> <button class="btn" data-a="del" data-id="${r.id}">Delete</button>`:''}
  ${r.st==='sent'||r.st==='overdue'?`<button class="btn" data-a="paid" data-id="${r.id}">Mark paid</button> <button class="btn" data-a="cancel" data-id="${r.id}">Cancel</button>`:''}</td></tr>`).join('')}</table>`:'<p class="muted">No invoices match. Create an invoice to get started.</p>'}`;
  const qi=el.querySelector('#q');if(q){qi.focus();qi.setSelectionRange(q.length,q.length)}
  let t;qi.oninput=e=>{clearTimeout(t);t=setTimeout(()=>{q=e.target.value.trim();draw()},300)};
  el.querySelector('#fs').onchange=e=>{fs=e.target.value;draw()};
  el.querySelector('#new').onclick=form;
  el.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{
    const r=rows.find(x=>x.id===b.dataset.id),a=b.dataset.a;
    if(a==='pdf')return pdf(r);
    let res;
    if(a==='del'){if(!confirm('Delete this draft?'))return;res=await sb.from('invoices').delete().eq('id',r.id)}
    else{if(a==='cancel'&&!confirm('Cancel this invoice?'))return;
      const st={sent:'sent',paid:'paid',cancel:'cancelled'}[a];
      res=await sb.from('invoices').update({status:st,paid_at:st==='paid'?today():null}).eq('id',r.id)}
    if(res.error)return toast(res.error.message,1);
    await log(me,`Invoice ${r.number}: ${a}`,'invoice',a==='del'?null:r.id);toast('Done');draw()});
}
async function form(){
  const [cu,sv,cnt]=await Promise.all([sb.from('customers').select('id,company_name').order('company_name'),sb.from('services').select('*').eq('active',true).order('name'),sb.from('invoices').select('id',{count:'exact',head:true})]);
  if(!cu.data.length)return toast('Create a customer first',1);
  const number=`${PFX}-${new Date().getFullYear()}-${String((cnt.count||0)+1).padStart(4,'0')}`;
  const due=new Date(Date.now()+14*864e5).toISOString().slice(0,10);
  const blank=()=>({svc:'',description:'',qty:1,unit_price_ore:0,discount_percent:0,vat_percent:25});
  let L=[blank()];
  const d=document.createElement('dialog');d.className='wide';document.body.append(d);
  d.innerHTML=`<form id="f"><h3>New invoice ${number}</h3><div class="g2">
  <label>Customer<select name="customer_id">${cu.data.map(c=>`<option value="${c.id}">${esc(c.company_name)}</option>`).join('')}</select></label>
  <label>Payment terms<input name="terms" value="Net 14 days"></label>
  <label>Invoice date<input type="date" name="issue_date" value="${today()}"></label><label>Due date<input type="date" name="due_date" value="${due}"></label></div>
  <div id="ls"></div><button type="button" class="btn" id="add">Add line</button><div class="tot" id="tot"></div>
  <label>Notes<textarea name="notes"></textarea></label>
  <div class="row"><button type="button" class="btn" id="x">Cancel</button><button type="button" class="btn" id="sd">Save as draft</button><button type="button" class="btn primary" id="ss">Save and mark sent</button></div></form>`;
  const f=d.querySelector('#f'),ls=d.querySelector('#ls');
  const totals=()=>{const t=calc(L.map(l=>({...l})));d.querySelector('#tot').innerHTML=`Subtotal excl. VAT: ${m(t.net)} DKK<br>VAT: ${m(t.vat)} DKK<br><b>Total incl. VAT: ${m(t.total)} DKK</b>`};
  const paint=()=>{ls.innerHTML=`<table class="lines"><tr><th>Service</th><th>Description</th><th>Qty</th><th>Price DKK</th><th>Disc. %</th><th>VAT %</th><th></th></tr>${L.map((l,i)=>`<tr>
  <td><select data-i="${i}" data-k="svc"><option value="">Custom</option>${sv.data.map(s=>`<option value="${s.id}" ${l.svc===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></td>
  <td><input data-i="${i}" data-k="description" value="${esc(l.description)}"></td>
  <td><input type="number" step="any" min="0" style="width:60px" data-i="${i}" data-k="qty" value="${l.qty}"></td>
  <td><input type="number" step="any" min="0" style="width:90px" data-i="${i}" data-k="price" value="${l.unit_price_ore/100}"></td>
  <td><input type="number" step="any" min="0" max="100" style="width:60px" data-i="${i}" data-k="discount_percent" value="${l.discount_percent}"></td>
  <td><input type="number" step="any" min="0" style="width:60px" data-i="${i}" data-k="vat_percent" value="${l.vat_percent}"></td>
  <td><button type="button" class="btn" data-x="${i}">×</button></td></tr>`).join('')}</table>`;totals()};
  ls.oninput=e=>{const t=e.target,l=L[+t.dataset.i],k=t.dataset.k;if(!k||k==='svc')return;
    if(k==='description')l.description=t.value;else if(k==='price')l.unit_price_ore=Math.round((+t.value||0)*100);else l[k]=+t.value||0;totals()};
  ls.onchange=e=>{const t=e.target;if(t.dataset.k!=='svc')return;const l=L[+t.dataset.i],s=sv.data.find(x=>x.id===t.value);
    l.svc=t.value;if(s){l.description=s.name;l.unit_price_ore=s.price_ore;l.vat_percent=s.vat_enabled?+s.vat_percent:0}paint()};
  ls.onclick=e=>{const x=e.target.dataset.x;if(x===undefined)return;L.splice(+x,1);if(!L.length)L=[blank()];paint()};
  d.querySelector('#add').onclick=()=>{L.push(blank());paint()};
  d.querySelector('#x').onclick=()=>d.remove();
  const save=async status=>{
    const v=Object.fromEntries(new FormData(f)),lines=L.filter(l=>l.description.trim());
    if(!lines.length)return toast('Add at least one line with a description',1);
    if(v.due_date<v.issue_date)return toast('Due date cannot be before invoice date',1);
    const {data:inv,error}=await sb.from('invoices').insert({company_id:me.company_id,customer_id:v.customer_id,number,issue_date:v.issue_date,due_date:v.due_date,terms:v.terms,notes:v.notes,status}).select().single();
    if(error)return toast(error.message,1);
    const {error:e2}=await sb.from('invoice_items').insert(lines.map((l,i)=>({invoice_id:inv.id,company_id:me.company_id,position:i,description:l.description,qty:l.qty,unit_price_ore:l.unit_price_ore,discount_percent:l.discount_percent,vat_percent:l.vat_percent,vat_enabled:l.vat_percent>0})));
    if(e2){await sb.from('invoices').delete().eq('id',inv.id);return toast(e2.message,1)}
    await log(me,`Invoice ${number} created`,'invoice',inv.id);toast('Invoice saved');d.remove();draw()};
  d.querySelector('#sd').onclick=()=>save('draft');d.querySelector('#ss').onclick=()=>save('sent');
  f.onsubmit=e=>e.preventDefault();paint();d.showModal();
}
function pdf(r){
  const {jsPDF}=window.jspdf,p=new jsPDF({unit:'mm',format:'a4'}),c=r.customers;
  p.setFillColor(20,33,61);p.rect(0,0,210,5,'F');
  p.setFont('helvetica','bold').setFontSize(18).setTextColor(23,25,29).text(CO.name,20,24);
  p.setFont('helvetica','normal').setFontSize(9).setTextColor(116,121,132).text([CO.addr,CO.cvr,CO.email],20,30);
  p.setFont('helvetica','bold').setFontSize(22).setTextColor(20,33,61).text('FAKTURA',190,24,{align:'right'});
  p.setFont('helvetica','normal').setFontSize(9).setTextColor(116,121,132).text([`Fakturanr.: ${r.number}`,`Dato: ${r.issue_date}`,`Forfaldsdato: ${r.due_date}`],190,31,{align:'right'});
  p.setTextColor(23,25,29).setFont('helvetica','bold').text('Faktureres til',20,58);
  p.setFont('helvetica','normal').text([c.company_name,c.contact_person||'',c.address||'',`${c.postal_code||''} ${c.city||''}`.trim(),c.cvr?`CVR: ${c.cvr}`:''].filter(Boolean),20,64);
  let y=95;
  const head=()=>{p.setFillColor(247,248,250).rect(20,y-5,170,8,'F');p.setFont('helvetica','bold').setFontSize(8).setTextColor(116,121,132);
    p.text('Beskrivelse',22,y);p.text('Antal',108,y,{align:'right'});p.text('Pris',128,y,{align:'right'});p.text('Rabat',146,y,{align:'right'});p.text('Moms',163,y,{align:'right'});p.text('Beløb',188,y,{align:'right'});y+=9};
  head();p.setFont('helvetica','normal').setFontSize(9).setTextColor(23,25,29);
  for(const l of r.items){const w=p.splitTextToSize(l.description,78);if(y>245){p.addPage();y=25;head();p.setFont('helvetica','normal').setFontSize(9).setTextColor(23,25,29)}
    p.text(w,22,y);p.text(String(l.qty),108,y,{align:'right'});p.text(m(l.unit_price_ore),128,y,{align:'right'});p.text(l.discount_percent?l.discount_percent+'%':'-',146,y,{align:'right'});p.text(l.vat_percent?l.vat_percent+'%':'0%',163,y,{align:'right'});p.text(m(l._n),188,y,{align:'right'});
    y+=Math.max(w.length*4.5,6)+3;p.setDrawColor(232,234,238).line(20,y-4,190,y-4)}
  if(y>225){p.addPage();y=25}
  y+=6;const row=(a,b,bold)=>{p.setFont('helvetica',bold?'bold':'normal').setFontSize(bold?11:9).text(a,130,y);p.text(b,190,y,{align:'right'});y+=bold?0:6};
  row('Subtotal ekskl. moms',m(r.tot.net)+' DKK');row('Moms i alt',m(r.tot.vat)+' DKK');p.setDrawColor(20,33,61).line(130,y-3,190,y-3);y+=3;row('Total inkl. moms',m(r.tot.total)+' DKK',true);
  y+=14;p.setFont('helvetica','bold').setFontSize(9).text('Betaling',20,y);p.setFont('helvetica','normal');
  p.text([`Betalingsbetingelser: ${r.terms||''}`,`Forfaldsdato: ${r.due_date}`,CO.bank,`Angiv fakturanr. ${r.number} ved betaling.`,...(r.notes?['',r.notes]:[])],20,y+6);
  p.save(`${r.number}.pdf`);
}