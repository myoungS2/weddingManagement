/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 서버가 그리는 페이지의 머리말과 공통 틀.
 */
import { SITE, SITE_DESC } from '../config.js';
import { baseHeaders, csp, esc } from '../lib/http.js';
import { AUTH_CSS, INTRO_CSS } from './styles.js';

/* ═══ 머리말 ═══════════════════════════════ */
export const FONT_LINKS =
  '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>' +
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">';

export function pageHead(origin, title, o) {
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
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="' + SITE + '">' +
    '<meta property="og:locale" content="ko_KR">' +
    '<meta property="og:title" content="' + esc(t) + '">' +
    '<meta property="og:description" content="' + esc(d) + '">' +
    '<meta property="og:url" content="' + esc(site + (o.path || '/')) + '">' +
    '<meta property="og:image" content="' + esc(site + '/og.png') + '">' +
    '<meta property="og:image:type" content="image/png">' +
    '<meta property="og:image:width" content="1200">' +
    '<meta property="og:image:height" content="630">' +
    '<meta property="og:image:alt" content="' + SITE + '">' +
    '<meta name="twitter:card" content="summary_large_image">';
}

/* 탭 아이콘: 로고의 핑크로 그린 반지 두 개. 작게 보여도 읽히는 가장 단순한 형태. */
export const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" rx="8" fill="#FFFFFF"/>' +
  '<g fill="none" stroke="#E8536F" stroke-width="2.4">' +
  '<circle cx="12.5" cy="17" r="7"/><circle cx="19.5" cy="17" r="7"/></g></svg>';

/* ═══ 공통 페이지 조각 ══════════════════════ */
export function page(origin, title, nonce, main, script, status) {
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

export const BRAND = '<div class="brand"><div class="st" id="st" title="다시 보기"><img class="w" src="/wordmark.webp?v=5" alt=""><img class="l" src="/logo.webp?v=5" alt=""></div>' +
  '<img class="wm" src="/wordmark.webp?v=5" alt="' + SITE + '" width="220"></div>';
export const REPLAY_JS = '(function(){var st=document.getElementById("st");if(!st)return;var wm=document.querySelector(".wm");' +
  'st.addEventListener("click",function(){[].concat(Array.prototype.slice.call(st.querySelectorAll("img")),wm?[wm]:[]).forEach(function(i){i.style.animation="none";void i.offsetWidth;i.style.animation="";});});})();';

export const GOOGLE_MARK = '<svg class="g" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">' +
  '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
  '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
  '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
  '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
