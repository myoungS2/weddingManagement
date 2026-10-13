/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 개인정보처리방침과 서비스 약관.
 */
import { SITE } from '../config.js';
import { b64 } from '../lib/crypto.js';
import { baseHeaders, csp, esc } from '../lib/http.js';
import { FONT_LINKS, pageHead } from './head.js';
import { AUTH_CSS, LEGAL_CSS } from './styles.js';

/* ═══ 약관과 개인정보처리방침 ══════════════ */
export const LEGAL_FROM = '2026년 10월 6일';
/* 연락처는 코드에 적지 않는다. 배포 환경의 CONTACT_EMAIL (secret 또는 vars) 에서 읽는다. */
export function contactOf(env) { return String((env && env.CONTACT_EMAIL) || '').trim(); }

export function legalPage(origin, kind, env) {
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
export function contactHtml(mail) { return mail ? '<p>' + esc(mail) + '</p>' : '<p>서비스 안에서 운영자에게 문의해 주세요.</p>'; }
export function privacyDoc(mail) {
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
export function termsDoc(mail) {
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
