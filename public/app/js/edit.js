/* Wedding Management · © 2026 myoung. All rights reserved.
 * 이미 적은 할 일과 일정(확정 일정 · 식순 단계 · 여행 일정)을 고치는 시트. */
import { PAYER } from './constants.js';
import { closeSheet, openSheet } from './sheet.js';
import { state } from './state.js';
import { store } from './store.js';
import { $, arm, esc, fmtD, num, toast } from './util.js';
import { tripDays } from './views/trip.js';

const WHO = { both: PAYER.both, groom: PAYER.groom, bride: PAYER.bride };

/* 할 일: 제목 · 그룹 · 기한 · 담당 · 완료 · 메모 */
export function openTask(id){
  const t = state.tasks.find(x => x.id === id); if (!t) return;
  const groups = [...new Set(state.tasks.map(x => x.group).filter(Boolean))];
  const body = () =>
    '<div class="field"><label for="et-title">할 일</label><input id="et-title" value="'+esc(t.title||'')+'"></div>' +
    '<div class="grid2"><div class="field"><label for="et-group">그룹</label><input id="et-group" list="et-groups" value="'+esc(t.group||'')+'">' +
      '<datalist id="et-groups">'+groups.map(g=>'<option value="'+esc(g)+'">').join('')+'</datalist></div>' +
    '<div class="field"><label for="et-due">기한</label><input id="et-due" type="date" value="'+esc(t.due||'')+'"></div></div>' +
    '<div class="grid2"><div class="field"><label for="et-who">담당</label><select id="et-who">'+Object.keys(WHO).map(k=>'<option value="'+k+'"'+(k===(t.who||'both')?' selected':'')+'>'+WHO[k]+'</option>').join('')+'</select></div>' +
    '<div class="field"><label for="et-done">완료</label><label class="toggle"><input type="checkbox" class="chk" id="et-done" '+(t.done?'checked':'')+'><span>끝냈어요</span></label></div></div>' +
    '<div class="field"><label for="et-memo">메모</label><textarea id="et-memo" placeholder="견적 받은 곳, 확인할 것…">'+esc(t.memo||'')+'</textarea></div>' +
    (t.guideKey ? '<p class="muted small">준비 가이드에서 넣은 할 일입니다. 고쳐도 다시 채우기를 누를 때 겹치지 않습니다.</p>' : '');
  openSheet('할 일 수정', body, [
    { label:'삭제', cls:'danger', onClick:(b)=>{ if (!arm(b)) return; closeSheet(); store.del('tasks', id); toast('지웠습니다'); } },
    { label:'저장', cls:'primary', onClick:()=>{
      const title = $('#et-title').value.trim(); if (!title) return toast('할 일을 적어 주세요');
      closeSheet();
      store.put('tasks', Object.assign({}, t, { title, group:$('#et-group').value.trim()||'직접 추가', due:$('#et-due').value,
        who:$('#et-who').value, done:$('#et-done').checked, memo:$('#et-memo').value }));
      toast('저장됨');
    } }
  ]);
}

/* 일정: 종류에 따라 칸이 다르다. 확정 일정(event) · 식순 단계(dday) · 여행 일정(trip) */
export function openEvent(id){
  const e = state.events.find(x => x.id === id); if (!e) return;
  const kind = e.kind || 'event';
  const title = { event:'일정 수정', dday:'식순 단계 수정', trip:'여행 일정 수정' }[kind] || '일정 수정';
  const vendors = state.vendors.filter(v => v.status !== 'dropped');
  const days = kind === 'trip' ? tripDays() : [];
  const body = () => {
    let h = '<div class="field"><label for="ee-title">'+(kind==='dday'?'단계':'일정')+'</label><input id="ee-title" value="'+esc(e.title||'')+'"></div>';
    if (kind === 'dday') {
      h += '<div class="field"><label for="ee-min">소요 시간(분)</label><input id="ee-min" inputmode="numeric" value="'+num(e.minutes)+'"></div>';
    } else if (kind === 'trip') {
      h += '<div class="grid2"><div class="field"><label for="ee-date">날짜</label><select id="ee-date"><option value="">하고 싶은 것 (날짜 없음)</option>' +
        days.map(d=>'<option value="'+d.date+'"'+(d.date===e.date?' selected':'')+'>Day '+d.n+' · '+fmtD(d.date)+'</option>').join('') +
        (e.date && !days.some(d=>d.date===e.date) ? '<option value="'+esc(e.date)+'" selected>'+esc(e.date)+'</option>' : '') + '</select></div>' +
        '<div class="field"><label for="ee-time">시간</label><input id="ee-time" type="time" value="'+esc(e.time||'')+'"></div></div>';
    } else {
      h += '<div class="grid2"><div class="field"><label for="ee-date">날짜</label><input id="ee-date" type="date" value="'+esc(e.date||'')+'"></div>' +
        '<div class="field"><label for="ee-time">시간</label><input id="ee-time" type="time" value="'+esc(e.time||'')+'"></div></div>' +
        '<div class="field"><label for="ee-vendor">업체 연결</label><select id="ee-vendor"><option value="">연결 없음</option>' +
        vendors.map(v=>'<option value="'+v.id+'"'+(v.id===e.vendorId?' selected':'')+'>'+esc(v.name)+'</option>').join('') + '</select></div>';
    }
    h += '<div class="field"><label for="ee-memo">메모</label><textarea id="ee-memo" placeholder="'+(kind==='dday'?'담당, 준비물, 곡 이름…':'장소, 담당자, 준비물…')+'">'+esc(e.memo||'')+'</textarea></div>';
    return h;
  };
  openSheet(title, body, [
    { label:'삭제', cls:'danger', onClick:(b)=>{ if (!arm(b)) return; closeSheet(); store.del('events', id); toast('지웠습니다'); } },
    { label:'저장', cls:'primary', onClick:()=>{
      const t = $('#ee-title').value.trim(); if (!t) return toast('제목을 적어 주세요');
      const next = Object.assign({}, e, { title:t, memo:$('#ee-memo').value });
      if (kind === 'dday') next.minutes = num($('#ee-min').value) || 0;
      else {
        next.date = $('#ee-date').value; next.time = $('#ee-time').value;
        if (kind === 'event') { if (!next.date) return toast('날짜를 골라 주세요'); next.vendorId = $('#ee-vendor').value; }
      }
      closeSheet(); store.put('events', next); toast('저장됨');
    } }
  ]);
}
