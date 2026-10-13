/* Wedding Management · © 2026 myoung. All rights reserved.
 * 홈: D-day · 예산 게이지 · 다가오는 결제와 일정 · 할 일. */
import { PAYER } from '../constants.js';
import { warnLocal } from '../render.js';
import { state } from '../state.js';
import { budgetRows, days, esc, fmtD, man, stageNow, today, vendorOf, won } from '../util.js';

/* ── 홈 ── */
export function renderHome(){
  const s = state.settings, d = days(s.weddingDate), b = budgetRows().total;
  const names = [s.groom, s.bride].filter(Boolean).join(' · ');
  const pays = state.payments.filter(p=>!p.paidAt && p.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,5);
  const evs = state.events.filter(e=>e.kind!=='dday' && e.date && e.date>=today()).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).slice(0,4);
  const late = state.tasks.filter(t=>!t.done && t.due && t.due<today());
  const todo = state.tasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9')).slice(0,6);
  const pct = b.budget ? Math.round(b.expect/b.budget*100) : 0;
  return warnLocal() +
    '<div class="hero"><img class="doves couple" src="/art/couple.webp" alt=""><div class="in"><div class="dd">'+(d==null?'예식일 미정':(d>=0?'D-'+d:'D+'+(-d)))+(s.weddingDate?'<small>'+esc(s.weddingDate)+(names?' · '+esc(names):'')+'</small>':'')+'</div>' +
    '<span class="pill pink stage">'+esc(stageNow())+'</span>' +
    (d==null?'<div style="margin-top:10px"><button class="btn primary sm" data-go="more:settings">예식일 정하기</button></div>':'')+'</div></div>' +
    (late.length?'<div class="notice bad">기한이 지난 할 일 '+late.length+'개: '+esc(late.slice(0,3).map(t=>t.title).join(', '))+(late.length>3?' 외':'')+'</div>':'') +
    '<div class="card"><div class="row"><b>예산</b><span class="right num">'+(b.budget?won(b.expect)+' / '+won(b.budget)+'원':'총예산을 정하면 게이지가 보여요')+'</span></div>' +
    '<div class="gauge'+(pct>100?' over':'')+'"><i style="width:'+Math.min(pct,100)+'%"></i></div>' +
    '<div class="line"><span>확정 '+man(b.fixed)+' · 예상 '+man(b.expect)+'</span><span>지출 '+man(b.spent)+'</span></div></div>' +
    '<div class="cards" style="margin-top:12px">' +
    '<div class="card"><h2 class="ct">다가오는 결제</h2>'+(pays.length?'<div class="list">'+pays.map(p=>{ const v=vendorOf(p.vendorId); return '<div class="it" data-vendor="'+esc(p.vendorId)+'" style="cursor:pointer"><div class="t"><b>'+esc(v?v.name:'?')+' · '+esc(p.title)+'</b><small>'+fmtD(p.dueDate)+' · D'+(days(p.dueDate)>=0?'-':'+')+Math.abs(days(p.dueDate))+'</small></div><span class="num">'+won(p.amount)+'</span></div>'; }).join('')+'</div>':'<p class="muted small">예정된 결제가 없습니다.</p>')+'</div>' +
    '<div class="card"><h2 class="ct">다가오는 일정</h2>'+(evs.length?'<div class="list">'+evs.map(e=>'<div class="it"><div class="t"><b>'+esc(e.title)+'</b><small>'+fmtD(e.date)+' '+esc(e.time||'')+(e.vendorId&&vendorOf(e.vendorId)?' · '+esc(vendorOf(e.vendorId).name):'')+'</small></div><span class="muted small">D-'+days(e.date)+'</span></div>').join('')+'</div>':'<p class="muted small">일정이 없습니다. 일정 탭에서 추가하세요.</p>')+'</div>' +
    '<div class="card"><h2 class="ct">할 일</h2>'+(todo.length?'<div class="list">'+todo.map(taskRow).join('')+'</div>':'<p class="muted small">일정 탭에서 "준비 가이드 채우기"를 누르면 예식일에 맞춘 할 일이 생깁니다.</p>')+'</div>' +
    '</div>';
}
export function taskRow(t){ return '<div class="it'+(t.done?' done':'')+'"><input type="checkbox" class="chk" data-task="'+esc(t.id)+'" '+(t.done?'checked':'')+' aria-label="완료"><div class="t"><b>'+esc(t.title)+'</b><small>'+esc(t.group||'')+(t.due?' · '+fmtD(t.due):'')+(t.who&&t.who!=='both'?' · '+PAYER[t.who]:'')+'</small></div><button class="x" data-deltask="'+esc(t.id)+'" aria-label="삭제">×</button></div>'; }
