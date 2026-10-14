/* Wedding Management · © 2026 myoung. All rights reserved.
 * 여행: 신혼여행 일정 · 예약 · 환율. */
import { CURRENCIES, STATUS, TRIP_TYPES } from '../constants.js';
import { emptyBox, head, render, segs } from '../render.js';
import { state } from '../state.js';
import { store } from '../store.js';
import { esc, filesOf, fmtD, krwPer, num, p2, tripsOf, vendorTotal, won } from '../util.js';

export async function loadFx(){ if (state.fx || state.mode!=='api') return; state.fx = { loading:true }; try { state.fx = await store.call('GET','/api/fx'); render(); } catch(e){ state.fx = { error:e.message }; render(); } }
export function tripDays(){ const h = state.settings.honeymoon||{}; if (!h.start || !h.end) return []; const out=[]; const d=new Date(h.start+'T00:00:00'), e=new Date(h.end+'T00:00:00'); let i=1; while (d<=e && i<=60) { out.push({ n:i, date:d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()) }); d.setDate(d.getDate()+1); i++; } return out; }
export function renderTrip(back){
  loadFx();
  const h = state.settings.honeymoon||{}, cur = h.currency||'USD', sub = state.sub.trip;
  const trips = state.events.filter(e=>e.kind==='trip'), days = tripDays();
  const books = state.vendors.filter(v=>v.category==='honeymoon');
  const k = krwPer(cur);
  const fxLine = state.fx && state.fx.rates ? '1 '+cur+' = <b>'+won(k)+'원</b> <span class="muted small">'+(state.fx.date||'').slice(5,16)+' 기준</span>' : state.fx && state.fx.error ? '<span class="muted small">환율을 못 받았습니다: '+esc(state.fx.error)+'</span>' : state.mode==='api' ? '<span class="muted small">환율 불러오는 중…</span>' : '<span class="muted small">환율은 서버에 연결되면 보입니다</span>';
  const top = '<div class="card" style="margin-bottom:14px"><div class="grid3"><div class="field"><label>여행지</label><input id="hm-dest" value="'+esc(h.dest||'')+'" placeholder="예: 파리 · 니스"></div><div class="field"><label>통화</label><select id="hm-cur">'+CURRENCIES.map(c=>'<option'+(c===cur?' selected':'')+'>'+c+'</option>').join('')+'</select></div><div class="field"><label>&nbsp;</label><div style="padding:9px 0;font-size:14px">'+fxLine+'</div></div></div>' +
    '<div class="grid3"><div class="field"><label>출발</label><input id="hm-start" type="date" value="'+esc(h.start||'')+'"></div><div class="field"><label>귀국</label><input id="hm-end" type="date" value="'+esc(h.end||'')+'"></div><div class="field"><label>환산기</label><div class="inline"><input id="fx-amt" data-money="dec" inputmode="decimal" placeholder="'+cur+'" style="width:110px"><span class="num" id="fx-out" style="font-weight:600">= 0원</span></div></div></div>' +
    '<div class="row"><button class="btn primary sm" id="saveTrip">저장</button>'+(days.length?'<span class="muted small">'+days.length+'일 · '+esc(h.start)+' ~ '+esc(h.end)+'</span>':'<span class="muted small">출발·귀국일을 넣으면 날짜별 일정표가 생깁니다</span>')+'</div></div>';
  let body;
  if (sub==='plan') {
    const wish = trips.filter(e=>!e.date).sort((a,b)=>(a.sort||0)-(b.sort||0));
    const byDay = d => trips.filter(e=>e.date===d).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    const row = e => '<div class="it"><span class="muted small" style="width:44px;flex:none">'+esc(e.time||'')+'</span><div class="t" data-editev="'+e.id+'" title="눌러서 수정"><b>'+esc(e.title)+'</b>'+(e.memo?'<small>'+esc(e.memo)+'</small>':'')+'</div>'+(e.date?'<button class="btn sm" data-unplan="'+e.id+'" title="날짜 빼기">위시로</button>':'<select data-plandate="'+e.id+'" style="padding:4px 6px;border:1px solid var(--line2);border-radius:6px;font-size:12px"><option value="">날짜 넣기</option>'+days.map(d=>'<option value="'+d.date+'">Day '+d.n+' · '+fmtD(d.date)+'</option>').join('')+'</select>')+'<button class="x" data-delev="'+e.id+'">×</button></div>';
    body = '<div class="sect"><h2>하고 싶은 것 <span class="sub">아직 날짜가 없는 것. 날짜를 넣으면 일정으로 내려갑니다</span></h2>'+(wish.length?'<div class="list">'+wish.map(row).join('')+'</div>':'<p class="muted small">예: 에펠탑 야경, 현지 쿠킹 클래스, 스냅 촬영</p>')+'<div class="inline" style="margin-top:8px"><input id="w-title" placeholder="하고 싶은 것" style="flex:1;min-width:160px"><input id="w-memo" placeholder="메모 (예약 필요, 가격…)" style="flex:1;min-width:120px"><button class="btn" id="addWish">추가</button></div></div>' +
      (days.length ? days.map(d => '<div class="sect"><h2>Day '+d.n+' <span class="sub">'+esc(d.date)+' '+'일월화수목금토'[new Date(d.date+'T00:00:00').getDay()]+'</span></h2>'+(byDay(d.date).length?'<div class="list">'+byDay(d.date).map(row).join('')+'</div>':'<p class="muted small">비어 있음</p>')+'<div class="inline" style="margin-top:6px"><input type="time" data-dtime="'+d.date+'" style="width:100px"><input data-dtitle="'+d.date+'" placeholder="일정" style="flex:1;min-width:140px"><button class="btn sm" data-addday="'+d.date+'">추가</button></div></div>').join('') : '');
  } else {
    body = '<div class="row" style="margin-bottom:10px"><span class="muted small">예산 탭의 신혼여행 카테고리와 같은 항목입니다. 여행사·항공사·호텔마다 예약을 여러 개 적고, 예약 금액은 원화로 업체 금액에 합산됩니다.</span><button class="btn primary right" data-addvendor="honeymoon">+ 예약 추가</button></div>' +
      (books.length ? '<div class="cards">'+books.map(v => { const ts=tripsOf(v); return '<div class="card" data-vendor="'+v.id+'" style="cursor:pointer"><div class="row"><b>'+esc(v.name)+'</b><span class="pill '+v.status+' right">'+STATUS[v.status]+'</span></div>' +
          (ts.length ? '<div class="list" style="margin-top:4px">'+ts.map(t=>'<div class="it" style="padding:7px 0"><span class="pill pink">'+(TRIP_TYPES[t.type]||'기타')+'</span><div class="t"><b class="num">'+(num(t.amount)?won(t.amount)+'원':'<span class="muted">금액 미정</span>')+'</b><small>'+[t.start?fmtD(t.start)+(t.end&&t.end!==t.start?' ~ '+fmtD(t.end):''):'',t.ref?'예약번호 '+esc(t.ref):'',num(t.localAmount)?esc(t.currency||cur)+' '+num(t.localAmount).toLocaleString('ko-KR'):''].filter(Boolean).join(' · ')+'</small></div></div>').join('')+'</div>' : '<p class="muted small" style="margin:4px 0 0">아직 예약이 없습니다</p>') +
          '<div class="row" style="margin-top:6px"><span class="num" style="font-size:16px;font-weight:600">'+won(vendorTotal(v))+'<span class="muted small" style="font-weight:400"> 원</span></span><span class="muted small">'+[(v.links||[]).length?'링크 '+v.links.length:'',filesOf('vendor',v.id).length?'첨부 '+filesOf('vendor',v.id).length:''].filter(Boolean).join(' · ')+'</span></div></div>'; }).join('')+'</div>'
        : emptyBox('항공권, 숙소, 투어 예약을 적어 두세요. 예약번호와 e-티켓 PDF, 예약 링크를 한곳에 모읍니다.', '', 'glasses'));
  }
  return head('신혼여행', h.dest ? esc(h.dest) : '', '<div class="row">'+segs('trip',[['plan','일정'],['book','예약']])+back+'</div>') + top + body;
}
