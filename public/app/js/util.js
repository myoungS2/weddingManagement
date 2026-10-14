/* Wedding Management · © 2026 myoung. All rights reserved.
 * DOM·숫자·날짜·금액 도구와 예산 집계. */
import { DEF_RELS, payerCol } from './constants.js';
import { state } from './state.js';

/* ═══ 헬퍼 ═════════════════════════════════ */
export const $ = s => document.querySelector(s);
export const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
export const num = v => { const n = Number(String(v==null?'':v).replace(/[^\d.-]/g,'')); return isFinite(n) ? n : 0; };
export const won = n => Math.round(Number(n)||0).toLocaleString('ko-KR');
export const man = n => { n = Math.round((Number(n)||0)/10000); if (Math.abs(n) >= 10000) { const e = Math.floor(n/10000), r = n%10000; return e+'억'+(r?' '+r.toLocaleString('ko-KR')+'만':''); } return n.toLocaleString('ko-KR')+'만'; };
export const today = () => { const d = new Date(); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); };
export const p2 = n => String(n).padStart(2,'0');
export const fmtD = d => d ? (d.length===7 ? d.replace('-','.')+'월' : d.slice(5).replace('-','.')) : '';
export const fmtB = n => n>=1073741824 ? (n/1073741824).toFixed(1)+'GB' : n>=1048576 ? Math.round(n/1048576)+'MB' : Math.round(n/1024)+'KB';
export const days = d => { if (!d) return null; const t = new Date((d.length===7?d+'-01':d)+'T00:00:00'); return Math.ceil((t - new Date(today()+'T00:00:00'))/864e5); };
export const addMonths = (iso, m) => { const d = new Date(iso+'T00:00:00'); const whole = Math.floor(m); d.setMonth(d.getMonth()-whole); d.setDate(d.getDate()-Math.round((m-whole)*30)); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); };
export const catName = id => (state.categories.find(c=>c.id===id)||{}).name || id || '기타';
export const vendorOf = id => state.vendors.find(v=>v.id===id);
export const nameOf = e => { const m = state.members.find(x=>x.email===e); return m ? m.name : (e||'').split('@')[0]; };
export function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),1800); }
export function arm(btn, ask){ if (btn.dataset.armed) return true; btn.dataset.armed='1'; const old=btn.textContent; btn.textContent=ask||'한 번 더 누르면 지웁니다'; setTimeout(()=>{ delete btn.dataset.armed; btn.textContent=old; },2500); return false; }
export function vendorTotal(v){ const base = v.amountMode==='formula' ? num(v.unitPrice)*num(v.qty)+num(v.extra) : num(v.amount); return base + (v.extras||[]).reduce((s,x)=>s+num(x.amount),0) + tripsOf(v).reduce((s,t)=>s+num(t.amount),0); }
/* 여행 예약 목록. 예전 데이터는 업체당 예약 하나(v.trip)였고 금액은 업체 금액에 직접 들어 있었다 → 금액 0인 예약 하나로 읽는다. */
export function tripsOf(v){ if (Array.isArray(v.trips)) return v.trips; const t = v.trip; return t && (t.type||t.ref||t.start||t.end||t.localAmount) ? [Object.assign({ id:'legacy', amount:0 }, t)] : []; }
export function paidOf(vid){ return state.payments.filter(p=>p.vendorId===vid && p.paidAt).reduce((s,p)=>s+num(p.amount),0); }
export function rels(){ return state.settings.rels && state.settings.rels.length ? state.settings.rels : DEF_RELS; }
export function filesOf(owner, id){ return state.files.filter(f=>f.owner===owner && f.ownerId===id); }
/* 환율: state.fx.rates 는 1 KRW 당 외화. 외화 1 단위 = 1/rate 원 */
export function krwPer(cur){ const r = state.fx && state.fx.rates && state.fx.rates[cur]; return r ? 1/r : null; }
export function toKrw(amount, cur){ const k = krwPer(cur); return k ? Math.round(num(amount)*k) : null; }
export function hostOf(u){ try { return new URL(u).hostname.replace(/^www\./,''); } catch(e){ return '링크'; } }
export function normUrl(u){ u=String(u||'').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u='https://'+u; try { return new URL(u).href; } catch(e){ return ''; } }
export function kindOf(mime, name){ if (/^audio\//.test(mime)) return 'audio'; if (/^video\//.test(mime)) return 'video'; if (/^image\//.test(mime)) return 'image'; if (/pdf|hwp|msword|officedocument/.test(mime) || /\.(pdf|hwp|docx?)$/i.test(name)) return 'doc'; return 'other'; }

/* 예산 집계: 카테고리별 예산 / 예상 / 확정 / 지출
 * 확정 = 계약 업체 금액 합. 예상 = 확정 + (계약이 없는 카테고리면 미정 업체 중 가장 큰 금액). 탈락은 제외.
 * 지출 = 결제 완료된 금액 합. */
export function budgetRows(){
  const cats = state.categories.length ? state.categories : [{id:'etc',name:'기타'}];
  const rows = cats.map(c => {
    const vs = state.vendors.filter(v=>(v.category||'etc')===c.id);
    const con = vs.filter(v=>v.status==='contracted'), cand = vs.filter(v=>v.status==='candidate');
    const fixed = con.reduce((s,v)=>s+vendorTotal(v),0);
    const expect = fixed + (con.length ? 0 : Math.max(0, ...cand.map(vendorTotal), 0));
    const spent = vs.reduce((s,v)=>s+paidOf(v.id),0);
    const by = { groom:0, bride:0, both:0 };
    vs.forEach(v => state.payments.filter(p=>p.vendorId===v.id && p.paidAt).forEach(p => { by[payerCol(p.payer)] += num(p.amount); }));
    const budget = num((state.settings.catBudget||{})[c.id]);
    return { id:c.id, name:c.name, budget, expect, fixed, spent, remain: Math.max(0, fixed - spent), by, vendors:vs };
  });
  const sum = k => rows.reduce((s,r)=>s+r[k],0);
  const byAll = { groom: rows.reduce((s,r)=>s+r.by.groom,0), bride: rows.reduce((s,r)=>s+r.by.bride,0), both: rows.reduce((s,r)=>s+r.by.both,0) };
  return { rows, total:{ budget:num(state.settings.budget)||sum('budget'), expect:sum('expect'), fixed:sum('fixed'), spent:sum('spent'), remain:sum('remain'), by:byAll } };
}
export function stageNow(){
  const d = days(state.settings.weddingDate); if (d==null) return '예식일을 정하면 단계가 보여요';
  if (d < 0) return '결혼식 후'; if (d <= 7) return '마지막 주'; if (d <= 31) return '식순·잔금 구간'; if (d <= 92) return '청첩장·가봉 구간';
  if (d <= 184) return '촬영·예물·신혼여행 구간'; if (d <= 305) return '스드메 구간'; return '예식장 구간';
}
/* 금액 칸: 치는 동안 천 단위 쉼표. 숫자(와 소수점)만 남기고 다시 적는다. num() 이 쉼표를 벗기므로 저장 쪽은 그대로. */
export function moneyFormat(el){
  const dec = el.dataset.money==='dec';
  let raw = el.value.replace(dec ? /[^\d.]/g : /\D/g, '');
  if (dec) { const i = raw.indexOf('.'); if (i >= 0) raw = raw.slice(0, i+1) + raw.slice(i+1).replace(/\./g,'').slice(0,2); }
  if (!raw) { el.value=''; return; }
  const [ip, fp] = raw.split('.');
  const out = (ip ? Number(ip).toLocaleString('ko-KR') : '0') + (fp !== undefined ? '.'+fp : '');
  if (el.value !== out) { el.value = out; try { el.setSelectionRange(out.length, out.length); } catch(err){} }
}
