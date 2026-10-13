/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 로그인 전 메인 화면.
 */
import { SITE } from '../config.js';
import { b64 } from '../lib/crypto.js';
import { baseHeaders, csp } from '../lib/http.js';
import { FONT_LINKS, REPLAY_JS, pageHead } from './head.js';
import { AUTH_CSS, INTRO_CSS, LANDING_CSS } from './styles.js';

/* ═══ 메인(랜딩) ═══════════════════════════
 * 로그인 안 한 사람이 처음 보는 화면. 한 문장과 버튼 하나.
 */
export function landingPage(origin, google, loggedIn) {
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
