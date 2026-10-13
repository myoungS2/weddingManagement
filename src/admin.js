/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 관리자 API (ADMIN_EMAIL 만).
 */
import { isAdmin } from './auth/session.js';
import { json, nowIso } from './lib/http.js';
import { dropPlan } from './plan.js';

/* ═══ 관리 ══════════════════════════════════
 * ADMIN_EMAIL 로 로그인했을 때만 열린다. 다른 사람에게는 404 로 보인다.
 */
export async function handleAdmin(req, env, url, u) {
  if (!isAdmin(env, u)) return json({ error: '없는 경로입니다' }, 404);
  const path = url.pathname, method = req.method;

  if (path === '/api/admin/overview' && method === 'GET') {
    const users = await env.DB.prepare(
      'SELECT u.email, u.name, u.created_at, u.last_login, u.provider, u.age_band, u.referred_by, ' +
      "(SELECT la.until FROM login_attempts la WHERE la.key = 'e:' || u.email) AS locked FROM users u ORDER BY u.created_at DESC"
    ).all();
    const plans = await env.DB.prepare(
      'SELECT p.id, p.name, p.owner_key, p.tier, p.created_at, p.wedding_date, p.region, p.budget, ' +
      '(SELECT COUNT(*) FROM plan_members m WHERE m.plan_id = p.id) AS people, ' +
      '(SELECT COUNT(*) FROM vendors v WHERE v.plan_id = p.id) AS vendors, ' +
      '(SELECT COALESCE(SUM(f.size),0) FROM files f WHERE f.plan_id = p.id) AS bytes FROM plans p ORDER BY p.created_at DESC'
    ).all();
    const pending = await env.DB.prepare("SELECT id, name, region, hall, created_by, created_at FROM venues WHERE status = 'pending' ORDER BY created_at").all();
    const stats = {
      byRegion: ((await env.DB.prepare("SELECT COALESCE(region,'미정') AS k, COUNT(*) AS n FROM plans GROUP BY 1 ORDER BY 2 DESC").all()).results) || [],
      byMonth: ((await env.DB.prepare("SELECT substr(wedding_date,1,7) AS k, COUNT(*) AS n FROM plans WHERE wedding_date IS NOT NULL GROUP BY 1 ORDER BY 1").all()).results) || [],
      byAge: ((await env.DB.prepare("SELECT COALESCE(age_band,'unknown') AS k, COUNT(*) AS n FROM users GROUP BY 1 ORDER BY 1").all()).results) || [],
      budget: await env.DB.prepare('SELECT COUNT(*) AS n, ROUND(AVG(budget)) AS avg FROM plans WHERE budget > 0').first(),
      purchases: await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS sum FROM purchases WHERE refunded_at IS NULL').first()
    };
    return json({ me: u.key, users: users.results || [], plans: plans.results || [], pendingVenues: pending.results || [], stats });
  }

  /* 카테고리: 추가 / 이름·순서 변경 / 삭제(사용 중이면 불가) */
  if (path === '/api/admin/categories' && method === 'POST') {
    const b = await req.json();
    const id = String(b.id || '').trim().toLowerCase(), name = String(b.name || '').trim().slice(0, 30);
    if (!/^[a-z][a-z0-9_]{1,24}$/.test(id) || !name) return json({ error: 'id(영문 소문자)와 이름을 적어 주세요' }, 400);
    const n = await env.DB.prepare('SELECT COALESCE(MAX(sort),0) AS s FROM categories').first();
    await env.DB.prepare('INSERT INTO categories (id, name, sort) VALUES (?,?,?)').bind(id, name, Number(n.s) + 10).run();
    return json({ ok: true });
  }
  const catOne = path.match(/^\/api\/admin\/categories\/([a-z][a-z0-9_]{1,24})$/);
  if (catOne && method === 'PUT') {
    const b = await req.json();
    const name = String(b.name || '').trim().slice(0, 30);
    const sort = Number(b.sort);
    await env.DB.prepare('UPDATE categories SET name = COALESCE(NULLIF(?, \'\'), name), sort = CASE WHEN ? > 0 THEN ? ELSE sort END WHERE id = ?')
      .bind(name, sort, sort, catOne[1]).run();
    return json({ ok: true });
  }
  if (catOne && method === 'DELETE') {
    const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM vendors WHERE category = ?').bind(catOne[1]).first();
    if (Number(used.n)) return json({ error: '쓰고 있는 업체가 ' + used.n + '개 있어 지울 수 없습니다' }, 409);
    await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(catOne[1]).run();
    return json({ ok: true });
  }

  /* 웨딩홀 추가 요청: 승인 / 기존 항목으로 병합 / 반려 */
  const venueOne = path.match(/^\/api\/admin\/venues\/([A-Za-z0-9:_-]{1,40})$/);
  if (venueOne && method === 'POST') {
    const b = await req.json(), id = venueOne[1];
    if (b.action === 'approve') {
      await env.DB.prepare("UPDATE venues SET status = 'ok' WHERE id = ?").bind(id).run();
    } else if (b.action === 'merge' && b.into) {
      await env.DB.prepare("UPDATE venues SET status = 'merged', merged_into = ? WHERE id = ?").bind(String(b.into), id).run();
    } else if (b.action === 'reject') {
      await env.DB.prepare("DELETE FROM venues WHERE id = ? AND status = 'pending'").bind(id).run();
    } else return json({ error: 'action 은 approve | merge | reject' }, 400);
    return json({ ok: true });
  }

  /* 결제 기록(수동). 넣으면 그 계획이 프리미엄이 된다. */
  if (path === '/api/admin/purchases' && method === 'POST') {
    const b = await req.json();
    const planId = String(b.planId || ''), product = String(b.product || 'premium'), amount = Number(b.amount) || 0;
    const p = await env.DB.prepare('SELECT owner_key FROM plans WHERE id = ?').bind(planId).first();
    if (!p) return json({ error: '없는 계획입니다' }, 404);
    const id = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO purchases (id, plan_id, user_key, product, amount, provider, provider_ref, created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, planId, p.owner_key, product, amount, 'manual', String(b.ref || '') || null, nowIso()),
      env.DB.prepare("UPDATE plans SET tier = 'premium' WHERE id = ?").bind(planId)
    ]);
    return json({ ok: true, id });
  }

  if (path === '/api/admin/unlock' && method === 'POST') {
    const who = String((await req.json()).email || '').toLowerCase();
    await env.DB.prepare("DELETE FROM login_attempts WHERE key IN ('e:' || ?, 'p:' || ?)").bind(who, who).run();
    return json({ ok: true });
  }
  if (path === '/api/admin/logout' && method === 'POST') {
    const who = String((await req.json()).email || '').toLowerCase();
    await env.DB.prepare('UPDATE users SET session_epoch = session_epoch + 1 WHERE email = ?').bind(who).run();
    return json({ ok: true });
  }
  const delUser = path.match(/^\/api\/admin\/users\/(.+)$/);
  if (delUser && method === 'DELETE') {
    const who = decodeURIComponent(delUser[1]).toLowerCase();
    if (who === u.key) return json({ error: '자기 계정은 여기서 지울 수 없습니다' }, 409);
    const owned = await env.DB.prepare('SELECT id FROM plans WHERE owner_key = ?').bind(who).all();
    for (const p of (owned.results || [])) await dropPlan(env, p.id);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM plan_members WHERE user_key = ?').bind(who),
      env.DB.prepare("DELETE FROM login_attempts WHERE key IN ('e:' || ?, 'p:' || ?)").bind(who, who),
      env.DB.prepare('DELETE FROM users WHERE email = ?').bind(who)
    ]);
    return json({ ok: true, droppedPlans: (owned.results || []).length });
  }
  const delPlan = path.match(/^\/api\/admin\/plans\/([A-Za-z0-9_-]{1,64})$/);
  if (delPlan && method === 'DELETE') {
    await dropPlan(env, delPlan[1]);
    return json({ ok: true });
  }
  return json({ error: '없는 경로입니다' }, 404);
}
