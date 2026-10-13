/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 파일함 메타데이터 (본체는 R2).
 */
export async function listFiles(env, pid) {
  const r = await env.DB.prepare(
    'SELECT id, owner_type AS owner, owner_id AS ownerId, kind, name, size, content_type AS type, memo, who, created_by AS by, created_at AS at ' +
    'FROM files WHERE plan_id = ? ORDER BY created_at DESC'
  ).bind(pid).all();
  return (r.results || []).map(x => Object.assign(x, { url: '/file/' + x.id }));
}
export async function fileRow(env, pid, id) {
  const x = await env.DB.prepare(
    'SELECT id, owner_type AS owner, owner_id AS ownerId, kind, name, size, content_type AS type, memo, who, created_by AS by, created_at AS at FROM files WHERE id = ? AND plan_id = ?'
  ).bind(id, pid).first();
  return x ? Object.assign(x, { url: '/file/' + x.id }) : null;
}
export async function usageOf(env, pid) {
  const r = await env.DB.prepare('SELECT COALESCE(SUM(size),0) AS n FROM files WHERE plan_id = ?').bind(pid).first();
  return Number(r.n) || 0;
}
export async function deleteFiles(env, pid, ids) {
  if (!ids.length) return;
  for (const id of ids) {
    const row = await env.DB.prepare('SELECT object_key FROM files WHERE id = ? AND plan_id = ?').bind(id, pid).first();
    if (!row) continue;
    if (env.FILES) { try { await env.FILES.delete(row.object_key); } catch (e) {} }
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ref_file_tags WHERE plan_id = ? AND file_id = ?').bind(pid, id),
      env.DB.prepare('DELETE FROM ref_likes WHERE plan_id = ? AND file_id = ?').bind(pid, id),
      env.DB.prepare('DELETE FROM files WHERE id = ? AND plan_id = ?').bind(id, pid)
    ]);
  }
}
