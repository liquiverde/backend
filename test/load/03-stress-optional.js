import http from 'k6/http';
import { check, sleep } from 'k6';

// Exploratory: find the real breaking point of POST /lists/:id/optimize on
// this host, not a pass/fail gate — no thresholds abort the run. Reuses the
// same pre-populated pool as 02-optimize-load.js (run
// prepare-optimize-pool.ts first if pool.json doesn't exist yet).
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const poolData = JSON.parse(open('./pool.json'));

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '30s', target: 30 },
    { duration: '30s', target: 60 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 0 },
  ],
  // No thresholds — this run is purely observational. Inspect the summary
  // (error rate, p95/p99 per stage) manually afterward to find the knee.
};

export default function () {
  const entry = poolData.pool[__VU % poolData.pool.length];
  const res = http.post(`${BASE_URL}/lists/${entry.listId}/optimize`, null, {
    headers: { Authorization: `Bearer ${entry.token}` },
    tags: { name: 'optimize' },
  });
  check(res, { 'optimize status is 201 or 429': (r) => r.status === 201 || r.status === 429 });
  sleep(0.5);
}
