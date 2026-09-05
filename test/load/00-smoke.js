import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 2,
  iterations: 10,
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
  check(health, { 'health status is 200': (r) => r.status === 200 });

  // No `q` param — guarantees this stays entirely local (see products.service.ts),
  // never triggers a real Open Food Facts/USDA call.
  const search = http.get(`${BASE_URL}/products/search?limit=5`, { tags: { name: 'products_search' } });
  check(search, { 'search status is 200': (r) => r.status === 200 });

  sleep(0.5);
}
