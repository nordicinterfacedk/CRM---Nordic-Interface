import { sb } from './db.js';
const f=document.getElementById('f'),err=document.getElementById('err'),btn=document.getElementById('go');
document.getElementById('eye').onclick=()=>{const p=document.getElementById('pw');p.type=p.type==='password'?'text':'password'};
sb.auth.getSession().then(({data})=>{if(data.session)location.replace('index.html')});
f.onsubmit=async e=>{e.preventDefault();err.textContent='';btn.disabled=true;btn.classList.add('load');
  const {data:email}=await sb.rpc('email_for_username',{u:f.user.value.trim()});
  const {error}=email?await sb.auth.signInWithPassword({email,password:f.pw.value}):{error:true};
  if(error){err.textContent='Wrong username or password.';btn.disabled=false;btn.classList.remove('load');return}
  location.replace('index.html')};