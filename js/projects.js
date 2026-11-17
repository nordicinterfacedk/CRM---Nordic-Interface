import { sb, esc, kr, toast, log } from './db.js';
import { modal, nn, opts } from './util.js';
const ST=[['not_started','Not Started'],['planning','Planning'],['in_progress','In Progress'],['review','Review'],['completed','Completed'],['on_hold','On Hold']];
let me,el;
export async function render(e,u){me=u;el=e;await draw()}
async function draw(){
  const {data,error}=await sb.from('projects').select('*,customers(company_name),profiles(full_name),tasks(status)').order('created_at',{ascending:false});if(error)throw error;
  el.innerHTML=`<div class="bar"><h2>Projects</h2><button class="btn primary" id="new">New project</button></div>
  ${data.length?`<table><tr><th>Project</th><th>Customer</th><th>Status</th><th>Progress</th><th>Deadline</th><th>Budget</th><th>Assigned</th><th></th></tr>${data.map(p=>{const n=p.tasks.length,d=p.tasks.filter(t=>t.status==='done').length,pc=n?Math.round(d/n*100):(p.status==='completed'?100:0);
  return `<tr><td>${esc(p.name)}<br><small>${esc(p.description)}</small></td><td>${esc(p.customers?.company_name)}</td><td><span class="tag">${ST.find(s=>s[0]===p.status)[1]}</span></td><td><div class="pb"><i style="width:${pc}%"></i></div><small>${pc}% (${d}/${n} tasks)</small></td><td>${p.deadline||'–'}</td><td>${kr(p.budget_ore)}</td><td>${esc(p.profiles?.full_name)}</td><td><button class="btn" data-e="${p.id}">Edit</button></td></tr>`}).join('')}</table>`:'<p class="muted">No projects yet. Link tasks to a project from the Tasks page to track progress.</p>'}`;
  el.querySelector('#new').onclick=()=>form({status:'not_started'});
  el.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>form(data.find(p=>p.id===b.dataset.e)));
}
async function form(p){
  const [c,u]=await Promise.all([opts('customers','company_name'),opts('profiles','full_name')]);
  modal(p.id?'Edit project':'New project',[['name','Project name'],['customer_id','Customer','select',c],['description','Description','textarea'],['status','Status','select',ST],['start_date','Start date','date'],['deadline','Deadline','date'],['budget','Budget (DKK)','number'],['assigned_to','Assigned to','select',u],['notes','Notes','textarea']],{...p,budget:(p.budget_ore||0)/100},async v=>{
    if(!v.name.trim())return toast('Name is required',1)&&false;
    const {budget,...r}=v,row=nn({...r,budget_ore:Math.round((+budget||0)*100),company_id:me.company_id}),res=p.id?await sb.from('projects').update(row).eq('id',p.id):await sb.from('projects').insert(row);
    if(res.error){toast(res.error.message,1);return false}await log(me,(p.id?'Project updated: ':'Project created: ')+v.name,'project');draw()},
    p.id?async()=>{await sb.from('projects').delete().eq('id',p.id);draw()}:null);
}