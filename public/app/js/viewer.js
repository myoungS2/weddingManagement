/* Wedding Management · © 2026 myoung. All rights reserved.
 * 레퍼런스 상담용 보기(전체 화면 넘기기). */
import { state } from './state.js';
import { $, esc } from './util.js';

/* 상담용 보기 */
let showList = [], showIdx = 0;
export function openShow(list, idx){ showList=list; showIdx=idx||0; showHint=true; paintShow(); $('#show').hidden=false; document.body.style.overflow='hidden'; }
let showHint=false;
export function paintShow(){ const f = showList[showIdx]; if (!f) return; const firstPaint = showHint; const tags = state.refFileTags.filter(x=>x.fileId===f.id).map(x=>(state.refTags.find(t=>t.id===x.tagId)||{}).name).filter(Boolean);
  $('#show').innerHTML = (showHint?'<div class="hint">옆으로 넘기세요 · 아래로 쓸어 닫기</div>':'')+'<img src="'+f.url+'" alt=""><button class="nv l" aria-label="이전"></button><button class="nv r" aria-label="다음"></button><button class="cl" aria-label="닫기">×</button><div class="cap">'+(showIdx+1)+' / '+showList.length+(f.who?' · '+(f.who==='groom'?'신랑용':'신부용'):'')+(tags.length?' · '+esc(tags.join(' · ')):'')+(f.memo?'<br>'+esc(f.memo):'')+'</div>'; showHint=false; }
export function showStep(d){ if (!showList.length) return; showIdx=(showIdx+d+showList.length)%showList.length; paintShow(); }
export function closeShow(){ $('#show').hidden=true; document.body.style.overflow=''; }
/* 스와이프(터치·마우스 드래그), 키보드 화살표, 휠로 넘긴다 */
let swX=null, swY=null, swiped=false, wheelAt=0;
/* 이벤트 연결. main.js 가 한 번 부른다. */
export function init() {
  $('#show').addEventListener('click', e => { if (swiped) { swiped=false; return; } if (e.target.classList.contains('cl') || e.target.tagName==='IMG') closeShow(); else if (e.target.classList.contains('l')) showStep(-1); else if (e.target.classList.contains('r')) showStep(1); });
  $('#show').addEventListener('pointerdown', e => { swX=e.clientX; swY=e.clientY; });
  $('#show').addEventListener('pointerup', e => { if (swX==null) return; const dx=e.clientX-swX, dy=e.clientY-swY; swX=null; if (Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)*1.5) { swiped=true; showStep(dx<0?1:-1); } else if (dy>90 && Math.abs(dy)>Math.abs(dx)*1.5) { swiped=true; closeShow(); } });
  $('#show').addEventListener('wheel', e => { const now=Date.now(); if (now-wheelAt<350) return; const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY; if (Math.abs(d)<8) return; wheelAt=now; showStep(d>0?1:-1); e.preventDefault(); }, { passive:false });
  document.addEventListener('keydown', e => { if ($('#show').hidden) return; if (e.key==='ArrowRight'||e.key===' ') { showStep(1); e.preventDefault(); } if (e.key==='ArrowLeft') { showStep(-1); e.preventDefault(); } });
}
