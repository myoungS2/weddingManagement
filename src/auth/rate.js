/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 로그인·가입 시도 횟수 제한.
 */
/* ═══ 시도 횟수 제한 ════════════════════════ */
export async function rateBlocked(env, key) {
  const row = await env.DB.prepare('SELECT until FROM login_attempts WHERE key = ?').bind(key).first();
  return row && row.until && row.until > Date.now() ? row.until : 0;
}
export async function rateFail(env, key, windowMs, maxFail, lockMs) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT count, first_at FROM login_attempts WHERE key = ?').bind(key).first();
  let count = 1, first = now;
  if (row && now - row.first_at <= windowMs) { count = row.count + 1; first = row.first_at; }
  const until = count >= maxFail ? now + lockMs : null;
  await env.DB.prepare(
    'INSERT INTO login_attempts (key, count, first_at, until) VALUES (?,?,?,?) ' +
    'ON CONFLICT(key) DO UPDATE SET count=excluded.count, first_at=excluded.first_at, until=excluded.until'
  ).bind(key, count, first, until).run();
  return until;
}
export async function rateClear(env, key) {
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
}
