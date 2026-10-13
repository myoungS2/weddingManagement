/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 진입점. 주소를 보고 알맞은 처리로 넘긴다. 그림·CSS·화면 JS 는 public/ 에서 정적 파일로 바로 나간다.
 */
import { handleAdmin } from './admin.js';
import { handleApi } from './api/index.js';
import { googleOn } from './auth/google.js';
import { handleAuth } from './auth/routes.js';
import { currentUser, isAdmin } from './auth/session.js';
import { MAX_FILE } from './config.js';
import { handleJoin, handleReferral } from './invites.js';
import { baseHeaders, json, sameOrigin, staticFile } from './lib/http.js';
import { serveApp } from './pages/app.js';
import { ICON_SVG } from './pages/head.js';
import { landingPage } from './pages/landing.js';
import { legalPage } from './pages/legal.js';
import { myPlans, quotaOf } from './plan.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (path === '/privacy' || path === '/terms') return legalPage(url.origin, path.slice(1), env);
      if (path === '/welcome') return landingPage(url.origin, googleOn(env), !!(await currentUser(req, env)));   // 로그인한 사람도 메인을 볼 수 있게

      if (path === '/favicon.ico') return staticFile(ICON_SVG, 'image/svg+xml; charset=utf-8');

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
