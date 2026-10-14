/* Wedding Management · © 2026 myoung. All rights reserved.
 * 시작점. 모듈을 모아 이벤트를 걸고 화면을 그린다. */
import { init as init0 } from './sheet.js';
import { init as init1 } from './files.js';
import { init as init2 } from './viewer.js';
import { init as init3 } from './events.js';
import { init as init4 } from './guide.js';
import { maybeGuide, playIntro } from './guide.js';
import { render } from './render.js';
import { store } from './store.js';

init0();   // sheet.js
init1();   // files.js
init2();   // viewer.js
init3();   // events.js
init4();   // guide.js

playIntro(false);
maybeGuide();
try { console.info('%cWedding Management%c  © 2026 myoung · 무단 사용 금지', 'color:#C23A55;font-weight:700', 'color:#9C868C'); } catch(e){}
store.loadLocal();
store.loadSnap();   // 서버 모드였으면 지난 상태를 먼저 그린다
render();
store.connect();
