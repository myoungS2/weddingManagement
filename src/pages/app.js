/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 로그인한 사람에게 앱 화면 뼈대를 내보낸다.
 */
import APP_HTML from '../app.html';
import { SITE } from '../config.js';
import { baseHeaders } from '../lib/http.js';
import { FONT_LINKS, pageHead } from './head.js';

const APP_CSS = ['base', 'components', 'views', 'overlays']
  .map(n => '<link rel="stylesheet" href="/app/css/' + n + '.css">').join('');
/* 화면 JS 모듈 전부. main.js 가 import 를 따라가며 한 단계씩 받으면 왕복이 3~4번 쌓이므로
 * 미리 한꺼번에 받게 한다. public/app/js 에 파일을 더하면 여기에도 적는다. */
const APP_MODULES = ['constants', 'edit', 'events', 'export', 'files', 'guide', 'importers', 'main', 'nav', 'render', 'sheet', 'state', 'store', 'util', 'viewer', 'xlsx',
  'views/budget', 'views/guest', 'views/home', 'views/more', 'views/plan', 'views/trip'];
const APP_PRELOAD = APP_MODULES.map(n => '<link rel="modulepreload" href="/app/js/' + n + '.js">').join('');

function appCsp() {
  return "default-src 'none'; script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; " +
    "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; form-action 'self'; " +
    "base-uri 'none'; frame-ancestors 'none'";
}

export function serveApp(origin) {
  const html = '<!doctype html><html lang="ko"><head>' + pageHead(origin, SITE) + FONT_LINKS + APP_CSS + APP_PRELOAD +
    '</head><body>' + APP_HTML + '</body></html>';
  return new Response(html, {
    headers: Object.assign(baseHeaders(), {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': appCsp()
    })
  });
}
