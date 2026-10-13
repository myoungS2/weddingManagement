/* Wedding Management · © 2026 myoung. All rights reserved.
 * 저장소: 서버가 있으면 API, 없으면 브라우저. */
import { LS } from './constants.js';
import { render } from './render.js';
import { COLS, state } from './state.js';
import { $, toast } from './util.js';

/* ═══ 저장소: 서버가 있으면 API, 없으면 브라우저 ═══ */
export const store = {
  loadLocal(){ try { const d = JSON.parse(localStorage.getItem(LS)||'null'); if (d) { for (const k of [...COLS,'settings','refTags','refFileTags','refLikes','categories']) if (d[k]) state[k]=d[k]; } } catch(e){} },
  saveLocal(){ if (state.mode!=='local') return; try { const d={}; for (const k of [...COLS,'settings','refTags','refFileTags','refLikes','categories']) d[k]=state[k]; localStorage.setItem(LS, JSON.stringify(d)); } catch(e){} },
  async connect(){
    try {
      const r = await fetch('/api/me', { credentials:'same-origin', headers:{accept:'application/json'} });
      if (r.status===401) { const j = await r.json().catch(()=>null); if (j && j.login) { location.href=j.login; return; } }
      if (r.ok && /json/.test(r.headers.get('content-type')||'')) {
        const me = await r.json();
        state.mode='api'; state.user=me; state.admin=!!me.admin; state.filesOn=!!me.files; state.kakao=!!me.kakao;
        try { localStorage.removeItem(LS); } catch(e){}
        await this.pull();
        addEventListener('focus', ()=>{ if (!$('#sheet').hidden) return; this.pull().catch(()=>{}); });
        return;
      }
    } catch(e){}
    if (!state.categories.length) state.categories = [['venue','예식장'],['planner','플래너'],['studio','스튜디오'],['dress','드레스'],['makeup','헤어/메이크업'],['snap','스냅/영상'],['ceremony','본식'],['ring','예물(반지)'],['suit','예복'],['parents','혼주'],['invitation','청첩장/답례품'],['gathering','청첩장 모임'],['honeymoon','신혼여행'],['etc','기타']].map(([id,name],i)=>({id,name,sort:i}));
    state.loading=false; render();
  },
  async pull(){
    const s = await this.call('GET','/api/state');
    state.plan=s.plan; state.settings=s.plan.settings||{}; state.members=s.members; state.invites=s.invites;
    for (const k of COLS) state[k]=s[k]||[];
    state.files=s.files||[]; state.refTags=s.refTags||[]; state.refFileTags=s.refFileTags||[]; state.refLikes=s.refLikes||[];
    state.categories=s.categories||[]; state.usage=s.usage||0; state.quota=s.quota||0;
    state.loading=false; render();
  },
  async call(method, path, body, raw){
    const o = { method, credentials:'same-origin', headers:{} };
    if (body!==undefined && !raw) { o.headers['content-type']='application/json'; o.body=JSON.stringify(body); }
    if (raw) o.body = raw;
    const r = await fetch(path, o);
    if (r.status===401) { location.href='/auth/login'; throw new Error('로그인이 풀렸습니다'); }
    if (!r.ok) { let m='HTTP '+r.status; try { m=(await r.json()).error||m; } catch(e){} throw new Error(m); }
    return r.json();
  },
  /* 낙관적 갱신: 화면 먼저, 서버는 뒤에. 실패하면 다시 당겨 온다. */
  async put(col, item){
    const arr = state[col]; const i = arr.findIndex(x=>x.id===item.id); if (i>=0) arr[i]=item; else arr.push(item);
    render();
    if (state.mode==='api') { try { await this.call('PUT','/api/'+col+'/'+item.id, item); } catch(e){ toast(e.message); this.pull().catch(()=>{}); } }
    else this.saveLocal();
  },
  async putMany(col, items){
    for (const it of items) { const i = state[col].findIndex(x=>x.id===it.id); if (i>=0) state[col][i]=it; else state[col].push(it); }
    render();
    if (state.mode==='api') { try { await this.call('PUT','/api/'+col, {items}); } catch(e){ toast(e.message); } }
    else this.saveLocal();
  },
  async del(col, id){
    state[col] = state[col].filter(x=>x.id!==id);
    if (col==='vendors') { state.payments = state.payments.filter(p=>p.vendorId!==id); state.events = state.events.filter(e=>e.vendorId!==id); }
    render();
    if (state.mode==='api') { try { await this.call('DELETE','/api/'+col+'/'+id); } catch(e){ toast(e.message); } }
    else this.saveLocal();
  },
  async settingsPatch(patch, quiet){
    state.settings = Object.assign({}, state.settings, patch); render();
    if (state.mode==='api') { try { await this.call('PUT','/api/plan', patch); } catch(e){ toast(e.message); } }
    else this.saveLocal();
    if (!quiet) toast('저장됨');
  }
};
