/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 구글 로그인 (OIDC + PKCE).
 */
import { GOOGLE_ISS, GOOGLE_TOKEN, OAUTH_COOKIE, OAUTH_TTL_MS } from '../config.js';
import { dec, enc, eqStr, sigOk, sign } from '../lib/crypto.js';
import { nowIso, readCookie } from '../lib/http.js';

/* ═══ 구글 로그인 ═══════════════════════════ */
export function googleOn(env) { return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET); }
export function redirectUri(url) { return url.origin + '/auth/google/callback'; }
export async function oauthCookie(env, st, secure) {
  const payload = enc(JSON.stringify(st));
  const sig = await sign(env, payload);
  return OAUTH_COOKIE + '=' + payload + '.' + sig +
    '; Path=/auth; Max-Age=' + Math.round(OAUTH_TTL_MS / 1000) + '; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
}
export async function readOauthCookie(req, env) {
  const raw = readCookie(req, OAUTH_COOKIE);
  if (!raw) return null;
  const cut = raw.lastIndexOf('.');
  if (cut < 0) return null;
  const payload = raw.slice(0, cut);
  if (!(await sigOk(env, payload, raw.slice(cut + 1)))) return null;
  let st;
  try { st = JSON.parse(dec(payload)); } catch (e) { return null; }
  if (!st || !st.s || !st.n || !st.v || !st.x || st.x < Date.now()) return null;
  return st;
}
export function killCookie(name, secure) {
  return name + '=; Path=/auth; Max-Age=0; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
}
function tokenErrorMessage(code) {
  const M = {
    invalid_client: '구글 로그인 설정(클라이언트 ID·비밀번호)이 맞지 않습니다. 운영자에게 알려 주세요',
    unauthorized_client: '이 서비스가 구글 로그인을 쓸 수 있도록 설정되지 않았습니다. 운영자에게 알려 주세요',
    redirect_uri_mismatch: '구글에 이 주소가 등록되지 않았습니다. 운영자에게 알려 주세요',
    invalid_grant: '로그인이 시간을 넘겼습니다. 다시 해주세요'
  };
  return M[code] || ('구글이 로그인을 받아주지 않았습니다' + (code ? ' (' + code + ')' : ''));
}
export async function googleClaims(env, url, code, st) {
  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(url), grant_type: 'authorization_code', code_verifier: st.v
    }).toString()
  });
  if (!r.ok) {
    /* 구글이 거절한 이유(오류 코드)만 남긴다. 코드·토큰·비밀값은 기록하지 않는다. */
    let e = {};
    try { e = await r.json(); } catch (x) {}
    console.error('google token exchange failed', r.status, e.error || '', e.error_description || '');
    throw new Error(tokenErrorMessage(e.error));
  }
  const t = await r.json();
  const parts = String(t.id_token || '').split('.');
  if (parts.length !== 3) throw new Error('구글이 보낸 정보를 읽지 못했습니다');
  let c;
  try { c = JSON.parse(dec(parts[1])); } catch (e) { throw new Error('구글이 보낸 정보를 읽지 못했습니다'); }
  if (GOOGLE_ISS.indexOf(String(c.iss)) < 0) throw new Error('구글이 보낸 정보가 아닙니다');
  if (!eqStr(String(c.aud || ''), String(env.GOOGLE_CLIENT_ID))) throw new Error('다른 앱에 발급된 정보입니다');
  if (!(Number(c.exp) * 1000 > Date.now())) throw new Error('구글이 보낸 정보가 오래됐습니다');
  if (!eqStr(String(c.nonce || ''), st.n)) throw new Error('로그인 정보가 맞지 않습니다');
  return c;
}
export async function linkGoogleUser(env, email, sub, name, gate) {
  if (!sub) return { error: '구글 계정을 알아보지 못했습니다' };
  const at = nowIso();
  const bySub = await env.DB.prepare('SELECT email, session_epoch FROM users WHERE google_sub = ?').bind(sub).first();
  if (bySub) {
    await env.DB.prepare('UPDATE users SET last_login = ? WHERE email = ?').bind(at, bySub.email).run();
    return { email: bySub.email, epoch: Number(bySub.session_epoch), created: false };
  }
  const byEmail = await env.DB.prepare('SELECT email, session_epoch FROM users WHERE email = ?').bind(email).first();
  if (byEmail) {
    await env.DB.prepare(
      "UPDATE users SET google_sub = ?, last_login = ?, provider = CASE WHEN pw IS NULL THEN 'google' ELSE 'both' END WHERE email = ?"
    ).bind(sub, at, email).run();
    return { email: byEmail.email, epoch: Number(byEmail.session_epoch), created: false };
  }
  if (!gate || !gate.ok) return { error: (gate && gate.why) || '지금은 새로 시작할 수 없습니다' };
  const nm = String(name || '').trim().slice(0, 40) || email.split('@')[0];
  try {
    await env.DB.prepare(
      'INSERT INTO users (email, name, pw, session_epoch, created_at, last_login, provider, google_sub) VALUES (?,?,NULL,1,?,?,?,?)'
    ).bind(email, nm, at, at, 'google', sub).run();
  } catch (e) {
    return { error: '계정을 만들지 못했습니다. 잠시 뒤에 다시 해주세요' };
  }
  return { email, epoch: 1, created: true };
}
