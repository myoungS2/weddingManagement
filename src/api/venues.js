/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * 웨딩홀 콤보박스: 자체 마스터 → 카카오 → 수동 등록 요청.
 */
import { validRegion } from '../config.js';
import { json, nowIso } from '../lib/http.js';

export async function handleVenuesApi(req, env, url, u) {
  const path = url.pathname, method = req.method;
  const pid = u.plan.id, uk = u.key;

  /* ── 웨딩홀 콤보박스: 자체 마스터 → 카카오 → 수동 요청 ── */
  if (path === '/api/venues' && method === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim();
    if (q.length < 1) return json({ items: [], kakao: [] });
    const r = await env.DB.prepare(
      "SELECT id, name, region, hall, place_url AS placeUrl, status FROM venues WHERE status <> 'merged' AND name LIKE ? ORDER BY name LIMIT 20"
    ).bind('%' + q + '%').all();
    let kakao = [];
    if (env.KAKAO_REST_KEY && (r.results || []).length < 5) kakao = await kakaoSearch(env, q);
    return json({ items: r.results || [], kakao });
  }
  if (path === '/api/venues' && method === 'POST') {
    const body = await req.json();
    const at = nowIso();
    if (body.kakaoId) {
      /* 카카오 결과를 골랐다. 장소 ID·장소명·place_url 만 저장한다(약관). 중복은 ID 로 막힌다. */
      const kid = String(body.kakaoId).slice(0, 32), name = String(body.name || '').trim().slice(0, 80);
      if (!/^\d+$/.test(kid) || !name) return json({ error: '장소 정보가 올바르지 않습니다' }, 400);
      const id = 'k:' + kid;
      await env.DB.prepare(
        'INSERT OR IGNORE INTO venues (id, kakao_place_id, name, place_url, region, hall, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(id, kid, name, String(body.placeUrl || '').slice(0, 200) || null,
        validRegion(body.region) ? body.region : null, String(body.hall || '').slice(0, 40) || null, 'ok', uk, at).run();
      return json({ ok: true, venue: await env.DB.prepare('SELECT id, name, region, hall, place_url AS placeUrl, status FROM venues WHERE id = ?').bind(id).first() });
    }
    /* 카카오에도 없다. 수동 입력을 받고 관리자가 검수한다. 요청한 사람은 바로 쓸 수 있다. */
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) return json({ error: '웨딩홀 이름을 적어 주세요' }, 400);
    const id = 'm:' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await env.DB.prepare(
      'INSERT INTO venues (id, name, region, hall, status, created_by, created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(id, name, validRegion(body.region) ? body.region : null, String(body.hall || '').slice(0, 40) || null, 'pending', uk, at).run();
    return json({ ok: true, venue: { id, name, region: body.region || null, hall: body.hall || null, status: 'pending' } });
  }

  return null;
}

export async function kakaoSearch(env, q) {
  try {
    const r = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?size=10&query=' + encodeURIComponent(q + ' 웨딩홀'), {
      headers: { authorization: 'KakaoAK ' + env.KAKAO_REST_KEY }
    });
    /* 거절 사유(키 틀림 · 카카오맵 사용 꺼짐 등)는 로그에만 남기고 화면은 빈 결과로 */
    if (!r.ok) { const e = await r.json().catch(() => ({})); console.error('kakao search failed', r.status, e.errorType || '', e.message || ''); return []; }
    const j = await r.json();
    return (j.documents || []).map(d => ({
      kakaoId: d.id, name: d.place_name, placeUrl: d.place_url,
      /* 주소·좌표는 화면에 지금 보여 주기만 하고 저장하지 않는다 */
      address: d.road_address_name || d.address_name, category: d.category_name
    }));
  } catch (e) { console.error('kakao search error', e && e.message); return []; }
}
