/* Wedding Management · © 2026 myoung. All rights reserved.
 * 더보기: 파일함 · 레퍼런스 · 함께하기 · 설정 · 관리자. */
import { KINDS } from '../constants.js';
import { delFile } from '../files.js';
import { emptyBox, head, render } from '../render.js';
import { closeSheet, openSheet } from '../sheet.js';
import { state } from '../state.js';
import { store } from '../store.js';
import { $, arm, esc, filesOf, fmtB, fmtD, man, nameOf, p2, rels, toast, vendorOf, won } from '../util.js';

/* ── 더보기 ── */
export function renderMore(){
  const sub = state.sub.more;
  if (sub==='menu') return head('더보기') + '<div class="list">'+[['memo','메모','축사 · 서약문 · 아이디어', state.memos.length],['files','파일함','계약서 · 음악 · 영상 · 당일 전달 묶음', state.files.filter(f=>f.owner!=='reference').length],['ref','레퍼런스','헤어 · 드레스 · 촬영 컨셉 모아 보기', state.files.filter(f=>f.owner==='reference').length],['export','내보내기','엑셀(CSV) · JSON',''],['share','함께하기','파트너 초대 · 친구에게 추천', state.members.length],['settings','설정','예식일 · 총예산 · 웨딩홀',''],['guide','사용 안내','화면 위에서 짚어 주는 10단계 투어',''],...(state.admin?[['admin','관리자','회원 · 카테고리 · 웨딩홀 요청 · 결제','']]:[])].map(([k,t,s,n])=>'<div class="it" data-go="more:'+k+'" style="cursor:pointer"><div class="t"><b>'+t+'</b><small>'+s+'</small></div>'+(n?'<span class="muted small">'+n+'</span>':'')+'<span class="muted">›</span></div>').join('')+'</div>' +
    '<div class="row" style="margin-top:22px"><span class="muted small">'+(state.user?esc(state.user.email):'로그인 안 됨')+'</span>'+(state.mode==='api'?'<button class="btn sm right" id="logout">로그아웃</button>':'')+'</div>' +
    '<p class="muted" style="text-align:center;font-size:11px;margin-top:28px;opacity:.7;letter-spacing:.04em">Wedding Management · © 2026 myoung</p>';
  const back = '<button class="btn ghost sm" data-go="more:menu">‹ 더보기</button>';
  if (sub==='memo') return head('메모','',back) + '<div class="inline" style="margin-bottom:12px"><input id="m-title" placeholder="제목 (예: 신랑 서약문)" style="flex:1"><button class="btn" id="addMemo">새 메모</button></div>' +
    (state.memos.length?'<div class="cards">'+state.memos.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).map(m=>'<div class="card" data-memo="'+m.id+'" style="cursor:pointer"><b>'+esc(m.title||'제목 없음')+'</b><div class="small" style="color:var(--ink2);margin-top:6px;white-space:pre-line;max-height:80px;overflow:hidden">'+esc((m.body||'').slice(0,160))+'</div><div class="muted small" style="margin-top:6px">'+fmtD((m.updatedAt||'').slice(0,10))+(filesOf('memo',m.id).length?' · 첨부 '+filesOf('memo',m.id).length:'')+'</div></div>').join('')+'</div>':emptyBox('축사, 서약문, 상견례 때 할 말을 적어 두세요.', '', 'flowers'));
  if (sub==='files') return renderFiles(back);
  if (sub==='ref') return renderRef(back);
  if (sub==='export') return head('내보내기','',back) + '<div class="cards"><div class="card"><b>예산·업체 (CSV)</b><p class="muted small" style="margin:6px 0 10px">카테고리, 업체, 상태, 금액, 결제 내역. 엑셀에서 바로 열립니다.</p><button class="btn" data-csv="budget">내려받기</button></div><div class="card"><b>전체 (JSON)</b><p class="muted small" style="margin:6px 0 10px">백업용. 파일 본체는 들어 있지 않습니다.</p><button class="btn" id="dumpJson">내려받기</button></div></div>';
  if (sub==='share') return renderShare(back);
  if (sub==='settings') return renderSettings(back);
  if (sub==='admin') return renderAdmin(back);
  return '';
}
export function renderFiles(back){
  const fs = state.files.filter(f=>f.owner!=='reference');
  const steps = state.events.filter(e=>e.kind==='dday').sort((a,b)=>(a.sort||0)-(b.sort||0));
  const bundle = []; steps.forEach((s,i)=>filesOf('event',s.id).forEach(f=>bundle.push({n:i+1,s,f})));
  const ownerLabel = f => f.owner==='vendor' ? (vendorOf(f.ownerId)||{}).name||'업체' : f.owner==='event' ? (state.events.find(e=>e.id===f.ownerId)||{}).title||'식순' : f.owner==='memo' ? (state.memos.find(m=>m.id===f.ownerId)||{}).title||'메모' : f.owner;
  const pct = state.quota ? Math.round(state.usage/state.quota*100) : 0;
  return head('파일함', fs.length+'개', back) +
    (state.mode==='api'?'<div class="card" style="margin-bottom:14px"><div class="row"><b>저장 공간</b><span class="right num">'+fmtB(state.usage)+' / '+fmtB(state.quota)+'</span></div><div class="gauge'+(pct>90?' over':'')+'"><i style="width:'+Math.min(pct,100)+'%"></i></div><div class="line"><span>'+(state.plan&&state.plan.tier==='premium'?'프리미엄':'기본')+'</span><span>파일당 100MB</span></div></div>':'') +
    '<div class="sect"><h2>당일 전달 묶음 <span class="sub">식순 순서대로 번호를 붙였습니다. 음향팀 USB용</span></h2>'+(bundle.length?'<div class="list">'+bundle.map(x=>'<div class="it"><span class="pill">'+p2(x.n)+'</span><div class="t"><b>'+esc(x.f.name)+'</b><small>'+esc(x.s.title)+' · '+fmtB(x.f.size)+'</small></div><a class="btn sm" href="'+x.f.url+'?dl=1" download="'+p2(x.n)+'_'+esc(x.s.title)+'_'+esc(x.f.name)+'">받기</a></div>').join('')+'</div><p class="muted small" style="margin-top:6px">파일 이름 앞에 순서 번호가 붙어 내려옵니다. 한 번에 zip 으로 묶는 기능은 다음에 붙입니다.</p>':'<p class="muted small">일정 → 식순에서 단계마다 음악·영상을 첨부하면 여기 모입니다.</p>')+'</div>' +
    '<div class="sect"><h2>전체</h2>'+(fs.length?'<div class="tbl"><table><thead><tr><th>종류</th><th>파일</th><th>붙은 곳</th><th class="num">크기</th><th></th></tr></thead><tbody>'+fs.map(f=>'<tr><td><span class="pill dim">'+KINDS[f.kind]+'</span></td><td><a href="'+f.url+'" target="_blank" rel="noopener">'+esc(f.name)+'</a>'+(f.memo?'<div class="muted small">'+esc(f.memo)+'</div>':'')+'</td><td class="muted small">'+esc(ownerLabel(f))+'</td><td class="num small">'+fmtB(f.size)+'</td><td><a class="btn sm" href="'+f.url+'?dl=1" download>받기</a> <button class="x" data-delfile="'+f.id+'">×</button></td></tr>').join('')+'</tbody></table></div>':emptyBox('계약서는 업체 상세에서, 음악·영상은 식순 단계에서 올립니다. 올린 파일은 여기 모여 보입니다.', '', 'bow'))+'</div>';
}
export function renderRef(back){
  const all = state.files.filter(f=>f.owner==='reference');
  const tagOf = {}; state.refFileTags.forEach(x=>(tagOf[x.fileId]=tagOf[x.fileId]||[]).push(x.tagId));
  const likes = {}; state.refLikes.forEach(x=>(likes[x.fileId]=likes[x.fileId]||[]).push(x.who));
  const me = state.user ? state.user.email : 'me';
  const shown = refShown(all, tagOf, likes);
  return head('레퍼런스', all.length+'장', back) +
    '<div class="row" style="margin-bottom:10px"><button class="btn primary" data-upload="reference:" '+(state.filesOn?'':'disabled')+'>+ 캡처 올리기</button><button class="btn" id="showRef" '+(shown.length?'':'disabled')+'>상담용 보기'+(shown.length&&shown.length!==all.length?' ('+shown.length+')':'')+'</button><button class="btn ghost sm right" id="addTag">+ 태그</button>'+(state.refTags.length?'':'<button class="btn ghost sm" id="seedTags">기본 태그 넣기</button>')+'</div>' +
    (state.filesOn?'':'<div class="notice">파일 저장소(R2)를 켜면 올릴 수 있습니다. 인스타·핀터레스트는 링크로 가져올 수 없어서 캡처를 올리는 방식입니다.</div>') +
    '<div class="filters who">'+[['all','모두'],['groom','신랑용'],['bride','신부용'],['none','공통']].map(([k,l])=>'<button data-rwho="'+k+'" aria-pressed="'+(state.refWho===k)+'">'+l+'</button>').join('')+'</div>' +
    '<div class="filters">'+[['all','전체'],['both','둘 다 좋아요'],...state.refTags.map(t=>[t.id,t.name])].map(([k,l])=>'<button data-rtag="'+esc(k)+'" aria-pressed="'+(state.refTag===k)+'">'+esc(l)+(state.refTags.find(t=>t.id===k)?' <span data-deltag="'+esc(k)+'" style="margin-left:4px;opacity:.5">×</span>':'')+'</button>').join('')+'</div>' +
    (shown.length?'<div class="refgrid">'+shown.map(f=>'<div class="ref" data-ref="'+f.id+'"><img src="'+f.url+'" alt="'+esc(f.memo||f.name)+'" loading="lazy"><span class="lk">'+((likes[f.id]||[]).includes(me)?'♥':'♡')+(likes[f.id]&&likes[f.id].length>1?' 2':'')+'</span>'+(f.who?'<span class="wh '+f.who+'">'+(f.who==='groom'?'신랑':'신부')+'</span>':'')+'<span class="tg">'+(tagOf[f.id]||[]).map(t=>esc((state.refTags.find(x=>x.id===t)||{}).name||'')).filter(Boolean).join(' · ')+'</span></div>').join('')+'</div>'
      : emptyBox('헤어, 드레스, 촬영 컨셉 캡처를 모아 두고 상담 때 전체 화면으로 보여 주세요.', '', 'bouquet'));
}
export function refShown(all, tagOf, likes){
  return all.filter(f => (state.refWho==='all' ? true : state.refWho==='none' ? !f.who : f.who===state.refWho) &&
    (state.refTag==='all' ? true : state.refTag==='both' ? (likes[f.id]||[]).length>=2 : (tagOf[f.id]||[]).includes(state.refTag)));
}
export function openRef(id){
  const f = state.files.find(x=>x.id===id); if (!f) return;
  const body = () => { const mine = new Set(state.refFileTags.filter(x=>x.fileId===id).map(x=>x.tagId)); const lk = state.refLikes.filter(x=>x.fileId===id);
    return '<img src="'+f.url+'" alt="" style="width:100%;max-height:50vh;object-fit:contain;background:var(--bg2);border-radius:var(--r)">' +
    '<div class="field" style="margin-top:12px"><label>누구 것</label><div class="segs">'+[['','공통'],['groom','신랑용'],['bride','신부용']].map(([k,l])=>'<button type="button" data-rwhoset="'+k+'" aria-pressed="'+((f.who||'')===k)+'">'+l+'</button>').join('')+'</div></div>' +
    '<div class="row" style="margin:12px 0"><button class="btn" id="likeRef">'+(lk.some(x=>x.who===(state.user||{}).email)?'♥ 좋아요 취소':'♡ 좋아요')+'</button><span class="muted small">'+lk.map(x=>nameOf(x.who)).join(', ')+'</span></div>' +
    '<div class="field"><label>태그</label><div class="filters" style="margin:0">'+state.refTags.map(t=>'<button data-ttag="'+t.id+'" aria-pressed="'+mine.has(t.id)+'">'+esc(t.name)+'</button>').join('')+(state.refTags.length?'':'<span class="muted small">태그가 없습니다. 목록에서 + 태그를 누르세요.</span>')+'</div></div>' +
    '<div class="field"><label>메모</label><input id="r-memo" value="'+esc(f.memo||'')+'" placeholder="앞머리는 이렇게, 뒤는 다른 사진"></div>'; };
  openSheet('레퍼런스', body, [
    { label:'삭제', cls:'danger', onClick:(b)=>{ if (!arm(b)) return; closeSheet(); delFile(id); } },
    { label:'메모 저장', cls:'primary', onClick:async()=>{ const memo=$('#r-memo').value; try { await store.call('PATCH','/api/files/'+id,{memo}); f.memo=memo; toast('저장됨'); closeSheet(); render(); } catch(e){ toast(e.message); } } }
  ], { async click(e){ const t=e.target.closest('#likeRef,[data-ttag],[data-rwhoset]'); if (!t) return;
    if (t.dataset.rwhoset!==undefined) { try { await store.call('PATCH','/api/files/'+id,{who:t.dataset.rwhoset||null}); f.who=t.dataset.rwhoset||null; $('#sheetBody').innerHTML=body(); render(); } catch(err){ toast(err.message); } return; }
    if (t.id==='likeRef') { try { const r=await store.call('POST','/api/ref/'+id+'/like'); const me=state.user.email; state.refLikes=state.refLikes.filter(x=>!(x.fileId===id&&x.who===me)); if (r.liked) state.refLikes.push({fileId:id,who:me}); $('#sheetBody').innerHTML=body(); render(); } catch(err){ toast(err.message); } }
    if (t.dataset.ttag) { const cur=new Set(state.refFileTags.filter(x=>x.fileId===id).map(x=>x.tagId)); cur.has(t.dataset.ttag)?cur.delete(t.dataset.ttag):cur.add(t.dataset.ttag);
      try { await store.call('PUT','/api/ref/'+id+'/tags',{tagIds:[...cur]}); state.refFileTags=state.refFileTags.filter(x=>x.fileId!==id).concat([...cur].map(tagId=>({fileId:id,tagId}))); $('#sheetBody').innerHTML=body(); render(); } catch(err){ toast(err.message); } } } });
}
export function renderShare(back){
  const inv = state.invites.filter(i=>i.type==='plan')[0], refs = state.invites.filter(i=>i.type==='referral');
  return head('함께하기','',back) +
    '<div class="sect"><h2>이 장부를 함께 쓰는 사람 <span class="sub">최대 2명, 권한은 같음</span></h2><div class="card">'+(state.members.length?state.members.map(m=>'<div class="row" style="padding:4px 0"><b>'+esc(m.name)+'</b><span class="muted small">'+esc(m.email)+'</span><span class="pill dim right">'+(m.role==='owner'?'만든 사람':'파트너')+'</span></div>').join(''):'<span class="muted small">서버에 연결되면 보입니다.</span>')+'</div></div>' +
    (state.mode==='api' ? '<div class="sect"><h2>파트너 초대</h2><div class="card">'+(state.members.length>=2?'<p class="muted small">두 사람이 이미 함께 쓰고 있습니다.</p>':inv?'<p class="small">이 링크를 파트너에게 보내세요. 한 번 쓰면 닫히고 '+Math.ceil((inv.expiresAt-Date.now())/864e5)+'일 뒤 만료됩니다.</p><div class="inline" style="margin-top:8px"><input readonly value="'+esc(inv.url)+'" id="invUrl" style="flex:1;font-size:12px"><button class="btn sm" data-copy="#invUrl">복사</button><button class="btn sm danger" data-killinv="'+esc(inv.token)+'">끄기</button></div>':'<p class="muted small" style="margin-bottom:8px">파트너는 이 링크로 들어와 구글이나 이메일로 가입하면 바로 이 장부의 멤버가 됩니다.</p><button class="btn primary" id="makeInvite">초대 링크 만들기</button>')+'</div></div>' +
    '<div class="sect"><h2>친구에게 추천 <span class="sub">받은 사람은 자기 장부를 새로 갖습니다</span></h2><div class="card">'+refs.map(r=>'<div class="inline" style="margin-bottom:6px"><input readonly value="'+esc(r.url)+'" id="ref-'+esc(r.token)+'" style="flex:1;font-size:12px"><button class="btn sm" data-copy="#ref-'+esc(r.token)+'">복사</button><button class="btn sm danger" data-killinv="'+esc(r.token)+'">끄기</button></div>').join('')+'<button class="btn" id="makeRef">추천 링크 만들기</button></div></div>' +
    (state.plan&&state.plan.role!=='owner'?'<div class="sect"><button class="btn danger" id="leavePlan">이 장부에서 나가기</button></div>':'') : '<div class="notice">배포하고 로그인하면 초대 링크를 만들 수 있습니다.</div>');
}
export function contractedVenue(){ return state.vendors.find(x=>x.category==='venue' && x.status==='contracted'); }
export function renderSettings(back){
  const s = state.settings, cv = contractedVenue();
  const v = (s.venue && s.venue.name) ? s.venue : (cv ? { name: cv.name, fromVendor: cv.id } : {});
  return head('설정','',back) +
    '<div class="card"><div class="grid2"><div class="field"><label>신랑</label><input id="st-groom" value="'+esc(s.groom||'')+'"></div><div class="field"><label>신부</label><input id="st-bride" value="'+esc(s.bride||'')+'"></div></div>' +
    '<div class="grid2"><div class="field"><label>예식일</label><input id="st-date" type="date" value="'+esc((s.weddingDate||'').length===10?s.weddingDate:'')+'"></div><div class="field"><label>총예산 (원)</label><input id="st-budget" data-money inputmode="numeric" value="'+(s.budget?won(s.budget):'')+'"></div></div>' +
    '<div class="grid2"><div class="field"><label>예식 지역</label><select id="st-region"><option value="">미정</option>'+['서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주','해외'].map(r=>'<option'+(r===s.region?' selected':'')+'>'+r+'</option>').join('')+'</select></div>' +
    '<div class="field"><label>장부 이름</label><input id="st-name" value="'+esc(state.plan?state.plan.name:'')+'" '+(state.mode==='api'?'':'disabled')+'></div></div>' +
    '<div class="field"><label>웨딩홀 <span class="muted">검색해서 고르면 표기가 통일됩니다</span></label><input id="st-venue" value="'+esc(v.name||'')+'" placeholder="웨딩홀 이름 검색" autocomplete="off"><div id="venueList"></div>' +
      (v.id?'<div class="muted small">선택됨: '+esc(v.name)+(v.hall?' · '+esc(v.hall):'')+(v.status==='pending'?' <span class="pill dim">검수 대기</span>':'')+'</div>':'') +
      (cv ? '<div class="small" style="margin-top:4px">'+(v.fromVendor||v.name===cv.name ? '<span class="pill contracted">계약</span> 예산의 예식장 업체 <b>'+esc(cv.name)+'</b>에서 가져왔어요' : '예산에 계약한 예식장 <b>'+esc(cv.name)+'</b>이(가) 있어요. <button type="button" class="btn sm" id="useVenue">그걸로 채우기</button>')+'</div>' : '')+'</div>' +
    '<div class="field"><label>홀 이름</label><input id="st-hall" value="'+esc(v.hall||'')+'" placeholder="그랜드홀"></div>' +
    '<input id="st-rels" type="hidden" value="'+esc(rels().join(', '))+'">' +
    '<div class="row"><button class="btn primary" id="saveSettings">저장</button>'+(state.mode==='api'?'<a class="btn" href="/auth/password">비밀번호 변경</a>':'')+'</div></div>' +
    (state.mode==='api'&&state.plan&&state.plan.role==='owner'?'<div class="sect"><h2>위험한 것</h2><button class="btn danger" id="dropPlan">이 장부와 모든 항목·파일 지우기</button></div>':'');
}
export function renderAdmin(back){
  const a = state.admData;
  if (!a) { loadAdmin(); return head('관리자','',back) + '<p class="muted">불러오는 중…</p>'; }
  return head('관리자', a.users.length+'명 · 계획 '+a.plans.length+'개', back) +
    '<div class="cards"><div class="card"><div class="muted small">결제</div><div class="dd">'+won(a.stats.purchases.sum)+'<small>원 · '+a.stats.purchases.n+'건</small></div></div><div class="card"><div class="muted small">예산 평균 (설정한 계획 '+a.stats.budget.n+'개)</div><div class="dd">'+man(a.stats.budget.avg||0)+'</div></div><div class="card"><div class="muted small">지역</div><div class="small">'+a.stats.byRegion.map(x=>esc(x.k)+' '+x.n).join(' · ')+'</div><div class="muted small" style="margin-top:4px">연령 '+a.stats.byAge.map(x=>esc(x.k)+' '+x.n).join(' · ')+'</div></div></div>' +
    '<div class="sect"><h2>웨딩홀 추가 요청 <span class="sub">'+a.pendingVenues.length+'</span></h2>'+(a.pendingVenues.length?'<div class="list">'+a.pendingVenues.map(v=>'<div class="it"><div class="t"><b>'+esc(v.name)+'</b><small>'+esc(v.region||'')+' '+esc(v.hall||'')+' · '+esc(v.created_by)+'</small></div><button class="btn sm" data-venue="approve:'+v.id+'">승인</button><button class="btn sm danger" data-venue="reject:'+v.id+'">반려</button></div>').join('')+'</div>':'<p class="muted small">없음</p>')+'</div>' +
    '<div class="sect"><h2>카테고리</h2><div class="list">'+state.categories.map(c=>'<div class="it"><span class="muted small" style="width:90px">'+c.id+'</span><input data-catname="'+c.id+'" value="'+esc(c.name)+'" style="flex:1;border:0;border-bottom:1px solid var(--line2);padding:3px 0;background:transparent"><input data-catsort="'+c.id+'" value="'+c.sort+'" style="width:50px;text-align:right;border:0;border-bottom:1px solid var(--line2);background:transparent"><button class="x" data-delcat="'+c.id+'">×</button></div>').join('')+'</div><div class="inline" style="margin-top:8px"><input id="c-id" placeholder="id (영문)" style="width:120px"><input id="c-name" placeholder="이름" style="flex:1"><button class="btn sm" id="addCat">추가</button></div></div>' +
    '<div class="sect"><h2>계획</h2><div class="tbl"><table><thead><tr><th>이름</th><th>주인</th><th>예식일</th><th>지역</th><th class="num">업체</th><th class="num">파일</th><th>요금제</th><th></th></tr></thead><tbody>'+a.plans.map(p=>'<tr><td>'+esc(p.name)+'</td><td class="small">'+esc(p.owner_key)+'</td><td class="small">'+esc(p.wedding_date||'')+'</td><td class="small">'+esc(p.region||'')+'</td><td class="num">'+p.vendors+'</td><td class="num small">'+fmtB(p.bytes)+'</td><td>'+(p.tier==='premium'?'<span class="pill pink">프리미엄</span>':'<button class="btn sm" data-premium="'+p.id+'">프리미엄 켜기</button>')+'</td><td><button class="x" data-delplan="'+p.id+'">×</button></td></tr>').join('')+'</tbody></table></div></div>' +
    '<div class="sect"><h2>회원</h2><div class="tbl"><table><thead><tr><th>이메일</th><th>이름</th><th>가입</th><th>로그인</th><th>방식</th><th>추천인</th><th></th></tr></thead><tbody>'+a.users.map(u=>'<tr><td class="small">'+esc(u.email)+(u.locked&&u.locked>Date.now()?' <span class="pill dim">잠김</span>':'')+'</td><td>'+esc(u.name||'')+'</td><td class="small">'+esc((u.created_at||'').slice(0,10))+'</td><td class="small">'+esc((u.last_login||'').slice(0,10))+'</td><td class="small">'+esc(u.provider)+'</td><td class="small">'+esc(u.referred_by||'')+'</td><td><button class="btn sm" data-unlock="'+esc(u.email)+'">잠금 해제</button> <button class="btn sm" data-forceout="'+esc(u.email)+'">로그아웃</button> <button class="x" data-deluser="'+esc(u.email)+'">×</button></td></tr>').join('')+'</tbody></table></div></div>';
}
export async function loadAdmin(){ try { state.admData = await store.call('GET','/api/admin/overview'); render(); } catch(e){ toast(e.message); } }
