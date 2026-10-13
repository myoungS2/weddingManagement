/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 상태 한 번에 받기 · 계획 설정 · 함께하기(초대·나가기·전환·삭제).
 */
import { COLLECTIONS, INVITE_DAYS, MAX_MEMBERS } from '../config.js';
import { listFiles, usageOf } from '../files.js';
import { liveInvites } from '../invites.js';
import { b64 } from '../lib/crypto.js';
import { json, nowIso, safeParse } from '../lib/http.js';
import { dropPlan, members, patchPlan, quotaOf } from '../plan.js';

export async function handlePlanApi(req, env, url, u) {
  const path = url.pathname, method = req.method;
  const pid = u.plan.id, uk = u.key;

  if (path === '/api/state' && method === 'GET') {
    const out = { plan: u.plan, members: await members(env, pid), invites: await liveInvites(env, pid, uk, url.origin) };
    for (const col of COLLECTIONS) {
      const r = await env.DB.prepare('SELECT data FROM ' + col + ' WHERE plan_id = ?').bind(pid).all();
      out[col] = (r.results || []).map(x => safeParse(x.data)).filter(Boolean);
    }
    out.files = await listFiles(env, pid);
    out.refTags = ((await env.DB.prepare('SELECT id, name, sort FROM ref_tags WHERE plan_id = ? ORDER BY sort, name').bind(pid).all()).results) || [];
    out.refFileTags = ((await env.DB.prepare('SELECT file_id AS fileId, tag_id AS tagId FROM ref_file_tags WHERE plan_id = ?').bind(pid).all()).results) || [];
    out.refLikes = ((await env.DB.prepare('SELECT file_id AS fileId, user_key AS who FROM ref_likes WHERE plan_id = ?').bind(pid).all()).results) || [];
    out.categories = ((await env.DB.prepare('SELECT id, name, sort FROM categories ORDER BY sort').all()).results) || [];
    out.usage = await usageOf(env, pid);
    out.quota = quotaOf(u.plan);
    return json(out);
  }

  /* ── 계획 설정 (예식일·총예산·이름·지역·웨딩홀…) ── */
  if (path === '/api/plan' && method === 'PUT') {
    const body = await req.json();
    if (JSON.stringify(body).length > 20000) return json({ error: '설정이 너무 깁니다' }, 413);
    const next = await patchPlan(env, pid, body && typeof body === 'object' ? body : {});
    if (typeof body.name === 'string' && body.name.trim()) {
      await env.DB.prepare('UPDATE plans SET name = ? WHERE id = ?').bind(body.name.trim().slice(0, 40), pid).run();
    }
    return json({ ok: true, settings: next });
  }

  /* ── 함께하기 ── */
  if (path === '/api/plan/invite' && method === 'POST') {
    const people = await env.DB.prepare('SELECT COUNT(*) AS n FROM plan_members WHERE plan_id = ?').bind(pid).first();
    if (Number(people.n) >= MAX_MEMBERS) return json({ error: '이미 두 사람이 함께 쓰고 있습니다' }, 409);
    const live = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM invites WHERE type = 'plan' AND plan_id = ? AND used_at IS NULL AND expires_at > ?"
    ).bind(pid, Date.now()).first();
    if (Number(live.n) >= 1) return json({ error: '아직 안 쓴 초대 링크가 있습니다. 그 링크를 보내거나 먼저 끄세요' }, 409);
    const token = b64(crypto.getRandomValues(new Uint8Array(24)));
    const expires = Date.now() + INVITE_DAYS * 864e5;
    await env.DB.prepare(
      "INSERT INTO invites (token, type, plan_id, role, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?)"
    ).bind(token, 'plan', pid, 'partner', uk, nowIso(), expires).run();
    return json({ ok: true, url: url.origin + '/join/' + token, expiresAt: expires, days: INVITE_DAYS,
      invites: await liveInvites(env, pid, uk, url.origin) });
  }
  if (path === '/api/referral' && method === 'POST') {
    const live = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM invites WHERE type = 'referral' AND created_by = ? AND used_at IS NULL AND expires_at > ?"
    ).bind(uk, Date.now()).first();
    if (Number(live.n) >= 5) return json({ error: '안 쓴 추천 링크가 5개 있습니다. 먼저 보내거나 끄세요' }, 409);
    const token = b64(crypto.getRandomValues(new Uint8Array(24)));
    const expires = Date.now() + INVITE_DAYS * 864e5;
    await env.DB.prepare(
      "INSERT INTO invites (token, type, plan_id, role, created_by, created_at, expires_at) VALUES (?,?,NULL,NULL,?,?,?)"
    ).bind(token, 'referral', uk, nowIso(), expires).run();
    return json({ ok: true, url: url.origin + '/r/' + token, expiresAt: expires, days: INVITE_DAYS,
      invites: await liveInvites(env, pid, uk, url.origin) });
  }
  const oneInvite = path.match(/^\/api\/invite\/([A-Za-z0-9_-]{20,64})$/);
  if (oneInvite && method === 'DELETE') {
    await env.DB.prepare(
      "DELETE FROM invites WHERE token = ? AND used_at IS NULL AND ((type = 'plan' AND plan_id = ?) OR (type = 'referral' AND created_by = ?))"
    ).bind(oneInvite[1], pid, uk).run();
    return json({ ok: true, invites: await liveInvites(env, pid, uk, url.origin) });
  }
  if (path === '/api/plan/leave' && method === 'POST') {
    if (u.plan.role === 'owner') return json({ error: '계획을 만든 사람은 나갈 수 없습니다. 설정에서 계획을 지우세요' }, 409);
    await env.DB.prepare('DELETE FROM plan_members WHERE plan_id = ? AND user_key = ?').bind(pid, uk).run();
    await env.DB.prepare('UPDATE users SET current_plan = NULL WHERE email = ?').bind(uk).run();
    return json({ ok: true });
  }
  if (path === '/api/plan/switch' && method === 'POST') {
    const to = String((await req.json()).planId || '');
    const m = await env.DB.prepare('SELECT 1 AS ok FROM plan_members WHERE plan_id = ? AND user_key = ?').bind(to, uk).first();
    if (!m) return json({ error: '그 계획의 멤버가 아닙니다' }, 403);
    await env.DB.prepare('UPDATE users SET current_plan = ? WHERE email = ?').bind(to, uk).run();
    return json({ ok: true });
  }
  if (path === '/api/plan' && method === 'DELETE') {
    if (u.plan.role !== 'owner') return json({ error: '계획을 만든 사람만 지울 수 있습니다' }, 403);
    await dropPlan(env, pid);
    return json({ ok: true });
  }

  return null;
}
