import { sb, esc, kr, toast, log } from './db.js';
const ST={lead:'Lead',contacted:'Contacted',interested:'Interested',meeting:'Meeting Scheduled',negotiation:'Negotiation',customer:'Customer',active:'Active Customer',inactive:'Inactive Customer',lost:'Lost'};
const EXTRA={lead:[['deal','Potential deal value (DKK)','number'],['lead_source','Lead source'],['interest','Interest level'],['next_follow_up','Next follow-up','date']],active:[['deal','Contract value (DKK)','number'],['mrr','Monthly recurring revenue (DKK)','number'],['last_contacted','Start date','date']],lost:[['lost_reason','Reason for losing the deal'],['competitor','Competitor'],['deal','Potential deal value (DKK)','number']]};
const extra=s=>EXTRA[s]||(['contacted','interested','meeting','negotiation'].includes(s)?EXTRA.lead:s==='customer'?EXTRA.active:[]);
let me,el,q='',fs='';
export async function render(e,m){me=m;el=e;await draw()}
async function draw(){
  let qb=sb.from('customers').select('*').order('created_at',{ascending:false});
  if(fs)qb=qb.eq('status',fs);if(q)qb=qb.or(`company_name.ilike.%${q}%,contact_person.ilike.%${q}%,email.ilike.%${q}%`);
  const {data,error}=await qb;if(error)throw error;
  el.innerHTML=`<div class="bar"><h2>Customers</h2><input id="q" placeholder="Search" value="${esc(q)}"><select id="fs"><option value="">All statuses</option>${Object.entries(ST).map(([k,v])=>`<option value="${k}" ${fs===k?'selected':''}>${v}</option>`).join('')}</select><button class="btn primary" id="new">New customer</button></div>
  ${data.length?`<table><tr><th>Company</th><th>Contact</th><th>Status</th><th>Value</th><th></th></tr>${data.map(r=>`<tr><td>${esc(r.company_name)}</td><td>${esc(r.contact_person)}<br><small>${esc(r.email)}</small></td><td><span class="tag s-${r.status}">${ST[r.status]}</span></td><td>${kr(r.deal_value_ore)}</td><td><button class="btn" data-e="${r.id}">Edit</button> <button class="btn" data-d="${r.id}">Delete</button></td></tr>`).join('')}</table>`:'<p class="muted">No customers match. Create one to get started.</p>'}`;
  const qi=el.querySelector('#q');if(q){qi.focus();qi.setSelectionRange(q.length,q.length)}
  let t;qi.oninput=e=>{clearTimeout(t);t=setTimeout(()=>{q=e.target.value.trim();draw()},300)};
  el.querySelector('#fs').onchange=e=>{fs=e.target.value;draw()};
  el.querySelector('#new').onclick=()=>form({status:'lead'});
  el.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>form(data.find(r=>r.id===b.dataset.e)));
  el.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this customer?'))return;const {error}=await sb.from('customers').delete().eq('id',b.dataset.d);error?toast(error.message,1):(await log(me,'Customer deleted','customer',null),toast('Deleted'),draw())});
}
function form(r){
  const d=document.createElement('dialog');document.body.append(d);
  const inp=(n,l,t='text',v='')=>`<label>${l}<input name="${n}" type="${t}" value="${esc(v)}"></label>`;
  const paint=s=>{const ex=extra(s);d.innerHTML=`<form><h3>${r.id?'Edit':'New'} customer</h3>
   <label>Status<select name="status">${Object.entries(ST).map(([k,v])=>`<option value="${k}" ${s===k?'selected':''}>${v}</option>`).join('')}</select></label>
   ${inp('company_name','Company name','text',r.company_name)}${inp('contact_person','Contact person','text',r.contact_person)}${inp('email','Email','email',r.email)}${inp('phone','Phone','tel',r.phone)}${inp('website','Website','text',r.website)}
   ${ex.map(([n,l,t])=>inp(n,l,t||'text',n==='deal'?(r.deal_value_ore||0)/100:n==='mrr'?(r.mrr_ore||0)/100:r[n]||'')).join('')}
   <label>Notes<textarea name="notes">${esc(r.notes)}</textarea></label><div class="row"><button type="button" class="btn" id="x">Cancel</button><button class="btn primary">Save customer</button></div></form>`;
   const f=d.querySelector('form');f.status.onchange=e=>{const v=Object.fromEntries(new FormData(f));r={...r,...v,id:r.id};paint(e.target.value)};
   d.querySelector('#x').onclick=()=>d.remove();
   f.onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(f));
     const row={company_id:me.company_id,company_name:v.company_name.trim(),contact_person:v.contact_person,email:v.email,phone:v.phone,website:v.website,status:v.status,notes:v.notes,
       deal_value_ore:Math.round((+v.deal||0)*100),mrr_ore:Math.round((+v.mrr||0)*100),lead_source:v.lead_source||null,interest:v.interest||null,next_follow_up:v.next_follow_up||null,lost_reason:v.lost_reason||null,competitor:v.competitor||null,last_contacted:v.last_contacted||null};
     const res=r.id?await sb.from('customers').update(row).eq('id',r.id).select().single():await sb.from('customers').insert(row).select().single();
     if(res.error)return toast(res.error.message,1);await log(me,r.id?'Customer updated':'Customer created','customer',res.data.id);toast('Saved');d.remove();draw()}};
  paint(r.status);d.showModal();
}