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

function appCsp() {
  return "default-src 'none'; script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; " +
    "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; form-action 'self'; " +
    "base-uri 'none'; frame-ancestors 'none'";
}

export function serveApp(origin) {
  const html = '<!doctype html><html lang="ko"><head>' + pageHead(origin, SITE) + FONT_LINKS + APP_CSS +
    '</head><body>' + APP_HTML + '</body></html>';
  return new Response(html, {
    headers: Object.assign(baseHeaders(), {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': appCsp()
    })
  });
}
