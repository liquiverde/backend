/**
 * 1.6-B Rate limit — global 100/min (GET /health).
 * Run LAST in the security phase — this deliberately saturates the shared
 * global rate-limit bucket for the test-runner's IP.
 */
import { client } from './utils/http-client';
import { check, saveResults, suite, summaryExitCode } from './utils/test-harness';

async function testB_globalLimit() {
  suite('1.6-B Rate limit — global 100/min (GET /health)');

  const TOTAL = 110;
  const requests = Array.from({ length: TOTAL }, () => client.get('/health'));
  const responses = await Promise.all(requests);

  const okCount = responses.filter((r) => r.status === 200).length;
  const throttledCount = responses.filter((r) => r.status === 429).length;

  console.log(`  ${okCount} x 200, ${throttledCount} x 429 (of ${TOTAL} requests)`);

  check('Some requests succeeded (200)', okCount > 0, `${okCount} succeeded`);
  check('Some requests were throttled (429) once past the limit', throttledCount > 0, `${throttledCount} throttled`);
  check(
    'Roughly ~100 requests succeeded before throttling kicked in',
    okCount >= 90 && okCount <= 110,
    `${okCount} succeeded (expected close to 100)`,
  );

  const firstThrottled = responses.find((r) => r.status === 429);
  if (firstThrottled) {
    const retryAfter = firstThrottled.headers['retry-after'];
    check('429 response includes Retry-After header', !!retryAfter, `Retry-After=${retryAfter}`);
    if (retryAfter) {
      const seconds = Number(retryAfter);
      check('Retry-After is <= RATE_LIMIT_TTL (60s)', !Number.isNaN(seconds) && seconds <= 60, `${seconds}s`);
    }
  }
}

async function main() {
  await testB_globalLimit();
  saveResults('rate-limit-b.json');
  process.exit(summaryExitCode());
}

main().catch((err) => {
  console.error('Fatal error running rate-limit-global spec:', err);
  process.exit(1);
});
