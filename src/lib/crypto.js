/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 비밀번호 늘리기, 서명, base64. 비밀번호 원문은 서버에 오지 않는다.
 */
import { KEY_BYTES, SERVER_ITER } from '../config.js';

/* ═══ 비밀번호 ══════════════════════════════ */
export async function pbkdf2(material, salt, iter) {
  const key = await crypto.subtle.importKey('raw',
    typeof material === 'string' ? new TextEncoder().encode(material) : material,
    'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, KEY_BYTES * 8));
}
export async function hashKey(clientKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const out = await pbkdf2(clientKey, salt, SERVER_ITER);
  return 'pbkdf2$' + SERVER_ITER + '$' + b64(salt) + '$' + b64(out);
}
export async function verifyKey(clientKey, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 4 || p[0] !== 'pbkdf2') return false;
  const iter = parseInt(p[1], 10);
  if (!(iter > 0 && iter <= 1000000)) return false;
  const out = await pbkdf2(clientKey, b64ToBytes(p[2]), iter);
  return eqBytes(out, b64ToBytes(p[3]));
}
export async function dummyWork() { await pbkdf2('x'.repeat(43), new Uint8Array(16), SERVER_ITER); }
export function validKey(k) { return typeof k === 'string' && /^[A-Za-z0-9_-]{43}$/.test(k); }
export function validEmail(e) {
  return typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(e);
}
export async function s256(v) {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
}
export function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64ToBytes(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - t.length % 4) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function enc(str) { return b64(new TextEncoder().encode(str)); }
export function dec(s) { return new TextDecoder().decode(b64ToBytes(s)); }
export function eqBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
export function eqStr(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function sign(env, data) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET이 설정되지 않았습니다');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))));
}
export async function sigOk(env, data, sig) { return eqStr(await sign(env, data), String(sig)); }
