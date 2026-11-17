import { sb, esc, toast, log } from './db.js';
import { modal, nn, opts, today } from './util.js';
const PR=[['low','Low'],['normal','Normal'],['high','High'],['urgent','Urgent']];
let me,el,tab='open';
export async function render(e,u){me=u;el=e;await draw()}
async function draw(){
  const {data,error}=await sb.from('tasks').select('*,customers(company_name),profiles(full_name),projects(name)').order('due_date',{nullsFirst:false});if(error)throw error;
  const T=today(),isO=t=>t.status==='open'&&t.due_date&&t.due_date<T;
  const F={open:t=>t.status==='open'&&!isO(t),overdue:isO,done:t=>t.status==='done'},rows=data.filter(F[tab]);
  el.innerHTML=`<div class="bar"><h2>Tasks</h2><button class="btn primary" id="new">New task</button></div>
  <div class="tabs">${[['open','Upcoming'],['overdue','Overdue'],['done','Completed']].map(([k,l])=>`<button class="btn ${tab===k?'on':''}" data-t="${k}">${l} (${data.filter(F[k]).length})</button>`).join('')}</div>
  ${rows.length?`<table><tr><th></th><th>Task</th><th>Due</th><th>Priority</th><th>Customer</th><th>Assigned</th><th>Project</th><th></th></tr>${rows.map(t=>`<tr><td><input type="checkbox" style="width:auto;margin:0" data-c="${t.id}" ${t.status==='done'?'checked':''}></td><td>${esc(t.title)}<br><small>${esc(t.description)}</small></td><td>${t.due_date||'–'}</td><td class="pri-${t.priority}">${t.priority}</td><td>${esc(t.customers?.company_name)}</td><td>${esc(t.profiles?.full_name)}</td><td>${esc(t.projects?.name)}</td><td><button class="btn" data-e="${t.id}">Edit</button></td></tr>`).join('')}</table>`:'<p class="muted">No tasks here.</p>'}`;
  el.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{tab=b.dataset.t;draw()});
  el.querySelectorAll('[data-c]').forEach(b=>b.onclick=async()=>{const done=b.checked,{error}=await sb.from('tasks').update({status:done?'done':'open',completed_at:done?new Date().toISOString():null}).eq('id',b.dataset.c);if(error)return toast(error.message,1);if(done)await log(me,'Task completed','task',b.dataset.c);draw()});
  el.querySelector('#new').onclick=()=>form({priority:'normal'});
  el.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>form(data.find(t=>t.id===b.dataset.e)));
}
async function form(t){
  const [u,c,p]=await Promise.all([opts('profiles','full_name'),opts('customers','company_name'),opts('projects','name')]);
  modal(t.id?'Edit task':'New task',[['title','Title'],['description','Description','textarea'],['due_date','Deadline','date'],['priority','Priority','select',PR],['assigned_to','Assigned to','select',u],['customer_id','Customer','select',c],['project_id','Project','select',p]],t,async v=>{
    if(!v.title.trim())return toast('Title is required',1);
    const row=nn({...v,company_id:me.company_id}),r=t.id?await sb.from('tasks').update(row).eq('id',t.id):await sb.from('tasks').insert(row);
    if(r.error)return toast(r.error.message,1);draw()},
    t.id?async()=>{await sb.from('tasks').delete().eq('id',t.id);draw()}:null);
}