import { sb, esc, kr, toast, log } from './db.js';
import { modal, nn, today } from './util.js';
const COLS=[['lead','New Lead',10],['contacted','Contacted',20],['interested','Interested',40],['meeting','Meeting',50],['negotiation','Negotiation',70],['customer','Won',100],['lost','Lost',0]];
let me,el;
export async function render(e,u){me=u;el=e;await draw()}
async function draw(){
  const {data,error}=await sb.from('customers').select('*').in('status',COLS.map(c=>c[0]));if(error)throw error;
  const open=data.filter(r=>['lead','contacted','interested','meeting','negotiation'].includes(r.status)),won=data.filter(r=>r.status==='customer').length,lost=data.filter(r=>r.status==='lost').length;
  const pipe=open.reduce((s,r)=>s+r.deal_value_ore,0),exp=Math.round(open.reduce((s,r)=>s+r.deal_value_ore*COLS.find(c=>c[0]===r.status)[2]/100,0));
  const src={};data.forEach(r=>{const k=r.lead_source||'Unknown';src[k]=(src[k]||0)+1});
  const card=(l,v)=>`<div class="stat"><small>${l}</small><b>${v}</b></div>`;
  el.innerHTML=`<div class="bar"><h2>Sales & Leads</h2><button class="btn primary" id="new">New lead</button></div>
  <div class="stats">${card('Pipeline value',kr(pipe))}${card('Expected revenue',kr(exp))}${card('Open leads',open.length)}${card('Conversion rate',won+lost?Math.round(won/(won+lost)*100)+'%':'–')}</div>
  <div class="board">${COLS.map(([s,l])=>{const cs=data.filter(r=>r.status===s);return `<div class="col" data-s="${s}"><h4>${l}<small>${cs.length}</small></h4>${cs.map(r=>`<div class="kc ${r.next_follow_up&&r.next_follow_up<today()&&!['customer','lost'].includes(s)?'late':''}" draggable="true" data-id="${r.id}"><b>${esc(r.company_name)}</b><small>${esc(r.contact_person)}</small><small>${kr(r.deal_value_ore)}</small><small>Last contact: ${r.last_contacted||'–'}</small><small class="fu">Follow-up: ${r.next_follow_up||'–'}</small>${s==='customer'?`<button class="btn" style="margin-top:6px" data-conv="${r.id}">Convert to customer</button>`:''}</div>`).join('')}</div>`}).join('')}</div>
  <p class="muted">Lead sources: ${Object.entries(src).map(([k,v])=>`${esc(k)} (${v})`).join(', ')||'none yet'}</p>`;
  const mv=async(id,s)=>{const {error}=await sb.from('customers').update({status:s}).eq('id',id);if(error)return toast(error.message,1);await log(me,'Lead status changed to '+s,'customer',id);draw()};
  el.querySelectorAll('.kc').forEach(c=>c.ondragstart=e=>e.dataTransfer.setData('text',c.dataset.id));
  el.querySelectorAll('.col').forEach(c=>{c.ondragover=e=>{e.preventDefault();c.classList.add('over')};c.ondragleave=()=>c.classList.remove('over');c.ondrop=e=>{e.preventDefault();mv(e.dataTransfer.getData('text'),c.dataset.s)}});
  el.querySelectorAll('[data-conv]').forEach(b=>b.onclick=async()=>{await mv(b.dataset.conv,'active');toast('Converted to active customer')});
  el.querySelector('#new').onclick=()=>modal('New lead',[['company_name','Company name'],['contact_person','Contact person'],['email','Email','email'],['phone','Phone','tel'],['deal','Potential deal value (DKK)','number'],['lead_source','Lead source'],['next_follow_up','Next follow-up','date']],{},async v=>{
    if(!v.company_name.trim())return toast('Company name is required',1)&&false;
    const {deal,...r}=v;const {data:d,error}=await sb.from('customers').insert(nn({...r,deal_value_ore:Math.round((+deal||0)*100),status:'lead',company_id:me.company_id})).select().single();
    if(error){toast(error.message,1);return false}await log(me,'Customer created','customer',d.id);draw()});
}