/* Wedding Management · © 2026 myoung. All rights reserved.
 * 하객 명단·장부 (배포본에선 탭을 숨기고 로컬에서만 보인다).
 * 엑셀처럼 칸을 바로 고치는 그리드. 행 추가·복사·삭제는 화면의 초안(rows)에만 하고, 저장을 눌러야 한꺼번에 들어간다.
 * 저장 안 한 행이 있는데 다른 화면·필터로 옮기려 하면 먼저 묻는다(nav.js 의 setGuard). */
import { SIDE } from '../constants.js';
import { download } from '../export.js';
import { setGuard } from '../nav.js';
import { render, emptyBox, head, warnLocal } from '../render.js';
import { closeSheet, openSheet } from '../sheet.js';
import { state } from '../state.js';
import { store } from '../store.js';
import { $, budgetRows, esc, num, rels, toast, uid, won } from '../util.js';
import { readXlsx, writeXlsx } from '../xlsx.js';

/* 칸 순서. 붙여넣기·엑셀 양식·올리기 모두 이 순서 */
const COLS = [
  { f:'side',    h:'측',     re:/^(측|구분|신랑\/?신부)$/ },
  { f:'rel',     h:'관계',   re:/관계|그룹/ },
  { f:'name',    h:'이름',   re:/이름|성명|성함/ },
  { f:'invited', h:'청첩장 전달여부', re:/청첩장/ },
  { f:'rsvp',    h:'참석여부', re:/참석|응답/ },
  { f:'plus',    h:'동반인원', re:/동반/ },
  { f:'gift',    h:'축의금', re:/축의/ },
  { f:'meal',    h:'식권',   re:/식권/ },
  { f:'memo',    h:'비고',   re:/메모|비고/ }
];
const RS = { '':'미정', y:'참석', n:'불참' };
const NUMS = ['plus','gift','meal'];

/* ── 초안 ── */
let rows = null;            // [{ k, orig(저장된 값 | null=신규), g(고치는 중인 값), del }]
const sel = new Set();      // 선택한 행의 k
const pick = g => ({ id:g.id, side:g.side||'groom', rel:g.rel||'', name:g.name||'', invited:!!g.invited, rsvp:g.rsvp||'', plus:num(g.plus), gift:num(g.gift), meal:num(g.meal), memo:g.memo||'' });
const same = (a, b) => COLS.every(({f}) => String(a[f]??'') === String(b[f]??''));
const status = r => r.del ? 'del' : !r.orig ? 'new' : same(r.g, r.orig) ? '' : 'mod';
const BADGE = { new:'신규', mod:'수정', del:'삭제' };
function blank(from){ const b = from && from.g; return { id:uid(), side:b?b.side:'groom', rel:b?b.rel:rels()[0], name:'', invited:false, rsvp:'', plus:0, gift:0, meal:0, memo:'' }; }
const fresh = g => ({ k:uid(), orig:null, g, del:false });
/* 저장된 하객을 초안에 다시 맞춘다. 고치는 중인 행과 신규 행은 그대로 둔다 */
function sync(){
  const mine = new Map((rows||[]).filter(r => r.orig).map(r => [r.orig.id, r]));
  const saved = state.guests.slice().sort((a,b)=>a.side.localeCompare(b.side)||String(a.rel).localeCompare(String(b.rel))||a.name.localeCompare(b.name)).map(x => {
    const r = mine.get(x.id), o = pick(x);
    if (r && status(r)) { r.orig = o; return r; }
    return { k:x.id, orig:o, g:Object.assign({}, o), del:false };
  });
  rows = saved.concat((rows||[]).filter(r => !r.orig));
  for (const k of [...sel]) if (!rows.some(r => r.k===k)) sel.delete(k);
}
/* 저장할 게 있는 행 수. 아무것도 안 적은 새 행은 세지 않는다 */
const dirty = () => (rows||[]).filter(r => status(r) && (r.orig || r.g.name.trim())).length;
const byK = k => rows.find(r => r.k===k);
/* 삭제한 행은 저장 전에도 숨긴다. 되살리려면 변경 취소 */
/* 검색어: 이름·관계·비고에서 찾는다. 공백은 무시 */
let query = '';
const flat = x => String(x||'').replace(/\s+/g,'').toLowerCase();
const hit = g => !query || [g.name, g.rel, g.memo].some(x => flat(x).includes(flat(query)));
const shown = () => rows.filter(r => !r.del).filter(r => !r.orig || ((state.guestF==='all' || (state.guestF==='inv' ? r.orig.invited : r.orig.side===state.guestF || r.orig.rel===state.guestF)) && hit(r.g)));

/* ── 그리기 ── */
function cell(r, f){
  const g = r.g, dis = r.del ? ' disabled' : '', a = ' data-f="'+f+'"'+dis;
  if (f==='side') return '<select'+a+'>'+Object.entries(SIDE).map(([v,l])=>'<option value="'+v+'"'+(g.side===v?' selected':'')+'>'+l+'</option>').join('')+'</select>';
  if (f==='rel') { const list = rels().includes(g.rel) || !g.rel ? rels() : rels().concat(g.rel); return '<select'+a+'>'+list.map(v=>'<option'+(g.rel===v?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select>'; }
  if (f==='invited') return '<input type="checkbox"'+a+(g.invited?' checked':'')+' aria-label="청첩장 전달">';
  if (f==='rsvp') return '<select'+a+' class="rs-'+(g.rsvp||'u')+'">'+Object.entries(RS).map(([v,l])=>'<option value="'+v+'"'+(g.rsvp===v?' selected':'')+'>'+l+'</option>').join('')+'</select>';
  if (f==='gift') return '<input'+a+' data-money inputmode="numeric" value="'+(g.gift?won(g.gift):'')+'" placeholder="0">';
  if (NUMS.includes(f)) return '<input'+a+' inputmode="numeric" value="'+(g[f]||'')+'" placeholder="0">';
  return '<input'+a+' value="'+esc(g[f])+'"'+(f==='name'?' placeholder="이름"':'')+'>';
}
function rowHtml(r, i){
  const st = status(r);
  return '<tr data-k="'+r.k+'" class="'+st+(sel.has(r.k)?' on':'')+'"><td class="ck"><input type="checkbox" data-sel'+(sel.has(r.k)?' checked':'')+' aria-label="행 선택"></td><td class="no">'+(i+1)+'<b>'+(BADGE[st]||'')+'</b></td>' +
    COLS.map(({f}) => '<td class="c-'+f+'">'+cell(r, f)+'</td>').join('') + '</tr>';
}
function bar(){
  const n = dirty(), s = sel.size;
  return '<div class="gbar" id="gbar"><button class="btn sm" id="gAdd">+ 행 추가</button><button class="btn sm" id="gCopy"'+(s?'':' disabled')+'>행 복사</button><button class="btn sm" id="gDel"'+(s?'':' disabled')+'>행 삭제</button>' +
    '<button class="btn sm primary" id="gSave"'+(n?'':' disabled')+'>저장'+(n?' ('+n+')':'')+'</button><span class="sp"></span>' +
    '<button class="btn sm ghost" id="gTpl">엑셀 양식</button><button class="btn sm ghost" id="gPick">엑셀 올리기</button><button class="btn sm ghost" id="gOut">엑셀 내려받기</button><input type="file" id="gFile" accept=".xlsx,.csv,.xls" hidden></div>';
}
/* 위쪽 카드. 계약한 예식장이 「단가 × 수량」이면 단가를 식대, 수량을 보증인원으로 보고 식권과 맞춰 본다 */
function summary(gs){
  const card = (label, big, unit, sub, color) => '<div class="card"><div class="muted small">'+label+'</div><div class="dd"'+(color?' style="color:'+color+'"':'')+'>'+big+'<small>'+unit+'</small></div>'+(sub?'<div class="muted small">'+sub+'</div>':'')+'</div>';
  const sent = gs.filter(g=>g.invited).length, came = gs.filter(g=>g.rsvp==='y').reduce((s,g)=>s+1+num(g.plus),0);
  const gift = gs.reduce((s,g)=>s+num(g.gift),0), meals = gs.reduce((s,g)=>s+num(g.meal),0), fixed = budgetRows().total.fixed;
  const v = state.vendors.find(x=>x.category==='venue' && x.status==='contracted');
  const unit = v && v.amountMode==='formula' ? num(v.unitPrice) : 0, guar = unit ? num(v.qty) : 0;
  /* 식대 패널: 계약(보증인원·식대)과 실제(참석·식권 사용)를 나란히. 보증보다 적게 왔을 때 얼마를 내는지는 업체마다 달라 계산하지 않는다 */
  const stat = (label, big, unit, sub) => '<div><div class="muted small">'+label+'</div><div class="v">'+big+'<small>'+unit+'</small></div>'+(sub?'<div class="muted small">'+sub+'</div>':'')+'</div>';
  let meal;
  if (!unit) meal = '<div class="card meal"><b>식대</b><p class="muted small" style="margin-top:4px">'+(v ? '예산의 '+esc(v.name)+' 금액을 「단가 × 수량」으로 적으면 보증인원·식대와 맞춰 봅니다.' : '예산에 예식장을 계약으로 넣고 금액을 「단가 × 수량」으로 적으면 보증인원·식대와 맞춰 봅니다.')+'</p></div>';
  else {
    const diff = meals - guar;
    const note = !meals ? '하객별 식권 수를 적으면 보증인원과 맞춰 봅니다.'
      : diff > 0 ? '보증보다 식권을 <b>'+diff+'장</b> 더 썼습니다 → 추가 식대 <b>'+won(diff*unit)+'원</b>'
      : diff < 0 ? '보증보다 식권을 '+(-diff)+'장 덜 썼습니다. 남은 식권을 돌려받는지는 계약서를 확인하세요.'
      : '보증인원만큼 식권을 썼습니다.';
    meal = '<div class="card meal"><b>식대 <span class="muted small">'+esc(v.name)+'</span></b><div class="mg">' +
      stat('보증인원', guar, '명') + stat('식대 (1인)', won(unit), '원', '계약 식대 '+won(guar*unit)+'원') +
      stat('실제 참석', came, '명', '참석 표시 + 동반인원') + stat('식권 사용', meals, '장', '= '+won(meals*unit)+'원') +
      '</div><p class="small" style="margin-top:8px;color:'+(diff>0?'var(--bad)':'var(--ink2)')+'">'+note+'</p></div>';
  }
  /* 정산: 확정 지출에는 예식장 「단가 × 보증인원」이 이미 들어 있다. 보증을 넘긴 식권만 더 뺀다 */
  const extra = unit && meals > guar ? (meals-guar)*unit : 0, net = gift - fixed - extra;
  return '<div class="cards" style="margin-bottom:14px">' +
    card('청첩장 전달', sent, ' / '+gs.length+'명') + card('참석', came, '명 (동반 포함)') +
    card('받은 축의금', won(gift), '원') +
    card('정산 (축의금 − 확정 지출'+(extra?' − 추가 식대':'')+')', (net>=0?'+':'−')+won(Math.abs(net)), '원', '', net>=0?'var(--good)':'var(--bad)') + '</div>' + meal;
}
export function renderGuest(){
  sync();
  const gs = state.guests, list = shown();
  const cards = gs.length ? summary(gs) : '';
  const filters = '<div class="filters">'+['all','inv','groom','bride',...rels()].map(k=>'<button data-gf="'+esc(k)+'" aria-pressed="'+(state.guestF===k)+'">'+(k==='all'?'전체':k==='inv'?'청첩장 전달':SIDE[k]||esc(k))+'</button>').join('')+'<input type="search" id="gq" class="gq" placeholder="이름·비고 검색" value="'+esc(query)+'" aria-label="하객 검색"></div>';
  const all = list.length && list.every(r => sel.has(r.k));
  const grid = list.length ? '<div class="tbl"><table id="gg"><colgroup><col class="w-ck"><col class="w-no">'+COLS.map(c=>'<col class="w-'+c.f+'">').join('')+'</colgroup><thead><tr><th class="ck"><input type="checkbox" data-selall'+(all?' checked':'')+' aria-label="모두 선택"></th><th class="no">No</th>'+COLS.map(c=>'<th class="c-'+c.f+'">'+c.h+'</th>').join('')+'</tr></thead><tbody>'+list.map(rowHtml).join('')+'</tbody></table></div>'
    : emptyBox(rows.some(r => !r.del) ? (query ? '「'+esc(query)+'」에 맞는 하객이 없습니다.' : '이 조건에 맞는 하객이 없습니다.') : '「+ 행 추가」로 한 줄씩 적거나, 엑셀 양식을 받아 채워 올리세요. 엑셀에서 여러 칸을 복사해 표에 붙여 넣어도 됩니다.');
  return warnLocal() + head('하객', gs.length+'명') + cards + filters + bar() + grid +
    '<p class="muted small" style="margin-top:8px">칸을 바로 고치고 <b>저장</b>을 눌러야 반영됩니다. Enter·↑↓로 위아래 칸을 옮기고, 엑셀에서 여러 칸을 복사해 붙여 넣으면 칸을 따라 채워집니다.</p>';
}
/* 표 전체를 다시 그리지 않고 행 표시·도구 막대만 고친다 (치는 중인 칸의 포커스를 지키려고) */
function paintRow(tr){ const r = byK(tr.dataset.k), st = status(r); tr.className = st+(sel.has(r.k)?' on':''); tr.querySelector('.no b').textContent = BADGE[st]||''; }
function paintBar(){ const el = $('#gbar'); if (el) el.outerHTML = bar(); }
function focusCell(k, f){ const el = document.querySelector('#gg tr[data-k="'+k+'"] [data-f="'+f+'"]'); if (el) { el.focus(); if (el.select) el.select(); } }

/* ── 글자 → 칸 값 (붙여넣기·엑셀) ── */
function setVal(g, f, v){
  v = String(v??'').trim();
  if (f==='side') { if (/신부|bride/i.test(v)) g.side='bride'; else if (/신랑|groom/i.test(v)) g.side='groom'; }
  else if (f==='rel') { if (v) g.rel = v; }
  else if (f==='invited') g.invited = /^(o|y|yes|true|1|v|✓|✔|ㅇ|전달|줌|드림)$/i.test(v);
  else if (f==='rsvp') g.rsvp = /^(참석|y|yes|o|ㅇ|1|true)$/i.test(v) ? 'y' : /^(불참|n|no|x|0|false)$/i.test(v) ? 'n' : '';
  else if (NUMS.includes(f)) g[f] = num(v);
  else g[f] = v;
}
/* lines 를 보이는 행 r0 의 c0 칸부터 채운다. 모자라면 신규 행을 붙인다 */
function fill(lines, r0, c0){
  const list = shown();
  lines.forEach((cols, i) => {
    let r = list[r0+i];
    if (!r) { r = fresh(blank(rows[rows.length-1])); rows.push(r); list.push(r); }
    if (r.del) return;
    cols.forEach((v, j) => { const c = COLS[c0+j]; if (c) setVal(r.g, c.f, v); });
  });
  render();
}

/* ── 엑셀 ── */
function template(){
  download('하객명단_양식.xlsx', writeXlsx([COLS.map(c=>c.h)], { sheet:'하객', widths:[8,10,14,15,10,7,12,7,28], lists:{ 0:['신랑','신부'], 1:rels(), 3:['O'], 4:['참석','불참','미정'] } }));
}
function exportXlsx(){
  const data = rows.filter(r => r.orig).map(r => r.orig).map(g => [SIDE[g.side], g.rel, g.name, g.invited?'O':'', g.rsvp?RS[g.rsvp]:'', g.plus||'', g.gift||'', g.meal||'', g.memo].map(x => x==null ? '' : String(x)));
  download('하객명단.xlsx', writeXlsx([COLS.map(c=>c.h), ...data], { sheet:'하객', widths:[8,10,14,15,10,7,12,7,28], lists:{ 0:['신랑','신부'], 1:rels(), 3:['O'], 4:['참석','불참','미정'] } }));
}
/* 머리글에 '이름'이 있으면 머리글 이름으로 칸을 찾는다(다른 양식도 된다). 없으면 양식 순서대로 */
function toLines(t){
  t = t.filter(r => r.some(c => String(c??'').trim()));
  if (!t.length) return [];
  const h = t[0].map(c => String(c??'').trim());
  if (!h.some(x => COLS[2].re.test(x))) return t.map(r => COLS.map((_,i) => r[i]??''));
  const idx = COLS.map(c => h.findIndex(x => c.re.test(x)));
  return t.slice(1).map(r => idx.map(i => i<0 ? '' : r[i]??''));
}
function parseCsv(t){
  const out = [[]]; let f = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch==='"') { if (t[i+1]==='"') { f+='"'; i++; } else q = false; } else f += ch; }
    else if (ch==='"') q = true;
    else if (ch===',' || ch==='\t') { out[out.length-1].push(f); f=''; }
    else if (ch==='\n') { out[out.length-1].push(f); f=''; out.push([]); }
    else if (ch!=='\r') f += ch; }
  out[out.length-1].push(f); return out;
}
async function upload(file){
  try {
    const buf = await file.arrayBuffer(); let t;
    if (/\.xlsx$/i.test(file.name)) t = await readXlsx(buf);
    else if (/\.(csv|txt)$/i.test(file.name)) { let s; try { s = new TextDecoder('utf-8', { fatal:true }).decode(buf); } catch(e){ s = new TextDecoder('euc-kr').decode(buf); } t = parseCsv(s.replace(/^﻿/,'')); }
    else return toast(/\.xls$/i.test(file.name) ? '예전 엑셀(.xls)은 못 읽습니다. 엑셀에서 .xlsx 로 저장해 올려 주세요' : '엑셀(.xlsx)이나 CSV 파일을 올려 주세요');
    const lines = toLines(t).filter(l => String(l[2]??'').trim());
    if (!lines.length) return toast('이름이 적힌 줄을 찾지 못했습니다');
    lines.forEach(l => { const g = blank(rows[rows.length-1]); COLS.forEach((c,i) => setVal(g, c.f, l[i])); rows.push(fresh(g)); });
    render(); toast(lines.length+'명을 신규 행으로 채웠습니다. 확인하고 저장을 누르세요');
  } catch(err){ toast(err.message || '파일을 읽지 못했습니다'); }
}

/* ── 도구 막대 ── */
function addRow(){
  const at = [...sel].map(byK).filter(Boolean).pop() || rows[rows.length-1];
  const r = fresh(blank(at)); rows.push(r);
  if (state.guestF!=='all') state.guestF='all';
  render(); focusCell(r.k, 'name');
}
function copyRows(){
  const picked = rows.filter(r => sel.has(r.k) && !r.del); if (!picked.length) return toast('복사할 행을 고르세요');
  picked.forEach(r => rows.push(fresh(Object.assign({}, r.g, { id:uid() }))));   // 신규 행은 늘 맨 아래에 모인다
  sel.clear(); render(); toast(picked.length+'행을 복사했습니다');
}
function delRows(){
  const picked = rows.filter(r => sel.has(r.k)); if (!picked.length) return toast('지울 행을 고르세요');
  rows = rows.filter(r => !(sel.has(r.k) && !r.orig)); picked.forEach(r => { if (r.orig) r.del = true; });
  sel.clear(); render();
}
async function save(){
  const empty = rows.filter(r => !r.orig && !r.del && !r.g.name.trim());
  const puts = rows.filter(r => ['new','mod'].includes(status(r)) && r.g.name.trim()).map(r => {
    const base = state.guests.find(x => r.orig && x.id===r.orig.id) || {};
    return Object.assign({}, base, r.g, { name:r.g.name.trim() });
  });
  const ids = rows.filter(r => r.del && r.orig).map(r => r.orig.id);
  if (!puts.length && !ids.length) return toast(empty.length ? '이름을 적은 행이 없습니다' : '바뀐 것이 없습니다');
  const n = { a:puts.filter(x => !state.guests.some(g => g.id===x.id)).length, d:ids.length };
  rows = rows.filter(r => empty.includes(r));   // 저장한 행은 저장된 값으로 다시 맞춘다. 이름 없는 신규 행만 남긴다
  sel.clear();
  await store.saveMany('guests', puts, ids);
  toast('저장했습니다 · 추가 '+n.a+' · 수정 '+(puts.length-n.a)+' · 삭제 '+n.d+(empty.length?' (이름 없는 '+empty.length+'행은 남겨 둠)':''));
}

/* 다른 화면·필터로 옮기기 전에 저장 안 한 행이 있으면 정말 옮길지 확인한다. 옮겨도 되면 true */
function leave(go){
  const n = state.view==='guest' && rows ? dirty() : 0;
  if (!n) return true;
  openSheet('저장되지 않은 내용이 있습니다', '<p>저장하지 않은 행이 <b>'+n+'개</b> 있습니다.<br>저장하지 않고 이동하시겠습니까? 이동하면 고친 내용은 사라집니다.</p>', [
    { label:'취소', onClick:closeSheet },
    { label:'이동', cls:'primary', onClick:()=>{ rows = null; sel.clear(); closeSheet(); go(); } }
  ]);
  return false;
}

/* 이벤트 연결. main.js 가 한 번 부른다. */
export function init(){
  setGuard(leave);
  document.addEventListener('click', e => {
    const t = e.target.closest('#gbar button'); if (!t) return;
    ({ gAdd:addRow, gCopy:copyRows, gDel:delRows, gSave:save, gTpl:template, gOut:exportXlsx, gPick:()=>$('#gFile').click() })[t.id]?.();
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id==='gFile') { const f = t.files[0]; t.value=''; if (f) upload(f); return; }
    if (!t.closest('#gg')) return;
    if (t.dataset.selall!==undefined) { shown().forEach(r => t.checked ? sel.add(r.k) : sel.delete(r.k)); return render(); }
    const tr = t.closest('tr[data-k]'); if (!tr) return;
    if (t.dataset.sel!==undefined) { t.checked ? sel.add(tr.dataset.k) : sel.delete(tr.dataset.k); paintRow(tr); return paintBar(); }
    edit(t, tr);
  });
  /* 검색: 칠 때마다 다시 그리고 검색칸 포커스를 되살린다. 한글 조합 중엔 기다렸다가 조합이 끝나면 */
  const search = t => { const at = t.selectionStart; query = t.value; render(); const q = $('#gq'); if (q) { q.focus(); try { q.setSelectionRange(at, at); } catch(err){} } };
  document.addEventListener('input', e => { if (e.target.id==='gq' && !e.isComposing) search(e.target); });
  document.addEventListener('compositionend', e => { if (e.target.id==='gq') search(e.target); });
  document.addEventListener('input', e => { const t = e.target, tr = t.closest('#gg tr[data-k]'); if (tr && t.dataset.f && t.type!=='checkbox' && t.tagName==='INPUT') edit(t, tr); });
  document.addEventListener('keydown', e => {
    const t = e.target; if (!t.dataset || !t.dataset.f || !t.closest('#gg')) return;
    const down = e.key==='Enter' || (e.key==='ArrowDown' && t.tagName==='INPUT'), up = e.key==='ArrowUp' && t.tagName==='INPUT';
    if (!down && !up) return;
    e.preventDefault();
    const trs = [...document.querySelectorAll('#gg tbody tr')], i = trs.indexOf(t.closest('tr')), f = t.dataset.f;
    if (down && i===trs.length-1) { if (e.key==='Enter' && byK(trs[i].dataset.k).g.name.trim()) { addRow(); focusCell(rows[rows.length-1].k, f); } return; }
    const to = trs[i + (down ? 1 : -1)]; if (to) focusCell(to.dataset.k, f);
  });
  document.addEventListener('paste', e => {
    const t = e.target; if (!t.dataset || !t.dataset.f || !t.closest('#gg')) return;
    const text = (e.clipboardData||window.clipboardData).getData('text/plain');
    if (!/[\t\n]/.test(text.replace(/\r?\n$/,''))) return;   // 한 칸짜리는 그냥 붙인다
    e.preventDefault();
    const list = shown(), r0 = list.indexOf(byK(t.closest('tr').dataset.k)), c0 = COLS.findIndex(c => c.f===t.dataset.f);
    fill(text.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(l => l.split('\t')), r0, c0);
  });
  addEventListener('beforeunload', e => { if (rows && dirty()) { e.preventDefault(); e.returnValue=''; } });
}
function edit(t, tr){
  const r = byK(tr.dataset.k), f = t.dataset.f; if (!r || !f) return;
  r.g[f] = f==='invited' ? t.checked : NUMS.includes(f) ? num(t.value) : t.value;
  if (f==='rsvp') t.className = 'rs-'+(t.value||'u');
  paintRow(tr); paintBar();
}
