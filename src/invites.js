/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 초대: 파트너 합류(/join)와 친구 추천(/r).
 */
import { currentUser } from './auth/session.js';
import { MAX_MEMBERS } from './config.js';
import { nowIso, redirect } from './lib/http.js';
import { joinPage } from './pages/auth.js';
import { dropEmptyOwnPlans } from './plan.js';

/* ═══ 초대 ══════════════════════════════════
 * plan     /join/<token>  파트너를 내 계획에 합류시킨다. 멤버 2명이 차면 더 못 만든다.
 * referral /r/<token>     친구에게 추천한다. 받은 사람은 자기 계획을 새로 갖고, 추천인이 기록된다.
 */
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export async function inviteOk(env, next) {
  const m = String(next || '').match(/^\/(join|r)\/([A-Za-z0-9_-]{20,64})$/);
  if (!m) return null;
  const type = m[1] === 'join' ? 'plan' : 'referral';
  const inv = await env.DB.prepare(
    'SELECT i.type, i.expires_at, i.used_at, i.created_by, p.name AS plan_name, u.name AS by_name ' +
    'FROM invites i LEFT JOIN plans p ON p.id = i.plan_id LEFT JOIN users u ON u.email = i.created_by WHERE i.token = ?'
  ).bind(m[2]).first();
  if (!inv || inv.type !== type || inv.used_at || Number(inv.expires_at) < Date.now()) return null;
  return { type, planName: inv.plan_name, byName: inv.by_name || inv.created_by.split('@')[0] };
}

/* 추천 링크를 타고 가입이 끝났을 때. 링크를 닫고 추천인을 적는다. */
export async function consumeReferral(env, next, email) {
  const m = String(next || '').match(/^\/r\/([A-Za-z0-9_-]{20,64})$/);
  if (!m) return;
  const inv = await env.DB.prepare(
    "SELECT token, created_by FROM invites WHERE token = ? AND type = 'referral' AND used_at IS NULL AND expires_at > ?"
  ).bind(m[1], Date.now()).first();
  if (!inv) return;
  const at = nowIso();
  await env.DB.batch([
    env.DB.prepare('UPDATE invites SET used_at = ?, used_by = ? WHERE token = ?').bind(at, email, inv.token),
    env.DB.prepare('UPDATE users SET referred_by = ? WHERE email = ? AND referred_by IS NULL').bind(inv.created_by, email)
  ]);
}

export async function handleReferral(req, env, url) {
  const token = url.pathname.slice('/r/'.length);
  if (!TOKEN_RE.test(token)) return joinPage(url.origin, '없는 추천 링크입니다.', null);
  const inv = await env.DB.prepare(
    "SELECT expires_at, used_at FROM invites WHERE token = ? AND type = 'referral'").bind(token).first();
  if (!inv) return joinPage(url.origin, '없는 추천 링크입니다. 보낸 사람에게 새로 받아 주세요.', null);
  if (inv.used_at) return joinPage(url.origin, '이미 쓴 추천 링크입니다. 보낸 사람에게 새로 받아 주세요.', null);
  if (Number(inv.expires_at) < Date.now()) return joinPage(url.origin, '기한이 지난 추천 링크입니다.', null);
  const u = await currentUser(req, env);
  if (u) return redirect(url.origin + '/');      // 이미 계정이 있으면 추천은 의미가 없다
  return redirect(url.origin + '/auth/signup?next=' + encodeURIComponent('/r/' + token));
}

export async function handleJoin(req, env, url) {
  const token = url.pathname.slice('/join/'.length);
  if (!TOKEN_RE.test(token)) return joinPage(url.origin, '없는 초대 링크입니다.', null);
  const inv = await env.DB.prepare(
    "SELECT i.token, i.plan_id, i.expires_at, i.used_at, p.name FROM invites i JOIN plans p ON p.id = i.plan_id " +
    "WHERE i.token = ? AND i.type = 'plan'"
  ).bind(token).first();
  if (!inv) return joinPage(url.origin, '없는 초대 링크입니다. 보낸 사람에게 새로 받아 주세요.', null);
  if (inv.used_at) return joinPage(url.origin, '이미 쓴 초대 링크입니다. 보낸 사람에게 새로 받아 주세요.', null);
  if (Number(inv.expires_at) < Date.now()) return joinPage(url.origin, '기한이 지난 초대 링크입니다. 보낸 사람에게 새로 받아 주세요.', null);

  const u = await currentUser(req, env);
  if (!u) return redirect(url.origin + '/auth/login?next=' + encodeURIComponent('/join/' + token));

  const already = await env.DB.prepare(
    'SELECT 1 AS ok FROM plan_members WHERE plan_id = ? AND user_key = ?').bind(inv.plan_id, u.key).first();
  if (already) {
    await env.DB.prepare('UPDATE users SET current_plan = ? WHERE email = ?').bind(inv.plan_id, u.key).run();
    return redirect(url.origin + '/');
  }
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM plan_members WHERE plan_id = ?').bind(inv.plan_id).first();
  if (Number(count.n) >= MAX_MEMBERS) return joinPage(url.origin, '이 계획에는 이미 두 사람이 들어와 있습니다.', null);

  const at = nowIso();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO plan_members (plan_id, user_key, role, joined_at) VALUES (?,?,?,?)')
      .bind(inv.plan_id, u.key, 'partner', at),
    env.DB.prepare('UPDATE invites SET used_at = ?, used_by = ? WHERE token = ?').bind(at, u.key, token),
    env.DB.prepare('UPDATE users SET current_plan = ? WHERE email = ?').bind(inv.plan_id, u.key)
  ]);
  /* 합류한 사람이 가입하면서 자동으로 받은 빈 계획은 치운다. 뭔가 적어 둔 계획이면 둔다. */
  await dropEmptyOwnPlans(env, u.key, inv.plan_id);
  return joinPage(url.origin, null, inv.name);
}

export async function liveInvites(env, planId, userKey, origin) {
  const r = await env.DB.prepare(
    'SELECT token, type, created_at, expires_at FROM invites ' +
    "WHERE ((type = 'plan' AND plan_id = ?) OR (type = 'referral' AND created_by = ?)) " +
    'AND used_at IS NULL AND expires_at > ? ORDER BY created_at'
  ).bind(planId, userKey, Date.now()).all();
  return (r.results || []).map(x => ({
    token: x.token, type: x.type,
    url: origin + (x.type === 'plan' ? '/join/' : '/r/') + x.token,
    createdAt: x.created_at, expiresAt: Number(x.expires_at)
  }));
}
