/**
 * 1.2 IDOR / ownership bypass — user B attempting every verb/sub-route
 * under ListOwnershipGuard against a list owned by user A.
 */
import { client, uniqueEmail } from './utils/http-client';
import { check, saveResults, suite, summaryExitCode } from './utils/test-harness';

async function registerAndLogin(prefix: string) {
  const email = uniqueEmail(prefix);
  const password = 'SuperSecret123';
  const res = await client.post('/auth/register', { email, password, name: prefix });
  return { email, token: res.data.accessToken as string, userId: res.data.userId as string };
}

function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function main() {
  suite('1.2 IDOR / ownership bypass');

  const userA = await registerAndLogin('idor-a');
  const userB = await registerAndLogin('idor-b');
  check('setup: both users registered', !!userA.token && !!userB.token);

  // A creates a list with an item.
  const listRes = await client.post('/lists', { budgetMax: 10000 }, authHeader(userA.token));
  const listId: string = listRes.data.id;
  check('setup: user A created a list', listRes.status === 201 && !!listId);

  const productsRes = await client.get('/products/search?limit=1');
  const productId: string = productsRes.data.items[0]?.id;
  check('setup: a seeded product exists to add', !!productId);

  const itemRes = await client.post(
    `/lists/${listId}/items`,
    { productId, quantity: 1 },
    authHeader(userA.token),
  );
  const itemId: string = itemRes.data.items?.[itemRes.data.items.length - 1]?.id;
  check('setup: user A added an item to their list', itemRes.status === 201 && !!itemId);

  // B attempts every verb/sub-route under ListOwnershipGuard against A's list.
  const attempts: Array<{ name: string; run: () => Promise<{ status: number }> }> = [
    { name: 'GET /lists/:id', run: () => client.get(`/lists/${listId}`, authHeader(userB.token)) },
    {
      name: 'PATCH /lists/:id',
      run: () => client.patch(`/lists/${listId}`, { budgetMax: 1 }, authHeader(userB.token)),
    },
    {
      name: 'POST /lists/:id/items',
      run: () =>
        client.post(`/lists/${listId}/items`, { productId, quantity: 1 }, authHeader(userB.token)),
    },
    {
      name: 'DELETE /lists/:id/items/:itemId',
      run: () => client.delete(`/lists/${listId}/items/${itemId}`, authHeader(userB.token)),
    },
    { name: 'POST /lists/:id/optimize', run: () => client.post(`/lists/${listId}/optimize`, {}, authHeader(userB.token)) },
    { name: 'GET /lists/:id/savings', run: () => client.get(`/lists/${listId}/savings`, authHeader(userB.token)) },
    {
      name: 'POST /lists/:id/items/:itemId/substitute',
      run: () =>
        client.post(
          `/lists/${listId}/items/${itemId}/substitute`,
          { substituteProductId: productId },
          authHeader(userB.token),
        ),
    },
  ];

  for (const attempt of attempts) {
    const res = await attempt.run();
    check(`B on A's list — ${attempt.name} → 403`, res.status === 403, `status=${res.status}`);
  }

  // DELETE /lists/:id last (destructive), still against B.
  const deleteRes = await client.delete(`/lists/${listId}`, authHeader(userB.token));
  check('B on A\'s list — DELETE /lists/:id → 403', deleteRes.status === 403, `status=${deleteRes.status}`);

  // Collection-level isolation: GET /lists (no guard, filtered by service) never leaks A's list to B.
  const bListsRes = await client.get('/lists', authHeader(userB.token));
  const leaked = Array.isArray(bListsRes.data) && bListsRes.data.some((l: { id: string }) => l.id === listId);
  check('GET /lists for B never includes A\'s list id', !leaked, leaked ? 'LEAKED' : 'not present');

  // Sanity: A can still access their own list normally (guard isn't over-blocking the owner).
  const aOwnRes = await client.get(`/lists/${listId}`, authHeader(userA.token));
  check('A can still access their own list (200)', aOwnRes.status === 200, `status=${aOwnRes.status}`);

  saveResults('idor-lists.json');
  process.exit(summaryExitCode());
}

main().catch((err) => {
  console.error('Fatal error running idor-lists spec:', err);
  process.exit(1);
});
