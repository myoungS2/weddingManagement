/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * /auth/* : 로그인·가입·비밀번호·시작 화면 처리.
 */
import { googleClaims, googleOn, killCookie, linkGoogleUser, oauthCookie, readOauthCookie, redirectUri } from './google.js';
import { rateBlocked, rateClear, rateFail } from './rate.js';
import { clearCookie, clientIp, currentUser, minutesLeft, sessionCookie } from './session.js';
import { GOOGLE_AUTH, LOGIN_LOCK_MS, LOGIN_MAX_FAIL, LOGIN_WINDOW_MS, OAUTH_COOKIE, OAUTH_TTL_MS, SIGNUP_MAX, SIGNUP_WINDOW_MS, validAge, validRegion } from '../config.js';
import { consumeReferral, inviteOk } from '../invites.js';
import { b64, dummyWork, eqStr, hashKey, s256, validEmail, validKey, verifyKey } from '../lib/crypto.js';
import { baseHeaders, json, nowIso, redirect, safeNext, sameOrigin } from '../lib/http.js';
import { authPage, inviteOnlyPage, startPage } from '../pages/auth.js';
import { patchPlan } from '../plan.js';

/* ═══ 로그인 화면과 처리 ════════════════════ */
export async function handleAuth(req, env, url) {
  const path = url.pathname, secure = url.protocol === 'https:';

  if (path === '/auth/logout') {
    if (req.method !== 'POST') return redirect(url.origin + '/');
    const h = new Headers({ location: '/auth/login' });
    h.append('set-cookie', clearCookie(secure));
    return new Response(null, { status: 303, headers: h });
  }

  /* ── 구글로 시작하기 (state·nonce·PKCE 를 서명 쿠키에 담아 두고 돌아와서 맞춰 본다) ── */
  if (path === '/auth/google' && req.method === 'GET') {
    if (!googleOn(env)) return redirect(url.origin + '/auth/login?e=' + encodeURIComponent('구글 로그인이 아직 켜져 있지 않습니다'));
    const st = {
      s: b64(crypto.getRandomValues(new Uint8Array(24))),
      n: b64(crypto.getRandomValues(new Uint8Array(16))),
      v: b64(crypto.getRandomValues(new Uint8Array(32))),
      next: safeNext(url.searchParams.get('next')),
      x: Date.now() + OAUTH_TTL_MS
    };
    const q = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri(url),
      response_type: 'code',
      scope: 'openid email profile',
      state: st.s, nonce: st.n,
      code_challenge: await s256(st.v),
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });
    const h = new Headers({ location: GOOGLE_AUTH + '?' + q.toString() });
    h.append('set-cookie', await oauthCookie(env, st, secure));
    return new Response(null, { status: 302, headers: h });
  }

  if (path === '/auth/google/callback' && req.method === 'GET') {
    const back = (msg) => {
      const h = new Headers({ location: url.origin + '/auth/login?e=' + encodeURIComponent(msg) });
      h.append('set-cookie', killCookie(OAUTH_COOKIE, secure));
      return new Response(null, { status: 302, headers: h });
    };
    if (!googleOn(env)) return back('구글 로그인이 아직 켜져 있지 않습니다');
    const st = await readOauthCookie(req, env);
    if (!st) return back('로그인이 시간을 넘겼습니다. 다시 해주세요');
    if (url.searchParams.get('error')) return back('구글 로그인을 그만두었습니다');
    const code = String(url.searchParams.get('code') || '');
    if (!code || !eqStr(String(url.searchParams.get('state') || ''), st.s)) {
      return back('로그인 정보가 맞지 않습니다. 다시 해주세요');
    }
    let claims;
    try { claims = await googleClaims(env, url, code, st); }
    catch (e) { return back((e && e.message) || '구글에서 정보를 받지 못했습니다'); }

    const email = String(claims.email || '').toLowerCase();
    if (!validEmail(email)) return back('구글 계정에서 이메일을 받지 못했습니다');
    if (claims.email_verified !== true && claims.email_verified !== 'true') {
      return back('구글에서 이메일 확인이 끝나지 않은 계정입니다');
    }

    /* 구글 계정이면 누구나 가입할 수 있다. 한 곳에서 계정을 무더기로 찍어내는 것만 아이피로 막는다. */
    const ipKey = 's:' + clientIp(req);
    const gate = (await rateBlocked(env, ipKey))
      ? { ok: false, why: '가입 시도가 너무 많습니다. 잠시 뒤에 다시 해주세요' } : { ok: true };
    const r = await linkGoogleUser(env, email, String(claims.sub || ''), claims.name, gate);
    if (r.error) return back(r.error);
    if (r.created) {
      await rateFail(env, ipKey, SIGNUP_WINDOW_MS, SIGNUP_MAX, SIGNUP_WINDOW_MS);
      await consumeReferral(env, st.next, email);
    }

    /* 막 만들어진 계정이면 시작 화면(예식일·지역·연령대)을 한 번 거친다 */
    /* 파트너 초대(/join)로 처음 온 사람은 시작 화면 없이 바로 합류한다.
       신랑·신부·예식일은 초대한 사람의 장부에 이미 있고, 여기서 적으면 곧 버려질 빈 장부에 들어간다. */
    const joining = /^\/join\//.test(st.next);
    const to = !r.created ? st.next
      : joining ? st.next + '?new=1'
      : '/auth/start?next=' + encodeURIComponent(st.next === '/' ? '/#guide' : st.next);
    const h = new Headers({ location: url.origin + to });
    h.append('set-cookie', await sessionCookie(env, email, r.epoch, secure));
    h.append('set-cookie', killCookie(OAUTH_COOKIE, secure));
    return new Response(null, { status: 302, headers: h });
  }

  if (path === '/auth/start' && req.method === 'GET') {
    const u = await currentUser(req, env);
    if (!u) return redirect(url.origin + '/auth/login');
    return startPage(url.origin, safeNext(url.searchParams.get('next')));
  }

  if (path === '/auth/login' && req.method === 'GET') {
    const u = await currentUser(req, env);
    if (u) return redirect(url.origin + '/');
    return authPage(url.origin, 'login', null, safeNext(url.searchParams.get('next')), null,
      googleOn(env), url.searchParams.get('e') || '');
  }

  if (path === '/auth/signup' && req.method === 'GET') {
    const nx = safeNext(url.searchParams.get('next'));
    const inv = await inviteOk(env, nx);
    /* 초대 링크 없이 들어왔으면 "초대 전용" 안내와 구글 버튼만 보여 준다 */
    if (!inv) return inviteOnlyPage(url.origin, googleOn(env));
    return authPage(url.origin, 'signup', null, nx, inv, googleOn(env));
  }

  if (path === '/auth/password' && req.method === 'GET') {
    const u = await currentUser(req, env);
    if (!u) return redirect(url.origin + '/auth/login');
    return authPage(url.origin, 'password', u.email);
  }

  if (req.method !== 'POST') return new Response('없는 경로입니다', { status: 404, headers: baseHeaders() });
  if (!sameOrigin(req, url)) return json({ error: '요청 출처가 올바르지 않습니다' }, 403);

  let body;
  try { body = await req.json(); } catch (e) { return json({ error: '요청을 읽지 못했습니다' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();

  if (path === '/auth/login') {
    if (!validEmail(email) || !validKey(body.key)) return json({ error: '이메일 또는 비밀번호가 맞지 않습니다' }, 401);
    const ipKey = 'i:' + clientIp(req), emKey = 'e:' + email;
    const blocked = (await rateBlocked(env, emKey)) || (await rateBlocked(env, ipKey));
    if (blocked) return json({ error: '로그인 시도가 너무 많습니다. ' + minutesLeft(blocked) + '분 뒤에 다시 해주세요' }, 429);

    const row = await env.DB.prepare('SELECT email, pw, session_epoch FROM users WHERE email = ?').bind(email).first();
    const ok = (row && row.pw) ? await verifyKey(body.key, row.pw) : (await dummyWork(), false);
    if (!ok) {
      await rateFail(env, emKey, LOGIN_WINDOW_MS, LOGIN_MAX_FAIL, LOGIN_LOCK_MS);
      await rateFail(env, ipKey, LOGIN_WINDOW_MS, LOGIN_MAX_FAIL * 3, LOGIN_LOCK_MS);
      return json({ error: '이메일 또는 비밀번호가 맞지 않습니다' }, 401);
    }
    await rateClear(env, emKey);
    await env.DB.prepare('UPDATE users SET last_login = ? WHERE email = ?').bind(nowIso(), email).run();
    const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    h.append('set-cookie', await sessionCookie(env, email, row.session_epoch, secure));
    return new Response(JSON.stringify({ ok: true, next: safeNext(body.next) }), { headers: h });
  }

  /* 이메일 가입은 초대 링크(/join 또는 /r)가 살아 있을 때만 */
  if (path === '/auth/signup') {
    const ipKey = 's:' + clientIp(req);
    const blocked = await rateBlocked(env, ipKey);
    if (blocked) return json({ error: '가입 시도가 너무 많습니다. ' + minutesLeft(blocked) + '분 뒤에 다시 해주세요' }, 429);
    const nx = safeNext(body.next);
    const inv = await inviteOk(env, nx);
    if (!inv) return json({ error: '가입은 초대 링크로만 할 수 있습니다. 구글 계정이면 바로 시작할 수 있어요' }, 403);
    if (!validEmail(email)) return json({ error: '이메일 형식이 올바르지 않습니다' }, 400);
    if (!validKey(body.key)) return json({ error: '비밀번호를 다시 입력해 주세요' }, 400);
    const exists = await env.DB.prepare('SELECT email FROM users WHERE email = ?').bind(email).first();
    if (exists) return json({ error: '이미 가입된 이메일입니다. 로그인해 주세요' }, 409);

    const pw = await hashKey(body.key);
    const name = String(body.name || '').trim().slice(0, 40) || email.split('@')[0];
    await env.DB.prepare(
      'INSERT INTO users (email, name, pw, session_epoch, created_at, provider) VALUES (?,?,?,1,?,?)'
    ).bind(email, name, pw, nowIso(), 'password').run();
    await rateFail(env, ipKey, SIGNUP_WINDOW_MS, SIGNUP_MAX, SIGNUP_WINDOW_MS);
    await consumeReferral(env, nx, email);

    const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    h.append('set-cookie', await sessionCookie(env, email, 1, secure));
    /* 파트너 초대(/join)면 그 주소로 가서 합류하고, 추천(/r)이면 시작 화면으로 */
    const next = inv.type === 'plan' ? nx + '?new=1' : '/auth/start?next=' + encodeURIComponent('/#guide');
    return new Response(JSON.stringify({ ok: true, next }), { headers: h });
  }

  if (path === '/auth/password') {
    const u = await currentUser(req, env);
    if (!u) return json({ error: '로그인이 필요합니다' }, 401);
    if (!validKey(body.key) || !validKey(body.newKey)) return json({ error: '비밀번호를 다시 입력해 주세요' }, 400);
    const emKey = 'p:' + u.email;
    const blocked = await rateBlocked(env, emKey);
    if (blocked) return json({ error: '시도가 너무 많습니다. ' + minutesLeft(blocked) + '분 뒤에 다시 해주세요' }, 429);
    const row = await env.DB.prepare('SELECT pw, session_epoch FROM users WHERE email = ?').bind(u.email).first();
    if (!row || !(await verifyKey(body.key, row.pw))) {
      await rateFail(env, emKey, LOGIN_WINDOW_MS, LOGIN_MAX_FAIL, LOGIN_LOCK_MS);
      return json({ error: '지금 쓰는 비밀번호가 맞지 않습니다' }, 401);
    }
    await rateClear(env, emKey);
    const epoch = Number(row.session_epoch) + 1;
    await env.DB.prepare('UPDATE users SET pw = ?, session_epoch = ? WHERE email = ?')
      .bind(await hashKey(body.newKey), epoch, u.email).run();
    const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    h.append('set-cookie', await sessionCookie(env, u.email, epoch, secure));
    return new Response(JSON.stringify({ ok: true, next: '/' }), { headers: h });
  }

  /* ── 시작 화면 저장: 예식일(미정 가능)·지역·연령대. 전부 건너뛰어도 된다. ── */
  if (path === '/auth/start') {
    const u = await currentUser(req, env);
    if (!u) return json({ error: '로그인이 필요합니다' }, 401);
    const age = validAge(body.age) ? body.age : null;
    await env.DB.prepare('UPDATE users SET age_band = ? WHERE email = ?').bind(age, u.key).run();
    const patch = {};
    const date = String(body.weddingDate || '');
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(date)) patch.weddingDate = date;
    if (validRegion(body.region)) patch.region = body.region;
    const g = String(body.groom || '').trim().slice(0, 20), b = String(body.bride || '').trim().slice(0, 20);
    if (g) patch.groom = g;
    if (b) patch.bride = b;
    if (Object.keys(patch).length) await patchPlan(env, u.plan.id, patch);
    return json({ ok: true, next: safeNext(body.next) });
  }

  return new Response('없는 경로입니다', { status: 404, headers: baseHeaders() });
}
