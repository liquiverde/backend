import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// The global rate limiter is 100 req/min PER IP, and every k6 VU shares the
// same source IP (same machine) — so at 50 VUs we will legitimately hit
// 429s. That's the rate limiter working correctly, not backend failure.
// These two custom metrics separate "real" backend errors from expected
// 429 throttling so the two effects don't get conflated in the report.
const realErrorRate = new Rate('real_error_rate');
const rateLimitedRate = new Rate('rate_limited_rate');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<800'],
    real_error_rate: ['rate<0.01'],
  },
};

export function setup() {
  const res = http.get(`${BASE_URL}/products/search?limit=1`);
  const body = JSON.parse(res.body);
  return { productId: body.items[0].id };
}

export default function (data) {
  const r = Math.random();
  let res;
  if (r < 0.4) {
    res = http.get(`${BASE_URL}/categories`, { tags: { name: 'categories' } });
  } else if (r < 0.8) {
    // No `q` param — stays entirely local, never hits an external API.
    res = http.get(`${BASE_URL}/products/search?page=1&limit=20`, {
      tags: { name: 'products_search' },
    });
  } else {
    res = http.get(`${BASE_URL}/substitution/${data.productId}?limit=5`, {
      tags: { name: 'substitution' },
    });
  }

  const isRateLimited = res.status === 429;
  rateLimitedRate.add(isRateLimited);
  realErrorRate.add(!isRateLimited && res.status >= 400);

  check(res, { 'status is 200 or 429 (rate limited)': (resp) => resp.status === 200 || resp.status === 429 });

  sleep(0.5);
}
