import { sb, esc, toast, log } from './db.js';
import { modal, nn, opts, iso } from './util.js';
const K={meeting:['Customer meeting','#14213D'],follow_up:['Follow-up','#C9792B'],deadline:['Deadline','#B4474A'],internal:['Internal','#2F7D5B']};
let me,el,view='month',cur=new Date();
export async function render(e,u){me=u;el=e;await draw()}
async function draw(){
  const y=cur.getFullYear(),o=cur.getMonth(),d=cur.getDate(),w=(cur.getDay()+6)%7;let s,n,title;
  if(view==='month'){s=new Date(y,o,1-(new Date(y,o,1).getDay()+6)%7);n=42;title=cur.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}
  else if(view==='week'){s=new Date(y,o,d-w);n=7;title='Week of '+iso(s)}
  else{s=new Date(y,o,d);n=1;title=cur.toLocaleDateString('en-GB',{dateStyle:'full'})}
  const f=iso(s),t=iso(new Date(s.getFullYear(),s.getMonth(),s.getDate()+n-1));
  const [ev,tk]=await Promise.all([sb.from('calendar_events').select('*').gte('event_date',f).lte('event_date',t).order('event_time'),sb.from('tasks').select('id,title,due_date').eq('status','open').gte('due_date',f).lte('due_date',t)]);
  if(ev.error)throw ev.error;
  const cells=Array.from({length:n},(_,i)=>{const dt=new Date(s.getFullYear(),s.getMonth(),s.getDate()+i),k=iso(dt);
    return `<div class="cd ${view==='month'&&dt.getMonth()!==o?'dim':''} ${k===iso(new Date())?'td':''}" data-d="${k}"><small>${dt.getDate()}</small>
    ${ev.data.filter(x=>x.event_date===k).map(x=>`<div class="ev" style="background:${K[x.kind][1]}" data-e="${x.id}">${x.event_time?x.event_time.slice(0,5)+' ':''}${esc(x.title)}</div>`).join('')}
    ${(tk.data||[]).filter(x=>x.due_date===k).map(x=>`<div class="ev tk">Task: ${esc(x.title)}</div>`).join('')}</div>`}).join('');
  el.innerHTML=`<div class="bar"><h2>${title}</h2><button class="btn" id="pv">‹</button><button class="btn" id="tdy">Today</button><button class="btn" id="nx">›</button>
  <select id="vw">${['month','week','day'].map(v=>`<option ${view===v?'selected':''}>${v}</option>`).join('')}</select><button class="btn primary" id="new">New event</button></div>
  <p class="muted">${Object.values(K).map(([l,c])=>`<span style="color:${c}">■</span> ${l}`).join(' &nbsp; ')} &nbsp; Dashed = task deadline</p>
  <div class="cal ${view==='day'?'day':''}">${view==='day'?'':['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<h6>${x}</h6>`).join('')}${cells}</div>`;
  const step=k=>{view==='month'?cur=new Date(y,o+k,1):cur=new Date(y,o,d+k*(view==='week'?7:1));draw()};
  el.querySelector('#pv').onclick=()=>step(-1);el.querySelector('#nx').onclick=()=>step(1);el.querySelector('#tdy').onclick=()=>{cur=new Date();draw()};
  el.querySelector('#vw').onchange=e=>{view=e.target.value;draw()};
  el.querySelector('#new').onclick=()=>form({event_date:iso(new Date()),kind:'meeting'});
  el.querySelectorAll('.cd').forEach(c=>c.onclick=e=>{const id=e.target.dataset.e;id?form(ev.data.find(x=>x.id===id)):e.target.classList.contains('tk')||form({event_date:c.dataset.d,kind:'meeting'})});
}
async function form(v){
  const [c,t]=await Promise.all([opts('customers','company_name'),opts('tasks','title',q=>q.eq('status','open'))]);
  modal(v.id?'Edit event':'New event',[['title','Title'],['event_date','Date','date'],['event_time','Time','time'],['kind','Type','select',Object.entries(K).map(([k,x])=>[k,x[0]])],['customer_id','Customer','select',c],['task_id','Task','select',t],['notes','Notes','textarea']],v,async x=>{
    if(!x.title.trim())return toast('Title is required',1)&&false;
    const row=nn({...x,company_id:me.company_id}),r=v.id?await sb.from('calendar_events').update(row).eq('id',v.id):await sb.from('calendar_events').insert(row);
    if(r.error){toast(r.error.message,1);return false}draw()},
    v.id?async()=>{await sb.from('calendar_events').delete().eq('id',v.id);draw()}:null);
}