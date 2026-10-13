/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 레퍼런스 보드 태그와 좋아요.
 */
import { json } from '../lib/http.js';

export async function handleRefApi(req, env, url, u) {
  const path = url.pathname, method = req.method;
  const pid = u.plan.id, uk = u.key;

  /* ── 레퍼런스: 태그와 좋아요 ── */
  if (path === '/api/ref/tags' && method === 'POST') {
    const body = await req.json();
    const name = String(body.name || '').trim().slice(0, 20);
    if (!name) return json({ error: '태그 이름을 적어 주세요' }, 400);
    const id = 't_' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM ref_tags WHERE plan_id = ?').bind(pid).first();
    if (Number(n.n) >= 60) return json({ error: '태그는 60개까지입니다' }, 409);
    await env.DB.prepare('INSERT INTO ref_tags (plan_id, id, name, sort) VALUES (?,?,?,?)').bind(pid, id, name, Number(n.n) + 1).run();
    return json({ ok: true, tag: { id, name, sort: Number(n.n) + 1 } });
  }
  const tagOne = path.match(/^\/api\/ref\/tags\/([A-Za-z0-9_-]{1,32})$/);
  if (tagOne && method === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ref_file_tags WHERE plan_id = ? AND tag_id = ?').bind(pid, tagOne[1]),
      env.DB.prepare('DELETE FROM ref_tags WHERE plan_id = ? AND id = ?').bind(pid, tagOne[1])
    ]);
    return json({ ok: true });
  }
  const refTags = path.match(/^\/api\/ref\/([a-f0-9]{32})\/tags$/);
  if (refTags && method === 'PUT') {
    const body = await req.json();
    const ids = (Array.isArray(body.tagIds) ? body.tagIds : []).map(String).filter(x => /^[A-Za-z0-9_-]{1,32}$/.test(x)).slice(0, 20);
    const f = await env.DB.prepare("SELECT id FROM files WHERE id = ? AND plan_id = ? AND owner_type = 'reference'").bind(refTags[1], pid).first();
    if (!f) return json({ error: '없는 레퍼런스입니다' }, 404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ref_file_tags WHERE plan_id = ? AND file_id = ?').bind(pid, refTags[1]),
      ...ids.map(t => env.DB.prepare('INSERT OR IGNORE INTO ref_file_tags (plan_id, file_id, tag_id) VALUES (?,?,?)').bind(pid, refTags[1], t))
    ]);
    return json({ ok: true });
  }
  const refLike = path.match(/^\/api\/ref\/([a-f0-9]{32})\/like$/);
  if (refLike && method === 'POST') {
    const has = await env.DB.prepare('SELECT 1 AS ok FROM ref_likes WHERE plan_id = ? AND file_id = ? AND user_key = ?').bind(pid, refLike[1], uk).first();
    if (has) await env.DB.prepare('DELETE FROM ref_likes WHERE plan_id = ? AND file_id = ? AND user_key = ?').bind(pid, refLike[1], uk).run();
    else await env.DB.prepare('INSERT INTO ref_likes (plan_id, file_id, user_key) VALUES (?,?,?)').bind(pid, refLike[1], uk).run();
    return json({ ok: true, liked: !has });
  }

  return null;
}
