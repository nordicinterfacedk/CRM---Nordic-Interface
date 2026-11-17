import { sb, esc, kr, toast, log } from './db.js';
const BT={one_time:'One-time',monthly:'Monthly',yearly:'Yearly',custom:'Custom'};
let me,el;
export async function render(e,m){me=m;el=e;await draw()}
async function draw(){
  const {data,error}=await sb.from('services').select('*').order('created_at');if(error)throw error;
  el.innerHTML=`<div class="bar"><h2>Services</h2><button class="btn primary" id="new">New service</button></div>
  ${data.length?`<table><tr><th>Service</th><th>Category</th><th>Price</th><th>Billing</th><th>VAT</th><th>Status</th><th></th></tr>${data.map(s=>`<tr><td>${esc(s.name)}<br><small>${esc(s.description)}</small></td><td>${esc(s.category)}</td><td>${kr(s.price_ore)}</td><td>${BT[s.billing_type]}</td><td>${s.vat_enabled?s.vat_percent+'%':'No VAT'}</td><td><span class="tag ${s.active?'s-active':''}">${s.active?'Active':'Inactive'}</span></td><td class="acts"><button class="btn" data-a="e" data-id="${s.id}">Edit</button> <button class="btn" data-a="dup" data-id="${s.id}">Duplicate</button> <button class="btn" data-a="tog" data-id="${s.id}">${s.active?'Deactivate':'Activate'}</button> <button class="btn" data-a="del" data-id="${s.id}">Delete</button></td></tr>`).join('')}</table>`:'<p class="muted">No services yet. Add your first service.</p>'}`;
  el.querySelector('#new').onclick=()=>form({billing_type:'one_time',vat_enabled:true,vat_percent:25,active:true,price_ore:0});
  el.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{
    const s=data.find(x=>x.id===b.dataset.id),a=b.dataset.a;
    if(a==='e')return form(s);
    let r;
    if(a==='dup'){const {id,created_at,...c}=s;r=await sb.from('services').insert({...c,name:s.name+' (copy)'})}
    if(a==='tog')r=await sb.from('services').update({active:!s.active}).eq('id',s.id);
    if(a==='del'){if(!confirm('Delete this service? Existing invoices are not affected.'))return;r=await sb.from('services').delete().eq('id',s.id)}
    if(r.error)return toast(r.error.message,1);
    await log(me,`Service ${s.name}: ${a}`,'service',a==='del'?null:s.id);toast('Done');draw()});
}
function form(s){
  const d=document.createElement('dialog');document.body.append(d);
  const i=(n,l,t='text',v='')=>`<label>${l}<input name="${n}" type="${t}" value="${esc(v)}"></label>`;
  d.innerHTML=`<form><h3>${s.id?'Edit':'New'} service</h3>${i('name','Service name','text',s.name)}${i('description','Description','text',s.description)}${i('category','Category','text',s.category)}${i('price','Price excl. VAT (DKK)','number',(s.price_ore||0)/100)}
  <label>Billing type<select name="billing_type">${Object.entries(BT).map(([k,v])=>`<option value="${k}" ${s.billing_type===k?'selected':''}>${v}</option>`).join('')}</select></label>
  <label><input type="checkbox" name="vat_enabled" ${s.vat_enabled?'checked':''} style="display:inline;width:auto"> VAT enabled</label>${i('vat_percent','VAT percentage','number',s.vat_percent)}
  <label><input type="checkbox" name="active" ${s.active?'checked':''} style="display:inline;width:auto"> Active</label>
  <div class="row"><button type="button" class="btn" id="x">Cancel</button><button class="btn primary">Save service</button></div></form>`;
  const f=d.querySelector('form');d.querySelector('#x').onclick=()=>d.remove();
  f.onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(f));
    const row={company_id:me.company_id,name:v.name.trim(),description:v.description,category:v.category,price_ore:Math.round((+v.price||0)*100),billing_type:v.billing_type,vat_enabled:!!v.vat_enabled,vat_percent:+v.vat_percent||0,active:!!v.active};
    const r=s.id?await sb.from('services').update(row).eq('id',s.id).select().single():await sb.from('services').insert(row).select().single();
    if(r.error)return toast(r.error.message,1);await log(me,s.id?'Service updated':'Service created','service',r.data.id);toast('Saved');d.remove();draw()};
  d.showModal();
}