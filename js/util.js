import { sb, esc } from './db.js';
export const m=v=>((v||0)/100).toLocaleString('da-DK',{minimumFractionDigits:2,maximumFractionDigits:2});
export const iso=d=>new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
export const today=()=>iso(new Date());
export const nn=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v===''?null:v]));
export const calc=ls=>{let net=0,vat=0;for(const l of ls){const n=Math.round(l.qty*l.unit_price_ore*(1-l.discount_percent/100));l._n=n;net+=n;vat+=l.vat_percent>0?Math.round(n*l.vat_percent/100):0}return{net,vat,total:net+vat}};
export const items=i=>(i.invoice_items||[]).map(x=>({...x,qty:+x.qty,discount_percent:+x.discount_percent,vat_percent:+x.vat_percent}));
export const PERIODS=[['today','Today'],['week','This week'],['month','This month'],['last','Last month'],['quarter','This quarter'],['year','This year'],['custom','Custom period']];
export function range(k,a,b){const n=new Date(),y=n.getFullYear(),o=n.getMonth(),d=n.getDate(),w=(n.getDay()+6)%7;
  const R={today:[n,n],week:[new Date(y,o,d-w),new Date(y,o,d-w+6)],month:[new Date(y,o,1),new Date(y,o+1,0)],last:[new Date(y,o-1,1),new Date(y,o,0)],quarter:[new Date(y,o-o%3,1),new Date(y,o-o%3+3,0)],year:[new Date(y,0,1),new Date(y,11,31)],l12:[new Date(y,o-11,1),new Date(y,o+1,0)],d30:[new Date(y,o,d-29),n]};
  return k==='custom'?[a,b]:R[k].map(iso)}
export const months=(f,t)=>{const r=[],[y,o]=f.split('-');let d=new Date(+y,+o-1,1);while(iso(d).slice(0,7)<=t.slice(0,7)){r.push(iso(d).slice(0,7));d=new Date(d.getFullYear(),d.getMonth()+1,1)}return r};
export async function finance(f,t){
  const [i,x,o]=await Promise.all([sb.from('invoices').select('*,invoice_items(*)').gte('issue_date',f).lte('issue_date',t).in('status',['sent','paid']),
    sb.from('expenses').select('*').gte('date',f).lte('date',t).order('date',{ascending:false}),
    sb.from('invoices').select('*,invoice_items(*)').eq('status','sent')]);
  const e=i.error||x.error||o.error;if(e)throw e;
  const inv=i.data.map(r=>({...r,t:calc(items(r))})),sum=(a,k)=>a.reduce((s,r)=>s+r[k],0);
  return{inv,exp:x.data,rev:sum(inv.map(r=>r.t),'net'),vatOut:sum(inv.map(r=>r.t),'vat'),total:sum(inv.map(r=>r.t),'total'),
    expNet:sum(x.data,'amount_ore'),vatIn:sum(x.data,'vat_ore'),expTotal:sum(x.data,'total_ore'),outstanding:o.data.reduce((s,r)=>s+calc(items(r)).total,0)}}
export async function opts(table,label,filter){let q=sb.from(table).select('*');if(filter)q=filter(q);const {data}=await q;return [['','—'],...(data||[]).map(r=>[r.id,r[label]])]}
export function modal(title,fields,v,save,del){
  const d=document.createElement('dialog');document.body.append(d);
  const fld=([n,l,t='text',o])=>t==='select'?`<label>${l}<select name="${n}">${o.map(([k,x])=>`<option value="${esc(k)}" ${String(v[n]??'')===String(k)?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`:
    t==='textarea'?`<label>${l}<textarea name="${n}">${esc(v[n])}</textarea></label>`:`<label>${l}<input name="${n}" type="${t}" ${t==='number'?'step="any"':''} value="${esc(v[n])}"></label>`;
  d.innerHTML=`<form><h3>${title}</h3>${fields.map(fld).join('')}<div class="row">${del?'<button type="button" class="btn" id="dl">Delete</button>':''}<button type="button" class="btn" id="x">Cancel</button><button class="btn primary">Save</button></div></form>`;
  d.querySelector('#x').onclick=()=>d.remove();
  if(del)d.querySelector('#dl').onclick=async()=>{if(confirm('Delete this?')){await del();d.remove()}};
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();if(await save(Object.fromEntries(new FormData(e.target)))!==false)d.remove()};
  d.showModal()}
export const csv=rows=>{if(!rows.length)return'';const k=Object.keys(rows[0]);return '\ufeff'+[k.join(';'),...rows.map(r=>k.map(c=>'"'+String(typeof r[c]==='object'&&r[c]?JSON.stringify(r[c]):r[c]??'').replace(/"/g,'""')+'"').join(';'))].join('\n')};
export const dl=(name,text,type='text/csv')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click()};
export function applyTheme(){document.documentElement.classList.toggle('dark',localStorage.theme==='dark');document.documentElement.style.setProperty('--ac',localStorage.accent||'#14213D')}