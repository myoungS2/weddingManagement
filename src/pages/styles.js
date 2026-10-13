/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 로그인·메인·약관 화면 CSS 와 인트로 애니메이션.
 */
export const INTRO_CSS = [
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
export const LANDING_CSS = [
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

/* 디자인 원칙(메뉴 구조 노트)대로: 흰 배경, 포인트는 로고의 핑크 하나, Pretendard, 장식 없음. */
export const AUTH_CSS = [
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
export const LEGAL_CSS = [
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
