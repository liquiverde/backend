/**
 * 1.3 Mass assignment / over-posting + 1.10 user enumeration (folded in,
 * since it reuses the same baseline registered user's email).
 * Uses 3 /auth/register calls total — fits in one rate-limit window.
 */
import { client, uniqueEmail } from './utils/http-client';
import { check, finding, saveResults, suite, summaryExitCode } from './utils/test-harness';

function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function main() {
  suite('1.3 Mass assignment / over-posting');

  const email = uniqueEmail('massassign');
  const password = 'SuperSecret123';
  const baseline = await client.post('/auth/register', { email, password, name: 'Mass Assign Test' });
  const token: string = baseline.data.accessToken;
  check('setup: baseline user registered', baseline.status === 201 && !!token);

  // PATCH /users/me with an undeclared field.
  const patchMeRes = await client.patch(
    '/users/me',
    { name: 'Still Me', rewardPoints: 999999 },
    authHeader(token),
  );
  check(
    'PATCH /users/me with rewardPoints → 400 (rejected, not silently ignored)',
    patchMeRes.status === 400,
    `status=${patchMeRes.status}`,
  );

  // POST /auth/register with an undeclared "role" field.
  const roleEmail = uniqueEmail('massassign-role');
  const roleRes = await client.post('/auth/register', {
    email: roleEmail,
    password,
    name: 'Role Injector',
    role: 'admin',
  });
  check('POST /auth/register with role:"admin" → 400', roleRes.status === 400, `status=${roleRes.status}`);

  // POST /lists with an undeclared "userId" field trying to impersonate another owner.
  const fakeOwnerId = '00000000-0000-4000-8000-000000000042';
  const listsRes = await client.post(
    '/lists',
    { budgetMax: 100, userId: fakeOwnerId },
    authHeader(token),
  );
  check('POST /lists with foreign userId field → 400', listsRes.status === 400, `status=${listsRes.status}`);

  // PATCH /lists/:id trying to force status to a value the DTO doesn't allow from the client.
  const createRes = await client.post('/lists', { budgetMax: 5000 }, authHeader(token));
  const listId: string = createRes.data.id;
  const forceStatusRes = await client.patch(
    `/lists/${listId}`,
    { status: 'OPTIMIZED' },
    authHeader(token),
  );
  check(
    'PATCH /lists/:id with status:"OPTIMIZED" → 400 (not in @IsIn allowlist)',
    forceStatusRes.status === 400,
    `status=${forceStatusRes.status}`,
  );

  // POST /lists/:id/items trying to set includedInOptimum directly.
  const productsRes = await client.get('/products/search?limit=1');
  const productId: string = productsRes.data.items[0]?.id;
  const forceIncludedRes = await client.post(
    `/lists/${listId}/items`,
    { productId, quantity: 1, includedInOptimum: true },
    authHeader(token),
  );
  check(
    'POST /lists/:id/items with includedInOptimum → 400',
    forceIncludedRes.status === 400,
    `status=${forceIncludedRes.status}`,
  );

  finding(
    'Static evidence: services never spread DTOs directly into Prisma calls',
    'info',
    'UsersService.update() and ListsRepository.update() build the Prisma `data` object with conditional spreads per field (`...(dto.x !== undefined && {x: dto.x})`), never `...dto` — so even if ValidationPipe were bypassed, unsupported fields would not reach the database. Defense in depth already present, not a pending fix.',
  );

  // 1.10 — user enumeration via duplicate registration.
  const dupRes = await client.post('/auth/register', { email, password, name: 'Duplicate Attempt' });
  check('duplicate email registration → 409', dupRes.status === 409, `status=${dupRes.status}`);
  finding(
    'POST /auth/register reveals whether an email is already registered (409)',
    'info',
    'This is a standard, widely-accepted industry trade-off (clear registration UX vs. low-impact email enumeration), partially mitigated by the 5 req/min rate limit on this endpoint. Documented as an accepted finding, not a bug to fix.',
  );

  saveResults('mass-assignment.json');
  process.exit(summaryExitCode());
}

main().catch((err) => {
  console.error('Fatal error running mass-assignment spec:', err);
  process.exit(1);
});
