/* Wedding Management · © 2026 myoung. All rights reserved.
 * 비둘기 도우미 · 사용 안내 투어 · 인트로. */
import { render } from './render.js';
import { state } from './state.js';
import { $, esc, toast, today } from './util.js';

/* ═══ 인트로와 시작 ═══════════════════════════ */
/* 비둘기 도우미. 'open' | 'min' | 'never' 를 이 브라우저에 기억한다 */
export function helperMode(){ try { return localStorage.getItem('wm.helper') || 'open'; } catch(e){ return 'open'; } }
export function setHelper(m){ try { localStorage.setItem('wm.helper', m); } catch(e){} paintHelper(); }
export function paintHelper(){
  const h = $('#helper'); const m = helperMode();
  if (state.view!=='home' || m==='never' || guideOn || !$('#sheet').hidden) { h.hidden=true; return; }
  h.hidden=false;
  h.innerHTML = m==='min'
    ? '<button class="mini" id="helperOpen" aria-label="사용 안내 열기"><img src="/art/doveheart.webp" alt=""></button>'
    : '<div class="hc"><button class="x" id="helperMin" aria-label="접어두기">×</button><img src="/art/doveheart.webp" alt=""><b>처음이세요?</b><p>화면 위에서 하나씩 짚어 드려요. 예산 적는 법부터 파트너 초대까지 10단계.</p>' +
      '<div class="row"><button class="btn primary sm" id="helperGuide">사용 안내 보기</button><button class="btn ghost sm" id="helperMin2">접어두기</button><button class="btn ghost sm" id="helperNever" style="color:var(--muted)">다시 보지 않기</button></div></div>';
}
/* 사용 안내: 가입 직후(#guide) 한 번, 더보기·메인에서 언제든. 각 단계가 실제 화면의 요소를 짚는다. */
export const GUIDE_STEPS = [
  { view:'home', target:'.hero', title:'홈은 오늘 할 일만', body:'D-day와 지금 단계가 먼저 보여요. 설정에서 예식일과 총예산을 넣으면 예산 게이지와 다가오는 결제가 살아납니다.' },
  { view:'budget', target:'#tabs [data-view="budget"]', title:'예산 = 업체', body:'예산 탭에서 업체를 적습니다. 업체 하나가 예산 항목 하나예요. 후보로 적어 두고 계약하면 상태만 바꾸세요.' },
  { view:'budget', target:'header.ph [data-addvendor]', title:'업체 적기', body:'이 버튼으로 업체를 추가해요. 금액은 직접 쓰거나 단가 × 수량으로. 저장하면 바로 결제(예약금·중도금·잔금)와 질문, 첨부를 적을 수 있어요.' },
  { view:'budget', target:'.segs [data-sub="budget:vendor"]', title:'금액 뷰와 업체 뷰', body:'금액 뷰는 카테고리별 예산·예상·확정·지출·잔금 표, 업체 뷰는 카드예요. 표의 행을 누르면 그 카테고리 업체가 펼쳐집니다.' },
  { view:'plan', target:'#tabs [data-view="plan"]', title:'예식일 역산 준비 순서', body:'일정 탭에서 "준비 가이드 채우기"를 한 번 누르면 D-12개월부터 D-7까지 할 일이 날짜에 맞춰 생겨요.' },
  { view:'plan', sub:['plan','dday'], target:'.segs [data-sub="plan:dday"]', title:'본식 식순', body:'시작 시각과 단계별 소요시간만 적으면 시각이 이어서 계산돼요. 입장곡·식전영상은 단계마다 첨부합니다.' },
  { view:'trip', target:'#tabs [data-view="trip"]', title:'신혼여행', body:'날짜별 일정과 하고 싶은 것, 항공·숙소 예약을 적어요. 예약은 예산의 신혼여행 카테고리에 자동으로 합산되고 환율 환산도 됩니다.' },
  { view:'more', sub:['more','menu'], target:'[data-go="more:ref"]', title:'레퍼런스', body:'헤어·드레스·촬영 컨셉 캡처를 모아 두고, 상담 때 "상담용 보기"로 넘겨 보세요. 신랑용·신부용으로 나눠 둘 수 있어요.' },
  { view:'more', sub:['more','menu'], target:'[data-go="more:files"]', title:'파일함', body:'업체에 붙인 계약서, 식순에 붙인 입장곡과 영상이 여기 모여요. 당일 전달 묶음은 음향팀에 넘길 때 씁니다.' },
  { view:'more', sub:['more','menu'], target:'[data-go="more:share"]', title:'둘이 같이 쓰기', body:'함께하기에서 파트너 초대 링크를 만들어 보내세요. 같은 장부를 둘 다 보고 고칩니다. 이 안내는 더보기에서 다시 볼 수 있어요.', last:'설정에서 시작하기' }
];
let guideIdx = 0, guideOn = false;
export function openGuide(i){ guideIdx = i||0; guideOn = true; $('#guide').hidden=false; $('#helper').hidden=true; paintGuide(); }
export function closeGuide(){ guideOn=false; $('#guide').hidden=true; try { localStorage.setItem('wm.guide','1'); } catch(e){} paintHelper(); }
export function paintGuide(){
  const g = GUIDE_STEPS[guideIdx], last = guideIdx===GUIDE_STEPS.length-1;
  if (state.view!==g.view || (g.sub && state.sub[g.sub[0]]!==g.sub[1])) { state.view=g.view; if (g.sub) state.sub[g.sub[0]]=g.sub[1]; render(); }
  $('#guide').innerHTML = '<div class="spot"></div><svg class="hand" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V11m0-3a1.5 1.5 0 0 1 3 0v3m0-1a1.5 1.5 0 0 1 3 0v5.5A6.5 6.5 0 0 1 14.5 22h-2.3a6.5 6.5 0 0 1-5.4-2.9L3.4 14a1.6 1.6 0 0 1 2.6-1.8L9 15" fill="#fff" stroke="#C23A55" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>' +
    '<div class="tip below"><div class="step">사용 안내 '+(guideIdx+1)+' / '+GUIDE_STEPS.length+'</div><h3>'+esc(g.title)+'</h3><p>'+esc(g.body)+'</p>' +
    '<div class="dots">'+GUIDE_STEPS.map((_,i)=>'<i class="'+(i===guideIdx?'on':'')+'"></i>').join('')+'</div>' +
    '<div class="gf"><button class="btn ghost sm" id="gSkip">'+(last?'닫기':'건너뛰기')+'</button>'+(guideIdx>0?'<button class="btn sm right" id="gPrev">이전</button>':'')+'<button class="btn primary sm'+(guideIdx>0?'':' right')+'" id="gNext">'+(last?(g.last||'시작하기'):'다음')+'</button></div></div>';
  requestAnimationFrame(()=>requestAnimationFrame(placeGuide));
}
export function placeGuide(){
  if (!guideOn) return;
  const g = GUIDE_STEPS[guideIdx]; const el = document.querySelector(g.target);
  const spot=$('#guide .spot'), hand=$('#guide .hand'), tip=$('#guide .tip'); if (!spot||!tip) return;
  if (!el) { spot.style.display='none'; hand.style.display='none'; tip.className='tip'; tip.style.left='12px'; tip.style.top='auto'; tip.style.bottom='calc(var(--nav) + 16px + env(safe-area-inset-bottom,0px))'; return; }
  let r = el.getBoundingClientRect();
  const navTop = matchMedia('(min-width:900px)').matches ? innerHeight : innerHeight - 66;
  if (r.top < 70 || r.bottom > navTop - 10) { el.scrollIntoView({ block:'center', behavior:'instant' }); r = el.getBoundingClientRect(); }
  const pad = 6; spot.style.display=''; hand.style.display='';
  spot.style.left=(r.left-pad)+'px'; spot.style.top=(r.top-pad)+'px'; spot.style.width=(r.width+pad*2)+'px'; spot.style.height=(r.height+pad*2)+'px';
  hand.style.left=(r.left + Math.min(r.width*0.6, r.width-10))+'px'; hand.style.top=(r.top + r.height*0.55)+'px';
  const tw = Math.min(340, innerWidth-24), th = tip.offsetHeight || 190;
  const below = r.bottom + 14 + th < navTop - 8;
  let left = Math.max(12, Math.min(innerWidth - tw - 12, r.left + r.width/2 - tw/2));
  tip.className = 'tip ' + (below ? 'below' : 'above');
  tip.style.left = left+'px'; tip.style.bottom='auto';
  tip.style.top = (below ? r.bottom + 14 : Math.max(12, r.top - 14 - th)) + 'px';
  tip.style.setProperty('--ax', Math.max(16, Math.min(tw-30, r.left + r.width/2 - left - 7))+'px');
}
export function maybeGuide(delay){
  if (location.hash==='#guide') { history.replaceState(null,'',location.pathname); setTimeout(()=>openGuide(0), delay==null ? 3800 : delay); }
}
export function playIntro(force){
  let seen = false; try { seen = localStorage.getItem('wm.intro')===today(); if (!force) localStorage.setItem('wm.intro', today()); } catch(e){}
  if ((seen && !force) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = $('#intro'); el.hidden=false; el.classList.remove('out');
  const imgs = el.querySelectorAll('img'); imgs.forEach(i => { i.style.animation='none'; void i.offsetWidth; i.style.animation=''; });
  const end = () => { el.classList.add('out'); setTimeout(()=>{ el.hidden=true; }, 450); };
  setTimeout(end, 3600); el.addEventListener('click', end, { once:true });
}
/* 이벤트 연결. main.js 가 한 번 부른다. */
export function init() {
  $('#helper').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id==='helperGuide') { openGuide(0); return; }
    if (t.id==='helperOpen') return setHelper('open');
    if (t.id==='helperMin' || t.id==='helperMin2') return setHelper('min');
    if (t.id==='helperNever') { setHelper('never'); toast('더보기 → 사용 안내에서 다시 볼 수 있어요'); }
  });
  addEventListener('resize', ()=>{ if (guideOn) placeGuide(); });
  $('#guide').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id==='gSkip') closeGuide();
    if (t.id==='gNext') { if (guideIdx>=GUIDE_STEPS.length-1) { closeGuide(); state.view='more'; state.sub.more='settings'; render(); window.scrollTo(0,0); } else { guideIdx++; paintGuide(); } }
    if (t.id==='gPrev') { guideIdx=Math.max(0,guideIdx-1); paintGuide(); }
  });
  addEventListener('hashchange', ()=>maybeGuide(0));
}
