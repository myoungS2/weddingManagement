/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 파일 올리기·받기(구간 요청)·지우기.
 */
import { FILE_KINDS, FILE_OWNERS, MAX_FILE } from '../config.js';
import { deleteFiles, fileRow, usageOf } from '../files.js';
import { baseHeaders, fmtBytes, json, nowIso } from '../lib/http.js';
import { quotaOf } from '../plan.js';

export async function handleFilesApi(req, env, url, u) {
  const path = url.pathname, method = req.method;
  const pid = u.plan.id, uk = u.key;

  /* ── 파일함 ──
   * POST /api/files?owner=vendor&id=<ownerId>&kind=contract&name=<파일명>  본문 = 파일 그대로
   * 본문은 스트림으로 R2 에 바로 흘려보낸다. 메타데이터만 D1 에 적는다.
   */
  if (path === '/api/files' && method === 'POST') {
    if (!env.FILES) return json({ error: '파일 저장소가 켜져 있지 않습니다' }, 503);
    const owner = String(url.searchParams.get('owner') || '');
    const ownerId = String(url.searchParams.get('id') || '');
    const kind = String(url.searchParams.get('kind') || 'other');
    const name = String(url.searchParams.get('name') || 'file').slice(0, 200);
    const memo = String(url.searchParams.get('memo') || '').slice(0, 500);
    const who = ['groom', 'bride'].indexOf(url.searchParams.get('who')) >= 0 ? url.searchParams.get('who') : null;
    if (FILE_OWNERS.indexOf(owner) < 0) return json({ error: '어디에 붙는 파일인지 알 수 없습니다' }, 400);
    if (owner !== 'reference' && !/^[A-Za-z0-9_-]{1,64}$/.test(ownerId)) return json({ error: '붙일 항목이 없습니다' }, 400);
    if (FILE_KINDS.indexOf(kind) < 0) return json({ error: '파일 종류가 올바르지 않습니다' }, 400);
    const size = Number(req.headers.get('content-length') || 0);
    if (!size) return json({ error: '빈 파일입니다' }, 400);
    if (size > MAX_FILE) return json({ error: '한 번에 ' + Math.round(MAX_FILE / 1048576) + 'MB까지 올릴 수 있습니다' }, 413);
    const used = await usageOf(env, pid);
    const quota = quotaOf(u.plan);
    if (used + size > quota) return json({ error: '저장 공간이 부족합니다 (' + fmtBytes(used) + ' / ' + fmtBytes(quota) + ')', quota: true }, 409);

    const type = req.headers.get('content-type') || 'application/octet-stream';
    const id = crypto.randomUUID().replace(/-/g, '');
    const key = pid + '/' + id;
    await env.FILES.put(key, req.body, { httpMetadata: { contentType: type } });
    const head = await env.FILES.head(key);
    const real = head ? head.size : size;
    await env.DB.prepare(
      'INSERT INTO files (id, plan_id, owner_type, owner_id, kind, name, size, content_type, object_key, memo, who, created_by, created_at) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(id, pid, owner, owner === 'reference' ? null : ownerId, kind, name, real, type, key, memo || null, who, uk, nowIso()).run();
    return json({ ok: true, file: await fileRow(env, pid, id), usage: used + real, quota });
  }

  const fileOne = path.match(/^\/file\/([a-f0-9]{32})$/);
  if (fileOne && method === 'GET') {
    const row = await env.DB.prepare('SELECT object_key, content_type, name, size FROM files WHERE id = ? AND plan_id = ?')
      .bind(fileOne[1], pid).first();
    if (!row) return new Response('없는 파일입니다', { status: 404, headers: baseHeaders() });
    if (!env.FILES) return new Response('파일 저장소가 없습니다', { status: 404, headers: baseHeaders() });
    /* 영상·음악은 구간 요청으로 끊김 없이 재생된다 */
    const range = req.headers.get('range');
    const obj = await env.FILES.get(row.object_key, range ? { range: req.headers } : undefined);
    if (!obj) return new Response('없는 파일입니다', { status: 404, headers: baseHeaders() });
    const h = Object.assign(baseHeaders(), {
      'content-type': row.content_type || 'application/octet-stream',
      'cache-control': 'private, max-age=86400',
      'accept-ranges': 'bytes',
      'etag': obj.httpEtag,
      'content-disposition': (url.searchParams.get('dl') ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(row.name)
    });
    if (obj.range && range) {
      const start = obj.range.offset, len = obj.range.length, total = obj.size;
      h['content-range'] = 'bytes ' + start + '-' + (start + len - 1) + '/' + total;
      h['content-length'] = String(len);
      return new Response(obj.body, { status: 206, headers: h });
    }
    h['content-length'] = String(obj.size);
    return new Response(obj.body, { headers: h });
  }
  const fileApi = path.match(/^\/api\/files\/([a-f0-9]{32})$/);
  if (fileApi && method === 'DELETE') {
    await deleteFiles(env, pid, [fileApi[1]]);
    return json({ ok: true, usage: await usageOf(env, pid) });
  }
  if (fileApi && method === 'PATCH') {
    const body = await req.json();
    if ('memo' in body) await env.DB.prepare('UPDATE files SET memo = ? WHERE id = ? AND plan_id = ?').bind(String(body.memo || '').slice(0, 500) || null, fileApi[1], pid).run();
    if (body.name) await env.DB.prepare('UPDATE files SET name = ? WHERE id = ? AND plan_id = ?').bind(String(body.name).slice(0, 200), fileApi[1], pid).run();
    if ('who' in body) await env.DB.prepare('UPDATE files SET who = ? WHERE id = ? AND plan_id = ?').bind(['groom', 'bride'].indexOf(body.who) >= 0 ? body.who : null, fileApi[1], pid).run();
    return json({ ok: true, file: await fileRow(env, pid, fileApi[1]) });
  }

  return null;
}
