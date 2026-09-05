/**
 * Pre-populates a pool of users, each with a 500-item shopping list, for
 * the k6 optimize-load test (02-optimize-load.js).
 *
 * Registration goes through the real HTTP API (only 5 calls, fits the
 * 5/min auth bucket). Populating each list with 500 items goes DIRECTLY
 * through Prisma, bypassing the rate-limited /lists/:id/items endpoint —
 * seeding test data isn't what's being load-tested (POST /optimize is),
 * and 500 x 5 = 2500 HTTP calls against a 100/min global limit would take
 * ~25 minutes of setup alone. This is a standard load-testing pattern:
 * seed out-of-band, measure only the endpoint under test.
 *
 * Run with: pnpm exec ts-node --transpile-only test/load/lib/prepare-optimize-pool.ts
 * Writes: backend/test/load/pool.json (mounted into the k6 container)
 */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const POOL_SIZE = 5; // matches the 5/min register bucket exactly, no waiting needed
const ITEMS_PER_LIST = 500;
// See report for the derivation: with the default KNAPSACK_DISCRETIZATION_STEP_CENTS=50,
// KNAPSACK_MAX_STEP_CENTS=5000, KNAPSACK_MAX_DP_CELLS=4_000_000 and 500 candidates,
// this budget keeps the DP table under the cell limit (auto-adjusted step ~100c,
// capacity ~4000, cells ~2_000_500 <= 4_000_000) so the exact DP branch runs,
// not the greedy fallback. Verified empirically below before writing pool.json.
const BUDGET_MAX = 4000;

const client = axios.create({ baseURL: BASE_URL, validateStatus: () => true });
const prisma = new PrismaClient();

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function main() {
  console.log(`Registering ${POOL_SIZE} pool users via HTTP...`);
  const users: Array<{ token: string; userId: string }> = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const email = uniqueEmail(`k6pool-${i}`);
    const res = await client.post('/auth/register', {
      email,
      password: 'SuperSecret123',
      name: `k6 Pool User ${i}`,
    });
    if (res.status !== 201) {
      throw new Error(`Failed to register pool user ${i}: ${res.status} ${JSON.stringify(res.data)}`);
    }
    users.push({ token: res.data.accessToken, userId: res.data.userId });
  }
  console.log(`  ${users.length} users registered.`);

  console.log('Loading seeded product catalog directly from Postgres...');
  const products = await prisma.product.findMany({ select: { id: true, price: true } });
  if (products.length === 0) {
    throw new Error('No products found — has the seed run? (docker compose run migrate, or pnpm prisma db seed)');
  }
  console.log(`  ${products.length} products available.`);

  console.log(`Creating ${POOL_SIZE} lists with ${ITEMS_PER_LIST} items each (direct Prisma writes)...`);
  const pool: Array<{ token: string; listId: string }> = [];
  for (const user of users) {
    const list = await prisma.shoppingList.create({
      data: { userId: user.userId, budgetMax: BUDGET_MAX },
    });

    const itemsData = Array.from({ length: ITEMS_PER_LIST }, (_, i) => {
      const product = products[i % products.length];
      return {
        listId: list.id,
        productId: product.id,
        quantity: 1,
        unitPrice: product.price,
        priority: 3,
      };
    });
    await prisma.listItem.createMany({ data: itemsData });

    pool.push({ token: user.token, listId: list.id });
    console.log(`  list ${list.id} ready (${ITEMS_PER_LIST} items)`);
  }

  console.log('\nCalibration check: running one real optimize call against the first list...');
  const calibrationRes = await client.post(
    `/lists/${pool[0].listId}/optimize`,
    {},
    { headers: { Authorization: `Bearer ${pool[0].token}` } },
  );
  if (calibrationRes.status !== 201) {
    throw new Error(
      `Calibration optimize call failed: ${calibrationRes.status} ${JSON.stringify(calibrationRes.data)}`,
    );
  }
  console.log(
    `  usedFallback=${calibrationRes.data.usedFallback}, computeTimeMs=${calibrationRes.data.computeTimeMs}`,
  );
  if (calibrationRes.data.usedFallback) {
    console.warn(
      `  WARNING: BUDGET_MAX=${BUDGET_MAX} still triggers the greedy fallback, not the exact DP branch. ` +
        'Lower BUDGET_MAX in this script and re-run, or document the fallback result as-is.',
    );
  } else {
    console.log('  Confirmed: exact DP branch is used at this budget with 500 candidates.');
  }

  const outPath = path.join(__dirname, '..', 'pool.json');
  fs.writeFileSync(outPath, JSON.stringify({ budgetMax: BUDGET_MAX, itemsPerList: ITEMS_PER_LIST, pool }, null, 2));
  console.log(`\nWrote pool of ${pool.length} {token, listId} pairs to ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error preparing optimize pool:', err);
  await prisma.$disconnect();
  process.exit(1);
});
