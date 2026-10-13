/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 로그인 세션 쿠키와 현재 사용자.
 */
import { SESSION_COOKIE, SESSION_DAYS } from '../config.js';
import { dec, enc, sigOk, sign } from '../lib/crypto.js';
import { nowIso, readCookie } from '../lib/http.js';
import { resolvePlan } from '../plan.js';

/* ═══ 세션 ══════════════════════════════════ */
export async function currentUser(req, env) {
  if (env.ALLOW_OPEN === '1') {
    const u = { email: 'open@local', name: '로컬', key: 'open@local' };
    await env.DB.prepare(
      'INSERT OR IGNORE INTO users (email, name, session_epoch, created_at, provider) VALUES (?,?,1,?,?)'
    ).bind(u.key, u.name, nowIso(), 'open').run();
    const row = await env.DB.prepare('SELECT current_plan FROM users WHERE email = ?').bind(u.key).first();
    u.plan = await resolvePlan(env, u, row && row.current_plan);
    return u;
  }

  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return null;
  const cut = raw.lastIndexOf('.');
  if (cut < 0) return null;
  const payload = raw.slice(0, cut), sig = raw.slice(cut + 1);
  if (!(await sigOk(env, payload, sig))) return null;

  let d;
  try { d = JSON.parse(dec(payload)); } catch (e) { return null; }
  if (!d || !d.e || !d.x || d.x < Date.now()) return null;

  const row = await env.DB.prepare(
    'SELECT email, name, session_epoch, current_plan FROM users WHERE email = ?').bind(d.e).first();
  if (!row) return null;
  if (Number(d.v || 0) !== Number(row.session_epoch)) return null;

  const u = { email: row.email, name: row.name || row.email.split('@')[0], key: row.email };
  u.plan = await resolvePlan(env, u, row.current_plan);
  return u;
}

export async function sessionCookie(env, email, epoch, secure) {
  const payload = enc(JSON.stringify({ e: email, v: epoch, x: Date.now() + SESSION_DAYS * 864e5 }));
  const sig = await sign(env, payload);
  return SESSION_COOKIE + '=' + payload + '.' + sig +
    '; Path=/; Max-Age=' + SESSION_DAYS * 86400 + '; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
}
export function clearCookie(secure) {
  return SESSION_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
}
export function isAdmin(env, u) {
  const a = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !!a && !!u && u.key === a;
}
export function clientIp(req) { return req.headers.get('CF-Connecting-IP') || '0.0.0.0'; }
export function minutesLeft(until) { return Math.max(1, Math.ceil((until - Date.now()) / 60000)); }
