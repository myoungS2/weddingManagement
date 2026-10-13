/* Wedding Management · © 2026 myoung. All rights reserved.
 * 클릭·변경·입력 이벤트와 웨딩홀 콤보박스. */
import { DEF_AVG, DEF_RATE, DEF_TAGS, LS } from './constants.js';
import { openEvent, openTask } from './edit.js';
import { download, exportCsv } from './export.js';
import { delFile, pickFiles } from './files.js';
import { openGuide, playIntro } from './guide.js';
import { importBudget, importGuests, seedDday, seedGuide } from './importers.js';
import { render } from './render.js';
import { closeSheet, openMemo } from './sheet.js';
import { COLS, state } from './state.js';
import { store } from './store.js';
import { $, arm, esc, moneyFormat, num, p2, toKrw, toast, today, uid, won } from './util.js';
import { openShow } from './viewer.js';
import { openVendor } from './views/budget.js';
import { contractedVenue, loadAdmin, openRef, refShown } from './views/more.js';

/* 웨딩홀 콤보박스: 자체 마스터 → 카카오 → 추가 요청 */
let venueTimer = null;
export async function pickVenue(v){
  try { let picked = v;
    if (v.kakaoId) { const r = await store.call('POST','/api/venues',{ kakaoId:v.kakaoId, name:v.name, placeUrl:v.placeUrl, region:$('#st-region').value, hall:$('#st-hall').value }); picked = r.venue; }
    state.settings.venue = { id:picked.id, name:picked.name, hall:$('#st-hall').value.trim()||picked.hall||'', status:picked.status }; $('#st-venue').value = picked.name; $('#venueList').innerHTML='';
    await store.settingsPatch({ venue: state.settings.venue }, true); toast('웨딩홀을 골랐습니다');
  } catch(err){ toast(err.message); }
}
export async function requestVenue(){
  try { const r = await store.call('POST','/api/venues',{ name:$('#st-venue').value.trim(), region:$('#st-region').value, hall:$('#st-hall').value }); await pickVenue(r.venue); toast('등록을 요청했습니다. 바로 쓸 수 있고, 관리자가 검수합니다'); } catch(err){ toast(err.message); }
}
/* 이벤트 연결. main.js 가 한 번 부른다. */
export function init() {

  /* ═══ 이벤트 ═══════════════════════════════ */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-view],[data-sub],[data-go],[data-cat],[data-addvendor],[data-vendor],[data-deltask],[data-edittask],[data-editev],[data-month],[data-delev],[data-upload],[data-delfile],[data-gf],[data-rsvp],[data-delguest],[data-memo],[data-ref],[data-rtag],[data-deltag],[data-copy],[data-killinv],[data-csv],[data-venue],[data-delcat],[data-premium],[data-delplan],[data-unlock],[data-forceout],[data-deluser],[data-pickvenue],[data-reqvenue],button');
    if (!t) return;
    const d = t.dataset;
    if (d.view) { state.view=d.view; state.openCat=null; window.scrollTo(0,0); return render(); }
    if (d.sub) { const [k,v]=d.sub.split(':'); state.sub[k]=v; return render(); }
    if (d.go==='more:guide') return openGuide(0);
    if (d.go) { const [k,v]=d.go.split(':'); state.view=k; state.sub[k]=v; window.scrollTo(0,0); return render(); }
    if (d.addvendor!==undefined) return openVendor(null, d.addvendor);
    if (d.addday) { const ti=$('[data-dtitle="'+d.addday+'"]').value.trim(); if (!ti) return; store.put('events', { id:uid(), kind:'trip', title:ti, memo:'', date:d.addday, time:$('[data-dtime="'+d.addday+'"]').value, sort:Date.now() }); return; }
    if (d.unplan) { const x=state.events.find(y=>y.id===d.unplan); if (x) store.put('events', Object.assign({}, x, { date:'', time:'' })); return; }
    if (d.vendor) return openVendor(d.vendor);
    if (d.cat) { if (e.target.closest('input')) return; state.openCat = state.openCat===d.cat ? null : d.cat; return render(); }
    if (d.edittask) return openTask(d.edittask);
    if (d.editev) return openEvent(d.editev);
    if (d.deltask) return store.del('tasks', d.deltask);
    if (d.delev) return store.del('events', d.delev);
    if (d.month) { const b=(state.month||today().slice(0,7)).split('-').map(Number); const dt=new Date(b[0], b[1]-1+Number(d.month), 1); state.month=dt.getFullYear()+'-'+p2(dt.getMonth()+1); return render(); }
    if (d.upload!==undefined) { const [o,i]=d.upload.split(':'); return pickFiles(o, i); }
    if (d.delfile) { if (!arm(t,'×')) return; return delFile(d.delfile); }
    if (d.gf) { state.guestF=d.gf; return render(); }
    if (d.rsvp) { const g=state.guests.find(x=>x.id===d.rsvp); if (g) store.put('guests', Object.assign({}, g, { rsvp:{'':'y',y:'n',n:''}[g.rsvp||''] })); return; }
    if (d.delguest) { if (!arm(t,'×')) return; return store.del('guests', d.delguest); }
    if (d.memo) return openMemo(d.memo);
    if (d.deltag) { e.stopPropagation(); if (!arm(t,'×')) return; try { await store.call('DELETE','/api/ref/tags/'+d.deltag); state.refTags=state.refTags.filter(x=>x.id!==d.deltag); state.refFileTags=state.refFileTags.filter(x=>x.tagId!==d.deltag); if (state.refTag===d.deltag) state.refTag='all'; render(); } catch(err){ toast(err.message); } return; }
    if (d.rtag) { state.refTag=d.rtag; return render(); }
    if (d.rwho) { state.refWho=d.rwho; return render(); }
    if (d.ref) return openRef(d.ref);
    if (d.copy) { const el=$(d.copy); try { await navigator.clipboard.writeText(el.value); toast('복사했습니다'); } catch(err){ el.select(); toast('길게 눌러 복사하세요'); } return; }
    if (d.killinv) { try { const r=await store.call('DELETE','/api/invite/'+d.killinv); state.invites=r.invites; render(); } catch(err){ toast(err.message); } return; }
    if (d.csv) return exportCsv(d.csv);
    if (d.venue) { const [a,id]=d.venue.split(':'); try { await store.call('POST','/api/admin/venues/'+id,{action:a}); loadAdmin(); } catch(err){ toast(err.message); } return; }
    if (d.delcat) { if (!arm(t,'×')) return; try { await store.call('DELETE','/api/admin/categories/'+d.delcat); await store.pull(); } catch(err){ toast(err.message); } return; }
    if (d.premium) { if (!arm(t,'한 번 더')) return; try { await store.call('POST','/api/admin/purchases',{planId:d.premium, product:'premium', amount:0, ref:'manual'}); loadAdmin(); } catch(err){ toast(err.message); } return; }
    if (d.delplan) { if (!arm(t,'×')) return; try { await store.call('DELETE','/api/admin/plans/'+d.delplan); loadAdmin(); } catch(err){ toast(err.message); } return; }
    if (d.unlock) { try { await store.call('POST','/api/admin/unlock',{email:d.unlock}); toast('풀었습니다'); } catch(err){ toast(err.message); } return; }
    if (d.forceout) { try { await store.call('POST','/api/admin/logout',{email:d.forceout}); toast('모든 기기에서 로그아웃시켰습니다'); } catch(err){ toast(err.message); } return; }
    if (d.deluser) { if (!arm(t,'×')) return; try { await store.call('DELETE','/api/admin/users/'+encodeURIComponent(d.deluser)); loadAdmin(); } catch(err){ toast(err.message); } return; }
    if (d.pickvenue!==undefined) return pickVenue(JSON.parse(t.dataset.pickvenue));
    if (d.reqvenue!==undefined) return requestVenue();

    switch (t.id) {
      case 'seedGuide': return seedGuide();
      case 'seedDday': return seedDday();
      case 'addTask': { const ti=$('#t-title').value.trim(); if (!ti) return; store.put('tasks',{ id:uid(), title:ti, group:$('#t-group').value.trim()||'직접 추가', due:$('#t-due').value, done:false, who:'both', memo:$('#t-memo').value.trim() }); return; }
      case 'addStep': { const ti=$('#s-title').value.trim(); if (!ti) return; const n=state.events.filter(x=>x.kind==='dday').length; store.put('events',{ id:uid(), kind:'dday', title:ti, minutes:num($('#s-min').value)||10, sort:n+1, date:state.settings.weddingDate||'', memo:$('#s-memo').value.trim() }); return; }
      case 'addEvent': { const ti=$('#e-title').value.trim(), dt=$('#e-date').value; if (!ti||!dt) return toast('날짜와 일정을 적어 주세요'); store.put('events',{ id:uid(), kind:'event', title:ti, date:dt, time:$('#e-time').value, vendorId:$('#e-vendor').value, memo:$('#e-memo').value.trim() }); return; }
      case 'addGuest': { const n=$('#g-name').value.trim(); if (!n) return; store.put('guests',{ id:uid(), side:$('#g-side').value, rel:$('#g-rel').value, name:n, plus:num($('#g-plus').value), rsvp:'', memo:'', gift:0, meal:0 }); $('#g-name').focus(); return; }
      case 'importGuests': return importGuests();
      case 'importBudget': return importBudget();
      case 'saveTrip': { const hm=Object.assign({}, state.settings.honeymoon||{}, { dest:$('#hm-dest').value.trim(), currency:$('#hm-cur').value, start:$('#hm-start').value, end:$('#hm-end').value }); return store.settingsPatch({ honeymoon: hm }); }
      case 'addWish': { const ti=$('#w-title').value.trim(); if (!ti) return; store.put('events', { id:uid(), kind:'trip', title:ti, memo:$('#w-memo').value.trim(), date:'', time:'', sort:Date.now() }); return; }
      case 'addMemo': return openMemo(null);
      case 'showRef': { const all=state.files.filter(f=>f.owner==='reference'); const tagOf={}; state.refFileTags.forEach(x=>(tagOf[x.fileId]=tagOf[x.fileId]||[]).push(x.tagId)); const likes={}; state.refLikes.forEach(x=>(likes[x.fileId]=likes[x.fileId]||[]).push(x.who));
        return openShow(refShown(all, tagOf, likes), 0); }
      case 'addTag': { const name=prompt('태그 이름'); if (!name) return; try { const r=await store.call('POST','/api/ref/tags',{name}); state.refTags.push(r.tag); render(); } catch(err){ toast(err.message); } return; }
      case 'seedTags': { for (const name of DEF_TAGS) { try { const r=await store.call('POST','/api/ref/tags',{name}); state.refTags.push(r.tag); } catch(err){ toast(err.message); break; } } return render(); }
      case 'dumpJson': { const o={}; for (const k of [...COLS,'settings','files','refTags','refFileTags']) o[k]=state[k]; return download('wedding-management.json', JSON.stringify(o,null,2), 'application/json'); }
      case 'makeInvite': { try { const r=await store.call('POST','/api/plan/invite',{}); state.invites=r.invites; render(); toast('링크를 만들었습니다'); } catch(err){ toast(err.message); } return; }
      case 'makeRef': { try { const r=await store.call('POST','/api/referral',{}); state.invites=r.invites; render(); } catch(err){ toast(err.message); } return; }
      case 'leavePlan': { if (!arm(t,'정말 나갈까요?')) return; try { await store.call('POST','/api/plan/leave',{}); location.reload(); } catch(err){ toast(err.message); } return; }
      case 'dropPlan': { if (!arm(t,'한 번 더 누르면 전부 지웁니다')) return; try { await store.call('DELETE','/api/plan'); location.reload(); } catch(err){ toast(err.message); } return; }
      case 'saveSettings': { const patch={ groom:$('#st-groom').value.trim(), bride:$('#st-bride').value.trim(), weddingDate:$('#st-date').value, budget:num($('#st-budget').value), region:$('#st-region').value, rels:$('#st-rels').value.split(',').map(x=>x.trim()).filter(Boolean), venue:Object.assign({}, state.settings.venue||{}, { hall:$('#st-hall').value.trim() }) };
        if ($('#st-name').value.trim() && state.mode==='api') { patch.name=$('#st-name').value.trim(); if (state.plan) state.plan.name=patch.name; }
        if (!(state.settings.venue&&state.settings.venue.id) && $('#st-venue').value.trim()) { patch.venue.name=$('#st-venue').value.trim(); const cv=contractedVenue(); if (cv && cv.name===patch.venue.name) patch.venue.fromVendor=cv.id; }
        return store.settingsPatch(patch); }
      case 'useVenue': { const cv=contractedVenue(); if (!cv) return; $('#st-venue').value=cv.name; state.settings.venue={ name:cv.name, fromVendor:cv.id, hall:$('#st-hall').value.trim() }; return store.settingsPatch({ venue: state.settings.venue }); }
      case 'addCat': { try { await store.call('POST','/api/admin/categories',{id:$('#c-id').value, name:$('#c-name').value}); await store.pull(); } catch(err){ toast(err.message); } return; }
      case 'replayIntro': return playIntro(true);
      case 'logout': { await fetch('/auth/logout',{method:'POST',credentials:'same-origin'}); try { localStorage.removeItem(LS); } catch(err){} location.href='/auth/login'; return; }
    }
  });
  document.addEventListener('change', e => {
    const t = e.target, d = t.dataset;
    if (d.task) { const x=state.tasks.find(y=>y.id===d.task); if (x) store.put('tasks', Object.assign({}, x, {done:t.checked})); }
    if (d.plandate && t.value) { const x=state.events.find(y=>y.id===d.plandate); if (x) store.put('events', Object.assign({}, x, { date:t.value })); }
    if (t.id==='hm-cur') { const hm=Object.assign({}, state.settings.honeymoon||{}, { currency:t.value }); store.settingsPatch({ honeymoon: hm }, true); }
    if (d.catbudget!==undefined) { const cb=Object.assign({}, state.settings.catBudget||{}); cb[d.catbudget]=num(t.value); store.settingsPatch({catBudget:cb}, true); }
    if (d.min) { const x=state.events.find(y=>y.id===d.min); if (x) store.put('events', Object.assign({}, x, {minutes:num(t.value)})); }
    if (t.id==='ddayStart') store.settingsPatch({ddayStart:t.value}, true);
    if (d.rate) { const r=Object.assign({}, state.settings.rates||DEF_RATE); r[d.rate]=num(t.value); store.settingsPatch({rates:r}, true); }
    if (d.avg) { const r=Object.assign({}, state.settings.avgGift||DEF_AVG); r[d.avg]=num(t.value); store.settingsPatch({avgGift:r}, true); }
    if (d.gift||d.meal) { const id=d.gift||d.meal; const g=state.guests.find(x=>x.id===id); if (g) store.put('guests', Object.assign({}, g, { [d.gift?'gift':'meal']: num(t.value) })); }
    if (d.catname||d.catsort) { const id=d.catname||d.catsort; store.call('PUT','/api/admin/categories/'+id,{ name:$('[data-catname="'+id+'"]').value, sort:num($('[data-catsort="'+id+'"]').value) }).then(()=>store.pull()).catch(err=>toast(err.message)); }
  });
  document.addEventListener('keydown', e => { if (e.key==='Escape') { if (!$('#show').hidden) { $('#show').hidden=true; document.body.style.overflow=''; } else if (!$('#sheet').hidden) closeSheet(); } });
  document.addEventListener('input', e => {
    if (e.target.dataset && e.target.dataset.money !== undefined) moneyFormat(e.target);
    if (e.target.id==='fx-amt') { const cur=$('#hm-cur').value, k=toKrw(e.target.value, cur); $('#fx-out').textContent = '= '+(k==null?'?':won(k))+'원'; return; }
    if (e.target.id!=='st-venue') return;
    const q = e.target.value.trim(); clearTimeout(venueTimer);
    if (state.settings.venue && state.settings.venue.id) { state.settings.venue = {}; }
    if (q.length < 1 || state.mode!=='api') { $('#venueList').innerHTML=''; return; }
    venueTimer = setTimeout(async () => {
      try { const r = await store.call('GET','/api/venues?q='+encodeURIComponent(q));
        const li = [...r.items.map(v=>'<div class="it" data-pickvenue=\''+esc(JSON.stringify({id:v.id,name:v.name,hall:v.hall,status:v.status}))+'\' style="cursor:pointer"><div class="t"><b>'+esc(v.name)+'</b><small>'+esc(v.region||'')+' '+esc(v.hall||'')+(v.status==='pending'?' · 검수 대기':'')+'</small></div></div>'),
          ...r.kakao.map(k=>'<div class="it" data-pickvenue=\''+esc(JSON.stringify({kakaoId:k.kakaoId,name:k.name,placeUrl:k.placeUrl}))+'\' style="cursor:pointer"><div class="t"><b>'+esc(k.name)+'</b><small>'+esc(k.address||'')+' · 카카오</small></div></div>')];
        $('#venueList').innerHTML = '<div class="list card" style="padding:0 12px;margin-top:4px">'+(li.join('')||'<p class="muted small" style="padding:8px 0">검색 결과가 없습니다.</p>')+'<div class="it" data-reqvenue style="cursor:pointer;color:var(--pink-ink)">+ "'+esc(q)+'" 직접 등록 요청</div></div>';
      } catch(err){ toast(err.message); }
    }, 250);
  });
}
