/**
 * Wedding Management — Cloudflare Worker
 * © 2026 myoung. All rights reserved.  (LICENSE 참고 · 무단 사용 금지)
 *
 *  1. 로그인: 구글이 기본. 이메일·비밀번호 가입은 초대 링크(/join, /r)를 타고 온 경우에만 열린다.
 *  2. 결혼 계획(plan) 단위로 완전히 분리된 API (D1). 한 계획에 커플 두 사람만.
 *  3. 파일함 (R2): 계약서·음악·영상·레퍼런스 이미지
 *  4. 앱 HTML 서빙
 *
 * 비밀번호는 서버에 도착하지 않는다. 브라우저가 PBKDF2로 60만 번 늘린 결과만 보내고,
 * 워커는 거기에 임의 소금을 섞어 1만 2천 번 더 늘려 저장한다. (house-hunt 와 같은 방식)
 */
import APP_HTML from "../index.html";
import LOGO_WEBP from "../assets/logo-doves.webp";
import WORDMARK_WEBP from "../assets/wordmark-ribbon.webp";
/* 작은 일러스트 8종: 탭 아이콘, 빈 화면, 사용 안내, 메인에 한 장씩 */
import ART_CAKE from "../assets/art/cake.webp";
import ART_COUPLE from "../assets/art/couple.webp";
import ART_BOUQUET from "../assets/art/bouquet.webp";
import ART_RINGS from "../assets/art/rings.webp";
import ART_DOVES from "../assets/art/doves.webp";
import ART_GLASSES from "../assets/art/glasses.webp";
import ART_BOW from "../assets/art/bow.webp";
import ART_FLOWERS from "../assets/art/flowers.webp";
import ART_CAKE2 from "../assets/art/cake2.webp";
import ART_BRIDE from "../assets/art/bride.webp";
import ART_GROOM from "../assets/art/groom.webp";
import ART_BOUQUET2 from "../assets/art/bouquet2.webp";
import ART_RINGS2 from "../assets/art/rings2.webp";
import ART_DOVES2 from "../assets/art/doves2.webp";
import ART_HEARTBOW from "../assets/art/heartbow.webp";
import ART_GLASSES2 from "../assets/art/glasses2.webp";
import ART_SPRIG from "../assets/art/sprig.webp";
import ART_TULIP from "../assets/art/tulip.webp";
import ART_ARCH from "../assets/art/arch.webp";
import ART_ENVELOPE from "../assets/art/envelope.webp";
import ART_BALLOONS from "../assets/art/balloons.webp";
import ART_DOVEHEART from "../assets/art/doveheart.webp";
import ART_FLOWERS2 from "../assets/art/flowers2.webp";
const ART = { cake: ART_CAKE, couple: ART_COUPLE, bouquet: ART_BOUQUET, rings: ART_RINGS, doves: ART_DOVES, glasses: ART_GLASSES, bow: ART_BOW, flowers: ART_FLOWERS,
  cake2: ART_CAKE2, bride: ART_BRIDE, groom: ART_GROOM, bouquet2: ART_BOUQUET2, rings2: ART_RINGS2, doves2: ART_DOVES2, heartbow: ART_HEARTBOW, glasses2: ART_GLASSES2, sprig: ART_SPRIG, tulip: ART_TULIP, arch: ART_ARCH, envelope: ART_ENVELOPE, balloons: ART_BALLOONS, doveheart: ART_DOVEHEART, flowers2: ART_FLOWERS2 };

/* ── 설정값 ── */
const SITE       = 'Wedding Management';
const SITE_LEAD  = '둘이 함께 쓰는 결혼 준비 장부';
const SITE_DESC  = '예산·업체·일정·하객을 한곳에서. 플래너 없이 준비하는 커플을 위한 결혼 준비 관리';

const CLIENT_ITER  = 600000;   // 브라우저가 도는 횟수. 로그인 화면 스크립트와 반드시 같아야 한다.
const SERVER_ITER  = 12000;
const KEY_BYTES    = 32;
const MIN_PW       = 10;
const SESSION_DAYS = 30;
const INVITE_DAYS  = 7;
const MAX_MEMBERS  = 2;        // 커플 두 사람. 혼주는 나중에 "보기 전용 링크"로.
const MAX_ITEMS    = 2000;     // 한 계획, 한 종류(업체·결제…)당 항목 수
const MAX_DOC_LEN  = 100000;   // 항목 하나의 JSON 길이

/* 파일함. Worker 를 거쳐 올리므로 한 번에 보낼 수 있는 크기는 요청 본문 한도(무료 100MB)에 묶인다.
 * 더 큰 영상은 R2 multipart 로 나눠 올리는 길을 나중에 연다. 총량은 요금제로 가른다. */
const MAX_FILE          = 100 * 1024 * 1024;
const QUOTA_FREE        = 300 * 1024 * 1024;
const QUOTA_PREMIUM     = 2 * 1024 * 1024 * 1024;
const FILE_OWNERS       = ['vendor', 'event', 'memo', 'reference', 'invitation'];
const FILE_KINDS        = ['contract', 'audio', 'video', 'image', 'doc', 'other'];

const LOGIN_WINDOW_MS  = 15 * 60 * 1000;
const LOGIN_MAX_FAIL   = 8;
const LOGIN_LOCK_MS    = 15 * 60 * 1000;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const SIGNUP_MAX       = 5;

const SESSION_COOKIE = 'wm_session';
const OAUTH_COOKIE   = 'wm_oauth';
const OAUTH_TTL_MS   = 10 * 60 * 1000;
const GOOGLE_AUTH    = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN   = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISS     = ['accounts.google.com', 'https://accounts.google.com'];

/* 통계용으로만 받는 값들 */
const AGE_BANDS = ['20s', '30s', '40s'];
const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '해외'];
function validAge(v) { return AGE_BANDS.indexOf(String(v)) >= 0; }
function validRegion(v) { return REGIONS.indexOf(String(v)) >= 0; }

/* 계획 안의 항목 종류. 모두 (plan_id, id, data) 모양이라 한 벌의 코드로 다룬다. */
const COLLECTIONS = ['vendors', 'payments', 'events', 'tasks', 'guests', 'memos'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (path === '/privacy' || path === '/terms') return legalPage(url.origin, path.slice(1), env);
      if (path === '/welcome') return landingPage(url.origin, googleOn(env), !!(await currentUser(req, env)));   // 로그인한 사람도 메인을 볼 수 있게

      if (path === '/icon.svg' || path === '/favicon.ico') return staticFile(ICON_SVG, 'image/svg+xml; charset=utf-8');
      if (path === '/logo.webp') return staticFile(LOGO_WEBP, 'image/webp');
      if (path === '/wordmark.webp') return staticFile(WORDMARK_WEBP, 'image/webp');
      const art = path.match(/^\/art\/([a-z0-9]+)\.webp$/);
      if (art && ART[art[1]]) return staticFile(ART[art[1]], 'image/webp');

      if (path.startsWith('/auth/')) return await handleAuth(req, env, url);

      if (path === '/api/me') {
        const u = await currentUser(req, env);
        if (!u) return json({ error: 'unauthorized', login: '/auth/login' }, 401);
        return json({
          email: u.email, name: u.name, admin: isAdmin(env, u),
          plan: u.plan, plans: await myPlans(env, u.key),
          files: !!env.FILES, fileMax: MAX_FILE, quota: quotaOf(u.plan),
          kakao: !!env.KAKAO_REST_KEY
        });
      }

      if (path.startsWith('/api/') || path.startsWith('/file/')) {
        const u = await currentUser(req, env);
        if (!u) return json({ error: 'unauthorized', login: '/auth/login' }, 401);
        if (req.method !== 'GET' && !sameOrigin(req, url)) {
          return json({ error: '요청 출처가 올바르지 않습니다' }, 403);
        }
        if (path.startsWith('/api/admin/')) return await handleAdmin(req, env, url, u);
        return await handleApi(req, env, url, u);
      }

      if (path.startsWith('/join/')) return await handleJoin(req, env, url);
      if (path.startsWith('/r/')) return await handleReferral(req, env, url);

      if (path === '/' || path === '/index.html') {
        const u = await currentUser(req, env);
        if (!u) return landingPage(url.origin, googleOn(env), false);
        return serveApp(url.origin);
      }
      return new Response('찾는 페이지가 없습니다', { status: 404, headers: baseHeaders() });
    } catch (err) {
      return json({ error: (err && err.message) || String(err) }, 500);
    }
  }
};

/* ═══ 머리말 ═══════════════════════════════ */
const FONT_LINKS =
  '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>' +
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">';

function pageHead(origin, title, o) {
  o = o || {};
  const t = o.title || SITE;
  const d = o.desc || SITE_DESC;
  const site = /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(origin + '/')
    ? origin : origin.replace(/^http:/, 'https:');
  return '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="color-scheme" content="light">' +
    '<meta name="theme-color" content="#FBF7F0">' +
    (title ? '<title>' + esc(title) + '</title>' : '') +
    '<meta name="description" content="' + esc(d) + '">' +
    '<meta name="author" content="myoung">' +
    '<meta name="copyright" content="© 2026 myoung. All rights reserved.">' +
    '<link rel="icon" href="/icon.svg" type="image/svg+xml">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="' + SITE + '">' +
    '<meta property="og:locale" content="ko_KR">' +
    '<meta property="og:title" content="' + esc(t) + '">' +
    '<meta property="og:description" content="' + esc(d) + '">' +
    '<meta property="og:url" content="' + esc(site + (o.path || '/')) + '">' +
    '<meta property="og:image" content="' + esc(site + '/logo.webp') + '">' +
    '<meta name="twitter:card" content="summary_large_image">';
}

/* 탭 아이콘: 로고의 핑크로 그린 반지 두 개. 작게 보여도 읽히는 가장 단순한 형태. */
const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" rx="8" fill="#FFFFFF"/>' +
  '<g fill="none" stroke="#E8536F" stroke-width="2.4">' +
  '<circle cx="12.5" cy="17" r="7"/><circle cx="19.5" cy="17" r="7"/></g></svg>';

function staticFile(body, type) {
  return new Response(body, {
    headers: Object.assign(baseHeaders(), { 'content-type': type, 'cache-control': 'public, max-age=86400' })
  });
}

/* ═══ 앱 서빙 ═══════════════════════════════ */
function serveApp(origin) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  const body = APP_HTML
    .replace('<style>', '<style nonce="' + nonce + '">')
    .replace('<script>', '<script nonce="' + nonce + '">');
  return new Response(shell(nonce, body, origin), {
    headers: Object.assign(baseHeaders(), {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': csp(nonce)
    })
  });
}
function shell(nonce, body, origin) {
  return '<!doctype html><html lang="ko"><head>' + pageHead(origin, '') + FONT_LINKS +
    '<style nonce="' + nonce + '">body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>' +
    '</head><body>' + body + '</body></html>';
}
function csp(nonce) {
  return "default-src 'none'; script-src 'nonce-" + nonce + "'; " +
    "style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; " +
    "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; form-action 'self'; " +
    "base-uri 'none'; frame-ancestors 'none'";
}
function baseHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'x-frame-options': 'DENY',
    'strict-transport-security': 'max-age=31536000; includeSubDomains'
  };
}
function sameOrigin(req, url) {
  const o = req.headers.get('Origin');
  if (!o) return true;
  return o === url.origin;
}

/* ═══ 세션 ══════════════════════════════════ */
async function currentUser(req, env) {
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

/* ═══ 결혼 계획 ══════════════════════════════
 * 가입하면 자기 계획이 하나 생긴다. 파트너 초대를 받아 들어온 사람은 그 계획의 멤버가 된다.
 * 모든 읽기와 쓰기는 plan_id 로 걸리고, 멤버가 아니면 아무것도 보이지 않는다.
 */
async function resolvePlan(env, u, wanted) {
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

async function createPlan(env, ownerKey, name) {
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

async function myPlans(env, key) {
  const r = await env.DB.prepare(
    'SELECT p.id, p.name, m.role, (SELECT COUNT(*) FROM plan_members x WHERE x.plan_id = p.id) AS people ' +
    'FROM plan_members m JOIN plans p ON p.id = m.plan_id WHERE m.user_key = ? ORDER BY m.joined_at'
  ).bind(key).all();
  return r.results || [];
}

function quotaOf(plan) { return plan && plan.tier === 'premium' ? QUOTA_PREMIUM : QUOTA_FREE; }

async function sessionCookie(env, email, epoch, secure) {
  const payload = enc(JSON.stringify({ e: email, v: epoch, x: Date.now() + SESSION_DAYS * 864e5 }));
  const sig = await sign(env, payload);
  return SESSION_COOKIE + '=' + payload + '.' + sig +
    '; Path=/; Max-Age=' + SESSION_DAYS * 86400 + '; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
}
function clearCookie(secure) {
  return SESSION_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
}

/* ═══ 비밀번호 ══════════════════════════════ */
async function pbkdf2(material, salt, iter) {
  const key = await crypto.subtle.importKey('raw',
    typeof material === 'string' ? new TextEncoder().encode(material) : material,
    'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, KEY_BYTES * 8));
}
async function hashKey(clientKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const out = await pbkdf2(clientKey, salt, SERVER_ITER);
  return 'pbkdf2$' + SERVER_ITER + '$' + b64(salt) + '$' + b64(out);
}
async function verifyKey(clientKey, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 4 || p[0] !== 'pbkdf2') return false;
  const iter = parseInt(p[1], 10);
  if (!(iter > 0 && iter <= 1000000)) return false;
  const out = await pbkdf2(clientKey, b64ToBytes(p[2]), iter);
  return eqBytes(out, b64ToBytes(p[3]));
}
async function dummyWork() { await pbkdf2('x'.repeat(43), new Uint8Array(16), SERVER_ITER); }
function validKey(k) { return typeof k === 'string' && /^[A-Za-z0-9_-]{43}$/.test(k); }
function validEmail(e) {
  return typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(e);
}

/* ═══ 시도 횟수 제한 ════════════════════════ */
async function rateBlocked(env, key) {
  const row = await env.DB.prepare('SELECT until FROM login_attempts WHERE key = ?').bind(key).first();
  return row && row.until && row.until > Date.now() ? row.until : 0;
}
async function rateFail(env, key, windowMs, maxFail, lockMs) {
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
async function rateClear(env, key) {
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
}
function isAdmin(env, u) {
  const a = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !!a && !!u && u.key === a;
}
function clientIp(req) { return req.headers.get('CF-Connecting-IP') || '0.0.0.0'; }
function minutesLeft(until) { return Math.max(1, Math.ceil((until - Date.now()) / 60000)); }

/* ═══ 로그인 화면과 처리 ════════════════════ */
async function handleAuth(req, env, url) {
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
    const to = r.created ? '/auth/start?next=' + encodeURIComponent(st.next === '/' ? '/#guide' : st.next) : st.next;
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
    const next = inv.type === 'plan' ? nx : '/auth/start?next=' + encodeURIComponent('/#guide');
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

async function patchPlan(env, planId, patch) {
  const row = await env.DB.prepare('SELECT data FROM plans WHERE id = ?').bind(planId).first();
  const cur = (row && safeParse(row.data)) || {};
  const next = Object.assign({}, cur, patch);
  await env.DB.prepare('UPDATE plans SET data = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(next), nowIso(), planId).run();
  return next;
}

/* ═══ 구글 로그인 ═══════════════════════════ */
function googleOn(env) { return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET); }
function redirectUri(url) { return url.origin + '/auth/google/callback'; }
async function s256(v) {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
}
async function oauthCookie(env, st, secure) {
  const payload = enc(JSON.stringify(st));
  const sig = await sign(env, payload);
  return OAUTH_COOKIE + '=' + payload + '.' + sig +
    '; Path=/auth; Max-Age=' + Math.round(OAUTH_TTL_MS / 1000) + '; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
}
async function readOauthCookie(req, env) {
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
function killCookie(name, secure) {
  return name + '=; Path=/auth; Max-Age=0; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '');
}
async function googleClaims(env, url, code, st) {
  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(url), grant_type: 'authorization_code', code_verifier: st.v
    }).toString()
  });
  if (!r.ok) throw new Error('구글이 로그인을 받아주지 않았습니다');
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
async function linkGoogleUser(env, email, sub, name, gate) {
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

/* ═══ 초대 ══════════════════════════════════
 * plan     /join/<token>  파트너를 내 계획에 합류시킨다. 멤버 2명이 차면 더 못 만든다.
 * referral /r/<token>     친구에게 추천한다. 받은 사람은 자기 계획을 새로 갖고, 추천인이 기록된다.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

async function inviteOk(env, next) {
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
async function consumeReferral(env, next, email) {
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

async function handleReferral(req, env, url) {
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

async function handleJoin(req, env, url) {
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

async function dropEmptyOwnPlans(env, userKey, keepId) {
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

async function liveInvites(env, planId, userKey, origin) {
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

/* ═══ API ═══════════════════════════════════ */
async function handleApi(req, env, url, u) {
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

  /* ── 항목 CRUD: /api/<col>/<id> ── */
  const colOne = path.match(/^\/api\/(vendors|payments|events|tasks|guests|memos)\/([A-Za-z0-9_-]{1,64})$/);
  if (colOne) {
    const col = colOne[1], id = colOne[2];
    if (method === 'PUT') {
      const body = await req.json();
      body.id = id;
      const doc = JSON.stringify(body);
      if (doc.length > MAX_DOC_LEN) return json({ error: '내용이 너무 깁니다' }, 413);
      const c = await env.DB.prepare(
        'SELECT COUNT(*) AS n, MAX(CASE WHEN id = ? THEN 1 ELSE 0 END) AS mine FROM ' + col + ' WHERE plan_id = ?'
      ).bind(id, pid).first();
      if (!Number(c.mine) && Number(c.n) >= MAX_ITEMS) return json({ error: '항목이 너무 많습니다 (' + MAX_ITEMS + '개)' }, 409);
      await env.DB.prepare(upsertSql(col)).bind(pid, id, doc, nowIso(), uk, uk).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await deleteItem(env, pid, col, id);
      return json({ ok: true });
    }
  }
  /* 여러 개 한 번에 (가이드 할 일 채우기, CSV 가져오기) */
  const colBulk = path.match(/^\/api\/(vendors|payments|events|tasks|guests|memos)$/);
  if (colBulk && method === 'PUT') {
    const col = colBulk[1];
    const body = await req.json();
    const items = (Array.isArray(body.items) ? body.items : []).filter(x => x && /^[A-Za-z0-9_-]{1,64}$/.test(String(x.id)));
    if (!items.length) return json({ ok: true, saved: 0 });
    if (items.length > 500) return json({ error: '한 번에 500개까지만 저장합니다' }, 400);
    const have = await env.DB.prepare('SELECT id FROM ' + col + ' WHERE plan_id = ?').bind(pid).all();
    const known = new Set((have.results || []).map(r => String(r.id)));
    const fresh = items.filter(x => !known.has(String(x.id))).length;
    if (known.size + fresh > MAX_ITEMS) return json({ error: '항목이 너무 많습니다 (' + MAX_ITEMS + '개)' }, 409);
    for (const x of items) if (JSON.stringify(x).length > MAX_DOC_LEN) return json({ error: '내용이 너무 긴 항목이 있습니다' }, 413);
    const at = nowIso();
    await env.DB.batch(items.map(x => env.DB.prepare(upsertSql(col)).bind(pid, String(x.id), JSON.stringify(x), at, uk, uk)));
    return json({ ok: true, saved: items.length });
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

  /* ── 파일함 ──
   * POST /api/files?owner=vendor&id=<ownerId>&kind=contract&name=<파일명>  본문 = 파일 그대로
   * 본문은 스트림으로 R2 에 바로 흘려보낸다. 메타데이터만 D1 에 적는다.
   */
  if (path === '/api/files' && method === 'POST') {
    if (!env.FILES) return json({ error: '파일 저장소가 켜져 있지 않습니다' }, 503);
    const owner = String(url.searchParams.get('owner') || '');
    const ownerId = String(url.searchParams.get('id') || '');
    const kind = String(url.searchParams.get('kind') || 'other');
    const name = String(url.searchParams.get('name') || 'file').slice(0, 200);
    const memo = String(url.searchParams.get('memo') || '').slice(0, 500);
    const who = ['groom', 'bride'].indexOf(url.searchParams.get('who')) >= 0 ? url.searchParams.get('who') : null;
    if (FILE_OWNERS.indexOf(owner) < 0) return json({ error: '어디에 붙는 파일인지 알 수 없습니다' }, 400);
    if (owner !== 'reference' && !/^[A-Za-z0-9_-]{1,64}$/.test(ownerId)) return json({ error: '붙일 항목이 없습니다' }, 400);
    if (FILE_KINDS.indexOf(kind) < 0) return json({ error: '파일 종류가 올바르지 않습니다' }, 400);
    const size = Number(req.headers.get('content-length') || 0);
    if (!size) return json({ error: '빈 파일입니다' }, 400);
    if (size > MAX_FILE) return json({ error: '한 번에 ' + Math.round(MAX_FILE / 1048576) + 'MB까지 올릴 수 있습니다' }, 413);
    const used = await usageOf(env, pid);
    const quota = quotaOf(u.plan);
    if (used + size > quota) return json({ error: '저장 공간이 부족합니다 (' + fmtBytes(used) + ' / ' + fmtBytes(quota) + ')', quota: true }, 409);

    const type = req.headers.get('content-type') || 'application/octet-stream';
    const id = crypto.randomUUID().replace(/-/g, '');
    const key = pid + '/' + id;
    await env.FILES.put(key, req.body, { httpMetadata: { contentType: type } });
    const head = await env.FILES.head(key);
    const real = head ? head.size : size;
    await env.DB.prepare(
      'INSERT INTO files (id, plan_id, owner_type, owner_id, kind, name, size, content_type, object_key, memo, who, created_by, created_at) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(id, pid, owner, owner === 'reference' ? null : ownerId, kind, name, real, type, key, memo || null, who, uk, nowIso()).run();
    return json({ ok: true, file: await fileRow(env, pid, id), usage: used + real, quota });
  }

  const fileOne = path.match(/^\/file\/([a-f0-9]{32})$/);
  if (fileOne && method === 'GET') {
    const row = await env.DB.prepare('SELECT object_key, content_type, name, size FROM files WHERE id = ? AND plan_id = ?')
      .bind(fileOne[1], pid).first();
    if (!row) return new Response('없는 파일입니다', { status: 404, headers: baseHeaders() });
    if (!env.FILES) return new Response('파일 저장소가 없습니다', { status: 404, headers: baseHeaders() });
    /* 영상·음악은 구간 요청으로 끊김 없이 재생된다 */
    const range = req.headers.get('range');
    const obj = await env.FILES.get(row.object_key, range ? { range: req.headers } : undefined);
    if (!obj) return new Response('없는 파일입니다', { status: 404, headers: baseHeaders() });
    const h = Object.assign(baseHeaders(), {
      'content-type': row.content_type || 'application/octet-stream',
      'cache-control': 'private, max-age=86400',
      'accept-ranges': 'bytes',
      'etag': obj.httpEtag,
      'content-disposition': (url.searchParams.get('dl') ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(row.name)
    });
    if (obj.range && range) {
      const start = obj.range.offset, len = obj.range.length, total = obj.size;
      h['content-range'] = 'bytes ' + start + '-' + (start + len - 1) + '/' + total;
      h['content-length'] = String(len);
      return new Response(obj.body, { status: 206, headers: h });
    }
    h['content-length'] = String(obj.size);
    return new Response(obj.body, { headers: h });
  }
  const fileApi = path.match(/^\/api\/files\/([a-f0-9]{32})$/);
  if (fileApi && method === 'DELETE') {
    await deleteFiles(env, pid, [fileApi[1]]);
    return json({ ok: true, usage: await usageOf(env, pid) });
  }
  if (fileApi && method === 'PATCH') {
    const body = await req.json();
    if ('memo' in body) await env.DB.prepare('UPDATE files SET memo = ? WHERE id = ? AND plan_id = ?').bind(String(body.memo || '').slice(0, 500) || null, fileApi[1], pid).run();
    if (body.name) await env.DB.prepare('UPDATE files SET name = ? WHERE id = ? AND plan_id = ?').bind(String(body.name).slice(0, 200), fileApi[1], pid).run();
    if ('who' in body) await env.DB.prepare('UPDATE files SET who = ? WHERE id = ? AND plan_id = ?').bind(['groom', 'bride'].indexOf(body.who) >= 0 ? body.who : null, fileApi[1], pid).run();
    return json({ ok: true, file: await fileRow(env, pid, fileApi[1]) });
  }

  /* ── 레퍼런스: 태그와 좋아요 ── */
  if (path === '/api/ref/tags' && method === 'POST') {
    const body = await req.json();
    const name = String(body.name || '').trim().slice(0, 20);
    if (!name) return json({ error: '태그 이름을 적어 주세요' }, 400);
    const id = 't_' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM ref_tags WHERE plan_id = ?').bind(pid).first();
    if (Number(n.n) >= 60) return json({ error: '태그는 60개까지입니다' }, 409);
    await env.DB.prepare('INSERT INTO ref_tags (plan_id, id, name, sort) VALUES (?,?,?,?)').bind(pid, id, name, Number(n.n) + 1).run();
    return json({ ok: true, tag: { id, name, sort: Number(n.n) + 1 } });
  }
  const tagOne = path.match(/^\/api\/ref\/tags\/([A-Za-z0-9_-]{1,32})$/);
  if (tagOne && method === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ref_file_tags WHERE plan_id = ? AND tag_id = ?').bind(pid, tagOne[1]),
      env.DB.prepare('DELETE FROM ref_tags WHERE plan_id = ? AND id = ?').bind(pid, tagOne[1])
    ]);
    return json({ ok: true });
  }
  const refTags = path.match(/^\/api\/ref\/([a-f0-9]{32})\/tags$/);
  if (refTags && method === 'PUT') {
    const body = await req.json();
    const ids = (Array.isArray(body.tagIds) ? body.tagIds : []).map(String).filter(x => /^[A-Za-z0-9_-]{1,32}$/.test(x)).slice(0, 20);
    const f = await env.DB.prepare("SELECT id FROM files WHERE id = ? AND plan_id = ? AND owner_type = 'reference'").bind(refTags[1], pid).first();
    if (!f) return json({ error: '없는 레퍼런스입니다' }, 404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ref_file_tags WHERE plan_id = ? AND file_id = ?').bind(pid, refTags[1]),
      ...ids.map(t => env.DB.prepare('INSERT OR IGNORE INTO ref_file_tags (plan_id, file_id, tag_id) VALUES (?,?,?)').bind(pid, refTags[1], t))
    ]);
    return json({ ok: true });
  }
  const refLike = path.match(/^\/api\/ref\/([a-f0-9]{32})\/like$/);
  if (refLike && method === 'POST') {
    const has = await env.DB.prepare('SELECT 1 AS ok FROM ref_likes WHERE plan_id = ? AND file_id = ? AND user_key = ?').bind(pid, refLike[1], uk).first();
    if (has) await env.DB.prepare('DELETE FROM ref_likes WHERE plan_id = ? AND file_id = ? AND user_key = ?').bind(pid, refLike[1], uk).run();
    else await env.DB.prepare('INSERT INTO ref_likes (plan_id, file_id, user_key) VALUES (?,?,?)').bind(pid, refLike[1], uk).run();
    return json({ ok: true, liked: !has });
  }

  /* ── 환율: open.er-api.com (키 없음, 하루 한 번 갱신). 12시간 캐시. rates 는 1 KRW 당 외화. ── */
  if (path === '/api/fx' && method === 'GET') {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/KRW', { cf: { cacheTtl: 43200, cacheEverything: true } });
      if (!r.ok) return json({ error: '환율을 받아오지 못했습니다' }, 502);
      const j = await r.json();
      if (j.result !== 'success') return json({ error: '환율을 받아오지 못했습니다' }, 502);
      return json({ base: 'KRW', date: j.time_last_update_utc, rates: j.rates, source: 'open.er-api.com' });
    } catch (e) { return json({ error: '환율 서버에 닿지 못했습니다' }, 502); }
  }

  /* ── 웨딩홀 콤보박스: 자체 마스터 → 카카오 → 수동 요청 ── */
  if (path === '/api/venues' && method === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim();
    if (q.length < 1) return json({ items: [], kakao: [] });
    const r = await env.DB.prepare(
      "SELECT id, name, region, hall, place_url AS placeUrl, status FROM venues WHERE status <> 'merged' AND name LIKE ? ORDER BY name LIMIT 20"
    ).bind('%' + q + '%').all();
    let kakao = [];
    if (env.KAKAO_REST_KEY && (r.results || []).length < 5) kakao = await kakaoSearch(env, q);
    return json({ items: r.results || [], kakao });
  }
  if (path === '/api/venues' && method === 'POST') {
    const body = await req.json();
    const at = nowIso();
    if (body.kakaoId) {
      /* 카카오 결과를 골랐다. 장소 ID·장소명·place_url 만 저장한다(약관). 중복은 ID 로 막힌다. */
      const kid = String(body.kakaoId).slice(0, 32), name = String(body.name || '').trim().slice(0, 80);
      if (!/^\d+$/.test(kid) || !name) return json({ error: '장소 정보가 올바르지 않습니다' }, 400);
      const id = 'k:' + kid;
      await env.DB.prepare(
        'INSERT OR IGNORE INTO venues (id, kakao_place_id, name, place_url, region, hall, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(id, kid, name, String(body.placeUrl || '').slice(0, 200) || null,
        validRegion(body.region) ? body.region : null, String(body.hall || '').slice(0, 40) || null, 'ok', uk, at).run();
      return json({ ok: true, venue: await env.DB.prepare('SELECT id, name, region, hall, place_url AS placeUrl, status FROM venues WHERE id = ?').bind(id).first() });
    }
    /* 카카오에도 없다. 수동 입력을 받고 관리자가 검수한다. 요청한 사람은 바로 쓸 수 있다. */
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) return json({ error: '웨딩홀 이름을 적어 주세요' }, 400);
    const id = 'm:' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await env.DB.prepare(
      'INSERT INTO venues (id, name, region, hall, status, created_by, created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(id, name, validRegion(body.region) ? body.region : null, String(body.hall || '').slice(0, 40) || null, 'pending', uk, at).run();
    return json({ ok: true, venue: { id, name, region: body.region || null, hall: body.hall || null, status: 'pending' } });
  }

  return json({ error: '없는 경로입니다' }, 404);
}

async function kakaoSearch(env, q) {
  try {
    const r = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=10&query=' + encodeURIComponent(q + ' 웨딩홀'), {
      headers: { authorization: 'KakaoAK ' + env.KAKAO_REST_KEY }
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.documents || []).map(d => ({
      kakaoId: d.id, name: d.place_name, placeUrl: d.place_url,
      /* 주소·좌표는 화면에 지금 보여 주기만 하고 저장하지 않는다 */
      address: d.road_address_name || d.address_name, category: d.category_name
    }));
  } catch (e) { return []; }
}

function upsertSql(col) {
  return 'INSERT INTO ' + col + ' (plan_id, id, data, updated_at, updated_by, created_by) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(plan_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by';
}

/* 항목을 지울 때 딸린 것도 같이 지운다. 업체 → 결제·일정·첨부. 일정·메모 → 첨부. */
async function deleteItem(env, pid, col, id) {
  const stmts = [env.DB.prepare('DELETE FROM ' + col + ' WHERE plan_id = ? AND id = ?').bind(pid, id)];
  const ownerType = { vendors: 'vendor', events: 'event', memos: 'memo' }[col];
  if (col === 'vendors') {
    stmts.push(env.DB.prepare("DELETE FROM payments WHERE plan_id = ? AND json_extract(data, '$.vendorId') = ?").bind(pid, id));
    stmts.push(env.DB.prepare("DELETE FROM events WHERE plan_id = ? AND json_extract(data, '$.vendorId') = ?").bind(pid, id));
  }
  if (ownerType) {
    const fs = await env.DB.prepare('SELECT id FROM files WHERE plan_id = ? AND owner_type = ? AND owner_id = ?').bind(pid, ownerType, id).all();
    await deleteFiles(env, pid, (fs.results || []).map(x => x.id));
  }
  await env.DB.batch(stmts);
}

async function listFiles(env, pid) {
  const r = await env.DB.prepare(
    'SELECT id, owner_type AS owner, owner_id AS ownerId, kind, name, size, content_type AS type, memo, who, created_by AS by, created_at AS at ' +
    'FROM files WHERE plan_id = ? ORDER BY created_at DESC'
  ).bind(pid).all();
  return (r.results || []).map(x => Object.assign(x, { url: '/file/' + x.id }));
}
async function fileRow(env, pid, id) {
  const x = await env.DB.prepare(
    'SELECT id, owner_type AS owner, owner_id AS ownerId, kind, name, size, content_type AS type, memo, who, created_by AS by, created_at AS at FROM files WHERE id = ? AND plan_id = ?'
  ).bind(id, pid).first();
  return x ? Object.assign(x, { url: '/file/' + x.id }) : null;
}
async function usageOf(env, pid) {
  const r = await env.DB.prepare('SELECT COALESCE(SUM(size),0) AS n FROM files WHERE plan_id = ?').bind(pid).first();
  return Number(r.n) || 0;
}
async function deleteFiles(env, pid, ids) {
  if (!ids.length) return;
  for (const id of ids) {
    const row = await env.DB.prepare('SELECT object_key FROM files WHERE id = ? AND plan_id = ?').bind(id, pid).first();
    if (!row) continue;
    if (env.FILES) { try { await env.FILES.delete(row.object_key); } catch (e) {} }
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ref_file_tags WHERE plan_id = ? AND file_id = ?').bind(pid, id),
      env.DB.prepare('DELETE FROM ref_likes WHERE plan_id = ? AND file_id = ?').bind(pid, id),
      env.DB.prepare('DELETE FROM files WHERE id = ? AND plan_id = ?').bind(id, pid)
    ]);
  }
}

async function dropPlan(env, id) {
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

async function members(env, pid) {
  const r = await env.DB.prepare(
    'SELECT m.user_key AS email, m.role, m.joined_at, u.name FROM plan_members m LEFT JOIN users u ON u.email = m.user_key WHERE m.plan_id = ? ORDER BY m.joined_at'
  ).bind(pid).all();
  return (r.results || []).map(x => ({ email: x.email, name: x.name || x.email.split('@')[0], role: x.role }));
}

/* ═══ 관리 ══════════════════════════════════
 * ADMIN_EMAIL 로 로그인했을 때만 열린다. 다른 사람에게는 404 로 보인다.
 */
async function handleAdmin(req, env, url, u) {
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

/* ═══ 인증 화면 ═════════════════════════════ */
function safeNext(next) {
  if (typeof next !== 'string' || !next) return '/';
  if (next[0] !== '/' || next[1] === '/' || next[1] === '\\') return '/';
  return next;
}

function authPage(origin, kind, email, next, inv, google, notice) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  const T = {
    login:    { lead: '로그인', btn: '로그인', path: '/auth/login' },
    signup:   { lead: '시작하기', btn: '가입하고 시작하기', path: '/auth/signup' },
    password: { lead: '비밀번호 변경', btn: '비밀번호 바꾸기', path: '/auth/password' }
  }[kind];

  const who = inv
    ? (inv.type === 'plan'
      ? '<p class="who"><b>' + esc(inv.byName) + '</b>님이 <b>' + esc(inv.planName) + '</b>에 초대했습니다. 둘이 함께 쓰는 장부예요.</p>'
      : '<p class="who"><b>' + esc(inv.byName) + '</b>님이 추천했습니다. 가입하면 두 분의 결혼 준비 장부가 새로 생겨요.</p>')
    : '';
  const fields =
    kind === 'signup' ? [
      who,
      row('email', '이메일', 'email', 'username', '', true),
      row('name', '이름', 'text', 'name', '안 써도 됩니다'),
      row('pw', '비밀번호', 'password', 'new-password', MIN_PW + '자 이상'),
      row('pw2', '비밀번호 다시', 'password', 'new-password')
    ].join('') :
    kind === 'password' ? [
      '<p class="who">' + esc(email) + '</p>',
      row('pw', '지금 비밀번호', 'password', 'current-password'),
      row('pw2', '새 비밀번호', 'password', 'new-password', MIN_PW + '자 이상'),
      row('pw3', '새 비밀번호 다시', 'password', 'new-password')
    ].join('') : [
      row('email', '이메일', 'email', 'username', '', true),
      row('pw', '비밀번호', 'password', 'current-password')
    ].join('');

  const q = next && next !== '/' ? '?next=' + encodeURIComponent(next) : '';
  const foot =
    kind === 'login'  ? '<p class="alt">처음이신가요? <a href="/auth/signup' + q + '">시작하기</a></p>' :
    kind === 'signup' ? '<p class="alt">이미 계정이 있나요? <a href="/auth/login' + q + '">로그인</a></p>' :
                        '<p class="alt"><a href="/">장부로 돌아가기</a></p>';
  const gate = (google && kind !== 'password')
    ? '<a class="gbtn" href="/auth/google' + q + '">' + GOOGLE_MARK + '구글로 계속하기</a><div class="or"><span>또는 이메일로</span></div>'
    : '';

  return page(origin, T.lead + ' · ' + SITE, nonce,
    '<main class="card">' + BRAND +
      '<p class="lead">' + T.lead + '</p>' +
      '<div class="prog" id="prog" aria-hidden="true"><i></i></div>' + gate +
      '<form id="f" novalidate>' + fields +
        '<p class="err" id="err"' + (notice ? '>' + esc(notice) : ' hidden>') + '</p>' +
        '<button type="submit" id="go">' + T.btn + '</button>' +
      '</form>' + foot +
      '<p class="fine"><a href="/privacy">개인정보처리방침</a> · <a href="/terms">서비스 약관</a><br><span class="by">© 2026 myoung</span></p>' +
    '</main>',
    authScript(kind, T.path, next));
}
function row(id, label, type, ac, ph, autofocus) {
  return '<label for="' + id + '">' + label + '</label>' +
    '<input id="' + id + '" type="' + type + '" autocomplete="' + ac + '"' +
    (ph ? ' placeholder="' + esc(ph) + '"' : '') + (autofocus ? ' autofocus' : '') + '>';
}

function inviteOnlyPage(origin, google) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  return page(origin, '시작하기 · ' + SITE, nonce,
    '<main class="card">' + BRAND + '<p class="lead">우리의 결혼 계획 시작하기</p>' +
      (google ? '<a class="gbtn" href="/auth/google?next=' + encodeURIComponent('/#guide') + '">' + GOOGLE_MARK + '구글로 시작하기</a><div class="or"><span>또는</span></div>' : '') +
      '<p class="who">이메일과 비밀번호로 시작하려면 파트너의 초대 링크나 친구의 추천 링크가 필요합니다. 구글 계정이면 바로 시작할 수 있어요.</p>' +
      '<p class="alt">이미 계정이 있나요? <a href="/auth/login">로그인</a></p>' +
      '<p class="fine"><a href="/privacy">개인정보처리방침</a> · <a href="/terms">서비스 약관</a><br><span class="by">© 2026 myoung</span></p>' +
    '</main>', '');
}

/* 막 들어온 사람에게 한 번만 묻는다. 예식일은 미정이면 비워도 되고, 전부 건너뛰어도 된다. */
function startPage(origin, next) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  const regions = '<option value="">나중에</option>' + REGIONS.map(r => '<option>' + r + '</option>').join('');
  const ages = '<option value="">밝히지 않음</option>' + AGE_BANDS.map(a => '<option value="' + a + '">' + a.replace('s', '대') + '</option>').join('');
  return page(origin, '시작하기 · ' + SITE, nonce,
    '<main class="card">' + BRAND + '<p class="lead">시작하기 전에</p>' +
      '<p class="who">세 가지만 알려 주시면 준비 순서를 예식일에 맞춰 역산해 드려요. 지금 몰라도 됩니다.</p>' +
      '<form id="f" novalidate>' +
        '<div class="two">' + row('groom', '신랑', 'text', 'off', '이름') + row('bride', '신부', 'text', 'off', '이름') + '</div>' +
        '<label for="weddingDate">예식일</label><input id="weddingDate" type="date">' +
        '<label for="region">예식 지역</label><select id="region">' + regions + '</select>' +
        '<label for="age">연령대 <span class="hint">통계에만 씁니다</span></label><select id="age">' + ages + '</select>' +
        '<p class="err" id="err" hidden></p>' +
        '<button type="submit" id="go">시작하기</button>' +
      '</form>' +
      '<p class="alt"><a href="' + esc(next) + '">그냥 넘어가기</a></p>' +
    '</main>',
    startScript(next));
}

function joinPage(origin, error, planName) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  const body = error
    ? '<p class="lead">초대를 쓸 수 없어요</p><p class="who">' + esc(error) + '</p><a class="go" href="/">내 장부로 가기</a>'
    : '<p class="lead">' + esc(planName) + '에 들어왔어요</p><p class="who">이제 두 분이 같은 장부를 보고 적습니다.</p><a class="go" href="/">장부 열기</a>';
  return page(origin, '초대 · ' + SITE, nonce, '<main class="card">' + BRAND + body + '</main>', '', error ? 410 : 200);
}

/* ═══ 약관과 개인정보처리방침 ══════════════ */
const LEGAL_FROM = '2026년 10월 6일';
/* 연락처는 코드에 적지 않는다. 배포 환경의 CONTACT_EMAIL (secret 또는 vars) 에서 읽는다. */
function contactOf(env) { return String((env && env.CONTACT_EMAIL) || '').trim(); }

function legalPage(origin, kind, env) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  const mail = contactOf(env);
  const doc = kind === 'privacy' ? privacyDoc(mail) : termsDoc(mail);
  const other = kind === 'privacy' ? '<a href="/terms">서비스 약관</a>' : '<a href="/privacy">개인정보처리방침</a>';
  const html = '<!doctype html><html lang="ko"><head>' +
    pageHead(origin, doc.title + ' · ' + SITE, { title: doc.title + ' · ' + SITE, path: '/' + kind }) + FONT_LINKS +
    '<style nonce="' + nonce + '">' + AUTH_CSS + LEGAL_CSS + '</style></head><body>' +
    '<main class="doc"><p class="crumb"><a href="/">' + SITE + '</a></p>' +
      '<h1>' + doc.title + '</h1><p class="when">시행일 ' + LEGAL_FROM + '</p>' + doc.body +
      '<hr><p class="alt">' + other + ' · <a href="/auth/login">로그인</a></p><p class="fine"><span class="by">© 2026 myoung</span></p></main></body></html>';
  return new Response(html, {
    headers: Object.assign(baseHeaders(), {
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600', 'content-security-policy': csp(nonce)
    })
  });
}
function contactHtml(mail) { return mail ? '<p>' + esc(mail) + '</p>' : '<p>서비스 안에서 운영자에게 문의해 주세요.</p>'; }
function privacyDoc(mail) {
  return { title: '개인정보처리방침', body: [
    '<p class="lede">' + SITE + '은 두 사람이 함께 쓰는 결혼 준비 장부입니다. 아래는 이 서비스가 무엇을 받아 어디에 두는지 그대로 적은 것입니다.</p>',
    '<h2>무엇을 받나</h2><ul>' +
      '<li><b>이메일 주소</b>와 <b>이름</b>. 구글로 시작하면 구글이 주는 계정 고유 번호(sub)도 받습니다. 구글 비밀번호는 받지 않습니다.</li>' +
      '<li><b>비밀번호</b>(이메일 가입 시). 원문은 서버에 도착하지 않고, 브라우저가 PBKDF2로 60만 번 늘린 결과만 받아 다시 늘려 저장합니다.</li>' +
      '<li><b>연령대·예식 지역·예식일</b>. 안 밝혀도 됩니다. 또래와 같은 지역 커플의 평균 예산, 인기 웨딩홀 같은 통계에만 씁니다.</li>' +
      '<li><b>장부에 적으신 모든 것</b>: 업체 이름·담당자 연락처·금액·결제 내역·일정·하객 명단·축의금·메모와 올리신 파일(계약서·음악·영상·사진).</li>' +
      '<li>로그인이 거듭 실패할 때 잠시 두는 접속 아이피와 실패 횟수.</li></ul>',
    '<h2>왜 받나</h2><ul><li>두 분이 같은 장부를 보게 하려고</li><li>로그인을 유지하고 비밀번호를 찍어 맞히는 것을 막으려고</li>' +
      '<li>통계는 <b>합계와 평균으로만</b> 만들고 표본이 5건 미만이면 보여 주지 않습니다. 누가 어떤 업체를 골랐는지 드러내지 않습니다.</li></ul>',
    '<h2>어디에 두나</h2><p>Cloudflare 의 데이터베이스(D1)와 파일 저장소(R2)에 둡니다. 광고나 분석 도구는 붙어 있지 않습니다.</p>',
    '<h2>얼마나 두나</h2><ul><li>계정과 장부는 <b>지우실 때까지</b> 둡니다.</li><li>데이터베이스는 30일 동안 되돌릴 수 있는 기록을 갖고 있습니다.</li><li>로그인 실패 기록은 잠금이 풀리면 지웁니다.</li></ul>',
    '<h2>누구에게 가나</h2><p>팔지 않고 광고에 쓰지 않습니다. 서비스를 돌리려면 아래를 거칩니다.</p><ul>' +
      '<li><b>Cloudflare</b>: 서비스·데이터베이스·파일이 올라가 있는 곳</li><li><b>Google</b>: 구글로 로그인할 때만</li>' +
      '<li><b>카카오</b>: 웨딩홀을 검색할 때 검색어만 보냅니다. 결과 중 장소 ID·장소명·링크만 저장합니다.</li>' +
      '<li><b>open.er-api.com</b>: 신혼여행 환율을 받아옵니다. 서버가 하루 두 번 받아 두고, 개인 정보는 보내지 않습니다.</li>' +
      '<li><b>jsDelivr</b>: 화면 글꼴(Pretendard)을 받아옵니다. 이때 접속 아이피와 브라우저 종류가 전달됩니다.</li></ul>',
    '<h2>브라우저에 남는 것</h2><ul><li><code>wm_session</code>: 로그인 유지 쿠키. 30일.</li><li><code>wm_oauth</code>: 구글에 다녀오는 10분 동안만.</li>' +
      '<li>장부 사본이 브라우저 저장소에 남습니다. 빨리 띄우려는 것이고 로그아웃하면 지웁니다.</li></ul>',
    '<h2>지우고 싶을 때</h2><p>설정에서 계획을 지우면 그 안의 모든 항목과 파일이 함께 지워집니다. 계정 삭제는 아래 주소로 알려 주세요.</p>',
    '<h2>물어보실 곳</h2>' + contactHtml(mail)
  ].join('') };
}
function termsDoc(mail) {
  return { title: '서비스 약관', body: [
    '<p class="lede">' + SITE + '은 커플이 결혼 준비를 기록하고 견주어 보는 도구입니다. 쓰시기 전에 아래를 한 번 읽어 주세요.</p>',
    '<h2>어떤 서비스인가</h2><p>예산·업체·일정·하객을 적어 두고 두 사람이 함께 보는 장부입니다. 업체를 중개하거나 추천의 대가를 받지 않습니다.</p>',
    '<h2>계정</h2><ul><li>본인이 쓰는 이메일 또는 구글 계정으로 만들어 주세요.</li><li>한 장부에는 두 사람만 들어옵니다. 초대한 사람은 모든 내용을 읽고 고칠 수 있습니다.</li></ul>',
    '<h2>적으신 내용과 파일</h2><ul><li>적으신 내용은 적으신 분의 것입니다. 서비스를 돌리는 데 필요한 만큼만 씁니다.</li>' +
      '<li>올리신 음악·영상 파일은 두 분의 개인 보관용입니다. 다른 사람에게 공유되지 않으며, 저작권이 있는 파일의 책임은 올리신 분에게 있습니다.</li>' +
      '<li>업체 담당자 연락처처럼 남의 정보는 필요한 만큼만 적어 두시길 권합니다.</li></ul>',
    '<h2>꼭 알아두실 것</h2><ul><li><b>계산 값은 참고용입니다.</b> 예상 인원·예상 축의금·식대 보증인원은 넣으신 숫자로 셈한 추정입니다.</li>' +
      '<li><b>개인이 운영하는 서비스입니다.</b> 끊김 없는 제공이나 데이터가 영원히 남는 것을 약속하지 않습니다. 계약서 같은 중요한 파일은 따로도 보관하세요.</li></ul>',
    '<h2>한도</h2><ul><li>파일은 한 번에 100MB, 기본 계획은 모두 합쳐 300MB까지입니다. 프리미엄은 2GB.</li><li>한 종류의 항목은 2,000개까지입니다.</li></ul>',
    '<h2>요금</h2><p>기본 기능은 무료입니다. 유료 기능은 계획당 한 번 결제하는 방식이고, 결제 전에 금액과 내용을 보여 드립니다. 구독이 아닙니다.</p>',
    '<h2>물어보실 곳</h2>' + contactHtml(mail)
  ].join('') };
}

/* ═══ 메인(랜딩) ═══════════════════════════
 * 로그인 안 한 사람이 처음 보는 화면. 한 문장과 버튼 하나.
 */
function landingPage(origin, google, loggedIn) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  const cta = loggedIn ? '/' : google ? '/auth/google?next=' + encodeURIComponent('/#guide') : '/auth/signup';
  const guide = loggedIn ? '/#guide' : '/auth/login?next=' + encodeURIComponent('/#guide');
  const html = '<!doctype html><html lang="ko"><head>' + pageHead(origin, SITE) + FONT_LINKS +
    '<style nonce="' + nonce + '">' + AUTH_CSS + INTRO_CSS + LANDING_CSS + '</style></head><body>' +
    '<main class="land">' +
      '<div class="st" id="st" title="다시 보기"><img class="w" src="/wordmark.webp?v=5" alt=""><img class="l" src="/logo.webp?v=5" alt=""></div>' +
      '<img class="wm" src="/wordmark.webp?v=5" alt="' + SITE + '" width="240">' +
      '<div class="ctas"><a class="cta" href="' + cta + '">' + (loggedIn ? '내 장부 열기' : '우리의 결혼 계획하기') + '</a><a class="cta ghost" href="' + guide + '">사용 안내</a></div>' +
      (loggedIn ? '' : '<p class="alt">이미 계정이 있나요? <a href="/auth/login">로그인</a></p>') +
      '<ul class="pts">' +
        '<li><img src="/art/rings.webp" alt=""><b>예산관리</b><span>업체 후보와 계약을 관리하세요. 그리고 금액정리를 한눈에!</span></li>' +
        '<li><img src="/art/cake.webp" alt=""><b>예식일</b><span>결혼날짜를 기준으로, 시기별 해야할 일을 놓치는 것 없이 관리하세요.</span></li>' +
        '<li><img src="/art/bouquet.webp" alt=""><b>파일함</b><span>우리의 결혼은 우리가 만들어가요. 원하는 무드보드를 만들고, 업체와 공유해요. 계약서와 입장곡까지 한곳에서 관리해요.</span></li>' +
      '</ul>' +
      '<p class="fine"><a href="/privacy">개인정보처리방침</a> · <a href="/terms">서비스 약관</a><br><span class="by">© 2026 myoung</span></p>' +
    '</main>' +
    '<script nonce="' + nonce + '">' + REPLAY_JS + '</script>' +
    '</body></html>';
  return new Response(html, {
    headers: Object.assign(baseHeaders(), {
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': csp(nonce)
    })
  });
}
const INTRO_CSS = [
  /* 인트로와 같은 동작: 레터링이 써지고 → 가운데로 모이고 → 반지에서 양쪽으로 로고가 풀린다 → 워드마크가 아래에 자리 잡는다 */
  '.st{position:relative;width:min(560px,100%);aspect-ratio:16/9;margin:0 auto;cursor:pointer}',
  '.st img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}',
  '.w{opacity:0;-webkit-mask-image:linear-gradient(90deg,#000 0 40%,transparent 60%);mask-image:linear-gradient(90deg,#000 0 40%,transparent 60%);-webkit-mask-size:300% 100%;mask-size:300% 100%;-webkit-mask-position:100% 0;mask-position:100% 0;',
  'animation:lw 2.1s cubic-bezier(.4,0,.2,1) .2s forwards,lg 1.2s cubic-bezier(.6,0,.4,1) 3s forwards}',
  '@keyframes lw{0%{opacity:1;transform:scale(.96);-webkit-mask-position:100% 0;mask-position:100% 0}100%{opacity:1;transform:scale(1);-webkit-mask-position:0% 0;mask-position:0% 0}}',
  '@keyframes lg{0%{opacity:1;transform:scale(1);-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-position:0 0;mask-position:0 0;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 0,#000 100%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 0,#000 100%,transparent 100%)}',
  '100%{opacity:0;transform:scale(.92);-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-position:0 0;mask-position:0 0;-webkit-mask-image:linear-gradient(90deg,transparent 46%,#000 50%,#000 50%,transparent 54%);mask-image:linear-gradient(90deg,transparent 46%,#000 50%,#000 50%,transparent 54%)}}',
  '.l{opacity:0;transform:scale(.94);-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 18%,#000 82%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 18%,#000 82%,transparent 100%);',
  '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:50% 0;mask-position:50% 0;-webkit-mask-size:0% 100%;mask-size:0% 100%;animation:ll 1.9s cubic-bezier(.3,.6,.15,1) 3.6s forwards}',
  '@keyframes ll{0%{opacity:0;transform:scale(.94);-webkit-mask-size:0% 100%;mask-size:0% 100%}12%{opacity:1}100%{opacity:1;transform:none;-webkit-mask-size:150% 100%;mask-size:150% 100%}}',
  '.wm{display:block;width:300px;max-width:78%;height:auto;margin:-6px auto 30px;opacity:0;transform:translateY(10px);animation:ls .9s ease 5.4s forwards}',
  '@keyframes ls{to{opacity:1;transform:none}}',
  '@media (prefers-reduced-motion:reduce){.w{display:none}.land .l,.wm{animation:none;opacity:1;transform:none;-webkit-mask-size:150% 100%;mask-size:150% 100%}}',
  '.land h1{font-size:26px;line-height:1.3;font-weight:700;letter-spacing:-.02em;margin:0 0 12px}',
  '.land .sub{color:var(--muted);font-size:14.5px;line-height:1.7;margin:0 auto 26px;max-width:40ch}',
].join('');
const LANDING_CSS = [
  'body{display:block;min-height:100vh;padding:0}',
  '.land{max-width:560px;margin:0 auto;padding:40px 20px 60px;text-align:center}',
  '.cta{display:inline-block;padding:14px 30px;border-radius:999px;background:var(--pink);color:#fff;font-weight:700;font-size:16px;text-decoration:none;box-shadow:0 8px 24px -10px rgba(232,83,111,.7)}',
  '.cta:hover{filter:brightness(.96)}',
  '.ctas{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}',
  '.cta.ghost{background:var(--surface);color:var(--pink-ink,#C23A55);border:1px solid var(--line);box-shadow:none;font-weight:600}',
  '.pts{list-style:none;padding:0;margin:40px 0 0;text-align:left;display:grid;gap:12px}',
  '.pts li{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px}',
  '.pts img{height:64px;width:auto;display:block;margin:0 0 8px}',
  '.pts b{display:block;font-weight:600;margin-bottom:3px;color:var(--pink-ink,#C23A55)}',
  '.pts span{display:block;font-size:13.5px;color:var(--muted);line-height:1.65;word-break:keep-all;overflow-wrap:break-word;text-wrap:pretty}',
  '@media (min-width:700px){.land{max-width:820px}.pts{grid-template-columns:1fr 1fr 1fr}}'
].join('');

/* ═══ 공통 페이지 조각 ══════════════════════ */
function page(origin, title, nonce, main, script, status) {
  const html = '<!doctype html><html lang="ko"><head>' + pageHead(origin, title) + FONT_LINKS +
    '<style nonce="' + nonce + '">' + AUTH_CSS + INTRO_CSS + '</style></head><body>' + main +
    (main.indexOf('class="by"') < 0 ? '<p class="fine" style="text-align:center"><span class="by">© 2026 myoung</span></p>' : '') +
    '<script nonce="' + nonce + '">' + REPLAY_JS + (script || '') + '</script></body></html>';
  return new Response(html, {
    status: status || 200,
    headers: Object.assign(baseHeaders(), {
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': csp(nonce)
    })
  });
}

const BRAND = '<div class="brand"><div class="st" id="st" title="다시 보기"><img class="w" src="/wordmark.webp?v=5" alt=""><img class="l" src="/logo.webp?v=5" alt=""></div>' +
  '<img class="wm" src="/wordmark.webp?v=5" alt="' + SITE + '" width="220"></div>';
const REPLAY_JS = '(function(){var st=document.getElementById("st");if(!st)return;var wm=document.querySelector(".wm");' +
  'st.addEventListener("click",function(){[].concat(Array.prototype.slice.call(st.querySelectorAll("img")),wm?[wm]:[]).forEach(function(i){i.style.animation="none";void i.offsetWidth;i.style.animation="";});});})();';

const GOOGLE_MARK = '<svg class="g" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">' +
  '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
  '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
  '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
  '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

/* 디자인 원칙(메뉴 구조 노트)대로: 흰 배경, 포인트는 로고의 핑크 하나, Pretendard, 장식 없음. */
const AUTH_CSS = [
  ':root{--bg:#FBF7F0;--surface:#FFFFFF;--ink:#3A2A2E;--muted:#9C868C;--line:#E3CFD0;--pink:#E8536F;--pink-soft:#FDECEF;--bad:#B3261E}',
  '*{box-sizing:border-box}',
  'body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo",sans-serif;',
  'display:grid;place-items:center;min-height:100vh;padding:24px 16px;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}',
  '.card{width:min(440px,100%);padding:8px 4px 24px}',
  '.card form,.card .gbtn,.card .or,.card .who,.card .prog{max-width:400px;margin-left:auto;margin-right:auto}',
  '.card .who{margin-bottom:18px}',
  '.brand{display:flex;flex-direction:column;align-items:center;margin-bottom:4px}',
  '.brand .st{width:min(420px,100%)}',
  '.brand .wm{width:220px;max-width:70%;margin:-4px auto 10px}',
  '.lead{margin:6px 0 18px;color:var(--muted);font-size:13px;text-align:center;letter-spacing:.02em}',
  '.who{margin:0 0 18px;padding:10px 14px;background:var(--pink-soft);border-radius:8px;font-size:13.5px;line-height:1.55}',
  '.who b{font-weight:600}',
  'label{display:block;font-size:12px;color:var(--muted);font-weight:500;margin:0 0 5px}',
  'label .hint{font-weight:400;color:var(--muted);margin-left:4px}',
  'input,select{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;font-size:15px;margin-bottom:14px;font-variant-numeric:tabular-nums}',
  'input:focus,select:focus{outline:none;border-color:var(--pink);box-shadow:0 0 0 3px var(--pink-soft)}',
  '.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
  '.gbtn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);font-weight:600;font-size:14.5px;text-decoration:none}',
  '.gbtn:hover{background:#FAF7F8}.gbtn .g{flex:none}',
  '.or{display:flex;align-items:center;gap:10px;margin:16px 0 14px;color:var(--muted);font-size:12px}',
  '.or::before,.or::after{content:"";flex:1;height:1px;background:var(--line)}',
  'button{width:100%;padding:12px;border:0;border-radius:999px;background:var(--pink);color:#fff;font:inherit;font-weight:600;font-size:15px;cursor:pointer;margin-top:4px}',
  'button:hover:not(:disabled){filter:brightness(.96)}button:disabled{opacity:.6;cursor:progress}',
  '.err{margin:0 0 12px;padding:10px 12px;background:#FBEAE9;color:var(--bad);border-radius:8px;font-size:13px}',
  '.prog{height:3px;border-radius:999px;background:var(--pink-soft);overflow:hidden;margin:0 0 16px;visibility:hidden}.prog.on{visibility:visible}',
  '.prog i{display:block;height:100%;width:38%;border-radius:999px;background:var(--pink);animation:slide 1.15s ease-in-out infinite}',
  '@keyframes slide{0%{transform:translateX(-110%)}100%{transform:translateX(275%)}}',
  '.alt{margin:20px 0 0;font-size:13px;color:var(--muted);text-align:center}',
  '.fine{margin:14px 0 0;font-size:11.5px;color:var(--muted);text-align:center}.fine a{color:var(--muted)}',
  '.fine .by{display:inline-block;margin-top:6px;font-size:11px;letter-spacing:.04em;opacity:.75}',
  'a{color:var(--pink);text-underline-offset:3px}',
  '.go{display:block;text-align:center;padding:12px;border-radius:8px;background:var(--pink);color:#fff;font-weight:600;text-decoration:none;margin-top:12px}',
  ':focus-visible{outline:2px solid var(--pink);outline-offset:2px}',
  '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}'
].join('');
const LEGAL_CSS = [
  'body{display:block;place-items:initial;min-height:0;padding:0}',
  '.doc{max-width:680px;margin:0 auto;padding:36px 20px 72px;text-align:left}',
  '.crumb{margin:0 0 22px;font-weight:600;font-size:15px}.crumb a{color:var(--ink);text-decoration:none}',
  '.doc h1{font-size:24px;margin:0 0 4px;font-weight:700}.when{margin:0 0 28px;color:var(--muted);font-size:12.5px}',
  '.lede{margin:0 0 28px;padding:14px 16px;background:var(--pink-soft);border-radius:8px;font-size:14px}',
  '.doc h2{font-size:17px;font-weight:600;margin:32px 0 10px;padding-top:14px;border-top:1px solid var(--line)}',
  '.doc p{margin:0 0 12px;font-size:14.5px;line-height:1.75}.doc ul{margin:0 0 14px;padding-left:19px}.doc li{margin:0 0 8px;font-size:14.5px;line-height:1.75}',
  '.doc b{font-weight:600}.doc code{background:var(--pink-soft);border-radius:4px;padding:1px 5px;font-size:12.5px}',
  '.doc hr{border:0;border-top:1px solid var(--line);margin:40px 0 18px}'
].join('');

function authScript(kind, postPath, next) {
  return [
'(function(){"use strict";',
'var ITER=' + CLIENT_ITER + ', MIN=' + MIN_PW + ', KIND=' + JSON.stringify(kind) + ', PATH=' + JSON.stringify(postPath) + ', NEXT=' + JSON.stringify(next || '/') + ';',
'var f=document.getElementById("f"), go=document.getElementById("go"), errBox=document.getElementById("err"), prog=document.getElementById("prog");',
'var label=go.textContent;',
'function busy(on){ if(prog) prog.classList.toggle("on",on); go.disabled=on; go.textContent = on ? "확인 중…" : label; }',
'function val(id){var el=document.getElementById(id);return el?el.value:"";}',
'function fail(m){errBox.textContent=m;errBox.hidden=false;busy(false);}',
'function b64u(buf){var s="",a=new Uint8Array(buf);for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");}',
/* 비밀번호는 이 브라우저를 떠나지 않는다. 늘린 결과만 보낸다. */
'async function derive(email,pw){var e=new TextEncoder();',
' var k=await crypto.subtle.importKey("raw",e.encode(pw.normalize("NFC")),"PBKDF2",false,["deriveBits"]);',
' return b64u(await crypto.subtle.deriveBits({name:"PBKDF2",salt:e.encode("wedding-management|"+email),iterations:ITER,hash:"SHA-256"},k,256));}',
'f.addEventListener("submit",async function(ev){ev.preventDefault();errBox.hidden=true;',
' if(!window.crypto||!crypto.subtle){return fail("이 브라우저에서는 로그인할 수 없습니다. 주소가 https인지 확인해 주세요.");}',
' var body={}; var email=(KIND==="password")?"":val("email").trim().toLowerCase();',
' if(KIND!=="password"){ if(!email||email.indexOf("@")<0) return fail("이메일을 확인해 주세요."); if(val("pw").length<MIN) return fail("비밀번호는 "+MIN+"자 이상이어야 합니다."); }',
' if(KIND==="signup"){ if(val("pw")!==val("pw2")) return fail("두 비밀번호가 서로 다릅니다."); if(val("pw").toLowerCase().indexOf(email.split("@")[0].toLowerCase())>=0) return fail("비밀번호에 이메일을 그대로 쓰지 마세요."); }',
' if(KIND==="password"){ if(val("pw2").length<MIN) return fail("새 비밀번호는 "+MIN+"자 이상이어야 합니다."); if(val("pw2")!==val("pw3")) return fail("새 비밀번호가 서로 다릅니다."); if(val("pw")===val("pw2")) return fail("지금 쓰는 비밀번호와 같습니다."); }',
' busy(true);',
' try{',
'  if(KIND==="password"){ var me=document.querySelector(".who").textContent.trim(); body.key=await derive(me,val("pw")); body.newKey=await derive(me,val("pw2")); }',
'  else { body.email=email; body.key=await derive(email,val("pw")); if(KIND==="signup"){ body.name=val("name").trim(); } body.next=NEXT; }',
'  var r=await fetch(PATH,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(body)});',
'  var j=null; try{ j=await r.json(); }catch(e){}',
'  if(r.ok&&j&&j.ok){ location.href=(j.next||"/"); return; }',
'  fail((j&&j.error)||"처리하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.");',
' }catch(e){ fail("연결하지 못했습니다. 잠시 뒤에 다시 시도해 주세요."); }',
'});})();'
  ].join('\n');
}
function startScript(next) {
  return [
'(function(){var NEXT=' + JSON.stringify(next) + ';',
'var f=document.getElementById("f"), go=document.getElementById("go");',
'function v(id){return document.getElementById(id).value}',
'f.addEventListener("submit",function(e){e.preventDefault();go.disabled=true;',
' fetch("/auth/start",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},',
'  body:JSON.stringify({groom:v("groom"),bride:v("bride"),weddingDate:v("weddingDate"),region:v("region"),age:v("age"),next:NEXT})})',
'  .then(function(r){return r.json()}).then(function(j){location.href=(j&&j.next)||NEXT}).catch(function(){location.href=NEXT});',
'});})();'
  ].join('\n');
}

/* ═══ 잡다한 것 ══════════════════════════════ */
function json(o, status) {
  return new Response(JSON.stringify(o), {
    status: status || 200,
    headers: Object.assign(baseHeaders(), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  });
}
function redirect(to) {
  return new Response(null, { status: 302, headers: Object.assign(baseHeaders(), { location: to }) });
}
function nowIso() { return new Date().toISOString(); }
function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function fmtBytes(n) {
  if (n >= 1073741824) return (n / 1073741824).toFixed(1) + 'GB';
  if (n >= 1048576) return Math.round(n / 1048576) + 'MB';
  return Math.round(n / 1024) + 'KB';
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function readCookie(req, name) {
  const raw = req.headers.get('Cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64ToBytes(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - t.length % 4) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function enc(str) { return b64(new TextEncoder().encode(str)); }
function dec(s) { return new TextDecoder().decode(b64ToBytes(s)); }
function eqBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
function eqStr(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sign(env, data) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET이 설정되지 않았습니다');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))));
}
async function sigOk(env, data, sig) { return eqStr(await sign(env, data), String(sig)); }
