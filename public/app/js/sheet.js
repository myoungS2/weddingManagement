/* Wedding Management · © 2026 myoung. All rights reserved.
 * 오른쪽(넓은 화면)·아래(좁은 화면)에서 열리는 편집 시트와 메모. */
import { paintHelper } from './guide.js';
import { state } from './state.js';
import { store } from './store.js';
import { $, arm, esc, filesOf, toast, uid } from './util.js';
import { fileList } from './views/budget.js';

/* ═══ 시트 ═════════════════════════════════ */
let sheetHandlers = null;
export function openSheet(title, body, buttons, handlers){
  $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = typeof body==='function' ? body() : body;
  const ft = $('#sheetFoot'); ft.innerHTML='';
  buttons.filter(Boolean).forEach(b => { const el=document.createElement('button'); el.className='btn '+(b.cls||''); el.textContent=b.label; if (b.cls==='primary') el.style.marginLeft='auto'; el.onclick=()=>b.onClick(el); ft.appendChild(el); });
  sheetHandlers = handlers||null;
  $('#scrim').hidden=false; $('#sheet').hidden=false; document.body.style.overflow='hidden'; $('#helper').hidden=true;
  const f = $('#sheetBody').querySelector('input,textarea,select'); if (f && matchMedia('(min-width:900px)').matches) f.focus();
}
export function closeSheet(){ $('#scrim').hidden=true; $('#sheet').hidden=true; document.body.style.overflow=''; sheetHandlers=null; paintHelper(); }

export function openMemo(id){
  const m = id ? state.memos.find(x=>x.id===id) : { id:uid(), title:$('#m-title')?$('#m-title').value.trim():'', body:'' };
  if (!m) return;
  openSheet(id?'메모':'새 메모', ()=>'<div class="field"><label>제목</label><input id="mm-title" value="'+esc(m.title||'')+'"></div><div class="field"><label>내용</label><textarea id="mm-body" style="min-height:260px">'+esc(m.body||'')+'</textarea></div>'+(id?'<div class="sub-list"><h4>첨부 <span class="right">음성 · 원고 파일</span></h4>'+fileList(filesOf('memo',id))+'<button class="btn sm" data-upload="memo:'+id+'" style="margin-top:8px"'+(state.filesOn?'':' disabled')+'>+ 파일</button></div>':''), [
    id ? { label:'삭제', cls:'danger', onClick:(b)=>{ if (!arm(b)) return; closeSheet(); store.del('memos', id); } } : null,
    { label:'저장', cls:'primary', onClick:()=>{ const t=$('#mm-title').value.trim(), b=$('#mm-body').value; closeSheet(); store.put('memos', Object.assign({}, m, { title:t||'제목 없음', body:b, updatedAt:new Date().toISOString() })); toast('저장됨'); } }
  ]);
}
/* 이벤트 연결. main.js 가 한 번 부른다. */
export function init() {
  $('#sheetClose').onclick = closeSheet;
  $('#scrim').onclick = closeSheet;
  $('#sheetBody').addEventListener('click', e => { if (sheetHandlers && sheetHandlers.click) sheetHandlers.click(e); });
  $('#sheetBody').addEventListener('change', e => { if (sheetHandlers && sheetHandlers.change) sheetHandlers.change(e); });
}
