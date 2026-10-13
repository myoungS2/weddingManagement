/**
 * Wedding Management · © 2026 myoung. All rights reserved.
 * /api/* 를 기능별 처리로 나눠 보낸다.
 */
import { handleFilesApi } from './files.js';
import { handleFxApi } from './fx.js';
import { handleItemsApi } from './items.js';
import { handlePlanApi } from './plan.js';
import { handleRefApi } from './ref.js';
import { handleVenuesApi } from './venues.js';
import { json } from '../lib/http.js';

/* 각 처리는 자기 주소가 아니면 null 을 돌려준다. 순서대로 물어보고 처음 답한 것을 쓴다. */
const HANDLERS = [handlePlanApi, handleItemsApi, handleFilesApi, handleRefApi, handleFxApi, handleVenuesApi];

export async function handleApi(req, env, url, u) {
  for (const h of HANDLERS) {
    const r = await h(req, env, url, u);
    if (r) return r;
  }
  return json({ error: '없는 경로입니다' }, 404);
}
