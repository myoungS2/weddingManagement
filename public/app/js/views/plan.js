/* Wedding Management · © 2026 myoung. All rights reserved.
 * 일정: 역산 타임라인 · 월간 · 식순. */
import { emptyBox, head, segs, warnLocal } from '../render.js';
import { state } from '../state.js';
import { esc, filesOf, fmtD, num, p2, stageNow, today, vendorOf } from '../util.js';
import { taskRow } from './home.js';

/* ── 일정 ── */
export function renderPlan(){
  const sub = state.sub.plan, wd = state.settings.weddingDate;
  let body;
  if (sub==='timeline') {
    const groups = {};
    state.tasks.forEach(t => { (groups[t.group||'기타'] = groups[t.group||'기타'] || []).push(t); });
    const order = Object.keys(groups).sort((a,b)=>{ const da=Math.min(...groups[a].map(t=>t.due||'9999')), db=Math.min(...groups[b].map(t=>t.due||'9999')); return da<db?-1:da>db?1:0; });
    body = (state.tasks.length ? order.map(g => { const list = groups[g].sort((a,b)=>(a.done-b.done)||(a.due||'9').localeCompare(b.due||'9')); const dn=list.filter(t=>t.done).length; return '<div class="sect"><h2>'+esc(g)+'<span class="sub">'+dn+'/'+list.length+(list[0].due?' · '+fmtD(list.reduce((m,t)=>t.due&&t.due<m?t.due:m,'9999'))+'까지':'')+'</span></h2><div class="list">'+list.map(taskRow).join('')+'</div></div>'; }).join('')
      : emptyBox(wd ? '예식일 기준으로 거꾸로 짠 준비 순서를 채워 드릴게요.' : '먼저 설정에서 예식일을 정하세요. 그 날짜에 맞춰 준비 순서를 역산합니다.', wd ? '<button class="btn primary" id="seedGuide">준비 가이드 채우기</button>' : '<button class="btn" data-go="more:settings">예식일 정하기</button>', 'cake')) +
      '<div class="sect"><h2>할 일 추가</h2><div class="inline"><input id="t-title" placeholder="할 일" style="flex:1;min-width:160px"><input id="t-group" placeholder="그룹" list="groups" style="width:120px"><datalist id="groups">'+Object.keys(groups).map(g=>'<option value="'+esc(g)+'">').join('')+'</datalist><input id="t-due" type="date" style="width:150px"><input id="t-memo" placeholder="메모 (선택)" style="flex:1;min-width:160px"><button class="btn" id="addTask">추가</button>'+(state.tasks.length&&wd?'<button class="btn ghost sm" id="seedGuide">가이드 다시 채우기</button>':'')+'</div></div>';
  } else if (sub==='month') {
    body = renderMonth();
  } else {
    const steps = state.events.filter(e=>e.kind==='dday').sort((a,b)=>(a.sort||0)-(b.sort||0));
    let t = toMin(state.settings.ddayStart||'10:00');
    body = '<div class="row" style="margin-bottom:12px"><label class="small muted">시작 시각</label><input type="time" id="ddayStart" value="'+esc(state.settings.ddayStart||'10:00')+'" style="padding:6px 8px;border:1px solid var(--line2);border-radius:var(--r)"><span class="muted small">단계마다 소요시간을 적으면 시각이 이어서 계산됩니다.</span></div>' +
      (steps.length ? '<div class="list steps">'+steps.map((s,i)=>{ const at=t; t+=num(s.minutes); const fs=filesOf('event',s.id); return '<div class="it"><span class="tm">'+fromMin(at)+'</span><div class="t" data-editev="'+s.id+'" title="눌러서 수정"><b>'+esc(s.title)+'</b>'+(s.memo?'<small>'+esc(s.memo)+'</small>':'')+(fs.length?'<div class="att">'+fs.map(f=>'<a href="'+f.url+'" target="_blank" rel="noopener"><span>'+esc(f.name)+'</span></a>').join('')+'</div>':'')+'</div><input class="mn" data-min="'+s.id+'" value="'+num(s.minutes)+'" inputmode="numeric" style="border:0;border-bottom:1px solid var(--line2);background:transparent" aria-label="소요 분">분<button class="btn sm" data-upload="event:'+s.id+'"'+(state.filesOn?'':' disabled')+' title="입장곡·영상 첨부">첨부</button><button class="x" data-delev="'+s.id+'">×</button></div>'; }).join('')+'</div>'
        : emptyBox('본식 당일의 흐름을 시각순으로 적어 두세요. 입장곡·퇴장곡·식전영상은 각 단계에 붙입니다.', '<button class="btn primary" id="seedDday">한국식 기본 식순 채우기</button>', 'glasses')) +
      '<div class="inline" style="margin-top:12px"><input id="s-title" placeholder="단계 (예: 신부 입장)" style="flex:1;min-width:160px"><input id="s-min" inputmode="numeric" placeholder="분" style="width:70px"><input id="s-memo" placeholder="메모 (곡 이름, 담당)" style="flex:1;min-width:140px"><button class="btn" id="addStep">추가</button></div>' +
      (steps.length?'<p class="muted small" style="margin-top:10px">끝나는 시각 '+fromMin(t)+'. 음향팀에 넘길 파일은 더보기 → 파일함에서 한 번에 봅니다.</p>':'');
  }
  return warnLocal() + head('일정', wd ? '예식일 '+esc(wd)+' · '+esc(stageNow()) : '예식일 미정', segs('plan',[['timeline','타임라인'],['month','월간'],['dday','식순']])) + body;
}
export function toMin(t){ const m = String(t||'').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1])*60+Number(m[2]) : 600; }
export function fromMin(m){ return p2(Math.floor(m/60)%24)+':'+p2(m%60); }
export function renderMonth(){
  const base = state.month || today().slice(0,7);
  const [y,m] = base.split('-').map(Number);
  const first = new Date(y, m-1, 1), start = new Date(first); start.setDate(1-first.getDay());
  const marks = {};
  const add = (d, cls, label) => { if (!d) return; (marks[d] = marks[d] || []).push({cls, label}); };
  if (state.settings.weddingDate && state.settings.weddingDate.length===10) add(state.settings.weddingDate, 'wed', '결혼식');
  state.events.filter(e=>e.kind!=='dday' && e.date).forEach(e=>add(e.date, e.kind==='trip'?'guide':'fixed', (e.kind==='trip'?'✈ ':'')+e.title));
  state.payments.filter(p=>!p.paidAt).forEach(p=>add(p.dueDate,'pay',(vendorOf(p.vendorId)||{}).name+' '+p.title));
  state.tasks.filter(t=>!t.done).forEach(t=>add(t.due,'guide',t.title));
  let cells = '';
  for (let i=0;i<42;i++) { const d = new Date(start); d.setDate(start.getDate()+i); const iso = d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); const ms = marks[iso]||[];
    cells += '<div class="d'+(d.getMonth()!==m-1?' other':'')+(iso===today()?' today':'')+'"><span class="n">'+d.getDate()+'</span>'+ms.slice(0,3).map(x=>'<span class="ev '+x.cls+'" title="'+esc(x.label)+'">'+esc(x.label)+'</span>').join('')+(ms.length>3?'<span class="ev">+'+(ms.length-3)+'</span>':'')+'</div>'; }
  return '<div class="row" style="margin-bottom:10px"><button class="btn sm" data-month="-1">‹</button><b>'+y+'년 '+m+'월</b><button class="btn sm" data-month="1">›</button><span class="muted small right">■ 확정 일정 · <span style="color:var(--warn)">■ 결제일</span> · 회색 가이드 마감</span></div>' +
    '<div class="cal">'+['일','월','화','수','목','금','토'].map(d=>'<div class="dow">'+d+'</div>').join('')+cells+'</div>' +
    '<div class="sect"><h2>확정 일정 추가 <span class="sub">투어 · 가봉 · 상견례 · 촬영</span></h2><div class="inline"><input id="e-date" type="date" style="width:150px"><input id="e-time" type="time" style="width:110px"><input id="e-title" placeholder="일정" style="flex:1;min-width:140px"><select id="e-vendor" style="width:140px"><option value="">업체 연결 없음</option>'+state.vendors.filter(v=>v.status!=='dropped').map(v=>'<option value="'+v.id+'">'+esc(v.name)+'</option>').join('')+'</select><input id="e-memo" placeholder="메모 (장소, 담당자, 준비물)" style="flex:1;min-width:160px"><button class="btn" id="addEvent">추가</button></div>' +
    (state.events.filter(e=>e.kind==='event').length?'<div class="list" style="margin-top:10px">'+state.events.filter(e=>e.kind==='event').sort((a,b)=>a.date.localeCompare(b.date)).map(e=>'<div class="it"><div class="t" data-editev="'+e.id+'" title="눌러서 수정"><b>'+esc(e.title)+'</b><small>'+esc(e.date)+' '+esc(e.time||'')+(e.vendorId&&vendorOf(e.vendorId)?' · '+esc(vendorOf(e.vendorId).name):'')+'</small></div><button class="x" data-delev="'+e.id+'">×</button></div>').join('')+'</div>':'')+'</div>';
}
