import { sb } from './db.js';
import { applyTheme } from './util.js'; applyTheme();
const routes={dashboard:['Dashboard','layout-dashboard'],customers:['Customers','users'],sales:['Sales & Leads','kanban'],invoices:['Invoices','file-text'],services:['Services','package'],economy:['Economy','landmark'],tasks:['Tasks','check-square'],calendar:['Calendar','calendar'],projects:['Projects','folder-kanban'],analytics:['Analytics','bar-chart-3'],settings:['Settings','settings']};
const groups={MAIN:['dashboard','customers','sales','invoices','services','economy'],MANAGEMENT:['tasks','calendar','projects','analytics'],SYSTEM:['settings']};
const {data:{session}}=await sb.auth.getSession();
if(!session)location.replace('login.html');
const {data:me}=await sb.from('profiles').select('*').eq('id',session.user.id).single();
if(!me){await sb.auth.signOut();location.replace('login.html')}
document.getElementById('meName').textContent=me.full_name;document.getElementById('meRole').textContent=me.role;
document.getElementById('nav').innerHTML=Object.entries(groups).map(([g,k])=>`<h6>${g}</h6>`+k.map(r=>`<a href="#${r}" data-r="${r}"><i data-lucide="${routes[r][1]}"></i><span>${routes[r][0]}</span></a>`).join('')).join('');
document.getElementById('col').onclick=()=>{document.body.classList.toggle('mini');localStorage.setItem('mini',document.body.classList.contains('mini')?1:'')};
if(localStorage.getItem('mini'))document.body.classList.add('mini');
document.getElementById('out').onclick=async()=>{await sb.auth.signOut();location.replace('login.html')};
const mods={dashboard:'./dashboard.js',customers:'./customers.js',services:'./services.js',invoices:'./invoices.js',economy:'./economy.js',sales:'./sales.js',tasks:'./tasks.js',calendar:'./calendar.js',projects:'./projects.js',analytics:'./analytics.js',settings:'./settings.js'};
async function go(){const r=(location.hash.slice(1)||'dashboard');const el=document.getElementById('view');
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===r));
  el.classList.remove('in');el.innerHTML='<div class="skel"></div>';
  if(mods[r]){try{await(await import(mods[r])).render(el,me)}catch(e){el.innerHTML=`<p class="error">Could not load ${routes[r]?.[0]}: ${e.message}</p>`}}
  else el.innerHTML=`<h2>${routes[r]?.[0]||'Not found'}</h2><p class="muted">This module is built in a later phase.</p>`;
  requestAnimationFrame(()=>el.classList.add('in'));lucide.createIcons()}
addEventListener('hashchange',go);go();