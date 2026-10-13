/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 로그인·가입·시작·초대 수락 화면.
 */
import { AGE_BANDS, CLIENT_ITER, MIN_PW, REGIONS, SITE } from '../config.js';
import { b64 } from '../lib/crypto.js';
import { esc } from '../lib/http.js';
import { BRAND, GOOGLE_MARK, page } from './head.js';

export function authPage(origin, kind, email, next, inv, google, notice) {
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
      row('name', '이름', 'text', 'name', ''),
      row('pw', '비밀번호', 'password', 'new-password', MIN_PW + '자 이상'),
      row('pw2', '비밀번호 다시', 'password', 'new-password')
    ].join('') :
    kind === 'password' ? [
      '<p class="who">' + esc(email) + '</p>',
      row('pw', '지금 비밀번호', 'password', 'current-password'),
      row('pw2', '새 비밀번호', 'password', 'new-password', MIN_PW + '자 이상'),
      row('pw3', '새 비밀번호 재입력', 'password', 'new-password')
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
export function row(id, label, type, ac, ph, autofocus) {
  return '<label for="' + id + '">' + label + '</label>' +
    '<input id="' + id + '" type="' + type + '" autocomplete="' + ac + '"' +
    (ph ? ' placeholder="' + esc(ph) + '"' : '') + (autofocus ? ' autofocus' : '') + '>';
}

export function inviteOnlyPage(origin, google) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  return page(origin, '시작하기 · ' + SITE, nonce,
    '<main class="card">' + BRAND + '<p class="lead">우리의 결혼 계획 시작하기</p>' +
      /* 가입은 구글 버튼 하나. 이메일 가입은 초대·추천 링크로 들어온 사람에게만 따로 열린다. */
      '<a class="gbtn" href="/auth/google?next=' + encodeURIComponent('/#guide') + '">' + GOOGLE_MARK + '구글로 가입하기</a>' +
      '<p class="alt">이미 계정이 있나요? <a href="/auth/login">로그인</a></p>' +
      '<p class="fine"><a href="/privacy">개인정보처리방침</a> · <a href="/terms">서비스 약관</a><br><span class="by">© 2026 myoung</span></p>' +
    '</main>', '');
}

/* 막 들어온 사람에게 한 번만 묻는다. 예식일은 미정이면 비워도 되고, 전부 건너뛰어도 된다. */
export function startPage(origin, next) {
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

export function joinPage(origin, error, planName, fresh) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
  const body = error
    ? '<p class="lead">초대를 쓸 수 없어요</p><p class="who">' + esc(error) + '</p><a class="go" href="/">내 장부로 가기</a>'
    : '<p class="lead">' + esc(planName) + '에 들어왔어요</p><p class="who">이제 두 분이 같은 장부를 보고 적습니다.</p><a class="go" href="' + (fresh ? '/#guide' : '/') + '">장부 열기</a>';
  return page(origin, '초대 · ' + SITE, nonce, '<main class="card">' + BRAND + body + '</main>', '', error ? 410 : 200);
}

export function authScript(kind, postPath, next) {
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
export function startScript(next) {
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
