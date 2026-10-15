/* Wedding Management · © 2026 myoung. All rights reserved.
 * 파일 올리기·지우기. */
import { render } from './render.js';
import { openMemo } from './sheet.js';
import { state } from './state.js';
import { store } from './store.js';
import { $, kindOf, toast } from './util.js';
import { openVendor } from './views/budget.js';

/* ═══ 파일 ═════════════════════════════════ */
let uploadTarget = null;
export function pickFiles(owner, id){
  uploadTarget = { owner, id };
  const inp = $('#fileInput'); inp.multiple = owner==='reference'; inp.accept = owner==='reference' ? 'image/*' : '';
  inp.value=''; inp.click();
}
export async function uploadFile(file, owner, ownerId){
  let blob = file, type = file.type || 'application/octet-stream';
  if (/^image\//.test(type) && owner!=='vendor') { try { blob = await resizeImage(file, 1600, .85); type='image/jpeg'; } catch(e){} }
  const kind = owner==='vendor' && !/^(audio|video)\//.test(type) ? (/^image\//.test(type) ? 'image' : 'contract') : kindOf(type, file.name);
  const q = new URLSearchParams({ owner, id: ownerId||'', kind, name: file.name });
  if (owner==='reference' && (state.refWho==='groom' || state.refWho==='bride')) q.set('who', state.refWho);
  if (owner==='reference' && state.refTags.some(t=>t.id===state.refTag)) q.set('tag', state.refTag);
  const r = await fetch('/api/files?'+q, { method:'POST', credentials:'same-origin', headers:{'content-type':type}, body:blob });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(j.error||'올리지 못했습니다');
  state.files.unshift(j.file); state.usage = j.usage;
  if (j.tagId) state.refFileTags.push({ fileId:j.file.id, tagId:j.tagId });
  return j.file;
}
export function resizeImage(file, max, q){
  return new Promise((res, rej) => { const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(u); const sc = Math.min(1, max/Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc); c.getContext('2d').drawImage(img,0,0,c.width,c.height); c.toBlob(b => b ? res(b) : rej(new Error('변환 실패')), 'image/jpeg', q); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('이미지를 읽지 못했습니다')); }; img.src = u; });
}
export async function delFile(id){ try { const r = await store.call('DELETE','/api/files/'+id); state.files = state.files.filter(f=>f.id!==id); state.refFileTags=state.refFileTags.filter(x=>x.fileId!==id); state.refLikes=state.refLikes.filter(x=>x.fileId!==id); state.usage=r.usage; render(); toast('지웠습니다'); } catch(e){ toast(e.message); } }
/* 이벤트 연결. main.js 가 한 번 부른다. */
export function init() {
  $('#fileInput').addEventListener('change', async e => {
    const files = [...e.target.files]; if (!files.length || !uploadTarget) return;
    const { owner, id } = uploadTarget; let ok=0;
    toast(files.length>1 ? files.length+'개 올리는 중…' : '올리는 중…');
    for (const f of files) { try { await uploadFile(f, owner, id); ok++; } catch(err){ toast(err.message); break; } }
    if (ok) toast(ok+'개 올렸습니다');
    render();
    if (!$('#sheet').hidden) { if (owner==='vendor') openVendor(id); else if (owner==='memo') openMemo(id); }
  });
}
