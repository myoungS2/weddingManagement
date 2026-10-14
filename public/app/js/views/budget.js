/* Wedding Management · © 2026 myoung. All rights reserved.
 * 예산: 금액 뷰 · 업체 뷰 · 업체 상세 시트. */
import { CURRENCIES, KINDS, METHOD, PAYER, PAY_TYPES, STATUS, TRIP_TYPES } from '../constants.js';
import { emptyBox, head, segs, warnLocal } from '../render.js';
import { closeSheet, openSheet } from '../sheet.js';
import { state } from '../state.js';
import { store } from '../store.js';
import { $, arm, budgetRows, esc, filesOf, fmtB, fmtD, hostOf, krwPer, man, normUrl, num, paidOf, toKrw, toast, today, tripsOf, uid, vendorOf, vendorTotal, won } from '../util.js';

/* ── 예산 ── */
export function renderBudget(){
  const sub = state.sub.budget, br = budgetRows();
  let body;
  if (sub==='money') {
    const dash = v => v ? won(v) : '<span class="muted">–</span>';
    body = '<div class="tbl"><table><thead><tr><th rowspan="2" style="vertical-align:bottom">카테고리</th><th class="num" rowspan="2" style="vertical-align:bottom">예산</th><th class="num" rowspan="2" style="vertical-align:bottom">예상</th><th class="num" rowspan="2" style="vertical-align:bottom">확정</th><th class="num" rowspan="2" style="vertical-align:bottom">지출</th><th class="num" rowspan="2" style="vertical-align:bottom">잔금</th><th colspan="3" style="text-align:center;border-bottom:0;padding-bottom:0">실제 지출</th></tr><tr><th class="num">신랑</th><th class="num">신부</th><th class="num">공동</th></tr></thead><tbody>' +
      br.rows.map(r => '<tr class="click" data-cat="'+r.id+'"><td>'+esc(r.name)+' <span class="muted small">'+(r.vendors.filter(v=>v.status!=='dropped').length||'')+'</span></td>' +
        '<td class="num"><input class="num" data-money data-catbudget="'+r.id+'" value="'+(r.budget?won(r.budget):'')+'" placeholder="–" style="width:96px;border:0;border-bottom:1px solid var(--line2);padding:2px 0;background:transparent"></td>' +
        '<td class="num">'+dash(r.expect)+'</td><td class="num">'+dash(r.fixed)+'</td><td class="num">'+dash(r.spent)+'</td><td class="num">'+dash(r.remain)+'</td><td class="num">'+dash(r.by.groom)+'</td><td class="num">'+dash(r.by.bride)+'</td><td class="num">'+dash(r.by.both)+'</td></tr>' +
        (state.openCat===r.id ? '<tr><td colspan="9" style="background:var(--bg2);padding:10px 8px">'+(r.vendors.length?'<div class="cards">'+r.vendors.map(vendorCard).join('')+'</div>':'<span class="muted small">이 카테고리에 업체가 없습니다.</span>')+' <button class="btn sm" data-addvendor="'+r.id+'" style="margin-top:8px">+ 업체</button></td></tr>' : '')).join('') +
      '<tr class="sum"><td>합계</td><td class="num">'+won(br.total.budget)+'</td><td class="num">'+won(br.total.expect)+'</td><td class="num">'+won(br.total.fixed)+'</td><td class="num">'+won(br.total.spent)+'</td><td class="num">'+won(br.total.remain)+'</td><td class="num">'+won(br.total.by.groom)+'</td><td class="num">'+won(br.total.by.bride)+'</td><td class="num">'+won(br.total.by.both)+'</td></tr></tbody></table></div>' +
      '<p class="muted small" style="margin-top:8px">예상 = 확정 + 계약 전 카테고리의 가장 큰 미정 금액. 잔금 = 확정 − 지출. 실제 지출은 결제마다 적은 결제자로 모읍니다. 탈락 업체는 합계에 들어가지 않습니다. 행을 누르면 업체가 펼쳐집니다.</p>' +
      payerBox();
  } else {
    const cats = state.categories.length ? state.categories : [{id:'etc',name:'기타'}];
    body = cats.map(c => { const vs = state.vendors.filter(v=>(v.category||'etc')===c.id).sort((a,b)=>(a.status==='dropped')-(b.status==='dropped')); if (!vs.length) return ''; return '<div class="sect"><h2>'+esc(c.name)+'<span class="sub">'+vs.filter(v=>v.status!=='dropped').length+'곳</span><button class="btn sm right" data-addvendor="'+c.id+'">+ 업체</button></h2><div class="cards">'+vs.map(vendorCard).join('')+'</div></div>'; }).join('') ||
      emptyBox('아직 업체가 없습니다. 후보부터 적어 두고 견적을 나란히 비교하세요.', '<button class="btn primary" data-addvendor="">첫 업체 적기</button>', 'rings');
  }
  return warnLocal() + head('예산', br.total.budget ? '총예산 '+man(br.total.budget)+'원' : '설정에서 총예산을 정하세요', '<div class="row">'+segs('budget',[['money','금액'],['vendor','업체']])+'<button class="btn" id="importBudget" title="엑셀 가계부 붙여넣기">가져오기</button><button class="btn primary" data-addvendor="">+ 업체</button></div>') + body;
}
export function vendorCard(v){
  const t = vendorTotal(v), paid = paidOf(v.id), q = (v.questions||[]), qa = q.filter(x=>x.done).length;
  return '<div class="card" data-vendor="'+esc(v.id)+'" style="cursor:pointer'+(v.status==='dropped'?';opacity:.6':'')+'">' +
    '<div class="row"><b class="'+(v.status==='dropped'?'strike':'')+'">'+esc(v.name)+'</b><span class="pill '+v.status+' right">'+STATUS[v.status]+'</span></div>' +
    '<div class="row" style="margin-top:6px"><span class="num" style="font-size:16px;font-weight:600">'+won(t)+'<span class="muted small" style="font-weight:400"> 원</span></span>' +
    (v.payer&&v.payer!=='both'?'<span class="pill dim">'+PAYER[v.payer]+'</span>':'')+'</div>' +
    '<div class="muted small" style="margin-top:4px">'+(paid?'결제 '+won(paid)+' · 잔금 '+won(Math.max(0,t-paid))+' · ':'')+(q.length?'질문 '+qa+'/'+q.length+' · ':'')+(filesOf('vendor',v.id).length?'첨부 '+filesOf('vendor',v.id).length+' · ':'')+((v.links||[]).length?'링크 '+v.links.length+' · ':'')+(v.contact&&v.contact.name?esc(v.contact.name):'')+'</div>' +
    (v.memo?'<div class="small" style="margin-top:6px;color:var(--ink2);white-space:pre-line">'+esc(v.memo.slice(0,80))+(v.memo.length>80?'…':'')+'</div>':'')+'</div>';
}
export function payerBox(){
  const by = {};
  state.vendors.filter(v=>v.status==='contracted').forEach(v => { const k=v.payer||'both'; by[k]=(by[k]||0)+vendorTotal(v); });
  const keys = Object.keys(by); if (!keys.length) return '';
  return '<div class="sect"><h2>부담 주체별 확정 금액</h2><div class="card"><dl class="kv">'+keys.map(k=>'<dt>'+PAYER[k]+'</dt><dd class="num">'+won(by[k])+'</dd>').join('')+'</dl></div></div>';
}

/* 업체 상세 시트 */
export function openVendor(id, catId){
  const v = id ? vendorOf(id) : { id:uid(), name:'', category:catId||(state.categories[0]||{}).id||'etc', status:'candidate', amountMode:'direct', amount:'', unitPrice:'', qty:'', extra:'', payer:'both', contact:{name:'',phone:''}, memo:'', links:[], questions:[], extras:[], trips:[], createdAt:today() };
  if (!v) return;
  const isNew = !id;
  const draft = JSON.parse(JSON.stringify(v));
  /* 예전 데이터(업체당 예약 하나 v.trip)는 예약 목록으로 옮긴다. 저장하면 새 모양으로 남는다. */
  if (!Array.isArray(draft.trips)) { draft.trips = tripsOf(draft).map(t=>Object.assign({}, t, { id:uid() })); delete draft.trip; }
  const curDef = () => (state.settings.honeymoon||{}).currency||'USD';
  const fxHint = c => { const k=krwPer(c); return k ? '1 '+c+' = '+won(k)+'원' : '환율은 신혼여행 화면을 한 번 열면 받아옵니다'; };
  const saveTrips = () => { if (!isNew) store.put('vendors', draft); };
  const body = () => {
    const pays = state.payments.filter(p=>p.vendorId===v.id).sort((a,b)=>(a.dueDate||'9').localeCompare(b.dueDate||'9'));
    const fs = filesOf('vendor', v.id);
    return '<div class="field"><label>업체 이름</label><input id="f-name" value="'+esc(draft.name)+'" placeholder="'+(draft.category==='venue'?'웨딩홀 이름 검색':'예: ○○ 스튜디오')+'" autocomplete="off">'+(draft.category==='venue'?'<div id="f-venueList"></div>':'')+'</div>' +
    '<div class="grid2"><div class="field"><label>카테고리</label><select id="f-cat">'+state.categories.map(c=>'<option value="'+c.id+'"'+(c.id===draft.category?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div>' +
    '<div class="field"><label>상태</label><select id="f-status">'+Object.keys(STATUS).map(k=>'<option value="'+k+'"'+(k===draft.status?' selected':'')+'>'+STATUS[k]+'</option>').join('')+'</select></div></div>' +
    '<div class="field"><label>금액 <span class="segs" style="margin-left:8px;vertical-align:middle"><button type="button" data-mode="direct" aria-pressed="'+(draft.amountMode!=='formula')+'">직접 입력</button><button type="button" data-mode="formula" aria-pressed="'+(draft.amountMode==='formula')+'">단가 × 수량</button></span></label>' +
    (draft.amountMode==='formula'
      ? '<div class="inline"><input id="f-unit" data-money inputmode="numeric" value="'+esc(draft.unitPrice)+'" placeholder="단가" style="width:110px"> × <input id="f-qty" inputmode="numeric" value="'+esc(draft.qty)+'" placeholder="수량" style="width:70px"> + <input id="f-extra" data-money inputmode="numeric" value="'+esc(draft.extra)+'" placeholder="추가 금액" style="width:110px"><span class="num" style="margin-left:auto;font-weight:600">= '+won(num(draft.unitPrice)*num(draft.qty)+num(draft.extra))+'</span></div><p class="muted small" style="margin-top:4px">예: 식대 53,000 × 300 + 대관료</p>'
      : '<input id="f-amount" data-money inputmode="numeric" value="'+(draft.amount?won(draft.amount):'')+'" placeholder="0">') +
    (draft.category==='honeymoon' ? '<p class="muted small" style="margin-top:4px">패키지·기본 금액. 항공·숙소처럼 예약별 금액은 아래 여행 예약에 적으면 여기에 더해집니다.</p>' : '')+'</div>' +
    '<div class="grid2"><div class="field"><label>부담</label><select id="f-payer">'+Object.keys(PAYER).map(k=>'<option value="'+k+'"'+(k===(draft.payer||'both')?' selected':'')+'>'+PAYER[k]+'</option>').join('')+'</select></div>' +
    '<div class="field"><label>담당자</label><input id="f-cname" value="'+esc((draft.contact||{}).name||'')+'" placeholder="담당 실장님"></div></div>' +
    '<div class="field"><label>연락처</label><input id="f-cphone" type="tel" value="'+esc((draft.contact||{}).phone||'')+'" placeholder="010-"></div>' +
    (draft.category==='honeymoon' || (draft.trips||[]).length ? (function(){
      /* 여행 예약: 업체(여행사·항공사·호텔) 하나에 예약을 여러 개. 예약마다 금액을 적고, 그 합이 업체 금액에 더해진다. */
      const cur0=curDef(), trips=draft.trips||[];
      const typeSel=(attr,sel)=>'<select class="c2 t" '+attr+' aria-label="종류">'+Object.keys(TRIP_TYPES).map(x=>'<option value="'+x+'"'+(x===sel?' selected':'')+'>'+TRIP_TYPES[x]+'</option>').join('')+'</select>';
      const curSel=(attr,sel)=>'<select '+attr+' aria-label="통화">'+CURRENCIES.map(c=>'<option'+(c===sel?' selected':'')+'>'+c+'</option>').join('')+'</select>';
      const row=t=>{ const c=t.currency||cur0; return '<div class="pay trip">'+typeSel('data-tf="type:'+t.id+'"',t.type||'flight') +
        '<input class="c2 num amt" data-money data-tf="amount:'+t.id+'" inputmode="numeric" value="'+(num(t.amount)?won(t.amount):'')+'" placeholder="금액 (원)" aria-label="금액">' +
        '<input class="c2 ref" data-tf="ref:'+t.id+'" value="'+esc(t.ref||'')+'" placeholder="예약번호" aria-label="예약번호">' +
        '<label class="c2 f fd"><span>시작</span><input type="date" data-tf="start:'+t.id+'" value="'+esc(t.start||'')+'"></label>' +
        '<label class="c2 f fd"><span>종료</span><input type="date" data-tf="end:'+t.id+'" value="'+esc(t.end||'')+'"></label>' +
        '<label class="c2 f curw"><span>현지 통화 금액</span><div class="cur">'+curSel('data-tf="currency:'+t.id+'"',c)+'<input data-money="dec" inputmode="decimal" data-tf="localAmount:'+t.id+'" value="'+(num(t.localAmount)?num(t.localAmount).toLocaleString('ko-KR'):'')+'" placeholder="0" aria-label="현지 통화 금액"></div></label>' +
        '<span class="c3 fx">'+fxHint(c)+'</span><button type="button" class="c2 btn sm conv" data-tconv="'+t.id+'" '+(krwPer(c)?'':'disabled')+'>원화로 환산</button><button class="c1 x" data-deltrip="'+t.id+'" aria-label="예약 삭제">×</button></div>'; };
      const sumT=trips.reduce((s,t)=>s+num(t.amount),0);
      return '<div class="sub-list"><h4>여행 예약 <span class="right">항공 · 숙소 · 투어 · 예약 금액은 업체 금액에 더해집니다</span></h4>' +
        (trips.length ? '<div class="pays">'+trips.map(row).join('')+'</div>' : '<p class="muted small">아직 예약이 없습니다. 항공권, 숙소, 투어를 금액과 함께 적어 두세요.</p>') +
        '<div class="pay new trip"><div class="c6 newh">새 예약</div>'+typeSel('id="t-type"','flight') +
          '<input class="c2 num amt" id="t-amount" data-money inputmode="numeric" placeholder="금액 (원)" aria-label="금액"><input class="c2 ref" id="t-ref" placeholder="예약번호 (PNR)" aria-label="예약번호">' +
          '<label class="c2 f fd"><span>시작</span><input type="date" id="t-start"></label><label class="c2 f fd"><span>종료</span><input type="date" id="t-end"></label>' +
          '<label class="c2 f curw"><span>현지 통화 금액</span><div class="cur">'+curSel('id="t-cur"',cur0)+'<input id="t-local" data-money="dec" inputmode="decimal" placeholder="0" aria-label="현지 통화 금액"></div></label>' +
          '<span class="c2 fx">'+fxHint(cur0)+'</span><button type="button" class="c2 btn sm conv" data-tconv="new" '+(krwPer(cur0)?'':'disabled')+'>원화로 환산</button><button class="c2 add btn sm primary" id="addTrip">추가</button></div>' +
        (trips.length ? '<p class="muted small" style="margin-top:8px">예약 합계 '+won(sumT)+' · 업체 금액 '+won(vendorTotal(draft))+'</p>' : '')+'</div>'; })() : '') +
    '<div class="field"><label>메모 <span class="muted">탈락 이유, 포함 사항, 조건</span></label><textarea id="f-memo">'+esc(draft.memo||'')+'</textarea></div>' +
    (isNew ? '<p class="muted small">저장하면 바로 이어서 결제(예약금·중도금·잔금·할부), 확인 질문, 구성 항목, 첨부를 적을 수 있어요.</p>' :
    '<div class="sub-list"><h4>결제 <span class="right">예약금 · 중도금 · 잔금 · 할부 · 추가금</span></h4>' +
      (pays.length?'<div class="pays">'+pays.map(p=>'<div class="pay'+(p.paidAt?' done':'')+'">' +
        '<label class="c2 pchk"><input type="checkbox" class="chk" data-paid="'+p.id+'" '+(p.paidAt?'checked':'')+'><span>'+(p.paidAt?'완료 '+fmtD(p.paidAt):'예정')+'</span></label>' +
        '<select class="c2 t" data-pf="title:'+p.id+'" aria-label="종류">'+PAY_TYPES.map(t=>'<option'+(t===p.title?' selected':'')+'>'+t+'</option>').join('')+(PAY_TYPES.indexOf(p.title)<0?'<option selected>'+esc(p.title)+'</option>':'')+'</select>' +
        '<input class="c2 num amt" data-money data-pf="amount:'+p.id+'" inputmode="numeric" value="'+(p.amount?won(p.amount):'')+'" placeholder="금액" aria-label="금액">' +
        '<label class="c2 f fd"><span>예정일</span><input type="date" data-pf="dueDate:'+p.id+'" value="'+esc(p.dueDate||'')+'"></label>' +
        '<label class="c2 f fp"><span>결제자</span><select data-pf="payer:'+p.id+'">'+Object.keys(PAYER).map(k=>'<option value="'+k+'"'+(k===(p.payer||'both')?' selected':'')+'>'+PAYER[k]+'</option>').join('')+'</select></label>' +
        '<label class="c2 f fm"><span>수단</span><select data-pf="method:'+p.id+'">'+Object.keys(METHOD).map(k=>'<option value="'+k+'"'+(k===(p.method||'card')?' selected':'')+'>'+METHOD[k]+'</option>').join('')+'</select></label>' +
        '<input class="c5 memo" data-pf="memo:'+p.id+'" value="'+esc(p.memo||'')+'" placeholder="메모 (할부 3/6, 현금영수증…)" aria-label="메모">' +
        '<button class="c1 x" data-delpay="'+p.id+'" aria-label="결제 삭제">×</button></div>').join('')+'</div>':'<p class="muted small">아직 결제 항목이 없습니다.</p>') +
      '<div class="pay new"><div class="c6 newh">새 결제</div>' +
        '<select class="c2 t" id="p-title" aria-label="종류">'+PAY_TYPES.map(t=>'<option>'+t+'</option>').join('')+'</select>' +
        '<input class="c2 num amt" id="p-amount" data-money inputmode="numeric" placeholder="금액" aria-label="금액">' +
        '<label class="c2 f fd"><span>예정일</span><input id="p-date" type="date"></label>' +
        '<label class="c3 f fp"><span>결제자</span><select id="p-payer">'+Object.keys(PAYER).map(k=>'<option value="'+k+'"'+(k===(draft.payer||'both')?' selected':'')+'>'+PAYER[k]+'</option>').join('')+'</select></label>' +
        '<label class="c3 f fm"><span>수단</span><select id="p-method">'+Object.keys(METHOD).map(k=>'<option value="'+k+'">'+METHOD[k]+'</option>').join('')+'</select></label>' +
        '<input class="c4 memo" id="p-memo" placeholder="메모" aria-label="메모">' +
        '<button class="c2 add btn sm primary" id="addPay">추가</button></div>' +
      (function(){ const sumP=pays.reduce((s,p)=>s+num(p.amount),0), paidP=pays.filter(p=>p.paidAt).reduce((s,p)=>s+num(p.amount),0), tot=vendorTotal(v); return '<p class="muted small" style="margin-top:8px">결제 합계 '+won(sumP)+' / 업체 금액 '+won(tot)+(sumP&&sumP!==tot?' <span style="color:var(--warn)">(차이 '+won(tot-sumP)+')</span>':'')+' · 완료 '+won(paidP)+' · 잔금 '+won(Math.max(0,tot-paidP))+'</p>'; })()+'</div>' +
    '<div class="sub-list"><h4>확인 질문 <span class="right">상담 때 물어볼 것</span></h4>' +
      (draft.questions||[]).map(q=>'<div class="it" style="display:flex;gap:8px;align-items:flex-start;padding:6px 0"><input type="checkbox" class="chk" data-qdone="'+q.id+'" '+(q.done?'checked':'')+' style="margin-top:3px"><div style="flex:1;min-width:0"><div class="'+(q.done?'strike':'')+'">'+esc(q.q)+'</div><input data-qa="'+q.id+'" value="'+esc(q.a||'')+'" placeholder="답변 메모" style="width:100%;border:0;border-bottom:1px solid var(--line);padding:3px 0;font-size:13px;background:transparent"></div><button class="x" data-delq="'+q.id+'">×</button></div>').join('') +
      '<div class="inline" style="margin-top:8px"><input id="q-new" placeholder="예: 헤어 변형 가능? 혼주 메이크업 포함?" style="flex:1"><button class="btn sm" id="addQ">추가</button></div></div>' +
    '<div class="sub-list"><h4>구성 항목 · 추가금 <span class="right">대관료, 헬퍼비, 원본비, 피팅비… 업체 금액에 더해집니다</span></h4>' +
      (draft.extras||[]).map(x=>'<div class="row" style="padding:4px 0"><span style="flex:1">'+esc(x.title)+'</span><span class="num">'+won(x.amount)+'</span><button class="x" data-delx="'+x.id+'">×</button></div>').join('') +
      '<div class="inline" style="margin-top:8px"><input id="x-title" placeholder="항목 (예: 홀 대관료)" style="flex:1"><input id="x-amount" data-money inputmode="numeric" placeholder="금액" style="width:110px"><button class="btn sm" id="addX">추가</button></div></div>' +
    (function(){ const ls=draft.links||[]; return '<div class="sub-list"><h4>링크 <span class="right">업체가 보내 준 견적서 · 상품 페이지 · 인스타 · 지도</span></h4>' +
        (ls.length?'<div class="list">'+ls.map(l=>'<div class="it"><span class="pill dim">'+esc(hostOf(l.url))+'</span><div class="t"><b><a href="'+esc(l.url)+'" target="_blank" rel="noopener" style="color:var(--pink-ink)">'+esc(l.title||l.url)+'</a></b><small>'+esc(l.url)+'</small></div><button class="btn sm" data-copylink="'+esc(l.url)+'">복사</button><button class="x" data-dellink="'+l.id+'">×</button></div>').join('')+'</div>':'<p class="muted small">아직 없음</p>') +
        '<div class="inline" style="margin-top:8px"><input id="l-title" placeholder="이름 (예: 1차 견적서)" style="width:140px"><input id="l-url" type="url" inputmode="url" placeholder="https://" style="flex:1;min-width:160px"><button class="btn sm" id="addLink">추가</button></div></div>'; })() +
    '<div class="sub-list"><h4>첨부 <span class="right">계약서 · 견적서 · 영수증</span></h4>'+fileList(fs)+'<button class="btn sm" data-upload="vendor:'+v.id+'" style="margin-top:8px"'+(state.filesOn?'':' disabled')+'>+ 파일 올리기</button>'+(state.filesOn?'':'<span class="muted small" style="margin-left:8px">파일 저장소를 켜면 쓸 수 있어요</span>')+'</div>');
  };
  const sync = () => {
    draft.name = $('#f-name').value.trim(); draft.category = $('#f-cat').value; draft.status = $('#f-status').value; draft.payer = $('#f-payer').value;
    draft.contact = { name:$('#f-cname').value.trim(), phone:$('#f-cphone').value.trim() }; draft.memo = $('#f-memo').value;
    if (draft.amountMode==='formula') { draft.unitPrice=num($('#f-unit').value); draft.qty=num($('#f-qty').value); draft.extra=num($('#f-extra').value); }
    else draft.amount = num($('#f-amount').value);
  };
  openSheet(isNew ? '새 업체' : v.name, body, [
    isNew ? null : { label:'삭제', cls:'danger', onClick:(b)=>{ if (!arm(b)) return; closeSheet(); store.del('vendors', v.id); toast('지웠습니다'); } },
    { label:'저장', cls:'primary', onClick:()=>{ sync(); if (!draft.name) { toast('업체 이름을 적어 주세요'); return; } closeSheet(); store.put('vendors', draft);
      if (draft.category==='venue' && draft.status==='contracted' && !(state.settings.venue && state.settings.venue.name)) { store.settingsPatch({ venue:Object.assign({ name:draft.name, fromVendor:draft.id }, draft.venueId?{ id:draft.venueId }:{}) }, true); toast('설정의 웨딩홀도 '+draft.name+'(으)로 채웠어요'); } if (isNew) { toast('저장됨. 이어서 결제를 적을 수 있어요'); setTimeout(()=>openVendor(draft.id), 150); } else toast('저장됨'); } }
  ], {
    click(e){
      const t = e.target.closest('[data-vpick],[data-mode],#addPay,#addQ,#addX,#addLink,#addTrip,[data-tconv],[data-deltrip],[data-delpay],[data-delq],[data-delx],[data-dellink],[data-copylink]'); if (!t) return;
      if (t.dataset.vpick) { pickVenueFor(JSON.parse(t.dataset.vpick)); return; }
      if (t.dataset.copylink) { navigator.clipboard.writeText(t.dataset.copylink).then(()=>toast('복사했습니다')).catch(()=>toast('복사하지 못했습니다')); return; }
      sync();
      if (t.dataset.tconv) {
        if (t.dataset.tconv==='new') { const k=toKrw($('#t-local').value, $('#t-cur').value); if (k==null) return toast('환율이 아직 없습니다'); $('#t-amount').value=won(k); toast(won(k)+'원으로 넣었습니다'); return; }
        const b=(draft.trips||[]).find(x=>x.id===t.dataset.tconv); if (!b) return; const k=toKrw(b.localAmount, b.currency||curDef()); if (k==null) return toast('환율이 아직 없습니다'); b.amount=k; saveTrips(); repaint(); toast(won(k)+'원으로 넣었습니다'); return; }
      if (t.id==='addTrip') { const b={ id:uid(), type:$('#t-type').value, ref:$('#t-ref').value.trim(), start:$('#t-start').value, end:$('#t-end').value, amount:num($('#t-amount').value), currency:$('#t-cur').value, localAmount:num($('#t-local').value) }; if (!b.amount && !b.ref && !b.start && !b.localAmount) return toast('금액이나 예약번호를 적어 주세요'); (draft.trips=draft.trips||[]).push(b); saveTrips(); repaint(); return; }
      if (t.dataset.deltrip) { draft.trips=(draft.trips||[]).filter(x=>x.id!==t.dataset.deltrip); saveTrips(); repaint(); return; }
      if (t.dataset.mode) { draft.amountMode = t.dataset.mode; repaint(); }
      if (t.id==='addPay') { const a=num($('#p-amount').value); if (!a) return toast('금액을 적어 주세요'); store.put('payments', { id:uid(), vendorId:v.id, title:$('#p-title').value, amount:a, dueDate:$('#p-date').value, paidAt:'', payer:$('#p-payer').value, method:$('#p-method').value, memo:$('#p-memo').value.trim() }); repaint(); }
      if (t.id==='addQ') { const q=$('#q-new').value.trim(); if (!q) return; (draft.questions=draft.questions||[]).push({id:uid(),q,a:'',done:false}); store.put('vendors', draft); repaint(); }
      if (t.id==='addX') { const ti=$('#x-title').value.trim(), a=num($('#x-amount').value); if (!ti) return; (draft.extras=draft.extras||[]).push({id:uid(),title:ti,amount:a}); store.put('vendors', draft); repaint(); }
      if (t.id==='addLink') { const url=normUrl($('#l-url').value); if (!url) return toast('주소를 확인해 주세요 (https://…)'); (draft.links=draft.links||[]).push({ id:uid(), title:$('#l-title').value.trim(), url }); store.put('vendors', draft); repaint(); }
      if (t.dataset.dellink) { draft.links = (draft.links||[]).filter(x=>x.id!==t.dataset.dellink); store.put('vendors', draft); repaint(); }
      if (t.dataset.delpay) { store.del('payments', t.dataset.delpay); repaint(); }
      if (t.dataset.delq) { draft.questions = draft.questions.filter(x=>x.id!==t.dataset.delq); store.put('vendors', draft); repaint(); }
      if (t.dataset.delx) { draft.extras = draft.extras.filter(x=>x.id!==t.dataset.delx); store.put('vendors', draft); repaint(); }
    },
    change(e){
      const t = e.target;
      sync();
      if (t.id==='f-cat') { repaint(); return; }
      if (t.dataset.tf) { const [k,id] = t.dataset.tf.split(':'); const b=(draft.trips||[]).find(x=>x.id===id); if (b) { b[k] = k==='amount'||k==='localAmount' ? num(t.value) : t.value.trim(); saveTrips(); if (k==='amount'||k==='currency') repaint(); } return; }
      if (t.id==='t-cur') { const box=t.closest('.pay'); box.querySelector('.fx').textContent=fxHint(t.value); box.querySelector('[data-tconv]').disabled=!krwPer(t.value); return; }
      if (t.dataset.paid) { const p = state.payments.find(x=>x.id===t.dataset.paid); if (p) { store.put('payments', Object.assign({}, p, { paidAt: t.checked ? today() : '' })); repaint(); } }
      if (t.dataset.pf) { const [k,id] = t.dataset.pf.split(':'); const p = state.payments.find(x=>x.id===id); if (p) { const val = k==='amount' ? num(t.value) : t.value; store.put('payments', Object.assign({}, p, { [k]: val })); if (k==='amount') repaint(); } }
      if (t.dataset.qdone) { sync(); const q=(draft.questions||[]).find(x=>x.id===t.dataset.qdone); if (q) { q.done=t.checked; store.put('vendors', draft); } }
      if (t.dataset.qa) { sync(); const q=(draft.questions||[]).find(x=>x.id===t.dataset.qa); if (q) { q.a=t.value; store.put('vendors', draft); } }
    }
  });
  /* 예식장 이름 칸에서 웨딩홀을 골랐다. 카카오 결과면 우리 목록에도 남겨 표기를 맞추고, 지도 링크를 붙인다. */
  async function pickVenueFor(p){
    try {
      let picked = p;
      if (p.kakaoId) { const r = await store.call('POST','/api/venues',{ kakaoId:p.kakaoId, name:p.name, placeUrl:p.placeUrl, region:state.settings.region||'' }); picked = r.venue; }
      sync(); draft.name = picked.name; draft.venueId = picked.id;
      const url = picked.placeUrl || p.placeUrl;
      if (url && !(draft.links||[]).some(l=>l.url===url)) (draft.links=draft.links||[]).push({ id:uid(), title:'카카오맵', url });
      if (!isNew) store.put('vendors', draft);
      repaint(); toast(picked.name+'(으)로 골랐습니다');
    } catch(err){ toast(err.message); }
  }
  function repaint(){ const sc = $('#sheetBody').scrollTop; $('#sheetBody').innerHTML = body(); $('#sheetBody').scrollTop = sc; }
}

export function fileList(fs){
  if (!fs.length) return '<p class="muted small">아직 없음</p>';
  return '<div class="list">'+fs.map(f=>'<div class="it"><span class="pill dim">'+KINDS[f.kind]+'</span><div class="t"><b><a href="'+f.url+'" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">'+esc(f.name)+'</a></b><small>'+fmtB(f.size)+(f.memo?' · '+esc(f.memo):'')+'</small></div>'+(f.kind==='audio'?'<audio controls preload="none" src="'+f.url+'" style="height:30px;width:140px"></audio>':'')+'<a class="btn sm" href="'+f.url+'?dl=1" download="'+esc(f.name)+'">받기</a><button class="x" data-delfile="'+f.id+'">×</button></div>').join('')+'</div>';
}
