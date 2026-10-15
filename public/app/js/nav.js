/* Wedding Management · © 2026 myoung. All rights reserved.
 * 뒤로가기. 탭·하위 탭을 옮길 때마다 기록을 남기고, 시트·상담용 보기·사용 안내가 열리면 한 칸 더 쌓는다.
 * 그래서 뒤로가기는 먼저 열린 창을 닫고, 다음엔 앞 화면으로 돌아간다. 앱 밖으로 나가는 건 맨 처음 화면에서뿐. */
import { render } from './render.js';
import { state } from './state.js';

const key = () => '#' + state.view + (state.sub[state.view] ? '/' + state.sub[state.view] : '');
let overlay = null;      // 지금 열린 창을 닫는 함수
let backing = false;     // 창을 버튼으로 닫아 history.back() 을 부르고 popstate 를 기다리는 중
let queued = [];         // 그 사이에 들어온 기록 작업. popstate 뒤에 한다
let guard = null;        // 화면을 떠나기 전에 물을 것 (하객 그리드의 저장 안 한 행). fn(이어서 할 일) → 지금 옮겨도 되면 true

export function setGuard(fn){ guard = fn; }
/* guard 가 막지 않으면 바로, 막으면 사용자가 고른 뒤에 fn 을 한다 */
export function guarded(fn){ if (!guard || guard(fn)) fn(); }

/* 사용 안내는 창 안에서 탭을 옮긴다. 닫혔을 때 화면이 주소와 다르면 앞 화면을 덮지 않고 새로 쌓는다 */
function settle(){ if (location.hash !== key()) history.pushState(null, '', key()); }
function later(fn){ if (backing) queued.push(fn); else fn(); }
function readHash(){
  const [v, s] = location.hash.slice(1).split('/');
  if (!/^[a-z]+$/.test(v) || !document.querySelector('#tabs [data-view="'+v+'"]')) return false;   // 숨긴 탭(배포본의 하객)은 주소로도 못 연다
  state.view = v; if (s) state.sub[v] = s;
  return true;
}

/* 탭·하위 탭 이동. sub 만 바꾸려면 view 에 지금 탭을 넘긴다 */
export function go(view, sub){
  const moved = state.view !== view;
  if (moved && guard && !guard(() => go(view, sub))) return;
  state.view = view; if (sub) state.sub[view] = sub;
  if (moved) { state.openCat = null; window.scrollTo(0,0); }
  later(() => { if (location.hash !== key()) history.pushState(null, '', key()); });
  render();
}

/* 창이 열릴 때 닫는 함수를 넘긴다. 이미 열린 창 위에 다른 내용을 그리는 경우엔 기록을 더 쌓지 않는다 */
export function opened(close){
  const fresh = !overlay; overlay = close;
  if (fresh) later(() => { if (overlay) history.pushState({ ov:1 }, '', key()); });
}
/* 창을 버튼·Esc 로 닫았을 때. 뒤로가기로 닫힌 경우는 overlay 가 이미 비어 있어 아무것도 안 한다 */
export function closed(){
  if (!overlay) return; overlay = null;
  if (history.state && history.state.ov && !backing) { backing = true; history.back(); }
}

export function init(){
  readHash();
  history.replaceState(null, '', key());
  addEventListener('popstate', () => {
    if (backing) {
      backing = false;
      settle();
      const q = queued; queued = []; q.forEach(fn => fn());
      return;
    }
    if (overlay) { const c = overlay; overlay = null; c(); settle(); return; }
    /* 뒤로가기로 하객 화면을 떠나려는데 저장 안 한 행이 있으면, 주소를 되돌려 놓고 묻는다 */
    const want = location.hash.slice(1).split('/');
    if (guard && /^[a-z]+$/.test(want[0]) && want[0] !== state.view && !guard(() => go(want[0], want[1]))) { history.pushState(null, '', key()); return; }
    if (readHash()) { state.openCat = null; render(); }
  });
}
