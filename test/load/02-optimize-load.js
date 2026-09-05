import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Written by `pnpm exec ts-node --transpile-only test/load/lib/prepare-optimize-pool.ts`
// BEFORE running this script — see that file for why the 500-item lists are
// pre-populated directly via Prisma instead of through k6's setup().
const poolData = JSON.parse(open('./pool.json'));

// Server-side pure compute time (from OptimizeListResponseDto.computeTimeMs),
// which excludes HTTP/DB/Redis overhead — lets the report distinguish
// "DP engine is slow" from "concurrency contention in Postgres/Redis".
const computeTimeMsTrend = new Trend('optimize_compute_time_ms');
const usedFallbackRate = new Trend('optimize_used_fallback');

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '40s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    // RNF-01: p95 < 2s, tagged to isolate ONLY the optimize call itself.
    'http_req_duration{name:optimize}': ['p(95)<2000'],
    http_req_failed: ['rate<0.05'], // some 429s expected from the shared global bucket, see report
  },
};

export function setup() {
  console.log(
    `pool: ${poolData.pool.length} lists x ${poolData.itemsPerList} items, budgetMax=${poolData.budgetMax}`,
  );
}

export default function () {
  const entry = poolData.pool[__VU % poolData.pool.length];
  const res = http.post(`${BASE_URL}/lists/${entry.listId}/optimize`, null, {
    headers: { Authorization: `Bearer ${entry.token}` },
    tags: { name: 'optimize' },
  });

  check(res, { 'optimize status is 201 or 429': (r) => r.status === 201 || r.status === 429 });

  if (res.status === 201) {
    const body = JSON.parse(res.body);
    computeTimeMsTrend.add(body.computeTimeMs);
    usedFallbackRate.add(body.usedFallback ? 1 : 0);
  }

  sleep(1);
}
