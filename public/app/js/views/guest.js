/* Wedding Management · © 2026 myoung. All rights reserved.
 * 하객 (탭은 숨김, 코드만 유지). */
import { DEF_AVG, DEF_RATE, SIDE } from '../constants.js';
import { emptyBox, head, segs, warnLocal } from '../render.js';
import { state } from '../state.js';
import { budgetRows, esc, man, num, rels, won } from '../util.js';

/* ── 하객 ── */
export function renderGuest(){
  const sub = state.sub.guest, gs = state.guests, rate = state.settings.rates||DEF_RATE, avg = state.settings.avgGift||DEF_AVG;
  let body;
  if (sub==='list') {
    const shown = gs.filter(g=>state.guestF==='all'||g.side===state.guestF||g.rel===state.guestF).sort((a,b)=>a.side.localeCompare(b.side)||a.rel.localeCompare(b.rel)||a.name.localeCompare(b.name));
    const rs = {'':'미정',y:'참석',n:'불참'};
    body = '<div class="inline" style="margin-bottom:12px"><select id="g-side"><option value="groom">신랑</option><option value="bride">신부</option></select><select id="g-rel">'+rels().map(r=>'<option>'+esc(r)+'</option>').join('')+'</select><input id="g-name" placeholder="이름" style="flex:1;min-width:120px"><input id="g-plus" inputmode="numeric" placeholder="동반" style="width:60px"><button class="btn" id="addGuest">추가</button><button class="btn ghost" id="importGuests">붙여넣기로 가져오기</button></div>' +
      '<div class="filters">'+['all','groom','bride',...rels()].map(k=>'<button data-gf="'+esc(k)+'" aria-pressed="'+(state.guestF===k)+'">'+(k==='all'?'전체':SIDE[k]||esc(k))+'</button>').join('')+'</div>' +
      (shown.length?'<div class="tbl"><table><thead><tr><th>측</th><th>관계</th><th>이름</th><th>응답</th><th class="num">동반</th><th></th></tr></thead><tbody>'+shown.map(g=>'<tr><td><span class="pill '+(g.side==='groom'?'':'pink')+'">'+SIDE[g.side]+'</span></td><td>'+esc(g.rel)+'</td><td>'+esc(g.name)+(g.memo?' <span class="muted small">'+esc(g.memo)+'</span>':'')+'</td><td><button class="pill '+(g.rsvp==='y'?'contracted':g.rsvp==='n'?'dropped':'')+'" data-rsvp="'+g.id+'">'+rs[g.rsvp||'']+'</button></td><td class="num">'+(g.plus||'')+'</td><td><button class="x" data-delguest="'+g.id+'">×</button></td></tr>').join('')+'</tbody></table></div>'
        : emptyBox('하객을 적으면 관계별 참석률로 예상 인원과 식대 보증인원을 미리 봅니다.')) +
      '<p class="muted small" style="margin-top:8px">'+gs.length+'명 · 동반 포함 '+gs.reduce((s,g)=>s+1+num(g.plus),0)+'명. 응답 칸을 누르면 미정 → 참석 → 불참 순으로 바뀝니다.</p>';
  } else if (sub==='predict') {
    let en=0, eg=0;
    const rows = rels().map(r => { const list = gs.filter(g=>g.rel===r); const heads = list.reduce((s,g)=>s+1+num(g.plus),0);
      const n = list.reduce((s,g)=>s+(g.rsvp==='y'?1+num(g.plus):g.rsvp==='n'?0:(1+num(g.plus))*(rate[r]??70)/100),0);
      const gift = list.reduce((s,g)=>s+(g.rsvp==='n'?0:(g.rsvp==='y'?1:(rate[r]??70)/100)*(avg[r]??5)),0); en+=n; eg+=gift;
      return '<tr><td>'+esc(r)+'</td><td class="num">'+heads+'</td><td class="num"><input data-rate="'+esc(r)+'" value="'+(rate[r]??70)+'" inputmode="numeric" style="width:56px;text-align:right;border:0;border-bottom:1px solid var(--line2);background:transparent">%</td><td class="num"><input data-avg="'+esc(r)+'" value="'+(avg[r]??5)+'" inputmode="numeric" style="width:56px;text-align:right;border:0;border-bottom:1px solid var(--line2);background:transparent">만</td><td class="num">'+Math.round(n)+'</td><td class="num">'+Math.round(gift)+'만</td></tr>'; });
    const venue = state.vendors.find(v=>v.category==='venue'&&v.status==='contracted');
    body = '<div class="cards" style="margin-bottom:14px"><div class="card"><div class="muted small">예상 참석</div><div class="dd">'+Math.round(en)+'<small>명</small></div></div><div class="card"><div class="muted small">예상 축의금</div><div class="dd">'+Math.round(eg).toLocaleString('ko-KR')+'<small>만원</small></div></div><div class="card"><div class="muted small">식대 보증인원 제안</div><div class="dd">'+Math.ceil(en*0.9/10)*10+'<small>명 (예상의 90%)</small></div>'+(venue&&venue.amountMode==='formula'?'<div class="muted small">'+esc(venue.name)+' 계약 수량 '+num(venue.qty)+'명</div>':'')+'</div></div>' +
      '<div class="tbl"><table><thead><tr><th>관계</th><th class="num">명단</th><th class="num">참석률</th><th class="num">평균 축의금</th><th class="num">예상 인원</th><th class="num">예상 축의금</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>' +
      '<p class="muted small" style="margin-top:8px">참석 응답은 100%, 불참은 0%, 미정은 관계별 참석률로 셉니다. 비율과 평균은 바로 고칠 수 있습니다.</p>';
  } else {
    const real = gs.reduce((s,g)=>s+num(g.gift),0), b = budgetRows().total;
    body = '<div class="cards" style="margin-bottom:14px"><div class="card"><div class="muted small">받은 축의금</div><div class="dd">'+man(real)+'<small>원</small></div></div><div class="card"><div class="muted small">총 지출(확정)</div><div class="dd">'+man(b.fixed)+'<small>원</small></div></div><div class="card"><div class="muted small">정산</div><div class="dd" style="color:'+(real-b.fixed>=0?'var(--good)':'var(--bad)')+'">'+(real-b.fixed>=0?'+':'−')+man(Math.abs(real-b.fixed))+'<small>원</small></div></div></div>' +
      (gs.length?'<div class="tbl"><table><thead><tr><th>측</th><th>이름</th><th>관계</th><th class="num">축의금</th><th class="num">식권</th></tr></thead><tbody>'+gs.slice().sort((a,b)=>a.side.localeCompare(b.side)||a.name.localeCompare(b.name)).map(g=>'<tr><td>'+SIDE[g.side]+'</td><td>'+esc(g.name)+'</td><td class="muted">'+esc(g.rel)+'</td><td class="num"><input data-money data-gift="'+g.id+'" value="'+(g.gift?won(g.gift):'')+'" inputmode="numeric" placeholder="0" style="width:100px;text-align:right;border:0;border-bottom:1px solid var(--line2);background:transparent"></td><td class="num"><input data-meal="'+g.id+'" value="'+(g.meal||'')+'" inputmode="numeric" placeholder="0" style="width:50px;text-align:right;border:0;border-bottom:1px solid var(--line2);background:transparent"></td></tr>').join('')+'</tbody></table></div>':emptyBox('식 후 축의대 장부를 여기 옮겨 적으면 정산이 바로 됩니다.'));
  }
  return warnLocal() + head('하객', gs.length+'명', segs('guest',[['list','명단'],['predict','예측'],['book','장부']])) + body;
}
