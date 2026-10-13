/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 응답·헤더·쿠키·이스케이프 같은 공통 도구.
 */
export function staticFile(body, type) {
  return new Response(body, {
    headers: Object.assign(baseHeaders(), { 'content-type': type, 'cache-control': 'public, max-age=86400' })
  });
}
export function csp(nonce) {
  return "default-src 'none'; script-src 'nonce-" + nonce + "'; " +
    "style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; " +
    "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; form-action 'self'; " +
    "base-uri 'none'; frame-ancestors 'none'";
}
export function baseHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'x-frame-options': 'DENY',
    'strict-transport-security': 'max-age=31536000; includeSubDomains'
  };
}
export function sameOrigin(req, url) {
  const o = req.headers.get('Origin');
  if (!o) return true;
  return o === url.origin;
}

/* ═══ 인증 화면 ═════════════════════════════ */
export function safeNext(next) {
  if (typeof next !== 'string' || !next) return '/';
  if (next[0] !== '/' || next[1] === '/' || next[1] === '\\') return '/';
  return next;
}

/* ═══ 잡다한 것 ══════════════════════════════ */
export function json(o, status) {
  return new Response(JSON.stringify(o), {
    status: status || 200,
    headers: Object.assign(baseHeaders(), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  });
}
export function redirect(to) {
  return new Response(null, { status: 302, headers: Object.assign(baseHeaders(), { location: to }) });
}
export function nowIso() { return new Date().toISOString(); }
export function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
export function fmtBytes(n) {
  if (n >= 1073741824) return (n / 1073741824).toFixed(1) + 'GB';
  if (n >= 1048576) return Math.round(n / 1048576) + 'MB';
  return Math.round(n / 1024) + 'KB';
}
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function readCookie(req, name) {
  const raw = req.headers.get('Cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
