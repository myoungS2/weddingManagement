/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 업체·결제·일정·할 일·하객·메모 항목 저장과 삭제.
 */
import { MAX_DOC_LEN, MAX_ITEMS } from '../config.js';
import { deleteFiles } from '../files.js';
import { json, nowIso } from '../lib/http.js';

export async function handleItemsApi(req, env, url, u) {
  const path = url.pathname, method = req.method;
  const pid = u.plan.id, uk = u.key;

  /* ── 항목 CRUD: /api/<col>/<id> ── */
  const colOne = path.match(/^\/api\/(vendors|payments|events|tasks|guests|memos)\/([A-Za-z0-9_-]{1,64})$/);
  if (colOne) {
    const col = colOne[1], id = colOne[2];
    if (method === 'PUT') {
      const body = await req.json();
      body.id = id;
      const doc = JSON.stringify(body);
      if (doc.length > MAX_DOC_LEN) return json({ error: '내용이 너무 깁니다' }, 413);
      const c = await env.DB.prepare(
        'SELECT COUNT(*) AS n, MAX(CASE WHEN id = ? THEN 1 ELSE 0 END) AS mine FROM ' + col + ' WHERE plan_id = ?'
      ).bind(id, pid).first();
      if (!Number(c.mine) && Number(c.n) >= MAX_ITEMS) return json({ error: '항목이 너무 많습니다 (' + MAX_ITEMS + '개)' }, 409);
      await env.DB.prepare(upsertSql(col)).bind(pid, id, doc, nowIso(), uk, uk).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await deleteItem(env, pid, col, id);
      return json({ ok: true });
    }
  }
  /* 여러 개 한 번에 (가이드 할 일 채우기, CSV 가져오기) */
  const colBulk = path.match(/^\/api\/(vendors|payments|events|tasks|guests|memos)$/);
  if (colBulk && method === 'PUT') {
    const col = colBulk[1];
    const body = await req.json();
    const items = (Array.isArray(body.items) ? body.items : []).filter(x => x && /^[A-Za-z0-9_-]{1,64}$/.test(String(x.id)));
    if (!items.length) return json({ ok: true, saved: 0 });
    if (items.length > 500) return json({ error: '한 번에 500개까지만 저장합니다' }, 400);
    const have = await env.DB.prepare('SELECT id FROM ' + col + ' WHERE plan_id = ?').bind(pid).all();
    const known = new Set((have.results || []).map(r => String(r.id)));
    const fresh = items.filter(x => !known.has(String(x.id))).length;
    if (known.size + fresh > MAX_ITEMS) return json({ error: '항목이 너무 많습니다 (' + MAX_ITEMS + '개)' }, 409);
    for (const x of items) if (JSON.stringify(x).length > MAX_DOC_LEN) return json({ error: '내용이 너무 긴 항목이 있습니다' }, 413);
    const at = nowIso();
    await env.DB.batch(items.map(x => env.DB.prepare(upsertSql(col)).bind(pid, String(x.id), JSON.stringify(x), at, uk, uk)));
    return json({ ok: true, saved: items.length });
  }

  return null;
}

export function upsertSql(col) {
  return 'INSERT INTO ' + col + ' (plan_id, id, data, updated_at, updated_by, created_by) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(plan_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by';
}

/* 항목을 지울 때 딸린 것도 같이 지운다. 업체 → 결제·일정·첨부. 일정·메모 → 첨부. */
export async function deleteItem(env, pid, col, id) {
  const stmts = [env.DB.prepare('DELETE FROM ' + col + ' WHERE plan_id = ? AND id = ?').bind(pid, id)];
  const ownerType = { vendors: 'vendor', events: 'event', memos: 'memo' }[col];
  if (col === 'vendors') {
    stmts.push(env.DB.prepare("DELETE FROM payments WHERE plan_id = ? AND json_extract(data, '$.vendorId') = ?").bind(pid, id));
    stmts.push(env.DB.prepare("DELETE FROM events WHERE plan_id = ? AND json_extract(data, '$.vendorId') = ?").bind(pid, id));
  }
  if (ownerType) {
    const fs = await env.DB.prepare('SELECT id FROM files WHERE plan_id = ? AND owner_type = ? AND owner_id = ?').bind(pid, ownerType, id).all();
    await deleteFiles(env, pid, (fs.results || []).map(x => x.id));
  }
  await env.DB.batch(stmts);
}
