/* Wedding Management · © 2026 myoung. All rights reserved.
 * 현재 탭을 그린다. */
import { paintHelper } from './guide.js';
import { state } from './state.js';
import { $, esc } from './util.js';
import { renderBudget } from './views/budget.js';
import { renderGuest } from './views/guest.js';
import { renderHome } from './views/home.js';
import { renderMore } from './views/more.js';
import { renderPlan } from './views/plan.js';
import { renderTrip } from './views/trip.js';

/* ═══ 그리기 ═══════════════════════════════ */
export function render(){
  document.querySelectorAll('#tabs [data-view]').forEach(b => b.setAttribute('aria-current', b.dataset.view===state.view ? 'page' : 'false'));
  $('#me').innerHTML = state.user ? esc(state.user.name) + '<br><span class="small">' + esc(state.plan ? state.plan.name : '') + '</span>' : '<span class="small">이 기기에만 저장 중</span>';
  const v = $('#view');
  if (state.loading) { v.innerHTML = '<p class="muted" style="padding:40px 0;text-align:center">불러오는 중…</p>'; return; }
  paintHelper();
  v.innerHTML = '<div class="mbrand"><button id="replayIntro" aria-label="인트로 다시 보기"><img src="/wordmark.webp?v=5" alt="Wedding Management"></button></div>' +
    ({ home:renderHome, budget:renderBudget, plan:renderPlan, guest:renderGuest, trip:()=>renderTrip(''), more:renderMore })[state.view]();
}
export function head(title, sub, right){ return '<header class="ph"><div><h1>'+title+'</h1>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>'+(right||'')+'</header>'; }
export function segs(key, opts){ return '<div class="segs">'+opts.map(([k,l])=>'<button data-sub="'+key+':'+k+'" aria-pressed="'+(state.sub[key]===k)+'">'+l+'</button>').join('')+'</div>'; }
export function emptyBox(msg, btn, art){ return '<div class="empty">'+(art?'<img src="/art/'+art+'.webp" alt="">':'')+msg+(btn?'<div style="margin-top:10px">'+btn+'</div>':'')+'</div>'; }
export function warnLocal(){ return state.mode==='local' ? '<div class="notice">서버에 연결되지 않아 이 브라우저에만 저장됩니다. 파일 올리기와 함께 쓰기는 배포한 뒤에 됩니다.</div>' : ''; }
