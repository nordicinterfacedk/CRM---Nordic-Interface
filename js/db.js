import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const kr = ore => new Intl.NumberFormat('da-DK',{style:'currency',currency:'DKK',maximumFractionDigits:0}).format((ore||0)/100);
export const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function toast(msg,err){const t=document.createElement('div');t.className='toast'+(err?' err':'');t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),3200);return false}
export async function log(me,action,entity,entity_id){await sb.from('activity_logs').insert({company_id:me.company_id,user_id:me.id,action,entity,entity_id})}