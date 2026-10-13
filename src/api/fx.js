/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 신혼여행 환율.
 */
import { json } from '../lib/http.js';

export async function handleFxApi(req, env, url, u) {
  const path = url.pathname, method = req.method;
  const pid = u.plan.id, uk = u.key;

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

  return null;
}
