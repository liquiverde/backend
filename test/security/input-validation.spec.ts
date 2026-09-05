/**
 * 1.5 Input validation edge cases.
 * Uses 3 /auth/register calls total (1 baseline + long-name + unicode-name).
 */
import { client, uniqueEmail } from './utils/http-client';
import { check, finding, saveResults, suite, summaryExitCode } from './utils/test-harness';

function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function main() {
  suite('1.5 Input validation');

  const email = uniqueEmail('inputval');
  const password = 'SuperSecret123';
  const baseline = await client.post('/auth/register', { email, password, name: 'Input Validation' });
  const token: string = baseline.data.accessToken;
  check('setup: baseline user registered', baseline.status === 201 && !!token);

  // Wrong type.
  const wrongTypeRes = await client.post('/lists', { budgetMax: 'not-a-number' }, authHeader(token));
  check('POST /lists budgetMax="not-a-number" → 400', wrongTypeRes.status === 400, `status=${wrongTypeRes.status}`);

  // Negative budget.
  const negBudgetRes = await client.post('/lists', { budgetMax: -1000 }, authHeader(token));
  check('POST /lists budgetMax=-1000 → 400', negBudgetRes.status === 400, `status=${negBudgetRes.status}`);

  const listRes = await client.post('/lists', { budgetMax: 5000 }, authHeader(token));
  const listId: string = listRes.data.id;
  const productsRes = await client.get('/products/search?limit=1');
  const productId: string = productsRes.data.items[0]?.id;

  // Negative quantity.
  const negQtyRes = await client.post(
    `/lists/${listId}/items`,
    { productId, quantity: -5 },
    authHeader(token),
  );
  check('POST /lists/:id/items quantity=-5 → 400', negQtyRes.status === 400, `status=${negQtyRes.status}`);

  // Priority out of range.
  const badPriorityRes = await client.post(
    `/lists/${listId}/items`,
    { productId, quantity: 1, priority: 10 },
    authHeader(token),
  );
  check('POST /lists/:id/items priority=10 → 400', badPriorityRes.status === 400, `status=${badPriorityRes.status}`);

  // Oversized array on /products/compare (well past @ArrayMaxSize(5); kept
  // modest to avoid unrelated HTTP-level URL-length edge cases).
  const manyIds = Array.from({ length: 50 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const compareRes = await client.get('/products/compare', { params: { ids: manyIds.join(',') } });
  check(
    'GET /products/compare with 50 ids → 400 (ArrayMaxSize(5))',
    compareRes.status === 400,
    `status=${compareRes.status}`,
  );

  // Deeply nested JSON replacing budgetMax.
  let nested: unknown = 1;
  for (let i = 0; i < 1000; i++) nested = { n: nested };
  const nestedRes = await client.post('/lists', { budgetMax: nested }, authHeader(token));
  if (nestedRes.status === 500) {
    finding(
      'Deeply nested JSON payload on POST /lists causes a 500 instead of a clean 400',
      'low',
      'A 1000-level-deep nested object passed as budgetMax produced a 500 instead of the expected 400 validation rejection — possible stack-depth issue in class-transformer/validator. Low-to-medium severity: easily reproducible, worth a body-size/depth guard, but limited real-world impact for this API surface.',
    );
  } else {
    check('POST /lists with deeply nested budgetMax → 400, not 500', nestedRes.status === 400, `status=${nestedRes.status}`);
  }

  // Long name on registration.
  const longName = 'A'.repeat(100_000);
  const longNameRes = await client.post('/auth/register', {
    email: uniqueEmail('longname'),
    password,
    name: longName,
  });
  if (longNameRes.status === 201) {
    finding(
      'RegisterDto.name has no length limit (accepts a 100,000-char name)',
      'low',
      'RegisterDto.name lacks a @MaxLength decorator and the Prisma schema column has no length constraint either — a client can send an arbitrarily long name (bounded only by the default Express body-size limit). Recommendation: add @MaxLength(120) (or similar) to name fields across DTOs.',
    );
  } else {
    check('long name (100k chars) on registration → rejected (400)', longNameRes.status === 400, `status=${longNameRes.status}`);
  }

  // Unicode / emoji on registration — should work fine (robustness, not a vuln).
  const unicodeRes = await client.post('/auth/register', {
    email: uniqueEmail('unicode'),
    password,
    name: '😀🎉 Ünïcödé Tëst 名前',
  });
  check('unicode/emoji name on registration → 201 (handled correctly)', unicodeRes.status === 201, `status=${unicodeRes.status}`);

  saveResults('input-validation.json');
  process.exit(summaryExitCode());
}

main().catch((err) => {
  console.error('Fatal error running input-validation spec:', err);
  process.exit(1);
});
