/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 결혼 계획: 만들기·고르기·설정·멤버·지우기.
 */
import { COLLECTIONS, QUOTA_FREE, QUOTA_PREMIUM } from './config.js';
import { deleteFiles } from './files.js';
import { nowIso, safeParse } from './lib/http.js';

/* ═══ 결혼 계획 ══════════════════════════════
 * 가입하면 자기 계획이 하나 생긴다. 파트너 초대를 받아 들어온 사람은 그 계획의 멤버가 된다.
 * 모든 읽기와 쓰기는 plan_id 로 걸리고, 멤버가 아니면 아무것도 보이지 않는다.
 */
export async function resolvePlan(env, u, wanted) {
  const pick = (m) => ({
    id: m.id, name: m.name, owner: m.owner_key, role: m.role,
    tier: m.tier || 'free', settings: safeParse(m.data) || {}
  });
  if (wanted) {
    const m = await env.DB.prepare(
      'SELECT p.id, p.name, p.owner_key, p.tier, p.data, m.role FROM plan_members m ' +
      'JOIN plans p ON p.id = m.plan_id WHERE m.plan_id = ? AND m.user_key = ?'
    ).bind(wanted, u.key).first();
    if (m) return pick(m);
  }
  const any = await env.DB.prepare(
    'SELECT p.id, p.name, p.owner_key, p.tier, p.data, m.role FROM plan_members m ' +
    'JOIN plans p ON p.id = m.plan_id WHERE m.user_key = ? ORDER BY m.joined_at LIMIT 1'
  ).bind(u.key).first();
  if (any) {
    await env.DB.prepare('UPDATE users SET current_plan = ? WHERE email = ?').bind(any.id, u.key).run();
    return pick(any);
  }
  return await createPlan(env, u.key, (u.name || u.key.split('@')[0]) + '의 결혼 준비');
}

export async function createPlan(env, ownerKey, name) {
  const id = 'p_' + crypto.randomUUID().replace(/-/g, '').slice(0, 18);
  const at = nowIso();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO plans (id, name, owner_key, data, created_at) VALUES (?,?,?,?,?)')
      .bind(id, name, ownerKey, '{}', at),
    env.DB.prepare('INSERT INTO plan_members (plan_id, user_key, role, joined_at) VALUES (?,?,?,?)')
      .bind(id, ownerKey, 'owner', at),
    env.DB.prepare('UPDATE users SET current_plan = ? WHERE email = ?').bind(id, ownerKey)
  ]);
  return { id, name, owner: ownerKey, role: 'owner', tier: 'free', settings: {} };
}

/* 쿼리는 "문장 만들기"와 "줄 다듬기"로 나눠 둔다. /api/state 가 여러 문장을 DB.batch 로 한 번에 보내기 위해서. */
export function myPlansStmt(env, key) {
  return env.DB.prepare(
    'SELECT p.id, p.name, m.role, (SELECT COUNT(*) FROM plan_members x WHERE x.plan_id = p.id) AS people ' +
    'FROM plan_members m JOIN plans p ON p.id = m.plan_id WHERE m.user_key = ? ORDER BY m.joined_at'
  ).bind(key);
}
export async function myPlans(env, key) {
  const r = await myPlansStmt(env, key).all();
  return r.results || [];
}

export function quotaOf(plan) { return plan && plan.tier === 'premium' ? QUOTA_PREMIUM : QUOTA_FREE; }

export async function patchPlan(env, planId, patch) {
  const row = await env.DB.prepare('SELECT data FROM plans WHERE id = ?').bind(planId).first();
  const cur = (row && safeParse(row.data)) || {};
  const next = Object.assign({}, cur, patch);
  await env.DB.prepare('UPDATE plans SET data = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(next), nowIso(), planId).run();
  return next;
}

export async function dropEmptyOwnPlans(env, userKey, keepId) {
  const owned = await env.DB.prepare('SELECT id FROM plans WHERE owner_key = ? AND id <> ?').bind(userKey, keepId).all();
  for (const p of (owned.results || [])) {
    let used = 0;
    for (const col of COLLECTIONS) {
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM ' + col + ' WHERE plan_id = ?').bind(p.id).first();
      used += Number(c.n);
    }
    const m = await env.DB.prepare('SELECT COUNT(*) AS n FROM plan_members WHERE plan_id = ?').bind(p.id).first();
    if (!used && Number(m.n) <= 1) await dropPlan(env, p.id);
  }
}

export async function dropPlan(env, id) {
  const fs = await env.DB.prepare('SELECT id FROM files WHERE plan_id = ?').bind(id).all();
  await deleteFiles(env, id, (fs.results || []).map(x => x.id));
  const stmts = COLLECTIONS.map(col => env.DB.prepare('DELETE FROM ' + col + ' WHERE plan_id = ?').bind(id));
  stmts.push(
    env.DB.prepare('DELETE FROM ref_tags WHERE plan_id = ?').bind(id),
    env.DB.prepare('DELETE FROM invites WHERE plan_id = ?').bind(id),
    env.DB.prepare('DELETE FROM plan_members WHERE plan_id = ?').bind(id),
    env.DB.prepare('UPDATE users SET current_plan = NULL WHERE current_plan = ?').bind(id),
    env.DB.prepare('DELETE FROM plans WHERE id = ?').bind(id)
  );
  await env.DB.batch(stmts);
}

export function membersStmt(env, pid) {
  return env.DB.prepare(
    'SELECT m.user_key AS email, m.role, m.joined_at, u.name FROM plan_members m LEFT JOIN users u ON u.email = m.user_key WHERE m.plan_id = ? ORDER BY m.joined_at'
  ).bind(pid);
}
export const memberRow = x => ({ email: x.email, name: x.name || x.email.split('@')[0], role: x.role });
export async function members(env, pid) {
  const r = await membersStmt(env, pid).all();
  return (r.results || []).map(memberRow);
}
