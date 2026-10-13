/* Wedding Management · © 2026 myoung. All rights reserved.
 * CSV·JSON 내려받기. */
import { METHOD, PAYER, SIDE, STATUS } from './constants.js';
import { state } from './state.js';
import { catName, vendorTotal } from './util.js';

/* ═══ 내보내기 ═════════════════════════════ */
export function download(name, text, type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain;charset=utf-8'})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
export function csv(rows){ return '﻿'+rows.map(r=>r.map(c=>{ c=String(c==null?'':c); return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c; }).join(',')).join('\r\n'); }
export function exportCsv(kind){
  if (kind==='guests') return download('하객명단.csv', csv([['측','관계','이름','동반','응답','메모','축의금','식권'], ...state.guests.map(g=>[SIDE[g.side],g.rel,g.name,g.plus||0,{'':'미정',y:'참석',n:'불참'}[g.rsvp||''],g.memo||'',g.gift||0,g.meal||0])]), 'text/csv;charset=utf-8');
  const rows = [['카테고리','업체','상태','금액','부담','담당자','연락처','결제 항목','결제 금액','결제 예정일','결제 완료','결제자','수단','결제 메모','업체 메모']];
  state.vendors.forEach(v => { const ps = state.payments.filter(p=>p.vendorId===v.id); const base=[catName(v.category),v.name,STATUS[v.status],vendorTotal(v),PAYER[v.payer||'both'],(v.contact||{}).name||'',(v.contact||{}).phone||''];
    if (!ps.length) rows.push([...base,'','','','','','','',v.memo||'']); else ps.forEach((p,i)=>rows.push([...(i?base.map(()=>''):base),p.title,p.amount,p.dueDate||'',p.paidAt||'',PAYER[p.payer||'both'],METHOD[p.method||'card'],p.memo||'',i?'':v.memo||''])); });
  download('예산.csv', csv(rows), 'text/csv;charset=utf-8');
}
